import {
  useEffect,
  useState,
  type CSSProperties,
} from "react";
import type { AppConfig, DdsCopybookPathGroup } from "../types";
import { saveFileHandle } from "../lib/fsHandleStore";
import { analyzeSchemaCatalogFromCsvHandle } from "../lib/schemaCatalogBrowser";

type Props = {
  open: boolean;
  onClose: () => void;
  config: AppConfig;
  patchConfig: (fn: (c: AppConfig) => AppConfig) => void;
};

export function TableCatalogCsvImportModal({
  open,
  onClose,
  config,
  patchConfig,
}: Props) {
  const [schemaCsvIncludeHeader, setSchemaCsvIncludeHeader] = useState<Record<number, boolean>>({});
  const [schemaReports, setSchemaReports] = useState<
    Record<
      number,
      {
        ok: boolean;
        summary: string;
        issues: Array<{ line: number; kind: string; message: string }>;
      }
    >
  >({});

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const setGroups = (g: DdsCopybookPathGroup[]) =>
    patchConfig((c) => ({ ...c, ddsCopybookPathGroups: g }));

  const moveGroup = (idx: number, dir: -1 | 1) => {
    const g = [...config.ddsCopybookPathGroups];
    const j = idx + dir;
    if (j < 0 || j >= g.length) return;
    [g[idx], g[j]] = [g[j]!, g[idx]!];
    setGroups(g.map((x, i) => ({ ...x, order: i })));
  };

  const removeGroup = (idx: number) => {
    if (config.ddsCopybookPathGroups.length <= 1) return;
    setGroups(
      config.ddsCopybookPathGroups
        .filter((_, i) => i !== idx)
        .map((x, i) => ({ ...x, order: i })),
    );
  };

  const pickSchemaCsv = async (groupIndex: number) => {
    if (!("showOpenFilePicker" in window)) {
      alert("当前浏览器不支持文件选择（File System Access API）。请使用 Chromium 内核浏览器。");
      return;
    }
    try {
      const [handle] = await (window as any).showOpenFilePicker({
        multiple: false,
        types: [{ description: "Schema CSV", accept: { "text/csv": [".csv"] } }],
      });
      if (!handle) return;
      const key = `file-schema-csv-${groupIndex}`;
      await saveFileHandle(key, handle);
      setGroups(
        config.ddsCopybookPathGroups.map((g, i) =>
          i === groupIndex
            ? {
                ...g,
                schemaCsvPath: handle.name ?? g.schemaCsvPath,
                schemaCsvFileHandleKey: key,
              }
            : g,
        ),
      );
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      alert(`选择 CSV 失败：${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const parseGroup = async (groupIndex: number) => {
    const g = config.ddsCopybookPathGroups[groupIndex];
    if (!g) return;
    if (!g.schemaCsvFileHandleKey) {
      alert("请先为该组选择 Schema CSV 文件。");
      return;
    }
    try {
      const includeHeader = schemaCsvIncludeHeader[groupIndex] !== false;
      const { schemas, report } = await analyzeSchemaCatalogFromCsvHandle({
        schemaCsvFileHandleKey: g.schemaCsvFileHandleKey,
        analyzeOptions: {
          firstRow: includeHeader ? "header" : "data",
        },
      });
      patchConfig((d) => {
        const existing = new Set(d.tableCatalog.map((t) => t.table.toUpperCase()));
        const add = schemas
          .filter((s) => !existing.has(s.table.toUpperCase()))
          .map((s) => ({
            table: s.table,
            qualifiedName: s.qualifiedName,
            comment: s.comment,
            fields: s.fields,
            primaryKeys: s.primaryKeys,
            fieldInfo: s.fieldInfo,
          }));
        return { ...d, tableCatalog: [...d.tableCatalog, ...add] };
      });
      setSchemaReports((m) => ({
        ...m,
        [groupIndex]: {
          ok: report.issues.length === 0,
          summary: `表 ${report.tables} · 字段 ${report.fields} · 数据行 ${report.rows}/${report.lines} · 主键标记 ${report.primaryKeyMarks} · 重复 ${report.duplicates} · 问题 ${report.issues.length}`,
          issues: report.issues.map((it) => ({
            line: it.line,
            kind: it.kind,
            message: it.message,
          })),
        },
      }));
    } catch (e) {
      setSchemaReports((m) => ({
        ...m,
        [groupIndex]: {
          ok: false,
          summary: `解析失败：${e instanceof Error ? e.message : String(e)}`,
          issues: [],
        },
      }));
    }
  };

  const addGroup = () => {
    setGroups([
      ...config.ddsCopybookPathGroups,
      {
        order: config.ddsCopybookPathGroups.length,
        schemaCsvPath: "",
        pairing: { ddsSuffix: ".dds", copybookSuffix: ".cbl" },
      },
    ]);
  };

  if (!open) return null;

  return (
    <div
      style={backdrop}
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={modal} role="dialog" aria-modal="true" aria-label="Schema CSV 导入">
        <div style={modalHead}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Schema CSV 导入</div>
            <div style={{ ...hint, marginTop: 4, marginBottom: 0 }}>
              每组绑定一个 <code>schema.csv</code>（格式见 <code>tutorial.MD</code>）；多组时同名表以列表靠前为准。
              文件句柄仅存 IndexedDB，不会进入导出 JSON。
            </div>
          </div>
          <button type="button" style={btnSm} onClick={onClose}>
            关闭
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 14px" }}>
          <ol style={{ margin: 0, paddingLeft: 22, display: "flex", flexDirection: "column", gap: 12 }}>
            {config.ddsCopybookPathGroups.map((g, idx) => (
              <li key={idx} style={liBox}>
                <span style={lbl}>排序 #{idx + 1}</span>
                <div style={row2}>
                  <div style={{ minWidth: 0 }}>
                    <label style={lbl2}>Schema CSV</label>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        style={{ ...inp, flex: 1 }}
                        value={g.schemaCsvPath}
                        onChange={(e) => {
                          const v = e.target.value;
                          setGroups(
                            config.ddsCopybookPathGroups.map((x, i) =>
                              i === idx ? { ...x, schemaCsvPath: v } : x,
                            ),
                          );
                        }}
                      />
                      <button type="button" style={btnSm} onClick={() => pickSchemaCsv(idx)}>
                        选择…
                      </button>
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    marginTop: 10,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 11,
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={schemaCsvIncludeHeader[idx] !== false}
                      onChange={(e) =>
                        setSchemaCsvIncludeHeader((m) => ({
                          ...m,
                          [idx]: e.target.checked,
                        }))
                      }
                    />
                    包含表头（跳过首行）
                  </label>
                  <button type="button" style={btnSm} onClick={() => parseGroup(idx)}>
                    解析该组
                  </button>
                  <button type="button" style={btnSm} onClick={() => moveGroup(idx, -1)}>
                    上移
                  </button>
                  <button type="button" style={btnSm} onClick={() => moveGroup(idx, 1)}>
                    下移
                  </button>
                  <button
                    type="button"
                    style={{
                      ...btnSm,
                      color: "var(--danger-muted)",
                      borderColor: "rgba(239,68,68,0.5)",
                    }}
                    onClick={() => removeGroup(idx)}
                  >
                    删除组
                  </button>
                </div>
                {schemaReports[idx] ? (
                  <div
                    style={{
                      marginTop: 10,
                      padding: 10,
                      borderRadius: 8,
                      border: `1px solid ${schemaReports[idx]!.ok ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`,
                      background: "var(--bg-app)",
                      fontSize: 11,
                      lineHeight: 1.55,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontWeight: 600,
                        color: schemaReports[idx]!.ok ? "var(--text)" : "var(--danger-muted)",
                        marginBottom: schemaReports[idx]!.issues.length ? 8 : 0,
                      }}
                    >
                      <span>
                        {schemaReports[idx]!.ok ? "✅ 解析完成（无问题）" : `⚠ 发现 ${schemaReports[idx]!.issues.length} 个问题`}
                      </span>
                      <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
                        · {schemaReports[idx]!.summary}
                      </span>
                    </div>
                    {schemaReports[idx]!.issues.length > 0 ? (
                      <div
                        style={{
                          maxHeight: 220,
                          overflow: "auto",
                          border: "1px solid var(--border)",
                          borderRadius: 6,
                          background: "var(--bg-panel)",
                        }}
                      >
                        <table
                          style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            fontSize: 11,
                          }}
                        >
                          <thead>
                            <tr style={{ background: "var(--bg-elevated)", textAlign: "left", color: "var(--text-muted)" }}>
                              <th style={{ padding: "4px 8px", fontWeight: 600, width: 60 }}>行</th>
                              <th style={{ padding: "4px 8px", fontWeight: 600, width: 110 }}>类型</th>
                              <th style={{ padding: "4px 8px", fontWeight: 600 }}>说明</th>
                            </tr>
                          </thead>
                          <tbody>
                            {schemaReports[idx]!.issues.map((it, i2) => (
                              <tr key={i2} style={{ borderTop: "1px solid var(--border)" }}>
                                <td style={{ padding: "4px 8px", fontFamily: "var(--mono)", color: "var(--text-muted)" }}>
                                  L{it.line}
                                </td>
                                <td style={{ padding: "4px 8px", color: "var(--danger-muted)" }}>{it.kind}</td>
                                <td style={{ padding: "4px 8px" }}>{it.message}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
          <button type="button" style={{ ...btnSm, marginTop: 12 }} onClick={addGroup}>
            ＋ 添加路径组
          </button>
        </div>
      </div>
    </div>
  );
}

const backdrop: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 10050,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  background: "var(--modal-backdrop)",
};

const modal: CSSProperties = {
  width: "min(780px, 96vw)",
  maxHeight: "min(88vh, 820px)",
  display: "flex",
  flexDirection: "column",
  background: "var(--bg-panel)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
  overflow: "hidden",
  minHeight: 0,
};

const modalHead: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  padding: "12px 14px",
  borderBottom: "1px solid var(--border)",
  flexShrink: 0,
};

const hint: CSSProperties = {
  fontSize: 11,
  color: "var(--text-muted)",
  lineHeight: 1.5,
};

const liBox: CSSProperties = {
  padding: 12,
  background: "var(--bg-app)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  listStylePosition: "outside",
};

const row2: CSSProperties = {
  display: "grid",
  gap: 10,
  marginTop: 8,
};

const lbl: CSSProperties = {
  fontSize: 11,
  fontWeight: 650,
  color: "var(--text-muted)",
};

const lbl2: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-muted)",
  marginBottom: 6,
  display: "block",
};

const inp: CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  fontSize: 12,
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg-app)",
  color: "var(--text)",
  boxSizing: "border-box",
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
