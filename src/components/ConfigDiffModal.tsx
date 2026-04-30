import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { AppConfig } from "../types";
import {
  blocksAreEqual,
  buildPortableConfig,
  CONFIG_BLOCK_KEYS,
  CONFIG_BLOCK_LABELS,
  getOrCreateUserId,
  parsePortableJson,
  setUserId,
  type ConfigBlockKey,
  type ConfigBlocksMeta,
  type PortableConfig,
} from "../lib/configBlocks";

type Props = {
  open: boolean;
  config: AppConfig;
  blocksMeta: ConfigBlocksMeta;
  onClose: () => void;
  onApplyBlock: (key: ConfigBlockKey, value: unknown, fromUserId: string) => void;
  onApplyAll: (incoming: AppConfig, fromUserId: string) => void;
};

function jsonOf(v: unknown): string {
  return JSON.stringify(v ?? null, null, 2);
}

type DiffRow = { type: "same" | "left" | "right"; left?: string; right?: string };

function diffLines(aText: string, bText: string): DiffRow[] {
  const a = aText.split("\n");
  const b = bText.split("\n");
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const out: DiffRow[] = [];
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) { out.push({ type: "same", left: a[i], right: b[j] }); i++; j++; }
    else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) { out.push({ type: "left", left: a[i] }); i++; }
    else { out.push({ type: "right", right: b[j] }); j++; }
  }
  while (i < m) out.push({ type: "left", left: a[i++] });
  while (j < n) out.push({ type: "right", right: b[j++] });
  return out;
}

