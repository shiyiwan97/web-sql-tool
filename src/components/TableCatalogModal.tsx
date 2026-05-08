import {
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { AppConfig, FieldGroup, TableCatalogEntry } from "../types";
import { pkBadgeResolved, styleFromText } from "./PanelStyleModal";
import { TableCatalogCsvImportModal } from "./TableCatalogCsvImportModal";

type Props = {
  open: boolean;
  config: AppConfig;
  onClose: () => void;
  onOpenStyle?: () => void;
  patchConfig: (fn: (c: AppConfig) => AppConfig) => void;
};

/**
 * 把一张表的所有可搜文本拼成一个大写字符串，便于一次性 includes 匹配。
 * 这样在 4000 表 / 23 万字段规模下，搜索只需要 4000 次 String#includes，
 * 而不是 4000 × 平均字段数 次 toUpperCase + includes。
 */
function buildTableHaystack(t: TableCatalogEntry): string {
  const parts: string[] = [t.table];
  if (t.qualifiedName) parts.push(t.qualifiedName);
  if (t.comment) parts.push(String(t.comment));
  const fi = t.fieldInfo ?? {};
  for (const f of t.fields) {
    parts.push(f);
    const c = fi[String(f).toUpperCase()]?.comment;
    if (c) parts.push(String(c));
  }
  // \u0001 作为分隔符，确保不会跨字段误匹配（除非用户真的搜了控制字符）
  return parts.join("\u0001").toUpperCase();
}

/** 左侧有关键字且命中字段名时，右侧为该字段行加背景（由样式配置） */
function fieldNameMatchesSearch(field: string, NU: string): boolean {
  return !!NU && String(field).toUpperCase().includes(NU);
}

export function TableCatalogModal({ open, config, onClose, onOpenStyle, patchConfig }: Props) {
  const [activeTable, setActiveTable] = useState<string>("");
  const [q, setQ] = useState("");
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const importMenuRef = useRef<HTMLDivElement>(null);
  const ps = config.panelStyles.tableCatalog;

  // --- 字段组编辑状态 ---
  const [newGroupKey, setNewGroupKey] = useState("");
  const [newGroupFields, setNewGroupFields] = useState<string[]>([]);
  const [editingGroupIdx, setEditingGroupIdx] = useState<number | null>(null);

  // 切换表时重置字段组编辑状态
  useEffect(() => {
    setNewGroupKey("");
    setNewGroupFields([]);
    setEditingGroupIdx(null);
  }, [activeTable]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!importMenuOpen) return;
      const el = importMenuRef.current;
      if (el && !el.contains(e.target as Node)) setImportMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, importMenuOpen]);

  const NU = q.trim().toUpperCase();
  // 输入卡顿大头：搜索一改，4000 表全过一遍。用 deferred 让 UI 先响应，再异步过滤。
  const deferredNU = useDeferredValue(NU);

  // 一次性为每张表预生成大写可搜文本，避免每次按键都跑 23 万次 toUpperCase。
  const searchIndex = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of config.tableCatalog) m.set(t.table, buildTableHaystack(t));
    return m;
  }, [config.tableCatalog]);

  const filtered = useMemo(() => {
    if (!deferredNU) return config.tableCatalog;
    const out: TableCatalogEntry[] = [];
    for (const t of config.tableCatalog) {
      const hay = searchIndex.get(t.table);
      if (hay && hay.includes(deferredNU)) out.push(t);
    }
    return out;
  }, [config.tableCatalog, deferredNU, searchIndex]);

  // 表头计数缓存，避免每次 render 都 reduce 4000 张表。
  const totalFieldCount = useMemo(
    () => config.tableCatalog.reduce((acc, t) => acc + t.fields.length, 0),
    [config.tableCatalog],
  );

  useEffect(() => {
    if (!open) return;
    setActiveTable((prev) =>
      config.tableCatalog.some((t) => t.table === prev)
        ? prev
        : config.tableCatalog[0]?.table ?? "",
    );
  }, [open, config.tableCatalog]);

  useEffect(() => {
    if (!open) return;
    if (filtered.length === 0) {
      setActiveTable("");
      return;
    }
    setActiveTable((prev) =>
      filtered.some((t) => t.table === prev) ? prev : filtered[0]!.table,
    );
  }, [open, filtered]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (importModalOpen) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, importModalOpen]);

  const active = useMemo(
    () => config.tableCatalog.find((t) => t.table === activeTable) ?? null,
    [config.tableCatalog, activeTable],
  );

  const highlightBg = ps.fieldSearchHighlightBg.trim();
  const pkBadge = pkBadgeResolved(ps.primaryKeyBadge);

  if (!open) return null;
  return (
    <div
      style={backdrop}
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={modal} role="dialog" aria-modal="true" aria-label="查看表">
        <div style={head}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 800 }}>查看表</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              共 {config.tableCatalog.length} 张表 · 字段总数 {totalFieldCount}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ position: "relative" }} ref={importMenuRef}>
              <button
                type="button"
                style={btnSm}
                aria-expanded={importMenuOpen}
                aria-haspopup="menu"
                onClick={() => setImportMenuOpen((v) => !v)}
              >
                导入 ▼
              </button>
              {importMenuOpen ? (
                <div
                  role="menu"
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "calc(100% + 4px)",
                    minWidth: 200,
                    padding: 6,
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--bg-elevated)",
                    boxShadow: "0 12px 36px rgba(0,0,0,0.35)",
                    zIndex: 12,
                  }}
                >
                  <button
                    type="button"
                    role="menuitem"
                    style={{
                      ...btnSm,
                      width: "100%",
                      textAlign: "left",
                      border: "none",
                      background: "transparent",
                    }}
                    onClick={() => {
                      setImportModalOpen(true);
                      setImportMenuOpen(false);
                    }}
                  >
                    Schema CSV 导入…
                  </button>
                </div>
              ) : null}
            </div>
            {onOpenStyle ? (
              <button type="button" style={btnSm} onClick={onOpenStyle} title="设置「查看表」的字体与搜索高亮">
                样式…
              </button>
            ) : null}
            <button type="button" style={btnSm} onClick={onClose}>
              关闭
            </button>
          </div>
        </div>

        <div style={body}>
          <aside style={left}>
            <input
              type="search"
              placeholder="表名 / 字段名 / 表注释 / 字段注释…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={inputStyle}
            />
            <VirtualTableList
              filtered={filtered}
              activeTable={activeTable}
              onPick={setActiveTable}
            />
          </aside>

          <main style={right}>
            {!active ? (
              <div style={{ ...hint, padding: 12 }}>请选择左侧一张表。</div>
            ) : (
              <div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", ...styleFromText(ps.tableName) }}>
                    {active.qualifiedName ?? active.table}
                  </div>
                  {active.comment ? (
                    <div style={{ fontSize: 12, color: "var(--text-muted)", ...styleFromText(ps.tableComment) }}>
                      {active.comment}
                    </div>
                  ) : null}
                  <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                    <span>
                      字段 {active.fields.length}
                      {active.primaryKeys && active.primaryKeys.length > 0
                        ? ` · 主键 ${active.primaryKeys.join(", ")}`
                        : ""}
                    </span>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <span>估计行数</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        placeholder="未登记"
                        value={active.estimatedRowCount ?? ""}
                        onChange={(e) => {
                          const raw = e.target.value.trim();
                          patchConfig((c) => ({
                            ...c,
                            tableCatalog: c.tableCatalog.map((t) => {
                              if (t.table !== active.table) return t;
                              if (raw === "") return { ...t, estimatedRowCount: undefined };
                              const n = Number(raw);
                              if (!Number.isFinite(n) || n < 0) return t;
                              return { ...t, estimatedRowCount: Math.floor(n) };
                            }),
                          }));
                        }}
                        style={{
                          width: 140,
                          padding: "6px 8px",
                          fontSize: 12,
                          borderRadius: 6,
                          border: "1px solid var(--border)",
                          background: "var(--bg-app)",
                          color: "var(--text)",
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    overflow: "hidden",
                    background: "var(--bg-app)",
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 12,
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          background: "var(--bg-elevated)",
                          color: "var(--text-muted)",
                          textAlign: "left",
                        }}
                      >
                        <th style={th}>#</th>
                        <th style={th}>字段</th>
                        <th style={th}>类型</th>
                        <th style={th}>长度</th>
                        <th style={th}>精度</th>
                        <th style={th}>PK</th>
                        <th style={th}>注释</th>
                      </tr>
                    </thead>
                    <tbody>
                      {active.fields.map((f, i) => {
                        const info = active.fieldInfo?.[String(f).toUpperCase()];
                        const rowHighlight =
                          highlightBg && fieldNameMatchesSearch(f, NU)
                            ? { background: highlightBg }
                            : {};
                        return (
                          <tr key={f} style={{ borderTop: "1px solid var(--border)", ...rowHighlight }}>
                            <td style={{ ...td, color: "var(--text-muted)" }}>{i + 1}</td>
                            <td
                              style={{
                                ...td,
                                fontFamily: "var(--mono)",
                                color: "#a7f3d0",
                                ...styleFromText(ps.fieldName),
                              }}
                            >
                              {f}
                            </td>
                            <td style={{ ...td, fontFamily: "var(--mono)", ...styleFromText(ps.fieldType) }}>
                              {info?.type ?? ""}
                            </td>
                            <td style={td}>{info?.length ?? ""}</td>
                            <td style={td}>{info?.precision ?? ""}</td>
                            <td style={td}>
                              {info?.isKey ? (
                                <span style={pkBadge.boxStyle}>{pkBadge.label}</span>
                              ) : (
                                ""
                              )}
                            </td>
                            <td style={{ ...td, ...styleFromText(ps.fieldComment) }}>{info?.comment ?? ""}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* 字段组配置 */}
                <FieldGroupsSection
                  active={active}
                  allFields={active.fields}
                  trigger={config.fieldGroupTrigger}
                  newGroupKey={newGroupKey}
                  setNewGroupKey={setNewGroupKey}
                  newGroupFields={newGroupFields}
                  setNewGroupFields={setNewGroupFields}
                  editingGroupIdx={editingGroupIdx}
                  setEditingGroupIdx={setEditingGroupIdx}
                  onSave={(groups) => {
                    patchConfig((c) => ({
                      ...c,
                      tableCatalog: c.tableCatalog.map((t) =>
                        t.table !== active.table ? t : { ...t, fieldGroups: groups },
                      ),
                    }));
                  }}
                />
              </div>
            )}
          </main>
        </div>
      </div>

      <TableCatalogCsvImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        config={config}
        patchConfig={patchConfig}
      />
    </div>
  );
}

// ──────────────────────────────────────────────
// 左侧表列表的轻量窗口化（避免 4000 表一次性全渲染）
// ──────────────────────────────────────────────

const ROW_H = 58; // 单行 52px 内容 + 6px 行间距
const OVERSCAN = 6;

function VirtualTableList({
  filtered,
  activeTable,
  onPick,
}: {
  filtered: TableCatalogEntry[];
  activeTable: string;
  onPick: (table: string) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(800);
  const [offsetTop, setOffsetTop] = useState(0);

  useLayoutEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const scroller = el.parentElement; // <aside>，本身就是滚动容器
    if (!scroller) return;
    const update = () => {
      setScrollTop(scroller.scrollTop);
      setViewportH(scroller.clientHeight);
      setOffsetTop(el.offsetTop);
    };
    update();
    scroller.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(scroller);
    return () => {
      scroller.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  const total = filtered.length;
  if (total === 0) {
    return (
      <div ref={wrapperRef} style={{ marginTop: 8 }}>
        <div
          style={{
            ...hint,
            padding: 10,
            border: "1px dashed var(--border)",
            borderRadius: 8,
          }}
        >
          无匹配表
        </div>
      </div>
    );
  }

  const visibleStart = Math.max(0, scrollTop - offsetTop);
  const startIdx = Math.max(0, Math.floor(visibleStart / ROW_H) - OVERSCAN);
  const endIdx = Math.min(
    total,
    Math.ceil((visibleStart + viewportH) / ROW_H) + OVERSCAN,
  );

  const items: ReactNode[] = [];
  for (let i = startIdx; i < endIdx; i++) {
    const t = filtered[i]!;
    items.push(
      <button
        key={t.table}
        type="button"
        style={{
          ...listItem,
          position: "absolute",
          top: i * ROW_H,
          left: 0,
          right: 0,
          height: ROW_H - 6,
          borderColor:
            t.table === activeTable ? "rgba(59,130,246,0.6)" : "var(--border)",
        }}
        onClick={() => onPick(t.table)}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
          {t.qualifiedName ?? t.table}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
          {t.comment ? t.comment + " · " : ""}
          {t.fields.length} 个字段
          {t.primaryKeys && t.primaryKeys.length > 0
            ? ` · PK ${t.primaryKeys.length}`
            : ""}
        </div>
      </button>,
    );
  }

  return (
    <div
      ref={wrapperRef}
      style={{ position: "relative", height: total * ROW_H, marginTop: 8 }}
    >
      {items}
    </div>
  );
}

// ──────────────────────────────────────────────
// 字段组配置子组件
// ──────────────────────────────────────────────

type FieldGroupsSectionProps = {
  active: TableCatalogEntry;
  allFields: string[];
  trigger: string;
  newGroupKey: string;
  setNewGroupKey: (v: string) => void;
  newGroupFields: string[];
  setNewGroupFields: (v: string[]) => void;
  editingGroupIdx: number | null;
  setEditingGroupIdx: (v: number | null) => void;
  onSave: (groups: FieldGroup[]) => void;
};

function FieldGroupsSection({
  active,
  allFields,
  trigger,
  newGroupKey,
  setNewGroupKey,
  newGroupFields,
  setNewGroupFields,
  editingGroupIdx,
  setEditingGroupIdx,
  onSave,
}: FieldGroupsSectionProps) {
  const groups: FieldGroup[] = active.fieldGroups ?? [];

  const toggleField = (f: string) => {
    const upper = f.toUpperCase();
    setNewGroupFields(
      newGroupFields.includes(upper)
        ? newGroupFields.filter((x) => x !== upper)
        : [...newGroupFields, upper],
    );
  };

  const startEdit = (idx: number) => {
    const g = groups[idx];
    if (!g) return;
    setEditingGroupIdx(idx);
    setNewGroupKey(g.key);
    setNewGroupFields([...g.fields]);
  };

  const cancelEdit = () => {
    setEditingGroupIdx(null);
    setNewGroupKey("");
    setNewGroupFields([]);
  };

  const isDuplicateKey = (key: string): boolean => {
    const lower = key.trim().toLowerCase();
    return groups.some(
      (g, i) => g.key.toLowerCase() === lower && i !== editingGroupIdx,
    );
  };

  const commitGroup = () => {
    const key = newGroupKey.trim();
    if (!key || newGroupFields.length === 0) return;
    if (isDuplicateKey(key)) return;
    const next = [...groups];
    if (editingGroupIdx !== null) {
      next[editingGroupIdx] = { key, fields: [...newGroupFields] };
    } else {
      next.push({ key, fields: [...newGroupFields] });
    }
    onSave(next);
    cancelEdit();
  };

  const deleteGroup = (idx: number) => {
    const next = groups.filter((_, i) => i !== idx);
    onSave(next.length > 0 ? next : []);
  };

  return (
    <div style={{ marginTop: 20 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
          字段组
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          触发符：<code style={{ fontFamily: "var(--mono)", color: "#93c5fd" }}>{trigger}</code>
          &thinsp;·&thinsp;搜索时输入{" "}
          <code style={{ fontFamily: "var(--mono)", color: "#fbbf24" }}>{trigger}组名</code>{" "}
          可检索该组所有字段
        </div>
      </div>

      {/* 已有分组列表 */}
      {groups.length > 0 ? (
        <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
          {groups.map((g, idx) => (
            <div
              key={idx}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: `1px solid ${editingGroupIdx === idx ? "rgba(59,130,246,0.6)" : "var(--border)"}`,
                background: "var(--bg-app)",
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <code
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#fbbf24",
                    }}
                  >
                    {trigger}{g.key}
                  </code>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {g.fields.length} 个字段
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {g.fields.map((f) => (
                    <code
                      key={f}
                      style={{
                        fontSize: 11,
                        fontFamily: "var(--mono)",
                        padding: "1px 6px",
                        borderRadius: 4,
                        border: "1px solid var(--border)",
                        background: "var(--bg-elevated)",
                        color: "#a7f3d0",
                      }}
                    >
                      {f}
                    </code>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button
                  type="button"
                  style={btnSm}
                  onClick={() => startEdit(idx)}
                  title="编辑该字段组"
                >
                  编辑
                </button>
                <button
                  type="button"
                  style={{ ...btnSm, color: "#f87171" }}
                  onClick={() => deleteGroup(idx)}
                  title="删除该字段组"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            ...hintStyle,
            padding: 10,
            border: "1px dashed var(--border)",
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          暂无字段组。在下方添加第一个。
        </div>
      )}

      {/* 新增 / 编辑表单 */}
      <div
        style={{
          padding: 12,
          border: "1px solid var(--border)",
          borderRadius: 8,
          background: "var(--bg-panel)",
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
          {editingGroupIdx !== null ? `编辑字段组 #${editingGroupIdx + 1}` : "新增字段组"}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
            组名（key）
          </label>
          <input
            type="text"
            placeholder="例如：combined-id"
            value={newGroupKey}
            onChange={(e) => setNewGroupKey(e.target.value)}
            style={{
              flex: 1,
              padding: "6px 8px",
              fontSize: 12,
              fontFamily: "var(--mono)",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--bg-app)",
              color: "var(--text)",
              outline: "none",
            }}
          />
          <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
            搜索触发：
            <code style={{ color: "#fbbf24", fontFamily: "var(--mono)" }}>
              {trigger}{newGroupKey || "…"}
            </code>
          </span>
        </div>

        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
          勾选该组包含的字段（已选 {newGroupFields.length} 个）：
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            maxHeight: 160,
            overflowY: "auto",
            padding: 4,
          }}
        >
          {allFields.map((f) => {
            const upper = f.toUpperCase();
            const checked = newGroupFields.includes(upper);
            return (
              <label
                key={f}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 11,
                  fontFamily: "var(--mono)",
                  padding: "3px 8px",
                  borderRadius: 5,
                  border: `1px solid ${checked ? "rgba(59,130,246,0.6)" : "var(--border)"}`,
                  background: checked ? "rgba(59,130,246,0.12)" : "var(--bg-app)",
                  color: checked ? "#93c5fd" : "var(--text)",
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleField(f)}
                  style={{ width: 12, height: 12, accentColor: "#3b82f6" }}
                />
                {f}
              </label>
            );
          })}
        </div>

        {newGroupKey.trim() && isDuplicateKey(newGroupKey) ? (
          <div style={{ fontSize: 11, color: "#f87171", marginTop: 6 }}>
            ⚠ 该表已存在 key 为「{newGroupKey.trim()}」的字段组，请使用不同的名称。
          </div>
        ) : null}
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button
            type="button"
            style={{
              ...btnSm,
              background:
                newGroupKey.trim() && newGroupFields.length > 0 && !isDuplicateKey(newGroupKey)
                  ? "rgba(59,130,246,0.2)"
                  : undefined,
              borderColor:
                newGroupKey.trim() && newGroupFields.length > 0 && !isDuplicateKey(newGroupKey)
                  ? "rgba(59,130,246,0.5)"
                  : undefined,
            }}
            disabled={!newGroupKey.trim() || newGroupFields.length === 0 || isDuplicateKey(newGroupKey)}
            onClick={commitGroup}
          >
            {editingGroupIdx !== null ? "保存修改" : "添加字段组"}
          </button>
          {editingGroupIdx !== null ? (
            <button type="button" style={btnSm} onClick={cancelEdit}>
              取消
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const hintStyle: CSSProperties = {
  fontSize: 11,
  color: "var(--text-muted)",
  lineHeight: 1.5,
};

const backdrop: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "var(--modal-backdrop)",
  padding: 16,
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
const modal: CSSProperties = {
  width: "min(1320px, 100%)",
  height: "min(820px, 100%)",
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: 14,
  boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};
const head: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 12px",
  borderBottom: "1px solid var(--border)",
};
const body: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: "grid",
  gridTemplateColumns: "320px 1fr",
};
const left: CSSProperties = {
  padding: 12,
  borderRight: "1px solid var(--border)",
  overflow: "auto",
  minHeight: 0,
  background: "var(--bg-panel)",
};
const right: CSSProperties = {
  padding: 16,
  overflow: "auto",
  minHeight: 0,
};
const listItem: CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--bg-app)",
  cursor: "pointer",
  textAlign: "left",
};
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
const hint: CSSProperties = {
  fontSize: 11,
  color: "var(--text-muted)",
  lineHeight: 1.5,
};
const btnSm: CSSProperties = {
  padding: "7px 10px",
  fontSize: 11,
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg-app)",
  color: "var(--text)",
  cursor: "pointer",
};
const th: CSSProperties = {
  padding: "6px 10px",
  fontWeight: 600,
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};
const td: CSSProperties = {
  padding: "6px 10px",
  verticalAlign: "top",
};
