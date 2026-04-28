import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import type {
  AppConfig,
  Cardinality,
  DdsCopybookPathGroup,
  SqlSnippet,
  SqlCompressLevel,
  TableRelation,
  UiTheme,
} from "../types";
import { normalizeConfig } from "../lib/configDefaults";
import { applySqlFormatting } from "../lib/sqlEditorOps";
import { saveDirectoryHandle } from "../lib/fsHandleStore";
import { buildSchemaCatalogFromHandles } from "../lib/schemaCatalogBrowser";

type Props = {
  open: boolean;
  config: AppConfig;
  onClose: () => void;
  onApply: (c: AppConfig) => void;
  focusJsonTick?: number;
};

type SectionId =
  | "basic"
  | "paths"
  | "relations"
  | "sqlfmt"
  | "snippets"
  | "json";

const cardOpts: { v: Cardinality; label: string }[] = [
  { v: "one-to-many", label: "一对多 (1:N)" },
  { v: "many-to-one", label: "多对一 (N:1)" },
  { v: "many-to-many", label: "多对多 (M:N)" },
];

function newRel(): TableRelation {
  return {
    id: `rel-${globalThis.crypto?.randomUUID?.() ?? String(Date.now())}`,
    fromTable: "",
    toTable: "",
    cardinality: "one-to-many",
    onClause: "",
    joinKind: "LEFT",
  };
}

function newSnippet(): SqlSnippet {
  return {
    id: `snip-${globalThis.crypto?.randomUUID?.() ?? String(Date.now())}`,
    name: "",
    text: "",
  };
}

const FORMAT_PREVIEW_SAMPLE =
  "SELECT  col1,  col2,  col3\nFROM  LIB.T1  t\nWHERE  t.ID = 'x'";

function AccordionSection({
  title,
  expanded,
  onToggle,
  children,
  sectionRef,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
  sectionRef?: RefObject<HTMLDivElement>;
}) {
  return (
    <div
      ref={sectionRef}
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        background: "var(--bg-elevated)",
        marginBottom: 12,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          position: "sticky",
          top: 0,
          zIndex: 5,
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "10px 14px",
          margin: 0,
          border: "none",
          borderBottom: expanded ? "1px solid var(--border)" : "none",
          borderRadius: expanded ? undefined : "var(--radius)",
          borderTopLeftRadius: "var(--radius)",
          borderTopRightRadius: "var(--radius)",
          borderBottomLeftRadius: expanded ? 0 : "var(--radius)",
          borderBottomRightRadius: expanded ? 0 : "var(--radius)",
          fontSize: 12,
          fontWeight: 600,
          fontFamily: "inherit",
          textAlign: "left",
          cursor: "pointer",
          background: "var(--accordion-header-bg)",
          color: "var(--text)",
          boxSizing: "border-box",
          boxShadow: expanded
            ? "0 1px 0 var(--border), 0 14px 36px var(--accordion-sticky-shadow)"
            : "none",
        }}
      >
        <span>{title}</span>
        <span
          aria-hidden
          style={{
            color: "var(--text-muted)",
            fontSize: 10,
            flexShrink: 0,
          }}
        >
          {expanded ? "▼ 收起" : "▶ 展开"}
        </span>
      </button>
      {expanded ? (
        <div style={{ padding: 14, overflow: "visible" }}>{children}</div>
      ) : null}
    </div>
  );
}

