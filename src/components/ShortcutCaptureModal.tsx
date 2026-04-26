import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { shortcutStringFromKeyboardEvent } from "../lib/shortcutFormat";

export type ShortcutCaptureModalProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  /** 打开时展示的已有绑定（只读预览，按下新键后替换） */
  initialShortcut?: string;
  onClose: () => void;
  /** 用户点击确定且当前有有效快捷键时调用 */
  onConfirm: (shortcut: string) => void;
  /** 确定按钮文案 */
  confirmLabel?: string;
};

export function ShortcutCaptureModal({
  open,
  title,
  description,
  initialShortcut = "",
  onClose,
  onConfirm,
  confirmLabel = "确定",
}: ShortcutCaptureModalProps) {
  const [captured, setCaptured] = useState(initialShortcut);
  const liveRef = useRef("");

  useEffect(() => {
    if (open) {
      setCaptured(initialShortcut);
      liveRef.current = initialShortcut;
    }
  }, [open, initialShortcut]);

  const trySetFromEvent = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "Enter" && liveRef.current.trim()) {
      e.preventDefault();
      onConfirm(liveRef.current.trim());
      return;
    }
    const s = shortcutStringFromKeyboardEvent(e);
    if (s) {
      e.preventDefault();
      e.stopPropagation();
      liveRef.current = s;
      setCaptured(s);
    }
  }, [onClose, onConfirm]);

  useEffect(() => {
    if (!open) return;
    const opts = { capture: true };
    const fn = (e: KeyboardEvent) => trySetFromEvent(e);
    window.addEventListener("keydown", fn, opts);
    return () => window.removeEventListener("keydown", fn, opts);
  }, [open, trySetFromEvent]);

  if (!open) return null;

  const canConfirm = captured.trim().length > 0;

  return (
    <div
      style={overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcut-capture-title"
      onClick={onClose}
    >
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h2 id="shortcut-capture-title" style={titleStyle}>
          {title}
        </h2>
        {description ? <div style={hint}>{description}</div> : null}
        <p style={pressHint}>请直接按下要绑定的组合键（焦点无需在输入框）</p>
        <div
          style={previewBox}
          tabIndex={-1}
          aria-live="polite"
          aria-label="当前捕获的快捷键"
        >
          {captured || (
            <span style={{ color: "var(--text-muted)" }}>等待按键…</span>
          )}
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            flexWrap: "wrap",
            marginTop: 16,
          }}
        >
          <button type="button" style={btnGhost} onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            style={btnGhost}
            onClick={() => {
              liveRef.current = "";
              setCaptured("");
            }}
          >
            清除
          </button>
          <button
            type="button"
            style={btnPrimary}
            disabled={!canConfirm}
            onClick={() => onConfirm(captured.trim())}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.35)",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 5000,
  padding: 16,
};

const modal: CSSProperties = {
  width: "min(420px, 100%)",
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: 20,
  boxShadow: "0 16px 48px rgba(0,0,0,0.35)",
};

const titleStyle: CSSProperties = {
  margin: "0 0 8px 0",
  fontSize: 16,
  fontWeight: 600,
};

const hint: CSSProperties = {
  margin: "0 0 10px 0",
  fontSize: 12,
  color: "var(--text-muted)",
  lineHeight: 1.5,
};

const pressHint: CSSProperties = {
  margin: "0 0 8px 0",
  fontSize: 12,
  color: "var(--text)",
  fontWeight: 500,
};

const previewBox: CSSProperties = {
  minHeight: 44,
  display: "flex",
  alignItems: "center",
  padding: "10px 12px",
  fontFamily: "var(--mono)",
  fontSize: 14,
  color: "var(--text)",
  background: "var(--bg-app)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  outline: "none",
};

const btnGhost: CSSProperties = {
  padding: "6px 14px",
  fontSize: 13,
  border: "1px solid var(--border)",
  borderRadius: 6,
  background: "transparent",
  color: "var(--text)",
  cursor: "pointer",
};

const btnPrimary: CSSProperties = {
  padding: "6px 14px",
  fontSize: 13,
  border: "1px solid var(--accent)",
  borderRadius: 6,
  background: "var(--accent-dim)",
  color: "var(--btn-primary-fg)",
  cursor: "pointer",
};
