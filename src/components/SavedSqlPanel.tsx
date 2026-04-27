import { useEffect, useState, type CSSProperties } from "react";
import type { SavedSqlSlot } from "../lib/savedSqlStorage";

type Props = {
  slots: SavedSqlSlot[];
  activeSlotId: string;
  onSelectActive: (id: string) => void;
  onUpdateSlot: (id: string, patch: Partial<Pick<SavedSqlSlot, "name" | "sql">>) => void;
  /** 将槽位内容写入编辑器当前分号块（不整篇替换） */
  onPushToEditor: (id: string) => void;
  onDeleteSlot: (id: string) => void;
};

export function SavedSqlPanel({
  slots,
  activeSlotId,
  onSelectActive,
  onUpdateSlot,
  onPushToEditor,
  onDeleteSlot,
}: Props) {
  const [viewId, setViewId] = useState<string | null>(null);
  const viewing = viewId ? slots.find((s) => s.id === viewId) : undefined;
  const [draftSql, setDraftSql] = useState("");

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
        槽位对应<strong>分号块</strong>：快捷键会按当前块或选区（去注释）<strong>新建一条存档</strong>。「使用」把该槽写入光标所在块。
      </p>
      {slots.length === 0 ? (
        <p style={{ ...hint, marginTop: 0 }}>暂无存档；在编辑器中按下「保存到已存 SQL」快捷键即可自动添加。</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {slots.map((r) => (
            <div
              key={r.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectActive(r.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onSelectActive(r.id);
              }}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(56px, 1fr) auto auto auto",
                gap: 6,
                alignItems: "center",
                minWidth: 0,
                padding: 8,
                borderRadius: 6,
                border:
                  r.id === activeSlotId
                    ? "1px solid var(--accent)"
                    : "1px solid var(--border)",
                background:
                  r.id === activeSlotId ? "var(--accent-dim)" : "var(--bg-elevated)",
              }}
            >
              <input
                className="input"
                style={inp}
                placeholder="名称"
                value={r.name}
                onChange={(e) => onUpdateSlot(r.id, { name: e.target.value })}
                onClick={(e) => e.stopPropagation()}
              />
              <button
                type="button"
                style={btnOp}
                title="查看或编辑 SQL"
                onClick={(e) => {
                  e.stopPropagation();
                  setViewId(r.id);
                }}
              >
                展示
              </button>
              <button
                type="button"
                style={btnOp}
                title="写入当前分号块"
                onClick={(e) => {
                  e.stopPropagation();
                  onPushToEditor(r.id);
                }}
              >
                使用
              </button>
              <button
                type="button"
                style={btnDel}
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteSlot(r.id);
                }}
                aria-label="删除槽位"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

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
