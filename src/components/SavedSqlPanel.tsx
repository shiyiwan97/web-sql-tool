import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { SavedSqlSlot } from "../lib/savedSqlStorage";
import type { AppConfig, PanelBoxStyle } from "../types";
import { styleFromBox } from "./PanelStyleModal";

type Props = {
  slots: SavedSqlSlot[];
  config: AppConfig;
  activeSlotId: string;
  onSelectActive: (id: string) => void;
  onUpdateSlot: (
    id: string,
    patch: Partial<Pick<SavedSqlSlot, "name" | "sql" | "bgColor">>,
  ) => void;
  onPushToEditor: (id: string) => void;
  onDeleteSlot: (id: string) => void;
  /** 排序：把指定 id 移动到目标 index */
  onReorder: (id: string, targetIndex: number) => void;
};

const PRESET_COLORS = [
  "",
  "#7f1d1d",
  "#9a3412",
  "#854d0e",
  "#3f6212",
  "#065f46",
  "#0e7490",
  "#1e40af",
  "#5b21b6",
  "#9d174d",
  "#374151",
];

export function SavedSqlPanel({
  slots,
  config,
  activeSlotId,
  onSelectActive,
  onUpdateSlot,
  onPushToEditor,
  onDeleteSlot,
  onReorder,
}: Props) {
  const ps = config.panelStyles.savedSql;
  const [viewId, setViewId] = useState<string | null>(null);
  const viewing = viewId ? slots.find((s) => s.id === viewId) : undefined;
  const [draftSql, setDraftSql] = useState("");
  const [paletteFor, setPaletteFor] = useState<{ id: string; x: number; y: number } | null>(null);
  const dragIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!viewing) return;
    setDraftSql(viewing.sql);
  }, [viewing]);

  useEffect(() => {
    if (viewId && !slots.some((s) => s.id === viewId)) setViewId(null);
  }, [slots, viewId]);

  useEffect(() => {
    if (!viewId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      setViewId(null);
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [viewId]);

  // 点击其它位置关闭 palette
  useEffect(() => {
    if (!paletteFor) return;
    const close = (e: MouseEvent) => {
      const el = e.target;
      if (el instanceof Element && el.closest("[data-saved-palette]")) return;
      setPaletteFor(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [paletteFor]);

  const wrap = (b: PanelBoxStyle, me: typeof ps.expandTarget): CSSProperties => {
    const base = styleFromBox(b);
    return { ...base, flex: ps.expandTarget === me ? 1 : "0 0 auto" };
  };

  const onDragStart = (id: string) => (e: React.DragEvent) => {
    dragIdRef.current = id;
    e.dataTransfer.setData("application/x-saved-sql-slot", id);
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (e: React.DragEvent) => {
    if (!Array.from(e.dataTransfer.types).includes("application/x-saved-sql-slot")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  const onDropAt = (targetIndex: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("application/x-saved-sql-slot") || dragIdRef.current;
    dragIdRef.current = null;
    if (!id) return;
    onReorder(id, targetIndex);
  };

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
      <p style={hint}>
        槽位对应<strong>分号块</strong>：快捷键会按当前块或选区（去注释）<strong>新建一条存档</strong>。「使用」把该槽写入光标所在块。左侧 ⠿ 拖动排序；右键行可单独设置背景色。
      </p>
      {slots.length === 0 ? (
        <p style={{ ...hint, marginTop: 0 }}>暂无存档；在编辑器中按下「保存到已存 SQL」快捷键即可自动添加。</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {slots.map((r, i) => {
            const rowBg = r.bgColor || ps.rowBackground || "var(--bg-elevated)";
            const isActive = r.id === activeSlotId;
            return (
              <div
                key={r.id}
                onDragOver={onDragOver}
                onDrop={onDropAt(i)}
                onClick={() => onSelectActive(r.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setPaletteFor({ id: r.id, x: e.clientX, y: e.clientY });
                }}
                style={{
                  display: "flex",
                  gap: 6,
                  alignItems: "center",
                  flexWrap: "wrap",
                  minWidth: 0,
                  padding: 8,
                  borderRadius: 6,
                  border: isActive ? "1px solid var(--accent)" : "1px solid var(--border)",
                  background: rowBg,
                  cursor: "pointer",
                }}
              >
                <span
                  draggable
                  onDragStart={onDragStart(r.id)}
                  onClick={(e) => e.stopPropagation()}
                  title="拖动排序"
                  style={{
                    color: "var(--text-muted)",
                    fontSize: 14,
                    cursor: "grab",
                    userSelect: "none",
                    padding: "0 4px",
                  }}
                >
                  ⠿
                </span>
                <input
                  className="input"
                  style={{ ...inp, ...wrap(ps.nameInput, "name") }}
                  placeholder="名称"
                  value={r.name}
                  onChange={(e) => onUpdateSlot(r.id, { name: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  type="button"
                  style={{ ...btnOp, ...wrap(ps.showButton, "show") }}
                  title="查看或编辑 SQL"
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewId(r.id);
                  }}
                >
                  {ps.showButton.label || "展示"}
                </button>
                <button
                  type="button"
                  style={{ ...btnOp, ...wrap(ps.useButton, "use") }}
                  title="写入当前分号块"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPushToEditor(r.id);
                  }}
                >
                  {ps.useButton.label || "使用"}
                </button>
                <button
                  type="button"
                  style={{ ...btnDel, ...wrap(ps.deleteButton, "delete") }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSlot(r.id);
                  }}
                  aria-label="删除槽位"
                >
                  {ps.deleteButton.label || "×"}
                </button>
              </div>
            );
          })}
          {/* 末尾投放区 */}
          <div
            onDragOver={onDragOver}
            onDrop={onDropAt(slots.length)}
            style={{ height: 6 }}
            aria-hidden
          />
        </div>
      )}

      {/* 右键调色板 */}
      {paletteFor ? (
        <div
          data-saved-palette
          style={{
            position: "fixed",
            left: Math.min(paletteFor.x, window.innerWidth - 240),
            top: Math.min(paletteFor.y, window.innerHeight - 160),
            zIndex: 14000,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 8,
            boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
            minWidth: 220,
          }}
        >
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>选择背景色</div>
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
                  onUpdateSlot(paletteFor.id, { bgColor: c || undefined });
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
                  <span style={{ color: "var(--text-muted)", fontSize: 12 }}>×</span>
                ) : null}
              </button>
            ))}
          </div>
          <label style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", gap: 6, alignItems: "center" }}>
            自定义
            <input
              type="color"
              defaultValue={
                /^#[0-9a-fA-F]{6}$/.test(slots.find((s) => s.id === paletteFor.id)?.bgColor ?? "")
                  ? (slots.find((s) => s.id === paletteFor.id)?.bgColor as string)
                  : "#666666"
              }
              onChange={(e) => onUpdateSlot(paletteFor.id, { bgColor: e.target.value })}
              style={{ width: 32, height: 22, padding: 0, border: "1px solid var(--border)", borderRadius: 4, background: "transparent" }}
            />
            <button
              type="button"
              style={btnTiny}
              onClick={() => {
                onUpdateSlot(paletteFor.id, { bgColor: undefined });
                setPaletteFor(null);
              }}
            >
              清除
            </button>
          </label>
        </div>
      ) : null}

      {viewing ? (
        <div
          style={backdrop}
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewId(null);
          }}
        >
          <div
            style={modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="saved-sql-view-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="saved-sql-view-title" style={{ margin: "0 0 10px", fontSize: 14 }}>
              {viewing.name || "存档"}
            </h2>
            <textarea
              className="input"
              style={modalTa}
              value={draftSql}
              onChange={(e) => setDraftSql(e.target.value)}
              spellCheck={false}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button type="button" style={btnGhost} onClick={() => setViewId(null)}>
                取消
              </button>
              <button
                type="button"
                style={btnPrimary}
                onClick={() => {
                  onUpdateSlot(viewing.id, { sql: draftSql });
                  setViewId(null);
                }}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const hint: CSSProperties = {
  fontSize: 11,
  color: "var(--text-muted)",
  lineHeight: 1.5,
  margin: "0 0 10px 0",
};

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

const btnOp: CSSProperties = {
  flexShrink: 0,
  padding: "6px 8px",
  fontSize: 11,
  border: "1px solid var(--border)",
  borderRadius: 6,
  background: "var(--bg-app)",
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

const btnTiny: CSSProperties = {
  padding: "2px 6px",
  fontSize: 10,
  borderRadius: 4,
  border: "1px solid var(--border)",
  background: "var(--bg-app)",
  color: "var(--text)",
  cursor: "pointer",
};

const backdrop: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 12000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  background: "var(--modal-backdrop)",
};

const modal: CSSProperties = {
  width: "min(560px, 100%)",
  maxHeight: "min(80vh, 520px)",
  display: "flex",
  flexDirection: "column",
  padding: 16,
  borderRadius: 8,
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
};

const modalTa: CSSProperties = {
  flex: 1,
  minHeight: 200,
  width: "100%",
  padding: 10,
  fontSize: 12,
  fontFamily: "var(--mono)",
  color: "var(--text)",
  background: "var(--bg-app)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  outline: "none",
  resize: "vertical",
};

const btnGhost: CSSProperties = {
  padding: "6px 12px",
  fontSize: 12,
  border: "1px solid var(--border)",
  borderRadius: 6,
  background: "var(--bg-app)",
  color: "var(--text)",
  cursor: "pointer",
};

const btnPrimary: CSSProperties = {
  padding: "6px 12px",
  fontSize: 12,
  border: "1px solid var(--accent)",
  borderRadius: 6,
  background: "var(--accent)",
  color: "#fff",
  cursor: "pointer",
};
