import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { AppConfig, TableCatalogEntry } from "../types";
import { defaultAliasFor } from "../lib/sqlEditorOps";
import { applyTypeMapping, pkBadgeResolved, styleFromText } from "./PanelStyleModal";

type Props = {
  config: AppConfig;
  onPickTable: (qualifiedName: string) => void;
  onPickField: (table: string, field: string) => void;
  /** 当前 SQL 块中出现的表名（大写短名，如 GRADECLS），用于上下文感知排序 */
  contextTables?: string[];
};

type FieldHit = { field: string };

type Group = {
  table: TableCatalogEntry;
  fields: FieldHit[];
  matchedByFieldOnly: boolean;
  /** 是否属于"当前语句上下文"表 */
  isContext: boolean;
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

function highlight(text: string, needle: string): ReactNode {
  if (!needle) return text;
  const i = text.toUpperCase().indexOf(needle.toUpperCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark
        style={{
          background: "#facc15",
          color: "#000",
          padding: "0 1px",
          borderRadius: 2,
        }}
      >
        {text.slice(i, i + needle.length)}
      </mark>
      {text.slice(i + needle.length)}
    </>
  );
}

export function SidebarSearch({ config, onPickTable, onPickField, contextTables }: Props) {
  const [q, setQ] = useState("");
  const ps = config.panelStyles.search;
  const trigger = config.fieldGroupTrigger ?? "#";

  const contextSet = useMemo(
    () => new Set((contextTables ?? []).map((t) => t.toUpperCase())),
    [contextTables],
  );

  const groups = useMemo<Group[]>(() => {
    const needle = q.trim();
    const NU = needle.toUpperCase();

    // 字段组触发模式：输入 "#groupKey" 时，展示所有含该组的表的对应字段
    const groupKey = parseGroupTrigger(needle, trigger);
    if (groupKey !== null) {
      const GK = groupKey.toUpperCase();
      const out: Group[] = [];
      for (const e of config.tableCatalog) {
        const matchedGroups = (e.fieldGroups ?? []).filter(
          (g) => g.key.toUpperCase() === GK,
        );
        if (matchedGroups.length === 0) continue;
        const fieldSet = new Set<string>();
        for (const g of matchedGroups) {
          for (const f of g.fields) fieldSet.add(f.toUpperCase());
        }
        const fields: FieldHit[] = e.fields
          .filter((f) => fieldSet.has(f.toUpperCase()))
          .map((f) => ({ field: f }));
        if (fields.length === 0) continue;
        const isContext = contextSet.has(e.table.toUpperCase());
        out.push({ table: e, matchedByFieldOnly: false, fields, isContext });
      }
      // 上下文表排前面
      return [...out.filter((g) => g.isContext), ...out.filter((g) => !g.isContext)];
    }

    // 普通搜索
    const raw: Group[] = [];
    for (const e of config.tableCatalog) {
      const tName = e.table.toUpperCase();
      const tQn = (e.qualifiedName ?? "").toUpperCase();
      const tComment = String(e.comment ?? "");
      const isContext = contextSet.has(tName);
      const tableHit =
        !needle ||
        tName.includes(NU) ||
        tQn.includes(NU) ||
        tComment.toUpperCase().includes(NU);
      if (tableHit) {
        raw.push({
          table: e,
          matchedByFieldOnly: false,
          fields: e.fields.map((f) => ({ field: f })),
          isContext,
        });
        continue;
      }
      if (!needle) continue;
      const matched: FieldHit[] = [];
      const info = e.fieldInfo ?? {};
      for (const f of e.fields) {
        const F = String(f).toUpperCase();
        const c = String(info[F]?.comment ?? "");
        if (F.includes(NU) || c.toUpperCase().includes(NU)) {
          matched.push({ field: f });
        }
      }
      if (matched.length > 0) {
        raw.push({ table: e, matchedByFieldOnly: true, fields: matched, isContext });
      }
    }
    // 上下文表排前面
    if (contextSet.size > 0 && needle) {
      return [...raw.filter((g) => g.isContext), ...raw.filter((g) => !g.isContext)];
    }
    return raw;
  }, [config.tableCatalog, q, trigger, contextSet]);

  const totalFields = groups.reduce((acc, g) => acc + g.fields.length, 0);
  const groupKey = parseGroupTrigger(q.trim(), trigger);
  const contextGroups = groups.filter((g) => g.isContext);
  const nonContextGroups = groups.filter((g) => !g.isContext);
  const hasContextSplit = contextSet.size > 0 && contextGroups.length > 0 && nonContextGroups.length > 0;

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
          placeholder={`按表名 / 字段 / remark 搜索… 或 ${trigger}组名 检索字段组`}
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
              字段组&thinsp;
              <code style={{ fontFamily: "var(--mono)" }}>
                {trigger}{groupKey}
              </code>
              &thinsp;·&thinsp;{groups.length} 张表匹配 · {totalFields} 个字段
            </span>
          ) : q.trim() ? (
            <span>匹配 {groups.length} 张表 · {totalFields} 个字段</span>
          ) : (
            <span>共 {config.tableCatalog.length} 张表</span>
          )}
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
              ? `没有找到字段组"${groupKey}"对应的表`
              : "没有匹配的结果"}
          </div>
        ) : (
          <>
            {hasContextSplit ? (
              <>
                {contextGroups.map((g) => (
                  <TableGroup
                    key={g.table.table}
                    g={g}
                    ps={ps}
                    q={groupKey !== null ? "" : q.trim()}
                    onPickTable={onPickTable}
                    onPickField={onPickField}
                    isContext
                  />
                ))}
                <ContextDivider divider={ps.contextDivider} />
                {nonContextGroups.map((g) => (
                  <TableGroup
                    key={g.table.table}
                    g={g}
                    ps={ps}
                    q={groupKey !== null ? "" : q.trim()}
                    onPickTable={onPickTable}
                    onPickField={onPickField}
                    isContext={false}
                  />
                ))}
              </>
            ) : (
              groups.map((g) => (
                <TableGroup
                  key={g.table.table}
                  g={g}
                  ps={ps}
                  q={groupKey !== null ? "" : q.trim()}
                  onPickTable={onPickTable}
                  onPickField={onPickField}
                  isContext={g.isContext}
                />
              ))
            )}
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
  q: string;
  onPickTable: (qualifiedName: string) => void;
  onPickField: (table: string, field: string) => void;
  isContext: boolean;
};

function TableGroup({ g, ps, q, onPickTable, onPickField, isContext }: TableGroupProps) {
  const e = g.table;
  const display = e.qualifiedName ?? e.table;
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
            {highlight(display, q)}
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
              {highlight(e.comment, q)}
            </span>
          ) : null}
        </div>
        <span style={tableBadgeStyle}>
          {g.matchedByFieldOnly ? "字段命中" : "表"} · {e.fields.length}
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
                    {defaultAliasFor(e.table)}.{highlight(fh.field, q)}
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
                    {highlight(fc, q)}
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
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
