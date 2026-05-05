import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { AppConfig, PanelBoxStyle, QuickInsertEntry } from "../types";
import { ShortcutCaptureModal } from "./ShortcutCaptureModal";
import { styleFromBox } from "./PanelStyleModal";

type Props = {
  config: AppConfig;
  setConfig: (fn: (c: AppConfig) => AppConfig) => void;
  /**
   * 单/双击行首序号图标时触发：把该行的「值」插入到编辑器光标处。
   * App 层根据当前是否处于占位符会话决定是否需要联动推进到下一个占位符。
   */
  onNumberIconActivate?: (entry: QuickInsertEntry) => void;
};

const PRESET_COLORS = [
  "", // 清除
  "#fe0404", // 鲜红
  "#ff7a00", // 橙
  "#facc15", // 黄
  "#22c55e", // 绿
  "#06b6d4", // 青
  "#3b82f6", // 蓝
  "#8b5cf6", // 紫
  "#ec4899", // 粉
  "#f97316", // 橘
  "#10b981", // 翡翠
  "#94a3b8", // 灰
];

function newEntry(): QuickInsertEntry {
  return {
    id: `qi-${globalThis.crypto?.randomUUID?.() ?? String(Date.now())}`,
    key: "",
    value: "",
    shortcut: "",
    bgScope: "row",
  };
}