export function SettingsModal({
  open,
  config,
  onClose,
  onApply,
  focusJsonTick = 0,
}: Props) {
  const [draft, setDraft] = useState<AppConfig>(config);
  const [jsonText, setJsonText] = useState("");
  const [openSections, setOpenSections] = useState<Record<SectionId, boolean>>({
    basic: true,
    paths: true,
    relations: true,
    sqlfmt: true,
    snippets: false,
    json: false,
  });

  const jsonBlockRef = useRef<HTMLDivElement>(null);
  const lastTick = useRef(0);

  const toggle = (id: SectionId) =>
    setOpenSections((s) => ({ ...s, [id]: !s[id] }));

  const compressPreviews = useMemo(() => {
    const base = draft.sqlFormatting;
    return ([0, 1, 2] as SqlCompressLevel[]).map((level) =>
      applySqlFormatting(FORMAT_PREVIEW_SAMPLE, {
        ...base,
        compressLevel: level,
      }),
    );
  }, [draft.sqlFormatting]);

  useEffect(() => {
    if (open) {
      setDraft(config);
      setJsonText(JSON.stringify(config, null, 2));
      document.documentElement.dataset.theme = config.theme;
    }
  }, [open, config]);

  useEffect(() => {
    if (!open || focusJsonTick === lastTick.current) return;
    lastTick.current = focusJsonTick;
    setOpenSections((s) => ({ ...s, json: true }));
    requestAnimationFrame(() => {
      jsonBlockRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [focusJsonTick, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const setGroups = (g: DdsCopybookPathGroup[]) =>
    setDraft((d) => ({ ...d, ddsCopybookPathGroups: g }));

  const moveGroup = (idx: number, dir: -1 | 1) => {
    const g = [...draft.ddsCopybookPathGroups];
    const j = idx + dir;
    if (j < 0 || j >= g.length) return;
    [g[idx], g[j]] = [g[j], g[idx]];
    setGroups(g.map((x, i) => ({ ...x, order: i })));
  };

  const removeGroup = (idx: number) => {
    if (draft.ddsCopybookPathGroups.length <= 1) return;
    setGroups(
      draft.ddsCopybookPathGroups
        .filter((_, i) => i !== idx)
        .map((x, i) => ({ ...x, order: i })),
    );
  };

  const pickDir = async (
    kind: "dds" | "copybook",
    groupIndex: number,
  ) => {
    if (!("showDirectoryPicker" in window)) {
      alert("当前浏览器不支持目录选择（File System Access API）。请使用 Chromium 内核浏览器。");
      return;
    }
    try {
      const handle = await (window as any).showDirectoryPicker();
      const key = `dir-${kind}-${groupIndex}`;
      await saveDirectoryHandle(key, handle);
      setGroups(
        draft.ddsCopybookPathGroups.map((g, i) => {
          if (i !== groupIndex) return g;
          if (kind === "dds") {
            return { ...g, ddsPath: handle.name ?? g.ddsPath, ddsDirHandleKey: key };
          }
          return {
            ...g,
            copybookPath: handle.name ?? g.copybookPath,
            copybookDirHandleKey: key,
          };
        }),
      );
    } catch (e) {
      // user cancelled
      if (e instanceof DOMException && e.name === "AbortError") return;
      alert(`选择目录失败：${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const parseGroup = async (groupIndex: number) => {
    const g = draft.ddsCopybookPathGroups[groupIndex];
    if (!g) return;
    if (!g.ddsDirHandleKey || !g.copybookDirHandleKey) {
      alert("请先为该组选择 DDS 与 Copybook 目录。");
      return;
    }
    try {
      const schemas = await buildSchemaCatalogFromHandles({
        ddsDirHandleKey: g.ddsDirHandleKey,
        copybookDirHandleKey: g.copybookDirHandleKey,
        ddsSuffix: g.pairing.ddsSuffix,
        copybookSuffix: g.pairing.copybookSuffix,
      });
      // 合并进 tableCatalog（同名表以靠前组为准：这里只追加不存在的）
      setDraft((d) => {
        const existing = new Set(d.tableCatalog.map((t) => t.table.toUpperCase()));
        const add = schemas
          .filter((s) => !existing.has(s.table.toUpperCase()))
          .map((s) => ({
            table: s.table,
            qualifiedName: s.qualifiedName,
            fields: s.fields,
            primaryKeys: s.primaryKeys,
          }));
        return { ...d, tableCatalog: [...d.tableCatalog, ...add] };
      });
      alert(`解析完成：新增 ${schemas.length} 张表（已自动去重/合并）。`);
    } catch (e) {
      alert(`解析失败：${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const addGroup = () => {
    setGroups([
      ...draft.ddsCopybookPathGroups,
      {
        order: draft.ddsCopybookPathGroups.length,
        ddsPath: "",
        copybookPath: "",
        pairing: { ddsSuffix: ".dds", copybookSuffix: ".cbl" },
      },
    ]);
  };

  const mergeRelationStub = () => {
    const p =
      draft.tableRelationSourcePath?.trim() ||
      "D:\\config\\table-relations\\";
    setDraft((d) => ({
      ...d,
      tableRelationSourcePath: p,
      relationIndex: {
        byTable: {
          GRADECLS: { source: p, files: ["GRADECLS.json"] },
          STUDENT: { source: p, files: ["STUDENT.json"] },
        },
        mergedAt: new Date().toISOString(),
        note: "演示桩：实现阶段由扫描路径生成",
      },
    }));
  };

  const refreshJsonPreview = () => {
    setJsonText(JSON.stringify(draft, null, 2));
  };

  const applyFromJsonText = () => {
    try {
      const parsed = JSON.parse(jsonText);
      const n = normalizeConfig(parsed);
      setDraft(n);
      setJsonText(JSON.stringify(n, null, 2));
    } catch (e) {
      alert(`JSON 无效：${e instanceof Error ? e.message : e}`);
    }
  };

  const applyAndClose = () => {
    onApply(draft);
    onClose();
  };

  /** 关系卡片：响应式网格，避免固定三列撑破容器导致无法滚动 */
  const relGrid: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))",
    gap: 8,
    minWidth: 0,
  };

  return (
    <div
      style={{
        ...backdrop,
        background: "var(--modal-backdrop)",
      }}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={modal} role="dialog" aria-modal="true" aria-labelledby="settings-h">
        <div style={modalHead}>
          <h2 id="settings-h" style={{ margin: 0, flex: 1, fontSize: 14 }}>
            设置
          </h2>
          <button type="button" style={btn} onClick={onClose}>
            关闭
          </button>
        </div>

        <div
          className="settings-modal-scroll"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "0 16px 12px",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <AccordionSection
            title="1. 基础设置"
            expanded={openSections.basic}
            onToggle={() => toggle("basic")}
          >
            <label style={lbl2}>主题</label>
            <select
              style={{ ...inp, maxWidth: 280 }}
              value={draft.theme}
              onChange={(e) => {
                const v = (e.target.value === "light" ? "light" : "dark") as UiTheme;
                document.documentElement.dataset.theme = v;
                setDraft((d) => ({ ...d, theme: v }));
              }}
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
            <p style={{ ...hint, marginTop: 10, marginBottom: 0 }}>
              主题会立即在预览中生效；点击「应用并保存」后写入本地配置与 JSON。
            </p>
          </AccordionSection>

          <AccordionSection
            title="2. DDS / Copybook 路径组（有序）"
            expanded={openSections.paths}
            onToggle={() => toggle("paths")}
          >
            <p style={hint}>
              同组内按 <code>表名.dds</code> 与 <code>表名.cbl</code> 配对；多组时同名表以列表靠前为准。浏览器端仅保存路径字符串。
              从 DDS / copybook 自动生成「表目录」尚在规划：可先用手工 JSON 或外部脚本生成后导入配置。
            </p>
            <ol
              style={{
                margin: 0,
                paddingLeft: 22,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {draft.ddsCopybookPathGroups.map((g, idx) => (
                <li key={idx} style={liBox}>
                  <span style={lbl}>排序 #{idx + 1}</span>
                  <div style={row2}>
                    <div style={{ minWidth: 0 }}>
                      <label style={lbl2}>DDS 路径</label>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input
                          style={{ ...inp, flex: 1 }}
                          value={g.ddsPath}
                          onChange={(e) => {
                            const v = e.target.value;
                            setGroups(
                              draft.ddsCopybookPathGroups.map((x, i) =>
                                i === idx ? { ...x, ddsPath: v } : x,
                              ),
                            );
                          }}
                        />
                        <button type="button" style={btnSm} onClick={() => pickDir("dds", idx)}>
                          选择…
                        </button>
                      </div>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <label style={lbl2}>Copybook 路径</label>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input
                          style={{ ...inp, flex: 1 }}
                          value={g.copybookPath}
                          onChange={(e) => {
                            const v = e.target.value;
                            setGroups(
                              draft.ddsCopybookPathGroups.map((x, i) =>
                                i === idx ? { ...x, copybookPath: v } : x,
                              ),
                            );
                          }}
                        />
                        <button
                          type="button"
                          style={btnSm}
                          onClick={() => pickDir("copybook", idx)}
                        >
                          选择…
                        </button>
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      marginTop: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <button type="button" style={btnSm} onClick={() => parseGroup(idx)}>
                      解析该组
                    </button>
                    <button
                      type="button"
                      style={btnSm}
                      onClick={() => moveGroup(idx, -1)}
                    >
                      上移
                    </button>
                    <button
                      type="button"
                      style={btnSm}
                      onClick={() => moveGroup(idx, 1)}
                    >
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
                </li>
              ))}
            </ol>
            <button
              type="button"
              style={{ ...btn, marginTop: 12 }}
              onClick={addGroup}
            >
              ＋ 添加路径组
            </button>
          </AccordionSection>

          <AccordionSection
            title="3. 表关系"
            expanded={openSections.relations}
            onToggle={() => toggle("relations")}
          >
            {draft.relations.map((r) => (
              <div key={r.id} style={relBox}>
                <div style={relGrid}>
                  <div style={{ minWidth: 0 }}>
                    <label style={lbl2}>From 表</label>
                    <input
                      style={inp}
                      value={r.fromTable}
                      onChange={(e) => {
                        const v = e.target.value.toUpperCase();
                        setDraft((d) => ({
                          ...d,
                          relations: d.relations.map((x) =>
                            x.id === r.id ? { ...x, fromTable: v } : x,
                          ),
                        }));
                      }}
                    />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <label style={lbl2}>To 表</label>
                    <input
                      style={inp}
                      value={r.toTable}
                      onChange={(e) => {
                        const v = e.target.value.toUpperCase();
                        setDraft((d) => ({
                          ...d,
                          relations: d.relations.map((x) =>
                            x.id === r.id ? { ...x, toTable: v } : x,
                          ),
                        }));
                      }}
                    />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <label style={lbl2}>基数</label>
                    <select
                      style={inp}
                      value={r.cardinality}
                      onChange={(e) => {
                        const v = e.target.value as Cardinality;
                        setDraft((d) => ({
                          ...d,
                          relations: d.relations.map((x) =>
                            x.id === r.id ? { ...x, cardinality: v } : x,
                          ),
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
                <div style={{ marginTop: 8, minWidth: 0 }}>
                  <label style={lbl2}>ON 条件（不含 ON 关键字）</label>
                  <input
                    style={inp}
                    value={r.onClause}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDraft((d) => ({
                        ...d,
                        relations: d.relations.map((x) =>
                          x.id === r.id ? { ...x, onClause: v } : x,
                        ),
                      }));
                    }}
                  />
                </div>
                <div
                  style={{
                    marginTop: 8,
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    flexWrap: "wrap",
                    minWidth: 0,
                  }}
                >
                  <label style={{ ...lbl2, marginBottom: 0 }}>JOIN</label>
                  <select
                    style={{ ...inp, maxWidth: 140, width: "auto" }}
                    value={r.joinKind ?? "LEFT"}
                    onChange={(e) => {
                      const v = e.target.value === "INNER" ? "INNER" : "LEFT";
                      setDraft((d) => ({
                        ...d,
                        relations: d.relations.map((x) =>
                          x.id === r.id ? { ...x, joinKind: v } : x,
                        ),
                      }));
                    }}
                  >
                    <option value="LEFT">LEFT</option>
                    <option value="INNER">INNER</option>
                  </select>
                  <button
                    type="button"
                    style={btnSm}
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        relations: [
                          ...d.relations,
                          {
                            ...r,
                            id: `rel-${globalThis.crypto?.randomUUID?.() ?? String(Date.now())}`,
                          },
                        ],
                      }))
                    }
                  >
                    复制
                  </button>
                  <button
                    type="button"
                    style={{
                      ...btnSm,
                      marginLeft: "auto",
                      color: "var(--danger-muted)",
                    }}
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        relations: d.relations.filter((x) => x.id !== r.id),
                      }))
                    }
                  >
                    删除关系
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              style={btn}
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  relations: [...d.relations, newRel()],
                }))
              }
            >
              ＋ 新建关系
            </button>
            <div
              style={{
                marginTop: 16,
                paddingTop: 14,
                borderTop: "1px solid var(--border)",
              }}
            >
              <label style={lbl2}>表关系外部配置路径（可选）</label>
              <input
                style={inp}
                placeholder="目录或文件路径"
                value={draft.tableRelationSourcePath ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    tableRelationSourcePath: e.target.value || null,
                  }))
                }
              />
              <button
                type="button"
                style={{ ...btnSm, marginTop: 10 }}
                onClick={mergeRelationStub}
              >
                扫描路径并合并到配置（演示桩）
              </button>
            </div>
          </AccordionSection>

          <AccordionSection
            title="4. SQL 行长与总长度"
            expanded={openSections.sqlfmt}
            onToggle={() => toggle("sqlfmt")}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(min(100%, 140px), 1fr))",
                gap: 12,
                minWidth: 0,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <label style={lbl2}>每行最大字符</label>
                <input
                  style={inp}
                  type="number"
                  min={40}
                  max={256}
                  value={draft.sqlFormatting.maxCharsPerLine}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      sqlFormatting: {
                        ...d.sqlFormatting,
                        maxCharsPerLine: Number(e.target.value) || 72,
                      },
                    }))
                  }
                />
              </div>
              <div style={{ minWidth: 0 }}>
                <label style={lbl2}>行长竖线（编辑器）</label>
                <select
                  style={inp}
                  value={draft.sqlFormatting.showColumnGuide ? "y" : "n"}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      sqlFormatting: {
                        ...d.sqlFormatting,
                        showColumnGuide: e.target.value === "y",
                      },
                    }))
                  }
                >
                  <option value="y">显示</option>
                  <option value="n">不显示</option>
                </select>
              </div>
              <div style={{ minWidth: 0 }}>
                <label style={lbl2}>换行设置</label>
                <select
                  style={inp}
                  value={draft.sqlFormatting.editorLineBreak}
                  onChange={(e) => {
                    const v = e.target.value === "hard" ? "hard" : "soft";
                    setDraft((d) => ({
                      ...d,
                      sqlFormatting: { ...d.sqlFormatting, editorLineBreak: v },
                    }));
                  }}
                >
                  <option value="soft">软换行</option>
                  <option value="hard">硬换行</option>
                </select>
              </div>
              <div style={{ minWidth: 0 }}>
                <label style={lbl2}>压缩等级（与主界面同步）</label>
                <select
                  style={inp}
                  value={String(draft.sqlFormatting.compressLevel)}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    const level = (v === 2 ? 2 : v === 1 ? 1 : 0) as SqlCompressLevel;
                    setDraft((d) => ({
                      ...d,
                      sqlFormatting: { ...d.sqlFormatting, compressLevel: level },
                    }));
                  }}
                >
                  <option value="0">0 不压缩</option>
                  <option value="1">1 轻微</option>
                  <option value="2">2 强力</option>
                </select>
              </div>
            </div>
            <p style={{ ...hint, marginTop: 10 }}>
              「每行最大字符」对<strong>复制</strong>、快捷键复制、工具栏<strong>重排</strong>均生效。复制与快捷键保存到已存 SQL 时会去掉 <code>--</code> 与 <code>/* */</code> 注释。
              开启「行长竖线」时，编辑器在该列绘制参考线。AS400
              满行衔接时会在下一行行首补空格以防终端拼行。
            </p>

            <div style={{ marginTop: 12 }}>
              <label style={lbl2}>Debug 模式</label>
              <select
                style={inp}
                value={draft.debugMode ? "y" : "n"}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, debugMode: e.target.value === "y" }))
                }
              >
                <option value="n">关闭（仅显示当前块与行列）</option>
                <option value="y">开启（显示完整提示信息）</option>
              </select>
              <div style={{ ...hint, marginTop: 6 }}>
                开启后，编辑器顶部状态栏会显示更完整的说明文字，便于排查交互/快捷键问题。
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <label style={lbl2}>压缩等级预览（固定样例 SQL）</label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 10,
                  marginTop: 8,
                }}
              >
                {compressPreviews.map((text, i) => (
                  <div key={i} style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>
                      等级 {i}
                    </div>
                    <pre
                      style={{
                        margin: 0,
                        padding: 8,
                        fontSize: 10,
                        fontFamily: "var(--mono)",
                        background: "var(--bg-app)",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        maxHeight: 160,
                        overflow: "auto",
                      }}
                    >
                      {text}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          </AccordionSection>

          <AccordionSection
            title="5. SQL 片段（本地）"
            expanded={openSections.snippets}
            onToggle={() => toggle("snippets")}
          >
            <p style={hint}>
              常用语句存配置 JSON，便于与团队共享。插入编辑器功能可后续再接侧栏。
            </p>
            {draft.sqlSnippets.map((sn) => (
              <div key={sn.id} style={{ ...relBox, marginBottom: 10 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                  <input
                    style={{ ...inp, flex: "1 1 140px" }}
                    placeholder="显示名称"
                    value={sn.name}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDraft((d) => ({
                        ...d,
                        sqlSnippets: d.sqlSnippets.map((x) =>
                          x.id === sn.id ? { ...x, name: v } : x,
                        ),
                      }));
                    }}
                  />
                  <button
                    type="button"
                    style={{ ...btnSm, color: "var(--danger-muted)" }}
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        sqlSnippets: d.sqlSnippets.filter((x) => x.id !== sn.id),
                      }))
                    }
                  >
                    删除
                  </button>
                </div>
                <textarea
                  style={{ ...ta, minHeight: 72 }}
                  placeholder="SQL 正文"
                  value={sn.text}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDraft((d) => ({
                      ...d,
                      sqlSnippets: d.sqlSnippets.map((x) =>
                        x.id === sn.id ? { ...x, text: v } : x,
                      ),
                    }));
                  }}
                />
              </div>
            ))}
            <button
              type="button"
              style={btn}
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  sqlSnippets: [...d.sqlSnippets, newSnippet()],
                }))
              }
            >
              ＋ 新建片段
            </button>
          </AccordionSection>

          <AccordionSection
            title="6. 配置 JSON"
            expanded={openSections.json}
            onToggle={() => toggle("json")}
            sectionRef={jsonBlockRef}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 10,
              }}
            >
              <button type="button" style={btnSm} onClick={refreshJsonPreview}>
                刷新预览
              </button>
              <button type="button" style={btnSm} onClick={applyFromJsonText}>
                从下方 JSON 应用
              </button>
              <button
                type="button"
                style={btnSm}
                onClick={() => {
                  const blob = new Blob([jsonText], {
                    type: "application/json;charset=utf-8",
                  });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = "sql-web-tool-config.json";
                  a.click();
                  URL.revokeObjectURL(a.href);
                }}
              >
                下载 JSON
              </button>
            </div>
            <label style={lbl2}>JSON</label>
            <textarea
              style={ta}
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              spellCheck={false}
            />
            <p style={hint}>
              完整配置含 tableCatalog、relations 等。导入文件可在主菜单 File
              中选择。
            </p>
          </AccordionSection>
        </div>

        <div style={modalFooter}>
          <button type="button" style={btn} onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            style={{
              ...btn,
              borderColor: "var(--accent)",
              background: "var(--accent-dim)",
              color: "var(--btn-primary-fg)",
            }}
            onClick={applyAndClose}
          >
            应用并保存
          </button>
        </div>
      </div>
    </div>
  );
}

