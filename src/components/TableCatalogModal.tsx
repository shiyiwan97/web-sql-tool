import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { AppConfig, TableCatalogEntry } from "../types";
import { pkBadgeResolved, styleFromText } from "./PanelStyleModal";
import { TableCatalogCsvImportModal } from "./TableCatalogCsvImportModal";

type Props = {
  open: boolean;
  config: AppConfig;
  onClose: () => void;
  onOpenStyle?: () => void;
  patchConfig: (fn: (c: AppConfig) => AppConfig) => void;
};

function tableMatchesCatalogSearch(t: TableCatalogEntry, NU: string): boolean {
  if (!NU) return true;
  const U = (s: string) => s.toUpperCase();
  if (U(t.table).includes(NU)) return true;
  if (U(t.qualifiedName ?? "").includes(NU)) return true;
  if (U(String(t.comment ?? "")).includes(NU)) return true;
  const fi = t.fieldInfo ?? {};
  for (const f of t.fields) {
    const F = String(f).toUpperCase();
    if (F.includes(NU)) return true;
    const cm = String(fi[F]?.comment ?? "").toUpperCase();
    if (cm.includes(NU)) return true;
  }
  return false;
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

  const filtered = useMemo(
    () => config.tableCatalog.filter((t) => tableMatchesCatalogSearch(t, NU)),
    [config.tableCatalog, NU],
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
              共 {config.tableCatalog.length} 张表 · 字段总数{" "}
              {config.tableCatalog.reduce((acc, t) => acc + t.fields.length, 0)}
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
            <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
              {filtered.length === 0 ? (
                <div style={{ ...hint, padding: 10, border: "1px dashed var(--border)", borderRadius: 8 }}>
                  无匹配表
                </div>
              ) : (
                filtered.map((t) => (
                  <button
                    key={t.table}
                    type="button"
                    style={{
                      ...listItem,
                      borderColor: t.table === activeTable ? "rgba(59,130,246,0.6)" : "var(--border)",
                    }}
                    onClick={() => setActiveTable(t.table)}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
                      {t.qualifiedName ?? t.table}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      {t.comment ? t.comment + " · " : ""}
                      {t.fields.length} 个字段
                      {t.primaryKeys && t.primaryKeys.length > 0 ? ` · PK ${t.primaryKeys.length}` : ""}
                    </div>
                  </button>
                ))
              )}
            </div>
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
