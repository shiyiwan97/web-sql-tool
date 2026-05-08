import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { AppConfig, TableCatalogEntry } from "../types";
import { defaultAliasFor } from "../lib/sqlEditorOps";
import { applyTypeMapping, pkBadgeResolved, styleFromText } from "./PanelStyleModal";
import {
  findGlobalSearchGroupsByPrefix,
  matchGlobalSearchGroup,
  splitOrKeywords,
} from "../lib/globalSearchGroup";

type Props = {
  config: AppConfig;
  onPickTable: (qualifiedName: string) => void;
  onPickField: (table: string, field: string) => void;
  /** 当前 SQL 块中出现的表名（大写短名，如 GRADECLS），用于上下文感知排序 */
  contextTables?: string[];
};

type FieldHit = { field: string };

type GroupSource =
  | "normal" // 普通搜索（含 | 多关键字）
  | "fieldGroup" // 表级字段组（trigger + key 命中表上的字段组）
  | "globalGroup" // 全局搜索组（trigger + key，跨表跨字段关键词）
  | "globalGroupTable"; // 全局搜索组的表级命中（整张表）

type Group = {
  table: TableCatalogEntry;
  fields: FieldHit[];
  matchedByFieldOnly: boolean;
  /** 是否属于"当前语句上下文"表 */
  isContext: boolean;
  /** 表的总字段数（fields 可能被截断，badge 仍显示完整数量） */
  totalFieldCount: number;
  /** 是否被截断（fields.length < totalFieldCount） */
  truncated: boolean;
  /** 该结果来源（用于排序与展示徽标） */
  source: GroupSource;
  /** 同 source 内的子组标识，用于在多个全局搜索组之间不混淆 */
  groupKeyLabel?: string;
};

/** 单表内最多渲染字段数，避免单张表上千字段把 DOM 撑爆 */
const MAX_FIELDS_PER_GROUP = 200;
/** 首次渲染分组数 */
const INITIAL_GROUPS = 200;
/** 每次「加载更多」追加分组数 */
const LOAD_MORE_STEP = 200;
/** 输入防抖（ms） */
const SEARCH_DEBOUNCE_MS = 180;

/** 预先大写化的搜索索引，仅当 tableCatalog 引用变化时重建 */
type IndexedField = { field: string; FU: string; cU: string };
type IndexedEntry = {
  entry: TableCatalogEntry;
  tNameU: string;
  tQnU: string;
  tCommentU: string;
  fieldsU: IndexedField[];
  /** 该表上有的字段组 key（大写） */
  groupKeysU: string[];
  /** 字段组 key(大写) → 该组字段(大写) 集合 */
  groupFieldSets: Map<string, Set<string>>;
};

/** 字段组关键字模式：触发符 + 组名 */
function parseGroupTrigger(
  q: string,
  trigger: string,
): string | null {
  if (!trigger || !q.startsWith(trigger)) return null;
  const key = q.slice(trigger.length).trim();
  return key.length > 0 ? key : null;
}

/** 把 text 按 needles（不区分大小写）的命中位置切分；命中段用 <mark> 包裹。
 *  - needles 为空或 text 为空时直接返回 text。
 *  - 多个 needle 之间会在最长匹配优先的策略下合并连续命中（先排序、再贪心）。
 */
