import { useMemo, useState, type CSSProperties } from "react";
import type { AppConfig, TableCatalogEntry } from "../types";
import { defaultAliasFor } from "../lib/sqlEditorOps";

export type SearchHit =
  | { kind: "table"; entry: TableCatalogEntry }
  | { kind: "field"; field: string; entry: TableCatalogEntry };

type Props = {
  config: AppConfig;
  onPickTable: (qualifiedName: string) => void;
  onPickField: (table: string, field: string) => void;
};

export function SidebarSearch({ config, onPickTable, onPickField }: Props) {
  const [q, setQ] = useState("");

  const hits = useMemo(() => {
    const needle = q.trim().toUpperCase();
    const list: SearchHit[] = [];
    if (!needle) {
      for (const e of config.tableCatalog) {
        list.push({ kind: "table", entry: e });
        for (const f of e.fields) {
          list.push({ kind: "field", field: f, entry: e });
        }
      }
      return list;
    }
    for (const e of config.tableCatalog) {
      const t = e.table.toUpperCase();
      const qn = (e.qualifiedName ?? "").toUpperCase();
      if (t.includes(needle) || qn.includes(needle)) {
        list.push({ kind: "table", entry: e });
      }
      for (const f of e.fields) {
        if (f.toUpperCase().includes(needle) || t.includes(needle)) {
          list.push({ kind: "field", field: f, entry: e });
        }
      }
    }
    return list;
  }, [config.tableCatalog, q]);

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
      <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
        <p
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--text-muted)",
            margin: "0 0 8px 0",
          }}
        >
          搜索
        </p>
        <div
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "8px 10px",
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-muted)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            表名 / 字段名
          </div>
          <div style={{ padding: 10 }}>
            <input
              className="input"
              type="search"
              placeholder="搜索表或字段…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={inputStyle}
            />
            <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0, maxHeight: "min(360px, 45vh)", overflow: "auto" }}>
              {hits.map((h, i) =>
                h.kind === "table" ? (
                  <li
                    key={`t-${h.entry.table}-${i}`}
                    style={listItemStyle}
                    onClick={() =>
                      onPickTable(h.entry.qualifiedName ?? h.entry.table)
                    }
                  >
                    <span>
                      <code style={codeStyle}>
                        {h.entry.qualifiedName ?? h.entry.table}
                      </code>
                    </span>
                    <span style={badgeStyle}>表</span>
                  </li>
                ) : (
                  <li
                    key={`f-${h.entry.table}-${h.field}-${i}`}
                    style={listItemStyle}
                    onClick={() => onPickField(h.entry.table, h.field)}
                  >
                    <span>
                      <code style={codeStyle}>
                        {defaultAliasFor(h.entry.table)}.{h.field}
                      </code>{" "}
                      <span style={{ color: "var(--text-muted)" }}>
                        · {h.entry.table}
                      </span>
                    </span>
                    <span style={badgeStyle}>字段</span>
                  </li>
                ),
              )}
            </ul>
            <p
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                lineHeight: 1.5,
                margin: "8px 0 0",
              }}
            >
              DDS / 表关系 / 行长等在设置中配置；数据存于本地 JSON（localStorage）。
            </p>
          </div>
        </div>
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

const listItemStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  padding: "8px 10px",
  fontSize: 12,
  borderBottom: "1px solid var(--border)",
  cursor: "pointer",
};

const codeStyle: CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 11,
  color: "#93c5fd",
};

const badgeStyle: CSSProperties = {
  fontSize: 10,
  padding: "2px 6px",
  borderRadius: 4,
  background: "var(--bg-app)",
  color: "var(--text-muted)",
};