export function ConfigDiffModal({ open, config, blocksMeta, onClose, onApplyBlock, onApplyAll }: Props) {
  const [incoming, setIncoming] = useState<PortableConfig | null>(null);
  const [text, setText] = useState("");
  const [activeKey, setActiveKey] = useState<ConfigBlockKey>(CONFIG_BLOCK_KEYS[0]);
  const [parseError, setParseError] = useState("");
  const [hideEqual, setHideEqual] = useState(true);
  const [myUid, setMyUid] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setMyUid(getOrCreateUserId());
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const tryParse = (s: string) => {
    setText(s);
    setParseError("");
    if (!s.trim()) { setIncoming(null); return; }
    try {
      const json = JSON.parse(s);
      const p = parsePortableJson(json);
      if (!p) { setParseError("无法识别的 JSON 结构"); setIncoming(null); return; }
      setIncoming(p);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : String(e));
      setIncoming(null);
    }
  };

  const onFile = (file: File | null) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => tryParse(String(r.result ?? ""));
    r.readAsText(file, "UTF-8");
  };

  const exportLocal = () => {
    const portable = buildPortableConfig(config, blocksMeta);
    const blob = new Blob([JSON.stringify(portable, null, 2)], { type: "application/json;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "sql-web-tool-config-portable.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const blockList = useMemo(() => {
    if (!incoming) return [];
    return CONFIG_BLOCK_KEYS.map((k) => ({
      key: k,
      equal: blocksAreEqual(incoming.config, config, k),
      incomingMeta: incoming.blocksMeta[k],
      localMeta: blocksMeta[k],
    }));
  }, [incoming, config, blocksMeta]);

  const visible = useMemo(
    () => (hideEqual ? blockList.filter((b) => !b.equal) : blockList),
    [blockList, hideEqual],
  );

  const leftJson = jsonOf(incoming ? (incoming.config as any)[activeKey] : null);
  const rightJson = jsonOf((config as any)[activeKey]);
  const diff = useMemo(() => diffLines(leftJson, rightJson), [leftJson, rightJson]);

  if (!open) return null;
  return (
    <div style={backdrop} role="presentation" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modal} role="dialog" aria-modal="true" aria-label="配置 比较 / 合并">
        <div style={head}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 800 }}>配置：比较 / 合并</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              左 = 对方（导入的 JSON） · 右 = 本地。可逐块应用到本地，或导出本地配置发给别人。
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
              我的 userId：
              <input type="text" value={myUid} onChange={(e) => { setMyUid(e.target.value); setUserId(e.target.value); }} style={{ ...inputStyle, width: 220 }} />
            </label>
            <button type="button" style={btnSm} onClick={exportLocal}>导出本地（含 meta）</button>
            <button type="button" style={btnSm} onClick={onClose}>关闭</button>
          </div>
        </div>

        <div style={inputBar}>
          <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: "none" }} onChange={(e) => { onFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
          <button type="button" style={btnSm} onClick={() => fileRef.current?.click()}>选择文件…</button>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>或粘贴 JSON 到下方文本框：</span>
          <button
            type="button"
            style={btnSm}
            disabled={!incoming}
            onClick={() => { if (!incoming) return; if (!confirm("将“对方 JSON”整体应用到本地配置？")) return; onApplyAll(incoming.config, incoming.userId || "(unknown)"); }}
          >
            ⇒ 全部应用到本地
          </button>
          <label style={{ marginLeft: "auto", fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={hideEqual} onChange={(e) => setHideEqual(e.target.checked)} />
            隐藏相同块
          </label>
        </div>

        <div style={inputArea}>
          <textarea value={text} onChange={(e) => tryParse(e.target.value)} placeholder="粘贴对方导出的 portable JSON 或旧格式 AppConfig…" style={textareaStyle} spellCheck={false} />
          {parseError ? (
            <div style={{ fontSize: 11, color: "var(--danger-muted)", marginTop: 4 }}>⚠ {parseError}</div>
          ) : incoming ? (
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
              来源 userId：<code>{incoming.userId || "(未提供)"}</code> · 生成时间 {incoming.generatedAt}
            </div>
          ) : null}
        </div>

        <div style={body}>
          <aside style={asideLeft}>
            {!incoming ? (
              <div style={{ ...hint, padding: 10 }}>请先导入或粘贴对方 JSON。</div>
            ) : visible.length === 0 ? (
              <div style={{ ...hint, padding: 10 }}>所有块都相同 ✅</div>
            ) : (
              visible.map(({ key, equal, incomingMeta, localMeta }) => (
                <button key={key} type="button" style={{ ...listItem, borderColor: key === activeKey ? "rgba(59,130,246,0.6)" : "var(--border)" }} onClick={() => setActiveKey(key)}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{CONFIG_BLOCK_LABELS[key]}</span>
                    <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 3, background: equal ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: equal ? "#86efac" : "#fca5a5" }}>
                      {equal ? "相同" : "差异"}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                    左 v{incomingMeta?.version ?? "?"} · {(incomingMeta?.userId || "(未知)").slice(0, 16)} · 右 v{localMeta?.version ?? 1} · {(localMeta?.userId || "(本地)").slice(0, 16)}
                  </div>
                </button>
              ))
            )}
          </aside>

          <main style={asideRight}>
            {!incoming ? (
              <div style={{ ...hint, padding: 12 }}>导入 JSON 后在此显示逐块 diff。</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{CONFIG_BLOCK_LABELS[activeKey]}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>（key: <code>{activeKey}</code>）</div>
                  <div style={{ flex: 1 }} />
                  <button type="button" style={primaryBtn} onClick={() => { if (!incoming) return; onApplyBlock(activeKey, (incoming.config as any)[activeKey], incoming.userId || "(unknown)"); }}>
                    ← 用左侧覆盖右侧（应用到本地）
                  </button>
                  <button
                    type="button"
                    style={btnSm}
                    onClick={() => navigator.clipboard?.writeText(jsonOf((config as any)[activeKey])).catch(() => undefined)}
                    title="把本地块 JSON 复制到剪贴板（贴回对方使用）"
                  >
                    → 复制本地块 JSON
                  </button>
                </div>
                <DiffView rows={diff} />
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function DiffView({ rows }: { rows: DiffRow[] }) {
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: "auto", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-app)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--mono)", fontSize: 11, tableLayout: "fixed" }}>
        <thead>
          <tr style={{ position: "sticky", top: 0, background: "var(--bg-elevated)", zIndex: 1 }}>
            <th style={diffTh}>对方（incoming）</th>
            <th style={diffTh}>本地（local）</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const lBg = r.type === "left" ? "rgba(34,197,94,0.10)" : "transparent";
            const rBg = r.type === "right" ? "rgba(239,68,68,0.10)" : "transparent";
            const lFg = r.type === "left" ? "#86efac" : "var(--text)";
            const rFg = r.type === "right" ? "#fca5a5" : "var(--text)";
            return (
              <tr key={i}>
                <td style={{ ...diffTd, background: lBg, color: lFg }}>
                  <span style={{ color: "var(--text-muted)", marginRight: 6 }}>{r.type === "left" ? "+" : " "}</span>
                  {r.left ?? ""}
                </td>
                <td style={{ ...diffTd, background: rBg, color: rFg }}>
                  <span style={{ color: "var(--text-muted)", marginRight: 6 }}>{r.type === "right" ? "-" : " "}</span>
                  {r.right ?? ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const backdrop: CSSProperties = { position: "fixed", inset: 0, background: "var(--modal-backdrop)", padding: 16, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" };
const modal: CSSProperties = { width: "min(1320px, 100%)", height: "min(820px, 100%)", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 14, boxShadow: "0 24px 80px rgba(0,0,0,0.45)", overflow: "hidden", display: "flex", flexDirection: "column" };
const head: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 12px", borderBottom: "1px solid var(--border)", flexWrap: "wrap" };
const inputBar: CSSProperties = { display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid var(--border)", background: "var(--bg-panel)", flexWrap: "wrap" };
const inputArea: CSSProperties = { padding: "8px 12px", borderBottom: "1px solid var(--border)", background: "var(--bg-app)" };
const textareaStyle: CSSProperties = { width: "100%", height: 80, padding: 8, fontFamily: "var(--mono)", fontSize: 11, background: "var(--bg-panel)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6, outline: "none", resize: "vertical", boxSizing: "border-box" };
const body: CSSProperties = { flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "300px 1fr" };
const asideLeft: CSSProperties = { padding: 10, borderRight: "1px solid var(--border)", overflow: "auto", minHeight: 0, background: "var(--bg-panel)", display: "grid", gap: 6, alignContent: "start" };
const asideRight: CSSProperties = { padding: 12, overflow: "hidden", minHeight: 0, display: "flex", flexDirection: "column" };
const listItem: CSSProperties = { width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-app)", cursor: "pointer", textAlign: "left" };
const inputStyle: CSSProperties = { padding: "4px 8px", fontSize: 11, color: "var(--text)", background: "var(--bg-app)", border: "1px solid var(--border)", borderRadius: 6, outline: "none" };
const hint: CSSProperties = { fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 };
const btnSm: CSSProperties = { padding: "6px 10px", fontSize: 11, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-app)", color: "var(--text)", cursor: "pointer" };
const primaryBtn: CSSProperties = { ...btnSm, borderColor: "var(--accent)", background: "var(--accent-dim)", color: "var(--btn-primary-fg)", fontWeight: 600 };
const diffTh: CSSProperties = { textAlign: "left", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", padding: "6px 10px", borderBottom: "1px solid var(--border)", background: "var(--bg-elevated)" };
const diffTd: CSSProperties = { padding: "1px 10px", whiteSpace: "pre-wrap", wordBreak: "break-word", verticalAlign: "top", borderBottom: "1px solid rgba(255,255,255,0.03)", width: "50%" };

