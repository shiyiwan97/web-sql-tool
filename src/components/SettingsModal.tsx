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
  EditorAppearance,
  SqlCompressLevel,
  UiTheme,
} from "../types";
import { normalizeConfig } from "../lib/configDefaults";
import { applySqlFormatting } from "../lib/sqlEditorOps";
import { getOrCreateUserId, setUserId } from "../lib/configBlocks";

type Props = {
  open: boolean;
  config: AppConfig;
  onClose: () => void;
  onApply: (c: AppConfig) => void;
  focusJsonTick?: number;
};

type SectionId = "basic" | "editor" | "warnings" | "json";

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

function UserIdField() {
  const [uid, setUid] = useState("");
  useEffect(() => {
    setUid(getOrCreateUserId());
  }, []);
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input
        style={{ ...inp, flex: 1, maxWidth: 320 }}
        value={uid}
        onChange={(e) => setUid(e.target.value)}
        placeholder="例如：alice@team-A"
      />
      <button
        type="button"
        style={btnSm}
        onClick={() => {
          const v = uid.trim();
          if (!v) return;
          setUserId(v);
        }}
      >
        保存
      </button>
      <button
        type="button"
        style={btnSm}
        onClick={() => {
          const fresh = `user-${globalThis.crypto?.randomUUID?.() ?? String(Date.now())}`;
          setUid(fresh);
          setUserId(fresh);
        }}
      >
        重新生成
      </button>
    </div>
  );
}