export function QuickInsertPanel({
  config,
  setConfig,
  onNumberIconActivate,
}: Props) {
  const rows = config.quickInserts;
  const [captureRowId, setCaptureRowId] = useState<string | null>(null);
  const [paletteFor, setPaletteFor] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const ps = config.panelStyles.quickInsert;
  const numberIconBehavior = config.quickInsertNumberIconBehavior;

  const captureRow = captureRowId
    ? rows.find((r) => r.id === captureRowId)
    : undefined;

  const updateRow = (id: string, patch: Partial<QuickInsertEntry>) => {
    setConfig((c) => ({
      ...c,
      quickInserts: c.quickInserts.map((r) =>
        r.id === id ? { ...r, ...patch } : r,
      ),
    }));
  };

  const addRow = () => {
    setConfig((c) => ({ ...c, quickInserts: [...c.quickInserts, newEntry()] }));
  };

  const removeRow = (id: string) => {
    setConfig((c) => ({
      ...c,
      quickInserts: c.quickInserts.filter((r) => r.id !== id),
    }));
  };

  const wrap = (b: PanelBoxStyle, me: typeof ps.expandTarget): CSSProperties => {
    const base = styleFromBox(b);
    return { ...base, flex: ps.expandTarget === me ? 1 : "0 0 auto" };
  };

  // 关闭调色板：点击非调色板区域时
  useEffect(() => {
    if (!paletteFor) return;
    const close = (e: MouseEvent) => {
      const el = e.target;
      if (el instanceof Element && el.closest("[data-quick-insert-palette]"))
        return;
      setPaletteFor(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [paletteFor]);

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        padding: 12,
        overflow: "auto",
      }}
    >
      <p
        style={{
          fontSize: 11,
          color: "var(--text-muted)",
          lineHeight: 1.5,
          margin: "0 0 10px 0",
        }}
      >
        在编辑器中按下对应快捷键时，将「值」插入到光标处（不做引号等处理）。
        左侧序号图标点击同样会插入；右键序号图标可调整该行背景色。
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((r, i) => {
          const scope = r.bgScope ?? "row";
          const rowBg = scope === "row" && r.bgColor ? r.bgColor : undefined;
          return (
            <div
              key={r.id}
              style={{
                display: "flex",
                gap: 6,
                alignItems: "center",
                flexWrap: "wrap",
                minWidth: 0,
                padding: rowBg ? "4px 6px" : 0,
                borderRadius: rowBg ? 6 : 0,
                background: rowBg,
              }}
            >
              <NumberIconButton
                idx={i + 1}
                behavior={numberIconBehavior}
                bgColor={scope === "icon" ? r.bgColor : undefined}
                onActivate={() => onNumberIconActivate?.(r)}
                onContextMenu={(e) =>
                  setPaletteFor({ id: r.id, x: e.clientX, y: e.clientY })
                }
              />
              <input
                className="input"
                style={{ ...inp, ...wrap(ps.keyInput, "key") }}
                placeholder="键名"
                value={r.key}
                onChange={(e) => updateRow(r.id, { key: e.target.value })}
              />
              <input
                className="input"
                style={{ ...inp, ...wrap(ps.valueInput, "value") }}
                placeholder="值"
                value={r.value}
                onChange={(e) => updateRow(r.id, { value: e.target.value })}
              />
              <input
                className="input"
                style={{
                  ...inp,
                  cursor: "default",
                  ...wrap(ps.shortcutInput, "shortcut"),
                }}
                readOnly
                placeholder="未绑定"
                value={r.shortcut}
                title={r.shortcut || "未绑定快捷键"}
              />
              <button
                type="button"
                style={{ ...btnBind, ...styleFromBox(ps.bindButton) }}
                onClick={() => setCaptureRowId(r.id)}
              >
                {ps.bindButton.label || "绑定…"}
              </button>
              <button
                type="button"
                style={{ ...btnDel, ...styleFromBox(ps.deleteButton) }}
                onClick={() => removeRow(r.id)}
                aria-label="删除"
              >
                {ps.deleteButton.label || "×"}
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        style={{ ...btnAdd, marginTop: 10, ...styleFromBox(ps.addButton) }}
        onClick={addRow}
      >
        {ps.addButton.label || "+ 添加一行"}
      </button>

      {/* 右键调色板 */}
      {paletteFor
        ? (() => {
            const row = rows.find((r) => r.id === paletteFor.id);
            if (!row) return null;
            const curScope = row.bgScope ?? "row";
            return (
              <div
                data-quick-insert-palette
                style={{
                  position: "fixed",
                  left: Math.min(paletteFor.x, window.innerWidth - 240),
                  top: Math.min(paletteFor.y, window.innerHeight - 220),
                  zIndex: 14000,
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: 8,
                  boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
                  minWidth: 220,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    marginBottom: 6,
                  }}
                >
                  选择背景色
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(6, 24px)",
                    gap: 4,
                    marginBottom: 8,
                  }}
                >
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c || "_clear"}
                      type="button"
                      title={c || "清除"}
                      onClick={() => {
                        updateRow(paletteFor.id, {
                          bgColor: c || undefined,
                        });
                        setPaletteFor(null);
                      }}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 4,
                        border: "1px solid var(--border)",
                        background: c || "transparent",
                        cursor: "pointer",
                        position: "relative",
                      }}
                    >
                      {!c ? (
                        <span
                          style={{
                            color: "var(--text-muted)",
                            fontSize: 12,
                          }}
                        >
                          ×
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
                <label
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  自定义
                  <input
                    type="color"
                    defaultValue={
                      /^#[0-9a-fA-F]{6}$/.test(row.bgColor ?? "")
                        ? (row.bgColor as string)
                        : "#666666"
                    }
                    onChange={(e) =>
                      updateRow(paletteFor.id, { bgColor: e.target.value })
                    }
                    style={{
                      width: 32,
                      height: 22,
                      padding: 0,
                      border: "1px solid var(--border)",
                      borderRadius: 4,
                      background: "transparent",
                    }}
                  />
                  <button
                    type="button"
                    style={btnTiny}
                    onClick={() => {
                      updateRow(paletteFor.id, { bgColor: undefined });
                      setPaletteFor(null);
                    }}
                  >
                    清除
                  </button>
                </label>

                {/* 背景色作用范围 checkbox */}
                <div
                  style={{
                    borderTop: "1px solid var(--border)",
                    paddingTop: 6,
                    fontSize: 11,
                    color: "var(--text)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  <div
                    style={{
                      color: "var(--text-muted)",
                      fontSize: 10,
                      marginBottom: 2,
                    }}
                  >
                    应用范围
                  </div>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={curScope === "row"}
                      onChange={(e) =>
                        updateRow(paletteFor.id, {
                          bgScope: e.target.checked ? "row" : "icon",
                        })
                      }
                    />
                    应用到整行
                  </label>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={curScope === "icon"}
                      onChange={(e) =>
                        updateRow(paletteFor.id, {
                          bgScope: e.target.checked ? "icon" : "row",
                        })
                      }
                    />
                    仅应用到序号图标
                  </label>
                </div>
              </div>
            );
          })()
        : null}

      <ShortcutCaptureModal
        open={captureRowId !== null}
        title="绑定快捷赋值快捷键"
        description={
          captureRow?.key ? (
            <>
              条目：<strong>{captureRow.key}</strong>
            </>
          ) : (
            "为此行指定组合键。"
          )
        }
        initialShortcut={captureRow?.shortcut ?? ""}
        onClose={() => setCaptureRowId(null)}
        confirmLabel="保存"
        onConfirm={(s) => {
          if (captureRowId) updateRow(captureRowId, { shortcut: s });
          setCaptureRowId(null);
        }}
      />
    </div>
  );
}

/**
 * 行首序号图标按钮：根据 behavior 决定单击 / 双击触发；右键弹出调色板（外部 onContextMenu）。
 * 内部用 250ms 去抖避免双击重复触发。
 */
function NumberIconButton({
  idx,
  behavior,
  bgColor,
  onActivate,
  onContextMenu,
}: {
  idx: number;
  behavior: "click" | "dblclick" | "both" | "none";
  bgColor?: string;
  onActivate: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const clickTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (clickTimerRef.current !== null) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
    };
  }, []);

  const fireClick = () => {
    if (behavior !== "click" && behavior !== "both") return;
    if (clickTimerRef.current !== null) return;
    clickTimerRef.current = window.setTimeout(() => {
      clickTimerRef.current = null;
      onActivate();
    }, 250);
  };

  const fireDblClick = () => {
    if (clickTimerRef.current !== null) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    if (behavior !== "dblclick" && behavior !== "both") return;
    onActivate();
  };

  const disabled = behavior === "none";
  const tipParts: string[] = [];
  if (behavior === "click") tipParts.push("单击：把「值」插入到光标处");
  if (behavior === "dblclick") tipParts.push("双击：把「值」插入到光标处");
  if (behavior === "both") tipParts.push("单击或双击：把「值」插入到光标处");
  if (behavior === "none") tipParts.push("（已在设置中禁用）");
  tipParts.push("右键：设置该行背景色（可选整行 / 仅图标）");

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={fireClick}
      onDoubleClick={fireDblClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(e);
      }}
      style={{
        ...numIconStyle,
        ...(bgColor ? { background: bgColor, color: "#fff" } : null),
        ...(disabled ? { cursor: "not-allowed", opacity: 0.5 } : null),
      }}
      title={tipParts.join("\n")}
      tabIndex={-1}
    >
      {idx}
    </button>
  );
}

