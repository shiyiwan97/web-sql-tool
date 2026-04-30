import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { AppConfig, TableCatalogEntry } from "../types";
import { defaultAliasFor } from "../lib/sqlEditorOps";
import { applyTypeMapping, styleFromText } from "./PanelStyleModal";

type Props = {
  config: AppConfig;
  onPickTable: (qualifiedName: string) => void;
  onPickField: (table: string, field: string) => void;
};

type FieldHit = { field: string };

type Group = {
  table: TableCatalogEntry;
  fields: FieldHit[];
  matchedByFieldOnly: boolean;
};

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

export function SidebarSearch({ config, onPickTable, onPickField }: Props) {
  const [q, setQ] = useState("");
  const ps = config.panelStyles.search;

  const groups = useMemo<Group[]>(() => {
    const needle = q.trim();
    const NU = needle.toUpperCase();
    const out: Group[] = [];
    for (const e of config.tableCatalog) {
      const tName = e.table.toUpperCase();
      const tQn = (e.qualifiedName ?? "").toUpperCase();
      const tComment = String(e.comment ?? "");
      const tableHit =
        !needle ||
        tName.includes(NU) ||
        tQn.includes(NU) ||
        tComment.toUpperCase().includes(NU);
      if (tableHit) {
        out.push({
          table: e,
          matchedByFieldOnly: false,
          fields: e.fields.map((f) => ({ field: f })),
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
        out.push({ table: e, matchedByFieldOnly: true, fields: matched });
      }
    }
    return out;
  }, [config.tableCatalog, q]);

  const totalFields = groups.reduce((acc, g) => acc + g.fields.length, 0);

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
          placeholder="按表名 / 字段 / remark 搜索…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={inputStyle}
        />
        <div
          style={{
            marginTop: 6,
            fontSize: 10,
            color: "var(--text-muted)",
          }}
        >
          {q.trim()
            ? `匹配 ${groups.length} 张表 · ${totalFields} 个字段`
            : `共 ${config.tableCatalog.length} 张表`}
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
            没有匹配的结果
          </div>
        ) : (
          groups.map((g) => {
            const e = g.table;
            const display = e.qualifiedName ?? e.table;
            return (
              <section key={e.table}>
                <header
                  style={{
                    ...tableHeaderStyle,
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
                    <code style={{ ...tableNameStyle, ...styleFromText(ps.tableName) }}>{highlight(display, q.trim())}</code>
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
                        {highlight(e.comment, q.trim())}
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
                    return (
                      <li
                        key={fh.field}
                        style={{
                          ...fieldItemStyle,
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
                            {isPk ? <span style={pkBadge}>PK</span> : null}
                            <code style={{ ...fieldNameStyle, ...styleFromText(ps.fieldName) }}>
                              {defaultAliasFor(e.table)}.{highlight(fh.field, q.trim())}
                            </code>
                            {typLabel ? (
                              <span style={{ ...typeStyle, ...styleFromText(ps.fieldType) }} title={typRaw}>
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
                              {highlight(fc, q.trim())}
                            </span>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })
        )}
      </div>
    </div>
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
  padding: "8px 12px",
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
  padding: "6px 12px 6px 24px",
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

const pkBadge: CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  padding: "1px 4px",
  background: "rgba(250,204,21,0.15)",
  color: "#facc15",
  border: "1px solid rgba(250,204,21,0.4)",
  borderRadius: 3,
};
