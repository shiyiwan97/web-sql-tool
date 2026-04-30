import { useState, type CSSProperties } from "react";
import type { AppConfig, PanelBoxStyle, QuickInsertEntry } from "../types";
import { ShortcutCaptureModal, type ShortcutConflictEntry } from "./ShortcutCaptureModal";
import { styleFromBox } from "./PanelStyleModal";

type Props = {
  config: AppConfig;
  setConfig: (fn: (c: AppConfig) => AppConfig) => void;
};

function newEntry(): QuickInsertEntry {
  return {
    id: `qi-${globalThis.crypto?.randomUUID?.() ?? String(Date.now())}`,
    key: "",
    value: "",
    shortcut: "",
  };
}

export function QuickInsertPanel({ config, setConfig }: Props) {
  const rows = config.quickInserts;
  const [captureRowId, setCaptureRowId] = useState<string | null>(null);
  const ps = config.panelStyles.quickInsert;

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
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((r) => (
          <div
            key={r.id}
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              flexWrap: "wrap",
              minWidth: 0,
            }}
          >
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
              style={{ ...inp, cursor: "default", ...wrap(ps.shortcutInput, "shortcut") }}
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
        ))}
      </div>
      <button type="button" style={{ ...btnAdd, marginTop: 10, ...styleFromBox(ps.addButton) }} onClick={addRow}>
        {ps.addButton.label || "+ 添加一行"}
      </button>

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
        existingShortcuts={(() => {
          const out: ShortcutConflictEntry[] = [];
          for (const r of rows) {
            if (r.id === captureRowId) continue;
            if (r.shortcut) out.push({ label: `快捷赋值 · ${r.key || "(未命名)"}`, shortcut: r.shortcut });
          }
          const h = config.hotkeys;
          const labels: Record<string, string> = {
            copyCurrentBlock: "复制当前分号块",
            saveEditorSql: "保存到「已存 SQL」",
            compressLineOrSelection: "压缩当前行/区域",
            compressCurrentBlock: "压缩当前分号块",
            openSettings: "打开设置面板",
          };
          for (const k of Object.keys(labels)) {
            const sc = (h as any)[k] as string;
            if (sc) out.push({ label: `快捷键 · ${labels[k]}`, shortcut: sc });
          }
          return out;
        })()}
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