function EditorAppearanceEditor({
  value,
  onChange,
}: {
  value: EditorAppearance;
  onChange: (next: EditorAppearance) => void;
}) {
  const colorRow = (
    label: string,
    cur: string,
    set: (v: string) => void,
    placeholder: string,
  ) => {
    const safe = /^#[0-9a-fA-F]{6}$/.test(cur) ? cur : "#666666";
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
        <label style={{ ...lbl2, marginBottom: 0, minWidth: 140 }}>{label}</label>
        <input
          type="color"
          value={safe}
          onChange={(e) => set(e.target.value)}
          style={{ width: 32, height: 26, padding: 0, border: "1px solid var(--border)", borderRadius: 4, background: "transparent" }}
          title={cur || "（沿用主题）"}
        />
        <input
          type="text"
          value={cur}
          onChange={(e) => set(e.target.value)}
          placeholder={placeholder}
          style={{ ...inp, width: 140 }}
        />
        <button type="button" style={btnSm} onClick={() => set("")}>
          清除
        </button>
      </div>
    );
  };
  return (
    <div>
      <label style={lbl2}>基础主题</label>
      <select
        style={{ ...inp, maxWidth: 280 }}
        value={value.baseTheme}
        onChange={(e) =>
          onChange({ ...value, baseTheme: e.target.value as EditorAppearance["baseTheme"] })
        }
      >
        <option value="auto">跟随界面主题（auto）</option>
        <option value="vs">vs（亮色）</option>
        <option value="vs-dark">vs-dark（暗色）</option>
        <option value="hc-light">hc-light（高对比 · 亮）</option>
        <option value="hc-black">hc-black（高对比 · 暗）</option>
      </select>
      <p style={{ ...hint, marginTop: 6 }}>
        颜色为空时使用主题默认值。建议先选好基础主题再叠加颜色。
      </p>
      {colorRow(
        "选中行 背景色",
        value.selectedLineBg,
        (v) => onChange({ ...value, selectedLineBg: v }),
        "#1f2937 等",
      )}
      {colorRow(
        "活动行号 颜色",
        value.activeLineNumberFg,
        (v) => onChange({ ...value, activeLineNumberFg: v }),
        "#facc15 等",
      )}
      {colorRow(
        "普通行号 颜色",
        value.lineNumberFg,
        (v) => onChange({ ...value, lineNumberFg: v }),
        "#858585 等",
      )}
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
    editor: true,
    warnings: true,
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
            <p style={{ ...hint, marginTop: 10, marginBottom: 10 }}>
              主题会立即在预览中生效；点击「应用并保存」后写入本地配置与 JSON。
            </p>

            <label style={{ ...lbl2, marginTop: 4 }}>用户 ID（userId）</label>
            <UserIdField />
            <p style={{ ...hint, marginTop: 6, marginBottom: 0 }}>
              用于在配置导出/比较合并时识别来源；建议填一个易识别的名字（如 <code>alice@team-A</code>）。
            </p>
          </AccordionSection>

          <AccordionSection
            title="2. 编辑器设置"
            expanded={openSections.editor}
            onToggle={() => toggle("editor")}
          >
            <EditorAppearanceEditor
              value={draft.editorAppearance}
              onChange={(ea) => setDraft((d) => ({ ...d, editorAppearance: ea }))}
            />

            <div
              style={{
                marginTop: 16,
                paddingTop: 14,
                borderTop: "1px solid var(--border)",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>
                SQL 行长与编辑器行为
              </div>
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
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    gridColumn: "1 / -1",
                    fontSize: 11,
                    color: "var(--text)",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={draft.sqlFormatting.searchInsertKeywordsUppercase}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        sqlFormatting: {
                          ...d.sqlFormatting,
                          searchInsertKeywordsUppercase: e.target.checked,
                        },
                      }))
                    }
                  />
                  搜索侧栏点击插入表/字段时，SQL 关键字使用大写（SELECT / FROM / LEFT JOIN / ON）
                </label>
              </div>
              <p style={{ ...hint, marginTop: 10 }}>
                「每行最大字符」对<strong>复制</strong>、快捷键复制、工具栏<strong>重排</strong>均生效；开启<strong>硬换行</strong>时，从搜索插入超长 JOIN 后会自动按行长拆行。
                Schema CSV 导入已迁至<strong>查看表 → 导入</strong>。
                复制与快捷键保存到已存 SQL 时会去掉 <code>--</code> 与 <code>/* */</code> 注释。
                开启「行长竖线」时，编辑器在该列绘制参考线。AS400
                满行衔接时会在下一行行首补空格以防终端拼行。
              </p>

              <div style={{ marginTop: 12 }}>
                <label style={lbl2}>字段组触发符</label>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                  <input
                    type="text"
                    style={{ ...inp, width: 72, fontFamily: "var(--mono)" }}
                    value={draft.fieldGroupTrigger}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v.length > 0) setDraft((d) => ({ ...d, fieldGroupTrigger: v }));
                    }}
                    placeholder="#"
                  />
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    在搜索栏输入&thinsp;
                    <code style={{ fontFamily: "var(--mono)", color: "#fbbf24" }}>
                      {draft.fieldGroupTrigger}组名
                    </code>
                    &thinsp;可检索该字段组的所有字段；在 SQL 编辑器中输入同样触发智能补全（弹出"表:组名"列表，选中后插入该组所有字段）。字段组在<strong>查看表</strong>中配置。
                  </span>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <label style={lbl2}>字段组补全显示格式</label>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
                  可混合固定文字与占位符，占位符用 <code style={{ fontFamily: "var(--mono)", color: "#fbbf24" }}>{"{}"}</code> 包裹。
                  左侧紧贴图标，右侧靠右对齐。可用占位符：
                  <br />
                  <code style={{ fontFamily: "var(--mono)", color: "#fbbf24" }}>
                    {"{key}"}&ensp;{"{keyName}"}&ensp;{"{table}"}&ensp;{"{count}"}&ensp;{"{fields}"}&ensp;{"{fields3}"}&ensp;{"{fields5}"}
                  </code>
                  <span style={{ marginLeft: 6 }}>— 固定文字示例：</span>
                  <code style={{ fontFamily: "var(--mono)", color: "var(--text-muted)" }}>表 {"{table}"} 的组</code>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ ...lbl2, marginBottom: 0, width: 60, flexShrink: 0 }}>左侧</span>
                    <input
                      type="text"
                      style={{ ...inp, flex: 1, fontFamily: "var(--mono)" }}
                      value={draft.fieldGroupCompletionFormat?.left ?? "{key}"}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          fieldGroupCompletionFormat: {
                            ...d.fieldGroupCompletionFormat,
                            left: e.target.value,
                          },
                        }))
                      }
                      placeholder="{key}"
                    />
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ ...lbl2, marginBottom: 0, width: 60, flexShrink: 0 }}>右侧</span>
                    <input
                      type="text"
                      style={{ ...inp, flex: 1, fontFamily: "var(--mono)" }}
                      value={draft.fieldGroupCompletionFormat?.right ?? "{table}: {fields5}"}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          fieldGroupCompletionFormat: {
                            ...d.fieldGroupCompletionFormat,
                            right: e.target.value,
                          },
                        }))
                      }
                      placeholder="{table}: {fields5}"
                    />
                  </div>
                  {/* 实时预览 */}
                  {(() => {
                    const applyPreview = (tpl: string) =>
                      tpl
                        .replace(/\{key\}/g, `${draft.fieldGroupTrigger}id`)
                        .replace(/\{keyName\}/g, "id")
                        .replace(/\{table\}/g, "STUDENT")
                        .replace(/\{count\}/g, "3")
                        .replace(/\{fields\}/g, "STUID, STUNM, CLASS")
                        .replace(/\{fields3\}/g, "STUID, STUNM, CLASS")
                        .replace(/\{fields5\}/g, "STUID, STUNM, CLASS");
                    return (
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        预览：
                        <code style={{ fontFamily: "var(--mono)", color: "var(--text-main)" }}>
                          {applyPreview(draft.fieldGroupCompletionFormat?.left ?? "{key}")}
                        </code>
                        <span style={{ color: "var(--text-muted)", margin: "0 6px" }}>···</span>
                        <code style={{ fontFamily: "var(--mono)", color: "var(--text-muted)", fontSize: 11 }}>
                          {applyPreview(draft.fieldGroupCompletionFormat?.right ?? "{table}: {fields5}")}
                        </code>
                      </div>
                    );
                  })()}
                  {/* 上下文分隔线开关 */}
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      color: "var(--text-main)",
                      cursor: "pointer",
                      marginTop: 2,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={draft.fieldGroupCompletionFormat?.showSeparator ?? true}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          fieldGroupCompletionFormat: {
                            ...d.fieldGroupCompletionFormat,
                            showSeparator: e.target.checked,
                          },
                        }))
                      }
                    />
                    在 FROM 表的组与其他表的组之间显示分隔线
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      （Monaco 无原生分隔符 API，以灰显补全项模拟）
                    </span>
                  </label>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <label style={lbl2}>「快捷赋值」序号图标交互</label>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
                  「快捷赋值」侧栏每行前会显示一个序号图标。点击该图标会把当前行的「值」
                  插入到编辑器光标处；若同时处于「已存 SQL」<code style={{ fontFamily: "var(--mono)", color: "#fbbf24" }}>${`{}`}</code> 占位符会话，插入后会自动跳到下一个占位符。
                  右键序号图标可设置该行的背景色（见侧栏右键菜单）。
                </div>
                <select
                  style={inp}
                  value={draft.quickInsertNumberIconBehavior}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      quickInsertNumberIconBehavior: e.target
                        .value as AppConfig["quickInsertNumberIconBehavior"],
                    }))
                  }
                >
                  <option value="dblclick">仅双击触发（默认，避免误触）</option>
                  <option value="click">仅单击触发（带 250ms 去抖）</option>
                  <option value="both">单击和双击均触发</option>
                  <option value="none">禁用（仅作展示）</option>
                </select>
              </div>

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
            </div>
          </AccordionSection>

          <AccordionSection
            title="3. 警告设置"
            expanded={openSections.warnings}
            onToggle={() => toggle("warnings")}
          >
            <p style={{ ...hint, marginTop: 0, marginBottom: 12 }}>
              以下开关控制编辑器内 JOIN 相关波浪线与底部汇总、以及「调整位置」无效光标提示是否启用；JOIN
              阈值仅在对应警告开启时生效。
            </p>

            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                marginBottom: 10,
                fontSize: 12,
                color: "var(--text)",
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <input
                type="checkbox"
                checked={draft.sqlDiagnosticsSettings.enableJoinLargeDrivingSmallWarning}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    sqlDiagnosticsSettings: {
                      ...d.sqlDiagnosticsSettings,
                      enableJoinLargeDrivingSmallWarning: e.target.checked,
                    },
                  }))
                }
                style={{ marginTop: 2 }}
              />
              <span>
                <strong>JOIN 顺序（大表驱动小表）</strong>
                <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                  书写顺序为左侧表 JOIN 右侧表，且两侧均在「查看表」登记了估计行数、左侧大于右侧并达到下限时提示。
                </span>
              </span>
            </label>

            <div style={{ marginLeft: 22, marginBottom: 14, minWidth: 0, maxWidth: 360 }}>
              <label style={lbl2}>左侧表估计行数下限</label>
              <input
                style={{ ...inp, opacity: draft.sqlDiagnosticsSettings.enableJoinLargeDrivingSmallWarning ? 1 : 0.45 }}
                type="number"
                min={0}
                step={1000}
                disabled={!draft.sqlDiagnosticsSettings.enableJoinLargeDrivingSmallWarning}
                value={draft.sqlDiagnosticsSettings.joinLargeDrivingSmallMinRows}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    sqlDiagnosticsSettings: {
                      ...d.sqlDiagnosticsSettings,
                      joinLargeDrivingSmallMinRows: Math.max(
                        0,
                        Math.floor(Number(e.target.value) || 0),
                      ),
                    },
                  }))
                }
              />
              <p style={{ ...hint, marginTop: 6, marginBottom: 0 }}>
                填 <strong>0</strong> 表示不设下限（只要左侧大于右侧即提示）。
              </p>
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                marginBottom: 0,
                fontSize: 12,
                color: "var(--text)",
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <input
                type="checkbox"
                checked={draft.sqlDiagnosticsSettings.enableJoinOnConfigMismatchWarning}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    sqlDiagnosticsSettings: {
                      ...d.sqlDiagnosticsSettings,
                      enableJoinOnConfigMismatchWarning: e.target.checked,
                    },
                  }))
                }
                style={{ marginTop: 2 }}
              />
              <span>
                <strong>JOIN ON 与配置表关系不一致</strong>
                <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                  已配置的两表关系存在时，将 SQL 中的 ON 与配置生成的条件比对，不一致则提示。
                </span>
              </span>
            </label>
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                marginBottom: 14,
                marginTop: 4,
                fontSize: 12,
                color: "var(--text)",
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <input
                type="checkbox"
                checked={draft.sqlDiagnosticsSettings.showRepositionInvalidCursorHint !== false}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    sqlDiagnosticsSettings: {
                      ...d.sqlDiagnosticsSettings,
                      showRepositionInvalidCursorHint: e.target.checked,
                    },
                  }))
                }
                style={{ marginTop: 2 }}
              />
              <span>
                <strong>调整位置：无效光标提示</strong>
                <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                  用快捷键或状态栏尝试进入「调整位置」时，若光标不在可解析的 FROM/JOIN 表片段或 SELECT
                  列上，是否在右下角以 VS Code 式通知提示说明（约 12 秒后自动消失）。关闭后可通过本项重新启用；通知内「不再显示」也会关闭此项。
                </span>
              </span>
            </label>
          </AccordionSection>

          <AccordionSection
            title="4. 配置 JSON"
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