const backdrop: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 6000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
};

const modal: CSSProperties = {
  width: "min(920px, 96vw)",
  maxHeight: "min(90vh, 900px)",
  display: "flex",
  flexDirection: "column",
  background: "var(--bg-panel)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
  overflow: "hidden",
  minHeight: 0,
};

const modalHead: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "12px 16px",
  borderBottom: "1px solid var(--border)",
  flexShrink: 0,
};

const modalFooter: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  padding: "12px 16px",
  borderTop: "1px solid var(--border)",
  flexShrink: 0,
  background: "var(--bg-panel)",
};

const hint: CSSProperties = {
  fontSize: 11,
  color: "var(--text-muted)",
  lineHeight: 1.5,
  margin: "0 0 12px 0",
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
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))",
  gap: 10,
  marginTop: 8,
  minWidth: 0,
};

const lbl: CSSProperties = {
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--text-muted)",
  display: "block",
  marginBottom: 4,
};

const lbl2: CSSProperties = {
  ...lbl,
  textTransform: "none",
  letterSpacing: "normal",
  fontSize: 11,
};

const inp: CSSProperties = {
  width: "100%",
  maxWidth: "100%",
  padding: "8px 10px",
  fontSize: 12,
  color: "var(--text)",
  background: "var(--bg-app)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  boxSizing: "border-box",
  minWidth: 0,
};

const ta: CSSProperties = {
  ...inp,
  minHeight: 200,
  fontFamily: "var(--mono)",
  fontSize: 11,
  resize: "vertical",
};

const btn: CSSProperties = {
  padding: "6px 12px",
  fontSize: 12,
  color: "var(--text)",
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  cursor: "pointer",
};

const btnSm: CSSProperties = { ...btn, padding: "4px 10px", fontSize: 11 };

const relBox: CSSProperties = {
  padding: 12,
  background: "var(--bg-app)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  marginBottom: 10,
  fontSize: 12,
  minWidth: 0,
};
