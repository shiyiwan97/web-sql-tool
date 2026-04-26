import { useCallback, useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { MenuBar } from "./components/MenuBar";
import { SettingsModal } from "./components/SettingsModal";
import { SidebarSearch } from "./components/SidebarSearch";
import { DockableSidebarColumn } from "./components/DockableSidebarLayout";
import { QuickInsertPanel } from "./components/QuickInsertPanel";
import { CopyHotkeyModal } from "./components/CopyHotkeyModal";
import type { AppConfig, PanelSlot, SqlCompressLevel } from "./types";
import { loadConfig, saveConfig } from "./lib/storage";
import {
  applySqlFormatting,
  extractAliasedTables,
  insertFieldIntoSelectAtBlock,
  insertTableWithJoinsAtBlock,
  tableKey,
} from "./lib/sqlEditorOps";
import { normalizeConfig } from "./lib/configDefaults";
import {
  blockIndexAtOffset,
  countSqlBlocks,
  getBlockTextForCopy,
  getSqlBlocks,
} from "./lib/sqlBlocks";
import { shortcutStringToKeyCode } from "./lib/monacoKeybinding";

const DEFAULT_SQL = `SELECT *
FROM LIB.STUDENT s
WHERE s.GCLSID = 'C01'
;

SELECT s.STUNM, e.SUBJECT, e.SCORE
FROM LIB.STUDENT s
LEFT JOIN LIB.EXAMSCORE e ON s.STUID = e.STUID
WHERE e.SUBJECT = 'MATH'
`;

export default function App() {
  const [config, setConfig] = useState<AppConfig>(() => {
    const c = loadConfig();
    document.documentElement.dataset.theme = c.theme;
    return c;
  });
  const [sql, setSql] = useState(DEFAULT_SQL);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copyHotkeyOpen, setCopyHotkeyOpen] = useState(false);
  const [jsonFocusTick, setJsonFocusTick] = useState(0);
  const [monacoReadyTick, setMonacoReadyTick] = useState(0);
  const [curBlock, setCurBlock] = useState({ i: 1, n: 1 });
  const [editorFontSize, setEditorFontSize] = useState(13);
  const importRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const configRef = useRef(config);
  configRef.current = config;
  /** 侧栏插入 SQL 后恢复光标（受控 value 同步会把光标甩到文末） */
  const pendingEditorCursorOffsetRef = useRef<number | null>(null);

  useEffect(() => {
    saveConfig(config);
  }, [config]);

  useEffect(() => {
    const off = pendingEditorCursorOffsetRef.current;
    if (off === null) return;
    const t = window.setTimeout(() => {
      if (pendingEditorCursorOffsetRef.current !== off) return;
      pendingEditorCursorOffsetRef.current = null;
      const ed = editorRef.current;
      const model = ed?.getModel();
      if (!ed || !model) return;
      const len = model.getValueLength();
      const clamped = Math.max(0, Math.min(off, len));
      const pos = model.getPositionAt(clamped);
      ed.setPosition(pos);
      ed.revealPositionInCenter(pos);
    }, 0);
    return () => clearTimeout(t);
  }, [sql]);

  useEffect(() => {
    if (settingsOpen) return;
    document.documentElement.dataset.theme = config.theme;
  }, [settingsOpen, config.theme]);

  const patchConfig = useCallback((fn: (c: AppConfig) => AppConfig) => {
    setConfig(fn);
  }, []);

  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const bumpJsonFocus = useCallback(() => setJsonFocusTick((n) => n + 1), []);

  const onExportConfig = useCallback(() => {
    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "sql-web-tool-config.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }, [config]);

  const onImportFile = useCallback((file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        setConfig(normalizeConfig(parsed));
      } catch (e) {
        alert(`导入失败：${e instanceof Error ? e.message : e}`);
      }
    };
    reader.readAsText(file, "UTF-8");
  }, []);

  const getCopyBlockText = useCallback(() => {
    const ed = editorRef.current;
    const model = ed?.getModel();
    const pos = ed?.getPosition();
    const text = model?.getValue() ?? sql;
    const off =
      model && pos ? model.getOffsetAt(pos) : 0;
    const idx = blockIndexAtOffset(text, off);
    return getBlockTextForCopy(text, idx);
  }, [sql]);

  const copyFormattedSql = useCallback(async () => {
    const block = getCopyBlockText();
    const out = applySqlFormatting(block, config.sqlFormatting);
    try {
      await navigator.clipboard.writeText(out);
    } catch (e) {
      console.error("Clipboard write failed:", e);
    }
  }, [getCopyBlockText, config.sqlFormatting]);

  useEffect(() => {
    const ed = editorRef.current;
    if (!ed || monacoReadyTick === 0) return;
    const node = ed.getDomNode();
    if (!node) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      const ae = document.activeElement;
      if (!ae || !node.contains(ae)) return;
      e.preventDefault();
      e.stopPropagation();
      const step = e.deltaY < 0 ? 1 : -1;
      setEditorFontSize((s) => Math.min(28, Math.max(10, s + step)));
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [monacoReadyTick]);

  useEffect(() => {
    const ed = editorRef.current;
    if (!ed || monacoReadyTick === 0) return;
    const upd = () => {
      const model = ed.getModel();
      const pos = ed.getPosition();
      if (!model || !pos) return;
      const t = model.getValue();
      const n = countSqlBlocks(t);
      const idx = blockIndexAtOffset(t, model.getOffsetAt(pos));
      setCurBlock({ i: idx + 1, n: Math.max(1, n) });
    };
    upd();
    const d1 = ed.onDidChangeCursorPosition(upd);
    const d2 = ed.onDidChangeModelContent(upd);
    return () => {
      d1.dispose();
      d2.dispose();
    };
  }, [monacoReadyTick, sql]);

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    const disposables: Monaco.IDisposable[] = [];
    const copyKb = shortcutStringToKeyCode(
      monaco,
      config.hotkeys.copyCurrentBlock,
    );
    if (copyKb != null) {
      disposables.push(
        editor.addAction({
          id: "sql-tool-copy-block",
          label: "复制当前 SQL 块",
          keybindings: [copyKb],
          run: async () => {
            const model = editor.getModel();
            const pos = editor.getPosition();
            if (!model || !pos) return;
            const text = model.getValue();
            const idx = blockIndexAtOffset(text, model.getOffsetAt(pos));
            const block = getBlockTextForCopy(text, idx);
            const out = applySqlFormatting(
              block,
              configRef.current.sqlFormatting,
            );
            try {
              await navigator.clipboard.writeText(out);
            } catch (e) {
              console.error(e);
            }
          },
        }),
      );
    }
    for (const qi of config.quickInserts) {
      const code = shortcutStringToKeyCode(monaco, qi.shortcut);
      if (code == null) continue;
      disposables.push(
        editor.addAction({
          id: `qi-${qi.id}`,
          label: qi.key || "快捷赋值",
          keybindings: [code],
          run: (ed) => {
            const model = ed.getModel();
            const sel = ed.getSelection();
            if (!model || !sel) return;
            ed.executeEdits("quick-insert", [
              { range: sel, text: qi.value, forceMoveMarkers: true },
            ]);
          },
        }),
      );
    }
    return () => {
      disposables.forEach((d) => d.dispose());
    };
  }, [
    monacoReadyTick,
    config.hotkeys.copyCurrentBlock,
    config.quickInserts,
  ]);

  const renderPanel = (slot: PanelSlot) => {
    if (slot === "search") {
      return (
        <SidebarSearch
          config={config}
          onPickTable={(q) => {
            const ed = editorRef.current;
            const model = ed?.getModel();
            const pos = ed?.getPosition();
            const current = model?.getValue() ?? sql;
            const off = model && pos ? model.getOffsetAt(pos) : 0;
            const idx = blockIndexAtOffset(current, off);
            const blocks = getSqlBlocks(current);
            const bi = Math.min(idx, Math.max(0, blocks.length - 1));
            const b =
              blocks.length > 0
                ? blocks[bi]
                : { start: 0, end: current.length, text: current.trim() || current };
            const blockText = blocks.length > 0 ? b.text : current;
            if (extractAliasedTables(blockText).has(tableKey(q))) {
              return;
            }
            const tr = insertTableWithJoinsAtBlock(current, q, config, idx);
            if (tr.cursorOffset !== null) {
              pendingEditorCursorOffsetRef.current = tr.cursorOffset;
            }
            setSql(tr.sql);
          }}
          onPickField={(t, f) => {
            const ed = editorRef.current;
            const model = ed?.getModel();
            const pos = ed?.getPosition();
            const s = model?.getValue() ?? sql;
            const off = model && pos ? model.getOffsetAt(pos) : 0;
            const idx = blockIndexAtOffset(s, off);
            const fr = insertFieldIntoSelectAtBlock(s, t, f, config, idx);
            pendingEditorCursorOffsetRef.current = fr.cursorOffset;
            setSql(fr.sql);
          }}
        />
      );
    }
    return <QuickInsertPanel config={config} setConfig={patchConfig} />;
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 480,
      }}
    >
      <input
        ref={importRef}
        type="file"
        accept=".json,application/json"
        style={{ display: "none" }}
        onChange={(e) => {
          onImportFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />

      <MenuBar
        onOpenSettings={openSettings}
        onFocusJsonInSettings={bumpJsonFocus}
        onImportConfig={() => importRef.current?.click()}
        onExportConfig={onExportConfig}
        onOpenCopyHotkeyModal={() => setCopyHotkeyOpen(true)}
      />

      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "0 12px",
          height: 40,
          background: "var(--bg-panel)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 13 }}>
          SQL Web Tool{" "}
          <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
            · DB2 / AS400
          </span>
        </div>
        <div style={{ flex: 1 }} />
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            color: "var(--text-muted)",
          }}
        >
          压缩
          <select
            style={{
              padding: "4px 8px",
              fontSize: 12,
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--bg-elevated)",
              color: "var(--text)",
            }}
            value={String(config.sqlFormatting.compressLevel)}
            onChange={(e) => {
              const v = Number(e.target.value);
              const level = (v === 2 ? 2 : v === 1 ? 1 : 0) as SqlCompressLevel;
              setConfig((c) => ({
                ...c,
                sqlFormatting: { ...c.sqlFormatting, compressLevel: level },
              }));
            }}
          >
            <option value="0">0 不压缩</option>
            <option value="1">1 轻微</option>
            <option value="2">2 强力</option>
          </select>
        </label>
        <button
          type="button"
          style={{
            padding: "6px 12px",
            fontSize: 12,
            color: "var(--btn-primary-fg)",
            background: "var(--accent-dim)",
            border: "1px solid var(--accent)",
            borderRadius: 6,
            cursor: "pointer",
          }}
          onClick={copyFormattedSql}
        >
          复制
        </button>
      </header>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <DockableSidebarColumn
          side="left"
          config={config}
          setConfig={patchConfig}
          renderPanel={renderPanel}
        />
        <section
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            background: "var(--bg-app)",
          }}
        >
          <div
            style={{
              padding: "6px 12px",
              background: "var(--bg-panel)",
              borderBottom: "1px solid var(--border)",
              fontSize: 11,
              color: "var(--text-muted)",
            }}
          >
            Monaco · SQL · 当前块 {curBlock.i}/{curBlock.n}（以分号分隔；复制不含分号）·{" "}
            Ctrl+滚轮 调字号
          </div>
          <div style={{ flex: 1, minHeight: 200 }}>
            <Editor
              height="100%"
              language="sql"
              theme={config.theme === "light" ? "light" : "vs-dark"}
              value={sql}
              onChange={(v) => setSql(v ?? "")}
              onMount={(editor, monaco) => {
                editorRef.current = editor;
                monacoRef.current = monaco;
                setMonacoReadyTick((n) => n + 1);
              }}
              options={{
                minimap: { enabled: false },
                fontSize: editorFontSize,
                wordWrap: config.sqlFormatting.wrapLongLines ? "bounded" : "off",
                wordWrapColumn: Math.max(
                  20,
                  config.sqlFormatting.maxCharsPerLine,
                ),
                rulers: config.sqlFormatting.showColumnGuide
                  ? [
                      Math.max(
                        20,
                        Math.floor(config.sqlFormatting.maxCharsPerLine) || 72,
                      ),
                    ]
                  : [],
                tabSize: 2,
              }}
            />
          </div>
        </section>
        <DockableSidebarColumn
          side="right"
          config={config}
          setConfig={patchConfig}
          renderPanel={renderPanel}
        />
      </div>

      <footer
        style={{
          padding: "8px 16px",
          fontSize: 11,
          color: "var(--text-muted)",
          borderTop: "1px solid var(--border)",
          background: "var(--bg-panel)",
        }}
      >
        配置保存在浏览器 localStorage；可通过 File 菜单导入/导出 JSON。
      </footer>

      <SettingsModal
        open={settingsOpen}
        config={config}
        onClose={() => setSettingsOpen(false)}
        onApply={(c) => setConfig(c)}
        focusJsonTick={jsonFocusTick}
      />

      <CopyHotkeyModal
        open={copyHotkeyOpen}
        initialShortcut={config.hotkeys.copyCurrentBlock}
        onClose={() => setCopyHotkeyOpen(false)}
        onSave={(shortcut) =>
          setConfig((c) => ({
            ...c,
            hotkeys: { ...c.hotkeys, copyCurrentBlock: shortcut },
          }))
        }
      />
    </div>
  );
}
