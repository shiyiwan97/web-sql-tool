import { useState, useEffect, type CSSProperties } from "react";
import type { GlobalSearchGroup } from "../types";

type Props = {
  open: boolean;
  groups: GlobalSearchGroup[];
  trigger: string;
  onClose: () => void;
  onSave: (groups: GlobalSearchGroup[]) => void;
};

type RowDraft = {
  key: string;
  /** 原始逗号分隔文本，不在 onChange 时 trim，避免空格被吞 */
  keywordsText: string;
};

function toRows(groups: GlobalSearchGroup[]): RowDraft[] {
  return groups.map((g) => ({ key: g.key, keywordsText: g.keywords.join(", ") }));
}

function parseRows(rows: RowDraft[]): GlobalSearchGroup[] {
  const seen = new Set<string>();
  const out: GlobalSearchGroup[] = [];
  for (const r of rows) {
    const key = r.key.trim();
    if (!key) continue;
    const dedupKey = key.toLowerCase();
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    const keywords = r.keywordsText
      .split(/[,，]/)
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
    // 关键词去重（大小写不敏感，保留顺序）
    const seenKw = new Set<string>();
    const dedupKws: string[] = [];
    for (const kw of keywords) {
      const u = kw.toLowerCase();
      if (seenKw.has(u)) continue;
      seenKw.add(u);
      dedupKws.push(kw);
    }
    out.push({ key, keywords: dedupKws });
  }
  return out;
}

export function GlobalSearchGroupsModal({ open, groups, trigger, onClose, onSave }: Props) {
  const [rows, setRows] = useState<RowDraft[]>([]);

  useEffect(() => {
    if (open) setRows(toRows(groups));
  }, [open, groups]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const updateRow = (idx: number, patch: Partial<RowDraft>) => {
    setRows((rs) => {
      const next = [...rs];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const addRow = () => setRows((rs) => [...rs, { key: "", keywordsText: "" }]);

  const removeRow = (idx: number) =>
    setRows((rs) => rs.filter((_, i) => i !== idx));

  const handleSave = () => {
    onSave(parseRows(rows));
    onClose();
  };

  return (
    <div
      style={backdrop}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={modal} role="dialog" aria-modal="true" aria-labelledby="gsm-title">
        {/* Header */}
        <div style={modalHead}>
          <h2 id="gsm-title" style={{ margin: 0, flex: 1, fontSize: 14 }}>
            全局搜索组配置
          </h2>
          <button type="button" style={btn} onClick={onClose}>
            关闭
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "14px 16px" }}>
          <p style={hint}>
            与「字段组」共用触发符&thinsp;
            <code style={{ fontFamily: "var(--mono)", color: "#fbbf24" }}>{trigger}</code>
            &thinsp;。输入&thinsp;
            <code style={{ fontFamily: "var(--mono)", color: "#fbbf24" }}>{trigger}组名</code>
            &thinsp;时，会用该组的所有关键词去匹配<strong>表名 / 表注释 / 字段名 / 字段注释</strong>，
            搜索栏与编辑器智能提示同时生效；表级命中在前、字段级命中在后。
            <br />
            例如配置&ensp;
            <code style={{ fontFamily: "var(--mono)" }}>julia = julia year, julia day</code>
            &ensp;，即可一次性找出所有"julia year / day"相关的表与字段。
            <br />
            <span style={{ color: "var(--text-muted)" }}>
              提示：普通搜索栏支持&thinsp;
              <code style={{ fontFamily: "var(--mono)", color: "#fbbf24" }}>|</code>
              &thinsp;分隔多个关键词（OR 语义），例如&thinsp;
              <code style={{ fontFamily: "var(--mono)" }}>julia year|julia day</code>。
            </span>
          </p>

          {/* Column headers */}
          {rows.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr 54px", gap: 6, marginBottom: 4 }}>
              <span style={colHdr}>组名（触发用）</span>
              <span style={colHdr}>关键词（逗号分隔，支持空格）</span>
              <span />
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rows.map((row, idx) => (
              <div
                key={idx}
                style={{ display: "grid", gridTemplateColumns: "140px 1fr 54px", gap: 6, alignItems: "start" }}
              >
                {/* key */}
                <input
                  type="text"
                  style={{ ...inp, fontFamily: "var(--mono)" }}
                  value={row.key}
                  onChange={(e) => updateRow(idx, { key: e.target.value })}
                  placeholder="如 julia"
                />
                {/* keywords — 存储原始文本，不在 onChange 做任何 trim，空格正常输入 */}
                <textarea
                  style={{ ...inp, fontFamily: "var(--mono)", minHeight: 38, resize: "vertical" }}
                  value={row.keywordsText}
                  onChange={(e) => updateRow(idx, { keywordsText: e.target.value })}
                  placeholder="如 julia year, julia day"
                  rows={1}
                />
                {/* delete */}
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  title="删除"
                  style={{
                    padding: "6px 10px",
                    fontSize: 11,
                    color: "#fca5a5",
                    background: "transparent",
                    border: "1px solid var(--border)",
                    borderRadius: 4,
                    cursor: "pointer",
                    alignSelf: "flex-start",
                  }}
                >
                  删除
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={addRow}
              style={{
                alignSelf: "flex-start",
                padding: "6px 14px",
                fontSize: 12,
                color: "var(--text-main)",
                background: "transparent",
                border: "1px dashed var(--border)",
                borderRadius: 4,
                cursor: "pointer",
                marginTop: 4,
              }}
            >
              + 添加搜索组
            </button>
          </div>
        </div>

        {/* Footer */}
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
            onClick={handleSave}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const backdrop: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 7000, // 比 SettingsModal (6000) 更高
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  background: "var(--modal-backdrop)",
};

const modal: CSSProperties = {
  width: "min(760px, 96vw)",
  maxHeight: "min(80vh, 700px)",
  display: "flex",
  flexDirection: "column",
  background: "var(--bg-panel)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
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
  lineHeight: 1.6,
  margin: "0 0 12px 0",
};

const colHdr: CSSProperties = {
  fontSize: 10,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const inp: CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  fontSize: 12,
  color: "var(--text)",
  background: "var(--bg-app)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  boxSizing: "border-box",
  minWidth: 0,
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

