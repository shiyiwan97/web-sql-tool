import { useEffect, useState, type CSSProperties } from "react";
import type { HotkeyConfig, QuickInsertEntry } from "../types";
import { ShortcutCaptureModal, type ShortcutConflictEntry } from "./ShortcutCaptureModal";

type Props = {
  open: boolean;
  hotkeys: HotkeyConfig;
  /** 用于冲突检测的额外占用条目（如快捷赋值） */
  quickInserts?: QuickInsertEntry[];
  onClose: () => void;
  onApply: (next: HotkeyConfig) => void;
};

type CaptureKind = "copy" | "save" | "compressLine" | "compressBlock" | "openSettings" | null;

export function HotkeysSettingsModal({
  open,
  hotkeys,
  quickInserts = [],
  onClose,
  onApply,
}: Props) {
  const [capture, setCapture] = useState<CaptureKind>(null);

  /** 排除当前正在编辑的项后，列出所有已占用的快捷键 */
  const buildExisting = (
    excludeKey: keyof HotkeyConfig,
  ): ShortcutConflictEntry[] => {
    const labels: Record<keyof HotkeyConfig, string> = {
      copyCurrentBlock: "复制当前分号块",
      saveEditorSql: "保存到「已存 SQL」",
      compressLineOrSelection: "压缩当前行/区域",
      compressCurrentBlock: "压缩当前分号块",
      openSettings: "打开设置面板",
    };
    const out: ShortcutConflictEntry[] = [];
    for (const k of Object.keys(labels) as Array<keyof HotkeyConfig>) {
      if (k === excludeKey) continue;
      const sc = hotkeys[k];
      if (sc) out.push({ label: `快捷键 · ${labels[k]}`, shortcut: sc });
    }
    for (const qi of quickInserts) {
      if (qi.shortcut) {
        out.push({
          label: `快捷赋值 · ${qi.key || "(未命名)"}`,
          shortcut: qi.shortcut,
        });
      }
    }
    return out;
  };

  useEffect(() => {
    if (!open || capture) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, capture, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        style={backdrop}
        role="presentation"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div style={modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
          <h2 style={{ margin: "0 0 12px", fontSize: 15 }}>快捷键</h2>
          <p style={hint}>
            点击「更改」后在键盘上按下组合键。与 Monaco 编辑器内快捷键共用同一套解析规则。
          </p>

          <div style={row}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={lbl}>复制当前分号块（格式化、无分号）</div>
              <code style={code}>{hotkeys.copyCurrentBlock || "（未绑定）"}</code>
            </div>
            <button type="button" style={btn} onClick={() => setCapture("copy")}>
              更改…
            </button>
          </div>

          <div style={row}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={lbl}>保存到「已存 SQL」（新建存档；块/选区，无注释）</div>
              <code style={code}>{hotkeys.saveEditorSql || "（未绑定）"}</code>
            </div>
            <button type="button" style={btn} onClick={() => setCapture("save")}>
              更改…
            </button>
          </div>

          <div style={row}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={lbl}>压缩当前行/区域（向上填充）</div>
              <code style={code}>{hotkeys.compressLineOrSelection || "（未绑定）"}</code>
            </div>
            <button type="button" style={btn} onClick={() => setCapture("compressLine")}>
              更改…
            </button>
          </div>

          <div style={row}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={lbl}>压缩当前分号块（整块向上填充）</div>
              <code style={code}>{hotkeys.compressCurrentBlock || "（未绑定）"}</code>
            </div>
            <button type="button" style={btn} onClick={() => setCapture("compressBlock")}>
              更改…
            </button>
          </div>

          <div style={row}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={lbl}>打开设置面板</div>
              <code style={code}>{hotkeys.openSettings || "（未绑定）"}</code>
            </div>
            <button type="button" style={btn} onClick={() => setCapture("openSettings")}>
              更改…
            </button>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
            <button type="button" style={btn} onClick={onClose}>
              关闭
            </button>
          </div>
        </div>
      </div>

      {capture === "copy" ? (
        <ShortcutCaptureModal
          open
          zIndex={13000}
          title="绑定：复制当前 SQL 块"
          description="与主界面「复制」、工具栏行为一致。"
          initialShortcut={hotkeys.copyCurrentBlock}
          existingShortcuts={buildExisting("copyCurrentBlock")}
          confirmLabel="保存"
          onClose={() => setCapture(null)}
          onConfirm={(s) => {
            onApply({ ...hotkeys, copyCurrentBlock: s });
            setCapture(null);
          }}
        />
      ) : null}
      {capture === "save" ? (
        <ShortcutCaptureModal
          open
          zIndex={13000}
          title="绑定：保存 SQL 到已存列表"
          description="无选区时保存当前分号块，有选区时保存选区内容；去掉注释后自动新建一条存档并选中。"
          initialShortcut={hotkeys.saveEditorSql}
          existingShortcuts={buildExisting("saveEditorSql")}
          confirmLabel="保存"
          onClose={() => setCapture(null)}
          onConfirm={(s) => {
            onApply({ ...hotkeys, saveEditorSql: s });
            setCapture(null);
          }}
        />
      ) : null}
      {capture === "compressLine" ? (
        <ShortcutCaptureModal
          open
          zIndex={13000}
          title="绑定：压缩当前行/区域"
          description="光标所在行（或选区覆盖的行）会尝试从下一行搬词向上填充，直到接近每行最大字符。"
          initialShortcut={hotkeys.compressLineOrSelection}
          existingShortcuts={buildExisting("compressLineOrSelection")}
          confirmLabel="保存"
          onClose={() => setCapture(null)}
          onConfirm={(s) => {
            onApply({ ...hotkeys, compressLineOrSelection: s });
            setCapture(null);
          }}
        />
      ) : null}
      {capture === "compressBlock" ? (
        <ShortcutCaptureModal
          open
          zIndex={13000}
          title="绑定：压缩当前分号块"
          description="对当前分号块执行同样的向上填充压缩（仅影响当前块）。"
          initialShortcut={hotkeys.compressCurrentBlock}
          existingShortcuts={buildExisting("compressCurrentBlock")}
          confirmLabel="保存"
          onClose={() => setCapture(null)}
          onConfirm={(s) => {
            onApply({ ...hotkeys, compressCurrentBlock: s });
            setCapture(null);
          }}
        />
      ) : null}
      {capture === "openSettings" ? (
        <ShortcutCaptureModal
          open
          zIndex={13000}
          title="绑定：打开设置面板"
          description="在编辑器内/外按下都会唤起设置 Modal。建议组合 Ctrl+Alt 等避免冲突。"
          initialShortcut={hotkeys.openSettings}
          existingShortcuts={buildExisting("openSettings")}
          confirmLabel="保存"
          onClose={() => setCapture(null)}
          onConfirm={(s) => {
            onApply({ ...hotkeys, openSettings: s });
            setCapture(null);
          }}
        />
      ) : null}
    </>
  );
}

const backdrop: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 11000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  background: "var(--modal-backdrop)",
};

const modal: CSSProperties = {
  width: "min(440px, 100%)",
  maxHeight: "90vh",
  overflow: "auto",
  padding: 20,
  borderRadius: "var(--radius)",
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  boxShadow: "0 16px 48px rgba(0,0,0,0.35)",
};

const hint: CSSProperties = {
  fontSize: 12,
  color: "var(--text-muted)",
  margin: "0 0 16px",
  lineHeight: 1.5,
};

const row: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  padding: "12px 0",
  borderBottom: "1px solid var(--border)",
};

const lbl: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 6,
};

const code: CSSProperties = {
  display: "block",
  fontFamily: "var(--mono)",
  fontSize: 12,
  color: "var(--btn-primary-fg)",
};

const btn: CSSProperties = {
  padding: "8px 14px",
  fontSize: 13,
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--bg-app)",
  color: "var(--text)",
  cursor: "pointer",
  flexShrink: 0,
};