function highlight(text: string, needles: string | string[] | null | undefined): ReactNode {
  if (!text) return text;
  const list: string[] = [];
  if (typeof needles === "string") {
    if (needles) list.push(needles);
  } else if (Array.isArray(needles)) {
    for (const n of needles) if (n) list.push(n);
  }
  if (list.length === 0) return text;
  // 长 needle 优先，避免短 needle 抢占重叠区段
  const sorted = [...list].sort((a, b) => b.length - a.length);
  const upper = text.toUpperCase();
  // 收集所有 [start, end) 命中区间
  const spans: Array<[number, number]> = [];
  for (const n of sorted) {
    const NU = n.toUpperCase();
    if (!NU) continue;
    let from = 0;
    while (true) {
      const i = upper.indexOf(NU, from);
      if (i < 0) break;
      spans.push([i, i + NU.length]);
      from = i + Math.max(1, NU.length);
    }
  }
  if (spans.length === 0) return text;
  // 排序 + 合并重叠
  spans.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: Array<[number, number]> = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s[0] <= last[1]) {
      if (s[1] > last[1]) last[1] = s[1];
    } else {
      merged.push([s[0], s[1]]);
    }
  }
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (let i = 0; i < merged.length; i++) {
    const [s, e] = merged[i];
    if (s > cursor) parts.push(text.slice(cursor, s));
    parts.push(
      <mark
        key={`m-${i}`}
        style={{
          background: "#facc15",
          color: "#000",
          padding: "0 1px",
          borderRadius: 2,
        }}
      >
        {text.slice(s, e)}
      </mark>,
    );
    cursor = e;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

export function SidebarSearch({ config, onPickTable, onPickField, contextTables }: Props) {
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [visibleCount, setVisibleCount] = useState(INITIAL_GROUPS);
  const ps = config.panelStyles.search;
  const fieldTrigger = config.fieldGroupTrigger ?? "#";
  const tableTrigger = config.tableGroupTrigger ?? "$";

  // 输入防抖：避免每次按键都重新扫描整库
  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [q]);

  // 查询变化时重置分页
  useEffect(() => {
    setVisibleCount(INITIAL_GROUPS);
  }, [qDebounced]);

  const contextSet = useMemo(
    () => new Set((contextTables ?? []).map((t) => t.toUpperCase())),
    [contextTables],
  );

  // 一次性构建大写索引（仅当 tableCatalog 引用变化时重建）
  const searchIndex = useMemo<IndexedEntry[]>(() => {
    const out: IndexedEntry[] = [];
    for (const e of config.tableCatalog) {
      const info = e.fieldInfo ?? {};
      const fieldsU: IndexedField[] = new Array(e.fields.length);
      for (let i = 0; i < e.fields.length; i++) {
        const f = e.fields[i];
        const FU = String(f).toUpperCase();
        fieldsU[i] = {
          field: f,
          FU,
          cU: String(info[FU]?.comment ?? "").toUpperCase(),
        };
      }
      const groupKeysU: string[] = [];
      const groupFieldSets = new Map<string, Set<string>>();
      for (const g of e.fieldGroups ?? []) {
        const key = g.key.toUpperCase();
        let set = groupFieldSets.get(key);
        if (!set) {
          set = new Set<string>();
          groupFieldSets.set(key, set);
          groupKeysU.push(key);
        }
        for (const f of g.fields) set.add(f.toUpperCase());
      }
      out.push({
        entry: e,
        tNameU: e.table.toUpperCase(),
        tQnU: (e.qualifiedName ?? "").toUpperCase(),
        tCommentU: String(e.comment ?? "").toUpperCase(),
        fieldsU,
        groupKeysU,
        groupFieldSets,
      });
    }
    return out;
  }, [config.tableCatalog]);

  const groups = useMemo<Group[]>(() => {
    const needle = qDebounced.trim();

    const tableGK = parseGroupTrigger(needle, tableTrigger);
    const fieldGK = parseGroupTrigger(needle, fieldTrigger);
    const isTriggered = tableGK !== null || fieldGK !== null;

    if (isTriggered) {
      const out: Group[] = [];

      // ── 表组触发（$key）：全局搜索组，只搜表名/表注释 ──
      if (tableGK !== null) {
        const matchedGroups = findGlobalSearchGroupsByPrefix(tableGK, config.globalSearchGroups ?? []);
        for (const gg of matchedGroups) {
          const hits = matchGlobalSearchGroup(gg, config.tableCatalog, MAX_FIELDS_PER_GROUP, "table");
          for (const th of hits.tableHits) {
            const e = th.entry;
            const isContext = contextSet.has(e.table.toUpperCase());
            let fields: FieldHit[];
            let truncated = false;
            if (e.fields.length > MAX_FIELDS_PER_GROUP) {
              fields = new Array(MAX_FIELDS_PER_GROUP);
              for (let i = 0; i < MAX_FIELDS_PER_GROUP; i++) fields[i] = { field: e.fields[i] };
              truncated = true;
            } else {
              fields = e.fields.map((f) => ({ field: f }));
            }
            out.push({ table: e, matchedByFieldOnly: false, fields, isContext,
              totalFieldCount: e.fields.length, truncated, source: "globalGroupTable",
              groupKeyLabel: gg.key });
          }
        }
      }

      // ── 字段组触发（#key）：表级字段组 + 全局搜索组字段搜索 ──
      if (fieldGK !== null) {
        const GK = fieldGK.toUpperCase();
        // 表级字段组
        for (const ie of searchIndex) {
          const set = ie.groupFieldSets.get(GK);
          if (!set || set.size === 0) continue;
          const fields: FieldHit[] = [];
          for (const fu of ie.fieldsU) {
            if (set.has(fu.FU)) { fields.push({ field: fu.field }); if (fields.length >= MAX_FIELDS_PER_GROUP) break; }
          }
          if (fields.length === 0) continue;
          const isContext = contextSet.has(ie.tNameU);
          out.push({ table: ie.entry, matchedByFieldOnly: false, fields, isContext,
            totalFieldCount: ie.entry.fields.length, truncated: fields.length >= MAX_FIELDS_PER_GROUP,
            source: "fieldGroup" });
        }
        // 全局搜索组字段搜索
        const matchedGG = findGlobalSearchGroupsByPrefix(fieldGK, config.globalSearchGroups ?? []);
        for (const gg of matchedGG) {
          const hits = matchGlobalSearchGroup(gg, config.tableCatalog, MAX_FIELDS_PER_GROUP, "field");
          for (const fh of hits.fieldHits) {
            const e = fh.entry;
            const isContext = contextSet.has(e.table.toUpperCase());
            out.push({ table: e, matchedByFieldOnly: true,
              fields: fh.fields.map((f) => ({ field: f })), isContext,
              totalFieldCount: e.fields.length, truncated: fh.fields.length >= MAX_FIELDS_PER_GROUP,
              source: "globalGroup", groupKeyLabel: gg.key });
          }
        }
      }

      // 排序：fieldGroup → globalGroupTable → globalGroup；同优先级 ctx 前置
      const sourcePriority = (s: GroupSource): number =>
        s === "fieldGroup" ? 0 : s === "globalGroupTable" ? 1 : s === "globalGroup" ? 2 : 3;
      out.sort((a, b) => {
        const pa = sourcePriority(a.source);
        const pb = sourcePriority(b.source);
        if (pa !== pb) return pa - pb;
        if (a.isContext !== b.isContext) return a.isContext ? -1 : 1;
        return 0;
      });
      return out;
    }

    // ── 普通搜索（支持 | 作为 OR 多关键词）──
    const orKeywords = splitOrKeywords(needle);
    const orKeywordsU = orKeywords.map((k) => k.toUpperCase());
    const emptyNeedle = orKeywordsU.length === 0;
    const matchAny = (s: string): boolean => {
      if (emptyNeedle) return true;
      for (const NU of orKeywordsU) if (s.includes(NU)) return true;
      return false;
    };

    const raw: Group[] = [];
    for (const ie of searchIndex) {
      const isContext = contextSet.has(ie.tNameU);
      const tableHit = emptyNeedle || matchAny(ie.tNameU) || matchAny(ie.tQnU) || matchAny(ie.tCommentU);
      if (tableHit) {
        // 命中表名时展开字段，限制每表最多 MAX_FIELDS_PER_GROUP 行
        let fields: FieldHit[];
        let truncated = false;
        if (ie.fieldsU.length > MAX_FIELDS_PER_GROUP) {
          fields = new Array(MAX_FIELDS_PER_GROUP);
          for (let i = 0; i < MAX_FIELDS_PER_GROUP; i++) {
            fields[i] = { field: ie.fieldsU[i].field };
          }
          truncated = true;
        } else {
          fields = ie.fieldsU.map((fu) => ({ field: fu.field }));
        }
        raw.push({ table: ie.entry, matchedByFieldOnly: false, fields, isContext,
          totalFieldCount: ie.entry.fields.length, truncated, source: "normal" });
        continue;
      }
      // 仅字段命中
      const matched: FieldHit[] = [];
      for (const fu of ie.fieldsU) {
        if (matchAny(fu.FU) || matchAny(fu.cU)) {
          matched.push({ field: fu.field });
          if (matched.length >= MAX_FIELDS_PER_GROUP) break;
        }
      }
      if (matched.length > 0) {
        raw.push({ table: ie.entry, matchedByFieldOnly: true, fields: matched, isContext,
          totalFieldCount: ie.entry.fields.length, truncated: matched.length >= MAX_FIELDS_PER_GROUP,
          source: "normal" });
      }
    }
    // 上下文表排前面
    if (contextSet.size > 0 && !emptyNeedle) {
      const ctx: Group[] = [];
      const other: Group[] = [];
      for (const g of raw) (g.isContext ? ctx : other).push(g);
      return ctx.concat(other);
    }
    return raw;
  }, [searchIndex, qDebounced, fieldTrigger, tableTrigger, contextSet, config.globalSearchGroups, config.tableCatalog]);

  const totalFields = useMemo(() => {
    let n = 0;
    for (const g of groups) n += g.fields.length;
    return n;
  }, [groups]);
  const groupKey = parseGroupTrigger(qDebounced.trim(), fieldTrigger) ??
    parseGroupTrigger(qDebounced.trim(), tableTrigger);
  /** 用于在条目内高亮的关键词集合：
   *  - 触发模式：本次检索到的全局搜索组关键词（去重） + 字段组 key 本身。
   *  - 普通模式：按 | 拆分用户输入。
   */
  const highlightNeedles = useMemo<string[]>(() => {
    const trimmed = qDebounced.trim();
    const tableGK = parseGroupTrigger(trimmed, tableTrigger);
    const fieldGK = parseGroupTrigger(trimmed, fieldTrigger);
    const activeGK = fieldGK ?? tableGK;
    if (activeGK !== null) {
      const list: string[] = [activeGK];
      const seen = new Set<string>([activeGK.toLowerCase()]);
      const matched = findGlobalSearchGroupsByPrefix(activeGK, config.globalSearchGroups ?? []);
      for (const gg of matched) {
        for (const kw of gg.keywords) {
          const u = kw.toLowerCase();
          if (!seen.has(u) && kw.trim()) { seen.add(u); list.push(kw); }
        }
      }
      return list;
    }
    return splitOrKeywords(trimmed);
  }, [qDebounced, fieldTrigger, tableTrigger, config.globalSearchGroups]);
  const { contextGroups, nonContextGroups } = useMemo(() => {
    const ctx: Group[] = [];
    const other: Group[] = [];
    for (const g of groups) (g.isContext ? ctx : other).push(g);
    return { contextGroups: ctx, nonContextGroups: other };
  }, [groups]);
  const hasContextSplit = contextSet.size > 0 && contextGroups.length > 0 && nonContextGroups.length > 0;
  const isStale = q !== qDebounced;
  const totalGroups = groups.length;
  const visibleGroups = useMemo(() => groups.slice(0, visibleCount), [groups, visibleCount]);
  const visibleContext = useMemo(
    () => (hasContextSplit ? contextGroups.slice(0, visibleCount) : []),
    [hasContextSplit, contextGroups, visibleCount],
  );
  const visibleNonContext = useMemo(() => {
    if (!hasContextSplit) return [];
    const remain = Math.max(0, visibleCount - contextGroups.length);
    return nonContextGroups.slice(0, remain);
  }, [hasContextSplit, contextGroups, nonContextGroups, visibleCount]);
  const renderedCount = hasContextSplit
    ? visibleContext.length + visibleNonContext.length
    : visibleGroups.length;
  const hasMore = renderedCount < totalGroups;

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "10px 12px 8px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-panel)",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--text-muted)",
            margin: "0 0 6px 0",
          }}
        >
          搜索（表名 / 字段 / 注释）
        </div>
        <input
          className="input"
          type="search"
          placeholder={`按表名 / 字段 / remark 搜索（用 | 分隔多关键字）… ${tableTrigger}组名 查表组 · ${fieldTrigger}组名 查字段组`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={inputStyle}
        />
        <div
          style={{
            marginTop: 6,
            fontSize: 10,
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          {groupKey !== null ? (
            <span style={{ color: "#fbbf24" }}>
              组&thinsp;
              <code style={{ fontFamily: "var(--mono)" }}>
                {parseGroupTrigger(qDebounced.trim(), tableTrigger) !== null ? tableTrigger : fieldTrigger}{groupKey}
              </code>
              &thinsp;·&thinsp;{groups.length} 张表 · {totalFields} 个字段
            </span>
          ) : qDebounced.trim() ? (
            <span>匹配 {groups.length} 张表 · {totalFields} 个字段</span>
          ) : (
            <span>共 {config.tableCatalog.length} 张表</span>
          )}
          {isStale ? (
            <span style={{ color: "#94a3b8" }}>· 搜索中…</span>
          ) : null}
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto" }}>
        {groups.length === 0 ? (
          <div
            style={{
              padding: 16,
              fontSize: 12,
              color: "var(--text-muted)",
              textAlign: "center",
            }}
          >
            {groupKey !== null
              ? `没有找到 "${groupKey}" 对应的字段组、表组或全局搜索组结果`
              : "没有匹配的结果"}
          </div>
        ) : (
          <>
            {hasContextSplit ? (
              <>
                {visibleContext.map((g) => (
                  <TableGroup
                    key={`${g.source}-${g.groupKeyLabel ?? ""}-${g.table.table}`}
                    g={g}
                    ps={ps}
                    highlightNeedles={highlightNeedles}
                    onPickTable={onPickTable}
                    onPickField={onPickField}
                    isContext
                  />
                ))}
                {visibleNonContext.length > 0 ? (
                  <ContextDivider divider={ps.contextDivider} />
                ) : null}
                {visibleNonContext.map((g) => (
                  <TableGroup
                    key={`${g.source}-${g.groupKeyLabel ?? ""}-${g.table.table}`}
                    g={g}
                    ps={ps}
                    highlightNeedles={highlightNeedles}
                    onPickTable={onPickTable}
                    onPickField={onPickField}
                    isContext={false}
                  />
                ))}
              </>
            ) : (
              visibleGroups.map((g) => (
                <TableGroup
                  key={`${g.source}-${g.groupKeyLabel ?? ""}-${g.table.table}`}
                  g={g}
                  ps={ps}
                  highlightNeedles={highlightNeedles}
                  onPickTable={onPickTable}
                  onPickField={onPickField}
                  isContext={g.isContext}
                />
              ))
            )}
            {hasMore ? (
              <div style={{ padding: "10px 12px", textAlign: "center" }}>
                <button
                  className="btn"
                  type="button"
                  onClick={() => setVisibleCount((n) => n + LOAD_MORE_STEP)}
                  style={{ fontSize: 12, padding: "6px 14px" }}
                  title={`已显示 ${renderedCount} / ${totalGroups}`}
                >
                  加载更多（{renderedCount} / {totalGroups}）
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// 子组件
// ──────────────────────────────────────────────

function ContextDivider({
  divider,
}: {
  divider: AppConfig["panelStyles"]["search"]["contextDivider"];
}) {
  const color = divider.color || "#86efac";
  const width = Math.max(1, divider.width);
  return (
    <div
      aria-hidden
      style={{
        width: "100%",
        height: 0,
        borderTop: `${width}px ${divider.style} ${color}`,
      }}
    />
  );
}

type TableGroupProps = {
  g: Group;
  ps: AppConfig["panelStyles"]["search"];
  /** 用于条目内高亮的关键词集合（多关键字 / 字段组关键词等） */
  highlightNeedles: string[];
  onPickTable: (qualifiedName: string) => void;
  onPickField: (table: string, field: string) => void;
  isContext: boolean;
};

function TableGroup({ g, ps, highlightNeedles, onPickTable, onPickField, isContext }: TableGroupProps) {
  const e = g.table;
  const display = e.qualifiedName ?? e.table;
  const groupBadgeText = (() => {
    switch (g.source) {
      case "fieldGroup": return "字段组";
      case "globalGroupTable": return g.groupKeyLabel ? `全局组·表 · ${g.groupKeyLabel}` : "全局组·表";
      case "globalGroup": return g.groupKeyLabel ? `全局组·字段 · ${g.groupKeyLabel}` : "全局组·字段";
      default: return g.matchedByFieldOnly ? "字段命中" : "表";
    }
  })();
  return (
    <section>
      <header
        style={{
          ...tableHeaderStyle,
          ...(isContext ? { borderLeft: "3px solid #86efac" } : {}),
          ...(ps.tableItemHeight > 0
            ? { height: ps.tableItemHeight, minHeight: ps.tableItemHeight }
            : {}),
        }}
        onClick={() => onPickTable(e.qualifiedName ?? e.table)}
        title="点击：把该表插入当前 SQL 块（FROM/JOIN）"
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            minWidth: 0,
            flex: 1,
          }}
        >
          <code style={{ ...tableNameStyle, ...styleFromText(ps.tableName) }}>
            {highlight(display, highlightNeedles)}
          </code>
          {e.comment ? (
            <span
              style={{
                ...tableCommentStyle,
                ...styleFromText(ps.tableComment),
                whiteSpace: ps.commentWrap ? "normal" : "nowrap",
                overflow: ps.commentWrap ? "visible" : "hidden",
                textOverflow: ps.commentWrap ? "clip" : "ellipsis",
              }}
            >
              {highlight(e.comment, highlightNeedles)}
            </span>
          ) : null}
        </div>
        <span style={tableBadgeStyle}>
          {groupBadgeText} · {g.totalFieldCount}
          {g.truncated && g.fields.length < g.totalFieldCount ? "*" : ""}
        </span>
      </header>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {g.fields.map((fh) => {
          const F = String(fh.field).toUpperCase();
          const info = e.fieldInfo?.[F];
          const isPk = !!info?.isKey;
          const fc = info?.comment ?? "";
          const typ = info?.type ?? "";
          const len = info?.length ?? null;
          const prec = info?.precision ?? null;
          const typRaw = typ
            ? `${typ}${len != null ? `(${len}${prec ? "," + prec : ""})` : ""}`
            : "";
          const typLabel = typRaw ? applyTypeMapping(typRaw, ps.typeMappings) : "";
          const pk = isPk ? pkBadgeResolved(ps.primaryKeyBadge) : null;
          return (
            <li
              key={fh.field}
              style={{
                ...fieldItemStyle,
                ...(isContext ? { borderLeft: "3px solid rgba(134,239,172,0.3)" } : {}),
                ...(ps.fieldItemHeight > 0
                  ? { height: ps.fieldItemHeight, minHeight: ps.fieldItemHeight }
                  : {}),
              }}
              onClick={() => onPickField(e.table, fh.field)}
              title="点击：把字段加入当前 SELECT"
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: ps.commentWrap ? "column" : "row",
                  alignItems: ps.commentWrap ? "stretch" : "baseline",
                  gap: ps.commentWrap ? 2 : 6,
                  minWidth: 0,
                  flex: 1,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 6,
                    minWidth: 0,
                  }}
                >
                  {pk ? <span style={pk.boxStyle}>{pk.label}</span> : null}
                  <code style={{ ...fieldNameStyle, ...styleFromText(ps.fieldName) }}>
                    {defaultAliasFor(e.table)}.{highlight(fh.field, highlightNeedles)}
                  </code>
                  {typLabel ? (
                    <span
                      style={{ ...typeStyle, ...styleFromText(ps.fieldType) }}
                      title={typRaw}
                    >
                      {typLabel}
                    </span>
                  ) : null}
                </div>
                {fc ? (
                  <span
                    style={{
                      ...fieldCommentStyle,
                      ...styleFromText(ps.fieldComment),
                      whiteSpace: ps.commentWrap ? "normal" : "nowrap",
                      overflow: ps.commentWrap ? "visible" : "hidden",
                      textOverflow: ps.commentWrap ? "clip" : "ellipsis",
                    }}
                  >
                    {highlight(fc, highlightNeedles)}
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
        {g.truncated && g.fields.length < g.totalFieldCount ? (
          <li
            style={{
              padding: "4px 10px 6px 12px",
              fontSize: 10,
              color: "var(--text-muted)",
              fontStyle: "italic",
              borderBottom: "1px solid var(--border)",
            }}
            title="为保证流畅，单表最多显示 200 个字段。点击表头插入完整表，或在搜索框输入更精确的关键词。"
          >
            … 仅显示 {g.fields.length} / {g.totalFieldCount} 个字段
          </li>
        ) : null}
      </ul>
    </section>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  fontSize: 12,
  color: "var(--text)",
  background: "var(--bg-app)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  outline: "none",
};

const tableHeaderStyle: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 2,
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 10px 8px 6px",
  background: "var(--bg-elevated)",
  borderBottom: "1px solid var(--border)",
  borderTop: "1px solid var(--border)",
  cursor: "pointer",
  boxShadow: "0 1px 0 var(--border)",
};

const tableNameStyle: CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 12,
  fontWeight: 700,
  color: "#93c5fd",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const tableCommentStyle: CSSProperties = {
  fontSize: 11,
  color: "var(--text-muted)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const tableBadgeStyle: CSSProperties = {
  flexShrink: 0,
  fontSize: 10,
  padding: "2px 6px",
  borderRadius: 4,
  background: "var(--bg-app)",
  color: "var(--text-muted)",
  border: "1px solid var(--border)",
};

const fieldItemStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 10px 6px 12px",
  fontSize: 12,
  borderBottom: "1px solid var(--border)",
  cursor: "pointer",
};

const fieldNameStyle: CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 11,
  color: "#a7f3d0",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const fieldCommentStyle: CSSProperties = {
  fontSize: 11,
  color: "var(--text-muted)",
  marginLeft: 2,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const typeStyle: CSSProperties = {
  fontSize: 10,
  color: "var(--text-muted)",
  fontFamily: "var(--mono)",
  padding: "0 4px",
  border: "1px solid var(--border)",
  borderRadius: 3,
};
