import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { shortcutStringFromKeyboardEvent, normalizeShortcutSpec } from "../lib/shortcutFormat";

export type ShortcutConflictEntry = {
  label: string;
  shortcut: string;
};

function canConfirmShortcut(
  trimmed: string,
  initialShortcut: string,
  existingShortcuts: ShortcutConflictEntry[],
): boolean {
  const targetNorm = trimmed ? normalizeShortcutSpec(trimmed) : "";
  const conflict = targetNorm
    ? existingShortcuts.find(
        (e) => e.shortcut && normalizeShortcutSpec(e.shortcut) === targetNorm,
      )
    : undefined;
  const sameAsInitial =
    !!initialShortcut && targetNorm === normalizeShortcutSpec(initialShortcut);
  return trimmed.length > 0 && (!conflict || sameAsInitial);
}

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
  /** 叠在其它弹窗之上时提高层级（默认 12000） */
  zIndex?: number;
  /** 已占用的其它快捷键（用于冲突检测） */
  existingShortcuts?: ShortcutConflictEntry[];
};

export function ShortcutCaptureModal({
  open,
  title,
  description,
  initialShortcut = "",
  onClose,
  onConfirm,
  confirmLabel = "确定",
  zIndex = 12000,
  existingShortcuts = [],
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
      e.stopPropagation();
      e.stopImmediatePropagation();
      onClose();
      return;
    }
    if (e.key === "Enter") {
      const trimmed = liveRef.current.trim();
      if (!trimmed) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (canConfirmShortcut(trimmed, initialShortcut, existingShortcuts)) {
        onConfirm(trimmed);
      }
      return;
    }
    const s = shortcutStringFromKeyboardEvent(e);
    if (s) {
      e.preventDefault();
      e.stopPropagation();
      liveRef.current = s;
      setCaptured(s);
    }
  }, [existingShortcuts, initialShortcut, onClose, onConfirm]);

  useEffect(() => {
    if (!open) return;
    const opts = { capture: true };
    const fn = (e: KeyboardEvent) => trySetFromEvent(e);
    window.addEventListener("keydown", fn, opts);
    return () => window.removeEventListener("keydown", fn, opts);
  }, [open, trySetFromEvent]);

  if (!open) return null;

  const trimmed = captured.trim();
  const targetNorm = trimmed ? normalizeShortcutSpec(trimmed) : "";
  const conflict = targetNorm
    ? existingShortcuts.find(
        (e) => e.shortcut && normalizeShortcutSpec(e.shortcut) === targetNorm,
      )
    : undefined;
  const sameAsInitial =
    !!initialShortcut && targetNorm === normalizeShortcutSpec(initialShortcut);
  const canConfirm = canConfirmShortcut(trimmed, initialShortcut, existingShortcuts);

  return (
    <div
      style={{ ...overlay, zIndex }}
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
        <p style={pressHint}>
          请直接按下要绑定的组合键（焦点无需在输入框）；无冲突时可按 Enter 保存。
        </p>
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

        {conflict && !sameAsInitial ? (
          <div style={conflictBox} role="alert">
            <strong>⚠ 冲突</strong>：与{" "}
            <code style={{ margin: "0 4px", padding: "1px 4px", background: "rgba(255,255,255,0.05)", borderRadius: 3 }}>
              {conflict.shortcut}
            </code>{" "}
            （{conflict.label}）冲突，请换一个组合键。
          </div>
        ) : trimmed && !conflict ? (
          <div style={okBox}>✓ 该组合键无冲突，可保存。</div>
        ) : (
          <div style={pendingBox}>按下任意组合键开始检测…</div>
        )}

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
            style={canConfirm ? btnPrimary : btnDisabled}
            disabled={!canConfirm}
            onClick={() => canConfirm && onConfirm(trimmed)}
            title={
              !trimmed
                ? "请先按下组合键"
                : conflict && !sameAsInitial
                ? `与「${conflict.label}」冲突`
                : "保存"
            }
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

const btnDisabled: CSSProperties = {
  ...btnPrimary,
  borderColor: "var(--border)",
  background: "transparent",
  color: "var(--text-muted)",
  cursor: "not-allowed",
  opacity: 0.6,
};

const conflictBox: CSSProperties = {
  marginTop: 10,
  padding: "8px 10px",
  fontSize: 12,
  border: "1px solid rgba(239,68,68,0.5)",
  background: "rgba(239,68,68,0.1)",
  color: "#fca5a5",
  borderRadius: 6,
  lineHeight: 1.5,
};

const okBox: CSSProperties = {
  marginTop: 10,
  padding: "8px 10px",
  fontSize: 12,
  border: "1px solid rgba(34,197,94,0.5)",
  background: "rgba(34,197,94,0.1)",
  color: "#86efac",
  borderRadius: 6,
};

const pendingBox: CSSProperties = {
  marginTop: 10,
  padding: "8px 10px",
  fontSize: 12,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text-muted)",
  borderRadius: 6,
};

