import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { AppConfig, TableCatalogEntry } from "../types";

type Props = {
  open: boolean;
  config: AppConfig;
  onClose: () => void;
};

export function TableCatalogModal({ open, config, onClose }: Props) {
  const [activeTable, setActiveTable] = useState<string>("");
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) return;
    setActiveTable((prev) =>
      config.tableCatalog.some((t) => t.table === prev)
        ? prev
        : config.tableCatalog[0]?.table ?? "",
    );
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, config.tableCatalog, onClose]);

  const filtered = useMemo<TableCatalogEntry[]>(() => {
    const NU = q.trim().toUpperCase();
    if (!NU) return config.tableCatalog;
    return config.tableCatalog.filter(
      (t) =>
        t.table.toUpperCase().includes(NU) ||
        (t.qualifiedName ?? "").toUpperCase().includes(NU) ||
        String(t.comment ?? "").toUpperCase().includes(NU),
    );
  }, [config.tableCatalog, q]);

  const active = useMemo(
    () => config.tableCatalog.find((t) => t.table === activeTable) ?? null,
    [config.tableCatalog, activeTable],
  );

  if (!open) return null;
  return (
    <div
      style={backdrop}
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={modal} role="dialog" aria-modal="true" aria-label="表配置查看">
        <div style={head}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 800 }}>表配置（只读查看）</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              共 {config.tableCatalog.length} 张表 · 字段总数 {config.tableCatalog.reduce((acc, t) => acc + t.fields.length, 0)}
            </div>
          </div>
          <button type="button" style={btnSm} onClick={onClose}>
            关闭
          </button>
        </div>

        <div style={body}>
          <aside style={left}>
            <input
              type="search"
              placeholder="搜索表 / 注释…"
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
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
                    {active.qualifiedName ?? active.table}
                  </div>
                  {active.comment ? (
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{active.comment}</div>
                  ) : null}
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    字段 {active.fields.length}
                    {active.primaryKeys && active.primaryKeys.length > 0
                      ? ` · 主键 ${active.primaryKeys.join(", ")}`
                      : ""}
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
                        return (
                          <tr key={f} style={{ borderTop: "1px solid var(--border)" }}>
                            <td style={{ ...td, color: "var(--text-muted)" }}>{i + 1}</td>
                            <td style={{ ...td, fontFamily: "var(--mono)", color: "#a7f3d0" }}>{f}</td>
                            <td style={{ ...td, fontFamily: "var(--mono)" }}>{info?.type ?? ""}</td>
                            <td style={td}>{info?.length ?? ""}</td>
                            <td style={td}>{info?.precision ?? ""}</td>
                            <td style={td}>
                              {info?.isKey ? (
                                <span style={pkBadge}>PK</span>
                              ) : (
                                ""
                              )}
                            </td>
                            <td style={td}>{info?.comment ?? ""}</td>
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
const pkBadge: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  padding: "1px 5px",
  background: "rgba(250,204,21,0.15)",
  color: "#facc15",
  border: "1px solid rgba(250,204,21,0.4)",
  borderRadius: 3,
};

