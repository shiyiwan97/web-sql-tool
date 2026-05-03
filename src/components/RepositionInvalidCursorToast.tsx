import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onDismiss: () => void;
  onNeverShowAgain: () => void;
};

const AUTO_DISMISS_MS = 12000;

function IconClose() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M4 4l8 8M12 4l-8 8"
        stroke="currentColor"
        strokeWidth={1.25}
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconEllipsis() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <circle cx={3} cy={8} r={1.35} />
      <circle cx={8} cy={8} r={1.35} />
      <circle cx={13} cy={8} r={1.35} />
    </svg>
  );
}

/** 右下角提示：对齐 VS Code notificationToast 配色与密度（Portal 到 body）。 */
export function RepositionInvalidCursorToast({
  open,
  onDismiss,
  onNeverShowAgain,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      setMenuOpen(false);
      return;
    }
    if (menuOpen) return;
    const t = window.setTimeout(() => onDismiss(), AUTO_DISMISS_MS);
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc, true);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", onDoc, true);
    };
  }, [open, menuOpen, onDismiss]);

  if (!open) return null;

  const ui = (
    <div className="reposition-vscode-notification-host">
      <div className="reposition-vscode-notification-toast" role="status" aria-live="polite" aria-atomic>
        <div className="reposition-vscode-notification-accent" aria-hidden />
        <div className="reposition-vscode-notification-main">
          <p className="reposition-vscode-notification-msg">
            请选中字段或表后再进入调整模式。
          </p>
          <div className="reposition-vscode-notification-actions">
            <div ref={menuRef} className="reposition-vscode-notification-menu-wrap">
              <button
                type="button"
                className="reposition-vscode-notification-iconbtn"
                title="更多"
                aria-label="更多选项"
                aria-expanded={menuOpen}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((v) => !v);
                }}
              >
                <IconEllipsis />
              </button>
              {menuOpen ? (
                <div className="reposition-vscode-notification-dropdown" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    className="reposition-vscode-notification-menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onNeverShowAgain();
                    }}
                  >
                    不再显示该提示
                  </button>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="reposition-vscode-notification-iconbtn"
              onClick={onDismiss}
              aria-label="关闭"
              title="关闭"
            >
              <IconClose />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(ui, document.body);
}
