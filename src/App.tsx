import { useCallback, useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { MenuBar } from "./components/MenuBar";
import { SettingsModal } from "./components/SettingsModal";
import { SidebarSearch } from "./components/SidebarSearch";
import {
  DockableSidebarColumn,
  SidebarWidthHandle,
} from "./components/DockableSidebarLayout";
import { QuickInsertPanel } from "./components/QuickInsertPanel";
import { SavedSqlPanel } from "./components/SavedSqlPanel";
import { HotkeysSettingsModal } from "./components/HotkeysSettingsModal";
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
  replaceBlockText,
} from "./lib/sqlBlocks";
import { stripSqlComments } from "./lib/sqlComments";
import {
  loadSidebarUi,
  persistSidebarUi,
  ratiosForSlotCount,
  sidebarWidthClamp,
  type SidebarUiState,
} from "./lib/sidebarUiStorage";
import { shortcutStringToKeyCode } from "./lib/monacoKeybinding";
import {
  loadSavedSqlSlots,
  persistSavedSqlSlots,
  type SavedSqlSlot,
} from "./lib/savedSqlStorage";

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
  const [hotkeysOpen, setHotkeysOpen] = useState(false);
  const [savedSqlSlots, setSavedSqlSlots] = useState<SavedSqlSlot[]>(loadSavedSqlSlots);
  const [savedSqlSelectedId, setSavedSqlSelectedId] = useState<string>(
    () => loadSavedSqlSlots()[0]?.id ?? "",
  );
  const [sidebarUi, setSidebarUi] = useState<SidebarUiState>(loadSidebarUi);
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
  const prevLineBreakRef = useRef<"soft" | "hard">(config.sqlFormatting.editorLineBreak);
  const autoHardWrapRef = useRef(false);
  useEffect(() => {
    saveConfig(config);
  }, [config]);

  useEffect(() => {
    persistSavedSqlSlots(savedSqlSlots);
  }, [savedSqlSlots]);

  useEffect(() => {
    persistSidebarUi(sidebarUi);
  }, [sidebarUi]);

  useEffect(() => {
    const n = config.sidebarLayout.left.length;
    setSidebarUi((u) =>
      u.leftRatios.length === n
        ? u
        : { ...u, leftRatios: ratiosForSlotCount(u.leftRatios, n) },
    );
  }, [config.sidebarLayout.left.length]);

  useEffect(() => {
    const n = config.sidebarLayout.right.length;
    setSidebarUi((u) =>
      u.rightRatios.length === n
        ? u
        : { ...u, rightRatios: ratiosForSlotCount(u.rightRatios, n) },
    );
  }, [config.sidebarLayout.right.length]);

  useEffect(() => {
    if (savedSqlSlots.some((s) => s.id === savedSqlSelectedId)) return;
    setSavedSqlSelectedId(savedSqlSlots[0]?.id ?? "");
  }, [savedSqlSlots, savedSqlSelectedId]);

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
    const block = stripSqlComments(getCopyBlockText());
    const out = applySqlFormatting(block, config.sqlFormatting);
    try {
      await navigator.clipboard.writeText(out);
    } catch (e) {
      console.error("Clipboard write failed:", e);
    }
  }, [getCopyBlockText, config.sqlFormatting]);

  /** 按当前「行长 + 压缩等级」把整篇 SQL 写成真实换行（硬换行工作流） */
  const reformatFullEditorSql = useCallback(() => {
    const ed = editorRef.current;
    const model = ed?.getModel();
    const pos = ed?.getPosition();
    const prevOff = model && pos ? model.getOffsetAt(pos) : 0;
    const next = applySqlFormatting(sql, config.sqlFormatting);
    const nextOff = Math.min(prevOff, Math.max(0, next.length));
    pendingEditorCursorOffsetRef.current = nextOff;
    setSql(next);
  }, [sql, config.sqlFormatting]);

  // 切到「硬换行」时，自动把当前编辑器内容写成真实换行（而不仅仅是关闭 Monaco 的视觉折行）
  useEffect(() => {
    const prev = prevLineBreakRef.current;
    const cur = config.sqlFormatting.editorLineBreak;
    prevLineBreakRef.current = cur;
    if (prev === cur) return;
    if (cur !== "hard") return;
    // 写回整篇（硬换行），保持光标附近位置尽量不跳
    const ed = editorRef.current;
    const model = ed?.getModel();
    const pos = ed?.getPosition();
    const prevOff = model && pos ? model.getOffsetAt(pos) : 0;
    const next = applySqlFormatting(model?.getValue() ?? sql, config.sqlFormatting);
    pendingEditorCursorOffsetRef.current = Math.min(prevOff, Math.max(0, next.length));
    setSql(next);
  }, [config.sqlFormatting.editorLineBreak, config.sqlFormatting, sql]);

  const computeSqlToSaveFromEditor = useCallback((): string => {
    const ed = editorRef.current;
    const model = ed?.getModel();
    if (!ed || !model) {
      const idx = blockIndexAtOffset(sql, 0);
      return stripSqlComments(getBlockTextForCopy(sql, idx));
    }
    const sel = ed.getSelection();
    if (sel && !sel.isEmpty()) {
      return stripSqlComments(model.getValueInRange(sel));
    }
    const pos = ed.getPosition();
    if (!pos) return stripSqlComments(model.getValue());
    const full = model.getValue();
    const idx = blockIndexAtOffset(full, model.getOffsetAt(pos));
    return stripSqlComments(getBlockTextForCopy(full, idx));
  }, [sql]);

  const computeSqlToSaveRef = useRef(computeSqlToSaveFromEditor);
  computeSqlToSaveRef.current = computeSqlToSaveFromEditor;

  const pushSlotIntoCurrentBlock = useCallback(
    (id: string) => {
      const s = savedSqlSlots.find((x) => x.id === id);
      if (!s) return;
      const ed = editorRef.current;
      const model = ed?.getModel();
      const pos = ed?.getPosition();
      const full = model?.getValue() ?? sql;
      const off = model && pos ? model.getOffsetAt(pos) : 0;
      const idx = blockIndexAtOffset(full, off);
      const next = replaceBlockText(full, idx, s.sql);
      setSavedSqlSelectedId(id);
      pendingEditorCursorOffsetRef.current = Math.min(off, next.length);
      setSql(next);
    },
    [savedSqlSlots, sql],
  );

  const updateSavedSlot = useCallback(
    (
      id: string,
      patch: Partial<Pick<SavedSqlSlot, "name" | "sql">>,
    ) => {
      setSavedSqlSlots((slots) =>
        slots.map((s) =>
          s.id === id
            ? { ...s, ...patch, updatedAt: new Date().toISOString() }
            : s,
        ),
      );
    },
    [],
  );

  const deleteSavedSlot = useCallback((id: string) => {
    setSavedSqlSlots((slots) => slots.filter((s) => s.id !== id));
  }, []);

  /**
   * Monaco Find Widget 的按钮会带原生 title（含快捷键），在部分 Chromium 场景下
   * 可能出现 tooltip 抖动并干扰点击。这里在 find-widget 局部剥离 title：
   * - 仅观察 find-widget 子树，避免编辑器全量 mutation 带来的频繁回调；
   * - 在 mouseover 捕获阶段即时剥离目标 title，阻止原生 tooltip 计时开始。
   * `aria-label` 保留，不影响键盘导航和读屏。
   */
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed || monacoReadyTick === 0) return;
    const root = ed.getDomNode();
    if (!root) return;

    const stripTitlesInFindWidget = () => {
      const fw = root.querySelector(".find-widget");
      if (!fw) return;
      if (fw.hasAttribute("title")) fw.removeAttribute("title");
      fw.querySelectorAll("[title]").forEach((el) => {
        el.removeAttribute("title");
      });
    };

    const setFindOpenClass = () => {
      const open = !!root.querySelector(".find-widget.visible");
      document.body.classList.toggle("find-widget-open", open);
    };

    const stripTitlesFromTarget = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return;
      const fw = target.closest(".find-widget");
      if (!fw) return;
      if (target.hasAttribute("title")) target.removeAttribute("title");
      let p: Element | null = target.parentElement;
      while (p && p !== fw.parentElement) {
        if (p.hasAttribute("title")) p.removeAttribute("title");
        if (p === fw) break;
        p = p.parentElement;
      }
    };

    /**
     * 参考 monaco-editor#5137：Find Widget 的 tooltip 来自原生 `title`，位置不可控且会挡住按钮。
     * 解决思路：剥离 `title`，并在应用侧实现一个“永远朝下”的自绘 tooltip（pointer-events: none）。
     */
    const onMouseOverCapture = (e: Event) => {
      stripTitlesFromTarget(e.target);
      stripTitlesInFindWidget();
    };
    const onFocusInCapture = (e: Event) => {
      stripTitlesFromTarget(e.target);
      stripTitlesInFindWidget();
    };
    const onMouseMoveCapture = (e: Event) => {
      // mouseover 可能在 tooltip 出现前没有再次触发；mousemove 更稳定
      stripTitlesFromTarget(e.target);
      stripTitlesInFindWidget();
    };

    stripTitlesInFindWidget();
    setFindOpenClass();
    const isFindWidgetMutation = (m: MutationRecord) => {
      if (!(m.target instanceof Element)) return false;
      if (m.target.closest(".find-widget")) return true;
      if (m.type !== "childList") return false;
      for (const n of m.addedNodes) {
        if (!(n instanceof Element)) continue;
        if (n.classList.contains("find-widget") || n.querySelector(".find-widget")) {
          return true;
        }
      }
      return false;
    };
    const mo = new MutationObserver((records) => {
      if (records.some(isFindWidgetMutation)) {
        stripTitlesInFindWidget();
        setFindOpenClass();
      }
    });
    mo.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["title"],
    });
    root.addEventListener("mouseover", onMouseOverCapture, true);
    root.addEventListener("focusin", onFocusInCapture, true);
    root.addEventListener("mousemove", onMouseMoveCapture, true);
    return () => {
      mo.disconnect();
      root.removeEventListener("mouseover", onMouseOverCapture, true);
      root.removeEventListener("focusin", onFocusInCapture, true);
      root.removeEventListener("mousemove", onMouseMoveCapture, true);
      document.body.classList.remove("find-widget-open");
    };
  }, [monacoReadyTick]);

  // 硬换行：监听输入，超过行长后自动插入真实换行符
  useEffect(() => {
    const ed = editorRef.current;
    const monaco = monacoRef.current;
    if (!ed || !monaco || monacoReadyTick === 0) return;

    const maxLen = Math.max(8, Math.floor(config.sqlFormatting.maxCharsPerLine) || 72);
    if (config.sqlFormatting.editorLineBreak !== "hard") return;

    const d = ed.onDidChangeModelContent((e) => {
      if (autoHardWrapRef.current) return;
      // 避免对格式化/粘贴等大修改做自动拆行
      if (e.changes.length !== 1) return;
      const ch = e.changes[0];
      if (!ch) return;
      // 只处理“插入少量字符”的场景（键入）
      if (ch.text.length === 0) return; // 删除
      if (ch.text.length > 2) return; // 粘贴/多字符输入
      if (ch.text.includes("\n") || ch.text.includes("\r")) return;

      const model = ed.getModel();
      const pos = ed.getPosition();
      if (!model || !pos) return;

      const lineNumber = pos.lineNumber;
      const line = model.getLineContent(lineNumber);
      // Monaco column 从 1 开始；line.length 是字符数
      if (line.length <= maxLen) return;

      // 如果光标还没超过 maxLen，先不动（避免行内编辑带来的奇怪换行）
      if (pos.column <= maxLen) return;

      const before = line.slice(0, maxLen);
      let cut = before.lastIndexOf(" ");
      if (cut < 1) cut = maxLen;

      // 在 cut 位置插入换行（column = cut+1）
      const insertPos = new monaco.Position(lineNumber, cut + 1);
      autoHardWrapRef.current = true;
      try {
        ed.executeEdits("auto-hard-wrap", [
          {
            range: new monaco.Range(
              insertPos.lineNumber,
              insertPos.column,
              insertPos.lineNumber,
              insertPos.column,
            ),
            text: "\n",
            forceMoveMarkers: true,
          },
        ]);
      } finally {
        autoHardWrapRef.current = false;
      }
    });

    return () => d.dispose();
  }, [
    monacoReadyTick,
    config.sqlFormatting.editorLineBreak,
    config.sqlFormatting.maxCharsPerLine,
  ]);

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
            const block = stripSqlComments(getBlockTextForCopy(text, idx));
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
    const saveKb = shortcutStringToKeyCode(
      monaco,
      config.hotkeys.saveEditorSql,
    );
    if (saveKb != null) {
      disposables.push(
        editor.addAction({
          id: "sql-tool-save-to-slot",
          label: "保存 SQL 到已存列表（新建存档）",
          keybindings: [saveKb],
          run: () => {
            const t = computeSqlToSaveRef.current();
            const now = new Date().toISOString();
            const id = `slot-${globalThis.crypto?.randomUUID?.() ?? String(Date.now())}`;
            setSavedSqlSlots((slots) => [
              ...slots,
              {
                id,
                name: `存档 ${slots.length + 1}`,
                sql: t,
                updatedAt: now,
              },
            ]);
            setSavedSqlSelectedId(id);
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
    config.hotkeys.saveEditorSql,
    config.quickInserts,
  ]);

  const renderPanel = (slot: PanelSlot) => {
    if (slot === "savedSql") {
      return (
        <SavedSqlPanel
          slots={savedSqlSlots}
          activeSlotId={savedSqlSelectedId}
          onSelectActive={setSavedSqlSelectedId}
          onUpdateSlot={updateSavedSlot}
          onPushToEditor={pushSlotIntoCurrentBlock}
          onDeleteSlot={deleteSavedSlot}
        />
      );
    }
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
        onOpenHotkeys={() => setHotkeysOpen(true)}
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
            color: "var(--text)",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            cursor: "pointer",
          }}
          title="按行长与压缩等级写入真实换行（适合硬换行 / AS400）"
          onClick={reformatFullEditorSql}
        >
          重排
        </button>
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
          widthPx={sidebarUi.leftWidth}
          panelRatios={sidebarUi.leftRatios}
          onPanelRatiosChange={(leftRatios) =>
            setSidebarUi((u) => ({ ...u, leftRatios }))
          }
          config={config}
          setConfig={patchConfig}
          renderPanel={renderPanel}
        />
        <SidebarWidthHandle
          ariaLabel="拖动改变左侧栏宽度"
          onDrag={(dx) =>
            setSidebarUi((u) => ({
              ...u,
              leftWidth: sidebarWidthClamp(u.leftWidth + dx),
            }))
          }
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
            Monaco · SQL · 当前块 {curBlock.i}/{curBlock.n}（以分号分隔；复制不含分号）·
            软换行＝仅视觉折行、行号不变；硬换行＝真实换行、行号增加（「重排」）· Ctrl+滚轮 调字号
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
                fixedOverflowWidgets: true,
                fontSize: editorFontSize,
                wordWrap:
                  config.sqlFormatting.editorLineBreak === "soft"
                    ? "bounded"
                    : "off",
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
        <SidebarWidthHandle
          ariaLabel="拖动改变右侧栏宽度"
          onDrag={(dx) =>
            setSidebarUi((u) => ({
              ...u,
              rightWidth: sidebarWidthClamp(u.rightWidth - dx),
            }))
          }
        />
        <DockableSidebarColumn
          side="right"
          widthPx={sidebarUi.rightWidth}
          panelRatios={sidebarUi.rightRatios}
          onPanelRatiosChange={(rightRatios) =>
            setSidebarUi((u) => ({ ...u, rightRatios }))
          }
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
        配置保存在 localStorage；「已存 SQL」单独持久化。File 菜单可导入/导出配置 JSON。
      </footer>

      <SettingsModal
        open={settingsOpen}
        config={config}
        onClose={() => setSettingsOpen(false)}
        onApply={(c) => setConfig(c)}
        focusJsonTick={jsonFocusTick}
      />

      <HotkeysSettingsModal
        open={hotkeysOpen}
        hotkeys={config.hotkeys}
        onClose={() => setHotkeysOpen(false)}
        onApply={(next) =>
          setConfig((c) => ({ ...c, hotkeys: { ...c.hotkeys, ...next } }))
        }
      />
    </div>
  );
}
