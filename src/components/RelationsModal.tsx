import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { AppConfig, Cardinality, TableRelation } from "../types";
import { SearchableSelect, type SearchOption } from "./SearchableSelect";

type Props = {
  open: boolean;
  config: AppConfig;
  onClose: () => void;
  setConfig: (fn: (c: AppConfig) => AppConfig) => void;
};

function newRel(): TableRelation {
  return {
    id: `rel-${globalThis.crypto?.randomUUID?.() ?? String(Date.now())}`,
    fromTable: "",
    toTable: "",
    fieldPairs: [{ fromField: "", toField: "" }],
    cardinality: "one-to-many",
    onClause: "",
    joinKind: "LEFT",
  };
}

const cardOpts: Array<{ v: Cardinality; label: string }> = [
  { v: "one-to-one", label: "一对一" },
  { v: "one-to-many", label: "一对多" },
  { v: "many-to-one", label: "多对一" },
  { v: "many-to-many", label: "多对多" },
];

export function RelationsModal({ open, config, onClose, setConfig }: Props) {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setActiveId((prev) => (config.relations.some((r) => r.id === prev) ? prev : config.relations[0]?.id ?? ""));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, config.relations, onClose]);

  const active = useMemo(
    () => config.relations.find((r) => r.id === activeId) ?? null,
    [config.relations, activeId],
  );

  const tableOptions = useMemo<SearchOption[]>(() => {
    return [...config.tableCatalog]
      .map((t) => ({
        value: t.table.toUpperCase(),
        label: t.table.toUpperCase(),
        subLabel: t.qualifiedName ? t.qualifiedName : undefined,
        searchText: `${t.table} ${t.qualifiedName ?? ""}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [config.tableCatalog]);

  const fieldOptionsFor = (table: string): SearchOption[] => {
    const t = table.trim().toUpperCase();
    const hit = config.tableCatalog.find((x) => x.table.toUpperCase() === t);
    if (!hit) return [];
    const info = hit.fieldInfo ?? {};
    return [...hit.fields]
      .map((f) => {
        const ff = String(f).toUpperCase();
        const c = info[ff]?.comment;
        return {
          value: ff,
          label: ff,
          subLabel: c ? String(c) : undefined,
          searchText: `${ff} ${c ?? ""}`,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  };

  const rebuildOnClause = (rel: TableRelation): string => {
    const aT = rel.fromTable?.trim().toUpperCase();
    const bT = rel.toTable?.trim().toUpperCase();
    if (!aT || !bT) return rel.onClause;
    const pairs = Array.isArray(rel.fieldPairs) ? rel.fieldPairs : [];
    const cooked = pairs
      .map((p) => ({
        a: String(p?.fromField ?? "").trim().toUpperCase(),
        b: String(p?.toField ?? "").trim().toUpperCase(),
      }))
      .filter((p) => p.a && p.b);
    if (cooked.length === 0) return rel.onClause;
    return cooked.map((p) => `${aT}.${p.a} = ${bT}.${p.b}`).join(" AND ");
  };

  if (!open) return null;

  return (
    <div style={backdrop} role="presentation" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modal} role="dialog" aria-modal="true" aria-label="表关系">
        <div style={head}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 800 }}>表关系</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              表/字段下拉支持搜索（字段支持搜索注释）；切换表会自动清空字段对。
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              style={btnSm}
              onClick={() => {
                const r = newRel();
                setConfig((c) => ({ ...c, relations: [...c.relations, r] }));
                setActiveId(r.id);
              }}
            >
              ＋ 新建
            </button>
            <button type="button" style={btnSm} onClick={onClose}>
              关闭
            </button>
          </div>
        </div>

        <div style={body}>
          <aside style={left}>
            {config.relations.length === 0 ? (
              <div style={{ ...hint, padding: 10, border: "1px dashed var(--border)", borderRadius: 10 }}>
                还没有表关系。点击右上角「＋ 新建」添加。
              </div>
            ) : null}
            <div style={{ display: "grid", gap: 8 }}>
              {config.relations.map((r) => {
                const title = r.fromTable && r.toTable ? `${r.fromTable} → ${r.toTable}` : "(未设置)";
                return (
                  <button
                    key={r.id}
                    type="button"
                    style={{ ...relListItem, borderColor: r.id === activeId ? "rgba(59,130,246,0.6)" : "var(--border)" }}
                    onClick={() => setActiveId(r.id)}
                  >
                    <div style={{ fontSize: 12, fontWeight: 750, color: "var(--text)" }}>{title}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      {r.cardinality} · {(r.fieldPairs?.length ?? 0) || 0} 列
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <main style={right}>
            {!active ? (
              <div style={{ ...hint, padding: 12 }}>请选择左侧一条关系，或点击「＋ 新建」。</div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 140px", gap: 10, alignItems: "end" }}>
                  <div style={{ minWidth: 0 }}>
                    <label style={lbl}>From 表</label>
                    <SearchableSelect
                      value={active.fromTable}
                      options={tableOptions}
                      placeholder="搜索并选择表…"
                      onChange={(v) =>
                        setConfig((c) => ({
                          ...c,
                          relations: c.relations.map((x) => {
                            if (x.id !== active.id) return x;
                            const next = { ...x, fromTable: v, fieldPairs: [{ fromField: "", toField: "" }] };
                            return { ...next, onClause: rebuildOnClause(next) };
                          }),
                        }))
                      }
                    />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <label style={lbl}>To 表</label>
                    <SearchableSelect
                      value={active.toTable}
                      options={tableOptions}
                      placeholder="搜索并选择表…"
                      onChange={(v) =>
                        setConfig((c) => ({
                          ...c,
                          relations: c.relations.map((x) => {
                            if (x.id !== active.id) return x;
                            const next = { ...x, toTable: v, fieldPairs: [{ fromField: "", toField: "" }] };
                            return { ...next, onClause: rebuildOnClause(next) };
                          }),
                        }))
                      }
                    />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <label style={lbl}>基数</label>
                    <select
                      style={select}
                      value={active.cardinality}
                      onChange={(e) => {
                        const v = e.target.value as Cardinality;
                        setConfig((c) => ({
                          ...c,
                          relations: c.relations.map((x) => (x.id === active.id ? { ...x, cardinality: v } : x)),
                        }));
                      }}
                    >
                      {cardOpts.map((o) => (
                        <option key={o.v} value={o.v}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <label style={{ ...lbl, marginBottom: 0 }}>字段对（多字段）</label>
                    <button
                      type="button"
                      style={btnSm}
                      disabled={!active.fromTable || !active.toTable}
                      onClick={() =>
                        setConfig((c) => ({
                          ...c,
                          relations: c.relations.map((x) => {
                            if (x.id !== active.id) return x;
                            const pairs = (x.fieldPairs?.length ? [...x.fieldPairs] : []) as Array<{
                              fromField: string;
                              toField: string;
                            }>;
                            pairs.push({ fromField: "", toField: "" });
                            return { ...x, fieldPairs: pairs };
                          }),
                        }))
                      }
                    >
                      ＋ 添加字段
                    </button>
                  </div>

                  <div style={{ display: "grid", gap: 10 }}>
                    {(active.fieldPairs?.length ? active.fieldPairs : [{ fromField: "", toField: "" }]).map((p, idx) => (
                      <div key={`${active.id}-p-${idx}`} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "end" }}>
                        <div style={{ minWidth: 0 }}>
                          <label style={lbl}>From 字段</label>
                          <SearchableSelect
                            value={p.fromField ?? ""}
                            disabled={!active.fromTable}
                            options={fieldOptionsFor(active.fromTable)}
                            placeholder="搜索字段/注释…"
                            onChange={(v) =>
                              setConfig((c) => ({
                                ...c,
                                relations: c.relations.map((x) => {
                                  if (x.id !== active.id) return x;
                                  const pairs = (x.fieldPairs?.length ? [...x.fieldPairs] : [{ fromField: "", toField: "" }]) as Array<{
                                    fromField: string;
                                    toField: string;
                                  }>;
                                  pairs[idx] = { ...pairs[idx], fromField: v };
                                  const next = { ...x, fieldPairs: pairs };
                                  return { ...next, onClause: rebuildOnClause(next) };
                                }),
                              }))
                            }
                          />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <label style={lbl}>To 字段</label>
                          <SearchableSelect
                            value={p.toField ?? ""}
                            disabled={!active.toTable}
                            options={fieldOptionsFor(active.toTable)}
                            placeholder="搜索字段/注释…"
                            onChange={(v) =>
                              setConfig((c) => ({
                                ...c,
                                relations: c.relations.map((x) => {
                                  if (x.id !== active.id) return x;
                                  const pairs = (x.fieldPairs?.length ? [...x.fieldPairs] : [{ fromField: "", toField: "" }]) as Array<{
                                    fromField: string;
                                    toField: string;
                                  }>;
                                  pairs[idx] = { ...pairs[idx], toField: v };
                                  const next = { ...x, fieldPairs: pairs };
                                  return { ...next, onClause: rebuildOnClause(next) };
                                }),
                              }))
                            }
                          />
                        </div>
                        <button
                          type="button"
                          style={btnSm}
                          disabled={(active.fieldPairs?.length ?? 1) <= 1}
                          onClick={() =>
                            setConfig((c) => ({
                              ...c,
                              relations: c.relations.map((x) => {
                                if (x.id !== active.id) return x;
                                const pairs = (x.fieldPairs?.length ? [...x.fieldPairs] : [{ fromField: "", toField: "" }]) as Array<{
                                  fromField: string;
                                  toField: string;
                                }>;
                                if (pairs.length <= 1) return x;
                                pairs.splice(idx, 1);
                                const next = { ...x, fieldPairs: pairs };
                                return { ...next, onClause: rebuildOnClause(next) };
                              }),
                            }))
                          }
                        >
                          删除
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 10, alignItems: "end" }}>
                  <div style={{ minWidth: 0 }}>
                    <label style={lbl}>ON 预览（不含 ON 关键字）</label>
                    <textarea
                      style={textarea}
                      value={active.onClause}
                      onChange={(e) => {
                        const v = e.target.value;
                        setConfig((c) => ({
                          ...c,
                          relations: c.relations.map((x) => (x.id === active.id ? { ...x, onClause: v } : x)),
                        }));
                      }}
                    />
                    <div style={{ ...hint, marginTop: 6 }}>选择字段会自动生成；也可以手动编辑。</div>
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    <label style={lbl}>JOIN</label>
                    <select
                      style={select}
                      value={active.joinKind ?? "LEFT"}
                      onChange={(e) => {
                        const v = e.target.value === "INNER" ? "INNER" : "LEFT";
                        setConfig((c) => ({
                          ...c,
                          relations: c.relations.map((x) => (x.id === active.id ? { ...x, joinKind: v } : x)),
                        }));
                      }}
                    >
                      <option value="LEFT">LEFT</option>
                      <option value="INNER">INNER</option>
                    </select>
                    <button
                      type="button"
                      style={{ ...btnSm, color: "var(--danger-muted)" }}
                      onClick={() =>
                        setConfig((c) => ({
                          ...c,
                          relations: c.relations.filter((x) => x.id !== active.id),
                        }))
                      }
                    >
                      删除关系
                    </button>
                  </div>
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
  padding: 12,
  overflow: "auto",
  minHeight: 0,
};

const relListItem: CSSProperties = {
  width: "100%",
  padding: "10px 10px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--bg-app)",
  cursor: "pointer",
  textAlign: "left",
};

const lbl: CSSProperties = {
  display: "block",
  fontSize: 11,
  color: "var(--text-muted)",
  marginBottom: 6,
};

const hint: CSSProperties = {
  fontSize: 11,
  color: "var(--text-muted)",
  lineHeight: 1.5,
};

const select: CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  fontSize: 12,
  color: "var(--text)",
  background: "var(--bg-app)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  outline: "none",
};

const textarea: CSSProperties = {
  width: "100%",
  height: 110,
  resize: "none",
  padding: "8px 10px",
  fontSize: 12,
  color: "var(--text)",
  background: "var(--bg-app)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  outline: "none",
  fontFamily: "var(--mono)",
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