const inp: CSSProperties = {
  minWidth: 0,
  padding: "6px 8px",
  fontSize: 11,
  color: "var(--text)",
  background: "var(--bg-app)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  outline: "none",
};

const numIconStyle: CSSProperties = {
  width: 24,
  height: 24,
  flexShrink: 0,
  fontFamily: "var(--mono)",
  fontSize: 11,
  fontWeight: 700,
  color: "var(--text)",
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  cursor: "pointer",
  userSelect: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const btnBind: CSSProperties = {
  flexShrink: 0,
  padding: "6px 8px",
  fontSize: 11,
  border: "1px solid var(--border)",
  borderRadius: 6,
  background: "var(--bg-elevated)",
  color: "var(--text)",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const btnDel: CSSProperties = {
  padding: "4px 8px",
  fontSize: 14,
  lineHeight: 1,
  border: "1px solid var(--border)",
  borderRadius: 6,
  background: "var(--bg-elevated)",
  color: "var(--text-muted)",
  cursor: "pointer",
};

const btnAdd: CSSProperties = {
  padding: "6px 10px",
  fontSize: 11,
  alignSelf: "flex-start",
  border: "1px solid var(--border)",
  borderRadius: 6,
  background: "var(--bg-elevated)",
  color: "var(--text)",
  cursor: "pointer",
};

const btnTiny: CSSProperties = {
  padding: "2px 6px",
  fontSize: 10,
  borderRadius: 4,
  border: "1px solid var(--border)",
  background: "var(--bg-app)",
  color: "var(--text)",
  cursor: "pointer",
};
