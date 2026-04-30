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
import { CommandMenuModal } from "./components/CommandMenuModal";
import { RelationsModal } from "./components/RelationsModal";
import { TableCatalogModal } from "./components/TableCatalogModal";
import { ConfigDiffModal } from "./components/ConfigDiffModal";
import { PanelStyleModal, type PanelStyleTarget } from "./components/PanelStyleModal";
import type { AppConfig, PanelSlot, SqlCompressLevel } from "./types";
import { loadConfigBundle, saveConfigBundle } from "./lib/storage";
import { resolveConfig, type ConfigBundle, normalizeBundle } from "./lib/configBundle";
import {
  CONFIG_BLOCK_KEYS,
  bumpBlockVersion,
  loadBlocksMeta,
  saveBlocksMeta,
  type ConfigBlockKey,
  type ConfigBlocksMeta,
} from "./lib/configBlocks";
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
import { compressLinesUpward } from "./lib/sqlLineCompress";
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
import { installMonacoFindWidgetWorkaround } from "./lib/monacoFindWidgetWorkaround";
import { loadWorkspaceState, saveWorkspaceSql } from "./lib/workspaceStorage";

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
  const [bundle, setBundle] = useState<ConfigBundle>(() => loadConfigBundle());
  const [config, setConfig] = useState<AppConfig>(() => {
    const c = resolveConfig(loadConfigBundle());
    document.documentElement.dataset.theme = c.theme;
    return c;
  });
  const [sql, setSql] = useState(() => loadWorkspaceState()?.sql ?? DEFAULT_SQL);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hotkeysOpen, setHotkeysOpen] = useState(false);
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const [relationsOpen, setRelationsOpen] = useState(false);
  const [tableCatalogOpen, setTableCatalogOpen] = useState(false);
  const [configDiffOpen, setConfigDiffOpen] = useState(false);
  const [blocksMeta, setBlocksMeta] = useState<ConfigBlocksMeta>(loadBlocksMeta);
  const [panelStyleTarget, setPanelStyleTarget] = useState<PanelStyleTarget | null>(null);
  const [savedSqlSlots, setSavedSqlSlots] = useState<SavedSqlSlot[]>(loadSavedSqlSlots);
  const [savedSqlSelectedId, setSavedSqlSelectedId] = useState<string>(
    () => loadSavedSqlSlots()[0]?.id ?? "",
  );
  const [sidebarUi, setSidebarUi] = useState<SidebarUiState>(loadSidebarUi);
  const [jsonFocusTick, setJsonFocusTick] = useState(0);
  const [monacoReadyTick, setMonacoReadyTick] = useState(0);
  const [curBlock, setCurBlock] = useState({ i: 1, n: 1 });
  const [cursorLc, setCursorLc] = useState({ line: 1, col: 1 });
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
    saveConfigBundle(bundle);
  }, [bundle]);

  useEffect(() => {
    saveBlocksMeta(blocksMeta);
  }, [blocksMeta]);

  useEffect(() => {
    persistSavedSqlSlots(savedSqlSlots);
  }, [savedSqlSlots]);

  useEffect(() => {
    persistSidebarUi(sidebarUi);
  }, [sidebarUi]);

  // Workspace autosave for editor SQL (debounced)
  useEffect(() => {
    const t = window.setTimeout(() => saveWorkspaceSql(sql), 350);
    return () => clearTimeout(t);
  }, [sql]);

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
    setBundle((b) => {
      const prevPrivate = resolveConfig(b);
      const nextPrivate = fn(prevPrivate);
      const next = { ...b, privateConfig: nextPrivate };
      setConfig(resolveConfig(next));
      // Bump block versions for changed top-level blocks
      setBlocksMeta((meta) => {
        let m = meta;
        for (const k of CONFIG_BLOCK_KEYS) {
          const a = JSON.stringify((prevPrivate as any)[k]);
          const z = JSON.stringify((nextPrivate as any)[k]);
          if (a !== z) m = bumpBlockVersion(m, k as ConfigBlockKey);
        }
        return m;
      });
      return next;
    });
  }, []);

  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const bumpJsonFocus = useCallback(() => setJsonFocusTick((n) => n + 1), []);

  // Ctrl+K: open command/shortcut menu
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = String(e.key || "").toLowerCase();
      const isK = key === "k";
      const mod = e.ctrlKey || e.metaKey;
      if (!isK || !mod) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      // Allow Ctrl+K even inside Monaco; block only for normal form inputs.
      const isMonacoInput =
        tag === "textarea" && (target?.classList?.contains("inputarea") || target?.closest?.(".monaco-editor"));
      const isNormalFormInput =
        (tag === "input" || tag === "textarea" || (target as any)?.isContentEditable) && !isMonacoInput;
      if (isNormalFormInput) return;
      e.preventDefault();
      setCommandMenuOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onExportConfig = useCallback(() => {
    // Export as portable JSON (with userId + per-block version meta) for sharing.
    const portable = {
      schemaVersion: 1 as const,
      userId: (function () {
        try {
          return localStorage.getItem("sql-web-tool-user-id") || "";
        } catch {
          return "";
        }
      })(),
      generatedAt: new Date().toISOString(),
      blocksMeta,
      config,
      // Keep raw bundle alongside for full back-compat round-trip.
      _bundle: bundle,
    };
    const blob = new Blob([JSON.stringify(portable, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "sql-web-tool-config.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }, [bundle, config, blocksMeta]);

  const onImportFile = useCallback((file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const o = parsed as Record<string, unknown>;
        // Portable file: { schemaVersion: 1, config, blocksMeta, _bundle? }
        if (o && o.schemaVersion === 1 && o.config) {
          if (o._bundle) {
            const nb = normalizeBundle(o._bundle);
            setBundle(nb);
            setConfig(resolveConfig(nb));
          } else {
            patchConfig(() => normalizeConfig(o.config));
          }
          if (o.blocksMeta && typeof o.blocksMeta === "object") {
            setBlocksMeta((m) => ({ ...m, ...(o.blocksMeta as Partial<ConfigBlocksMeta>) }));
          }
          return;
        }
        // Bundle file
        const isBundleLike =
          parsed &&
          typeof parsed === "object" &&
          "publicConfig" in (parsed as any) &&
          "privateConfig" in (parsed as any);
        const nextBundle = isBundleLike
          ? normalizeBundle(parsed)
          : { ...bundle, privateConfig: normalizeConfig(parsed) };
        setBundle(nextBundle);
        setConfig(resolveConfig(nextBundle));
      } catch (e) {
        alert(`导入失败：${e instanceof Error ? e.message : e}`);
      }
    };
    reader.readAsText(file, "UTF-8");
  }, [bundle, patchConfig]);

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
      patch: Partial<Pick<SavedSqlSlot, "name" | "sql" | "bgColor">>,
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

  useEffect(() => {
    const ed = editorRef.current;
    if (!ed || monacoReadyTick === 0) return;
    const root = ed.getDomNode();
    if (!root) return;
    return installMonacoFindWidgetWorkaround(root);
  }, [monacoReadyTick]);

  // 应用编辑器外观（自定义主题：基础主题 + 选中行/活动行号颜色覆盖）
  useEffect(() => {
    const monaco = monacoRef.current;
    const ed = editorRef.current;
    if (!monaco || !ed || monacoReadyTick === 0) return;
    const ea = config.editorAppearance;
    let base: "vs" | "vs-dark" | "hc-black" | "hc-light";
    if (ea.baseTheme === "auto" || !ea.baseTheme) {
      base = config.theme === "light" ? "vs" : "vs-dark";
    } else {
      base = ea.baseTheme;
    }
    const colors: Record<string, string> = {};
    if (ea.selectedLineBg) colors["editor.lineHighlightBackground"] = ea.selectedLineBg;
    if (ea.activeLineNumberFg) colors["editorLineNumber.activeForeground"] = ea.activeLineNumberFg;
    if (ea.lineNumberFg) colors["editorLineNumber.foreground"] = ea.lineNumberFg;
    if (Object.keys(colors).length === 0) {
      monaco.editor.setTheme(base);
      return;
    }
    try {
      monaco.editor.defineTheme("sql-tool-custom", {
        base,
        inherit: true,
        rules: [],
        colors,
      });
      monaco.editor.setTheme("sql-tool-custom");
    } catch {
      monaco.editor.setTheme(base);
    }
  }, [
    monacoReadyTick,
    config.editorAppearance.baseTheme,
    config.editorAppearance.selectedLineBg,
    config.editorAppearance.activeLineNumberFg,
    config.editorAppearance.lineNumberFg,
    config.theme,
  ]);

  // 全局快捷键：openSettings（在编辑器外/内均生效）
  useEffect(() => {
    const target = config.hotkeys.openSettings || "";
    if (!target) return;
    // 解析形如 "Ctrl+Alt+,", "Shift+F1" 这样的字符串
    const parts = target.split("+").map((s) => s.trim()).filter(Boolean);
    const want = {
      ctrl: parts.some((p) => /^ctrl|control$/i.test(p)),
      alt: parts.some((p) => /^alt$/i.test(p)),
      shift: parts.some((p) => /^shift$/i.test(p)),
      meta: parts.some((p) => /^meta|cmd|command$/i.test(p)),
      key: parts.find((p) => !/^(ctrl|control|alt|shift|meta|cmd|command)$/i.test(p)) ?? "",
    };
    if (!want.key) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey !== want.ctrl) return;
      if (e.altKey !== want.alt) return;
      if (e.shiftKey !== want.shift) return;
      if (e.metaKey !== want.meta) return;
      const k = want.key.toLowerCase();
      const hit =
        e.key.toLowerCase() === k ||
        (k.length === 1 && e.key === k) ||
        (k === "," && e.key === ",") ||
        (k === "." && e.key === ".") ||
        (k.startsWith("f") && e.key.toLowerCase() === k);
      if (!hit) return;
      e.preventDefault();
      e.stopPropagation();
      setSettingsOpen(true);
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [config.hotkeys.openSettings]);

  // 智能提示：根据 tableCatalog 注册表名 / 字段补全
  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco || monacoReadyTick === 0) return;
    const provider = monaco.languages.registerCompletionItemProvider("sql", {
      triggerCharacters: [".", " "],
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range: Monaco.IRange = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };
        // 检测点号：alias.<cursor> → 仅返回该表/别名的字段
        const lineText = model.getLineContent(position.lineNumber);
        const before = lineText.slice(0, position.column - 1);
        const dotMatch = /([A-Za-z_][\w$]*)\.\s*([\w$]*)$/.exec(before);
        const catalog = configRef.current.tableCatalog;
        const aliasMap = new Map<string, string>(); // alias / table → table key
        for (const t of catalog) {
          aliasMap.set(t.table.toUpperCase(), t.table);
          if (t.qualifiedName) aliasMap.set(t.qualifiedName.toUpperCase(), t.table);
        }
        // 解析当前文档中出现的别名（FROM/JOIN <table> <alias>）
        try {
          const fullText = model.getValue();
          const re = /\b(?:FROM|JOIN)\s+([\w.]+)\s+(?:AS\s+)?([A-Za-z_][\w$]*)/gi;
          let m: RegExpExecArray | null;
          while ((m = re.exec(fullText)) !== null) {
            const tableRef = m[1].toUpperCase();
            const alias = m[2].toUpperCase();
            const baseName = tableRef.split(".").pop() ?? tableRef;
            const hit = catalog.find((t) => t.table.toUpperCase() === baseName);
            if (hit) aliasMap.set(alias, hit.table);
          }
        } catch {
          // ignore
        }

        if (dotMatch) {
          const alias = dotMatch[1].toUpperCase();
          const base = aliasMap.get(alias);
          const table = base ? catalog.find((t) => t.table === base) : undefined;
          if (table) {
            const suggestions: Monaco.languages.CompletionItem[] = table.fields.map((f) => {
              const info = table.fieldInfo?.[f.toUpperCase()];
              const detail = info?.type
                ? `${info.type}${info.length != null ? `(${info.length}${info.precision ? "," + info.precision : ""})` : ""}`
                : table.table;
              return {
                label: f,
                kind: monaco.languages.CompletionItemKind.Field,
                insertText: f,
                range,
                detail,
                documentation: info?.comment ?? table.comment ?? "",
                sortText: info?.isKey ? `0_${f}` : `1_${f}`,
              };
            });
            return { suggestions };
          }
          return { suggestions: [] };
        }

        // 否则：返回所有表名 + 所有字段（粗筛，最多 200 个字段以免过载）
        const tables: Monaco.languages.CompletionItem[] = catalog.map((t) => ({
          label: t.qualifiedName ?? t.table,
          kind: monaco.languages.CompletionItemKind.Class,
          insertText: t.qualifiedName ?? t.table,
          range,
          detail: `表 · ${t.fields.length} 字段`,
          documentation: t.comment ?? "",
          sortText: `0_${t.table}`,
        }));
        const fields: Monaco.languages.CompletionItem[] = [];
        const seen = new Set<string>();
        for (const t of catalog) {
          for (const f of t.fields) {
            const key = f.toUpperCase();
            if (seen.has(key)) continue;
            seen.add(key);
            const info = t.fieldInfo?.[key];
            fields.push({
              label: f,
              kind: monaco.languages.CompletionItemKind.Field,
              insertText: f,
              range,
              detail: `${t.table}${info?.type ? ` · ${info.type}` : ""}`,
              documentation: info?.comment ?? "",
              sortText: `1_${f}`,
            });
            if (fields.length >= 200) break;
          }
          if (fields.length >= 200) break;
        }
        return { suggestions: [...tables, ...fields] };
      },
    });
    return () => provider.dispose();
  }, [monacoReadyTick, config.tableCatalog]);

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
      // 处理两类典型场景：
      //   1) 单字符键入（含空格）；text 长度小且不含换行
      //   2) 删除（含删除换行把下一行并到上一行）；text 为空
      const isInsert = ch.text.length > 0;
      if (isInsert) {
        if (ch.text.length > 2) return; // 粘贴/多字符输入
        if (ch.text.includes("\n") || ch.text.includes("\r")) return;
      }
      // 删除场景下，rangeLength 必须 > 0（确实有删除内容）
      if (!isInsert && (ch.rangeLength ?? 0) === 0) return;

      const model = ed.getModel();
      const pos = ed.getPosition();
      if (!model || !pos) return;

      // 以本次变更所在行（或合并后的当前行）为准
      const lineNumber = ch.range.startLineNumber ?? pos.lineNumber;
      const line = model.getLineContent(lineNumber);
      // Monaco column 从 1 开始；line.length 是字符数
      if (line.length <= maxLen) return;

      // 插入场景：仅在“变更点在边界附近”时触发，避免历史长行被反复重排
      if (isInsert) {
        const changeCol = ch.range.startColumn ?? pos.column;
        if (changeCol > maxLen + 1 && pos.column <= maxLen) return;
      }
      // 删除场景：直接对超长行做断行（典型：删除换行把下一行提上来）

      const before = line.slice(0, maxLen);
      let cut = before.lastIndexOf(" ");
      if (cut < 1) cut = maxLen;

      // 优先把断点空格替换为换行，避免行尾残留空格；若无空格则直接插入换行
      const replaceSpace = cut < maxLen && line[cut] === " ";
      const insertPos = new monaco.Position(lineNumber, cut + 1);
      const range = replaceSpace
        ? new monaco.Range(lineNumber, cut + 1, lineNumber, cut + 2)
        : new monaco.Range(
            insertPos.lineNumber,
            insertPos.column,
            insertPos.lineNumber,
            insertPos.column,
          );
      autoHardWrapRef.current = true;
      try {
        ed.executeEdits("auto-hard-wrap", [
          {
            range,
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
      setCursorLc({ line: pos.lineNumber, col: pos.column });
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

    const compressLineKb = shortcutStringToKeyCode(
      monaco,
      config.hotkeys.compressLineOrSelection,
    );
    if (compressLineKb != null) {
      disposables.push(
        editor.addAction({
          id: "sql-tool-compress-line-or-selection",
          label: "压缩当前行/区域（向上填充）",
          keybindings: [compressLineKb],
          run: (ed) => {
            const model = ed.getModel();
            const pos = ed.getPosition();
            const sel = ed.getSelection();
            if (!model || !pos) return;
            const full = model.getValue();
            const maxLen = Math.max(
              8,
              Math.floor(configRef.current.sqlFormatting.maxCharsPerLine) || 72,
            );
            const lineCount = model.getLineCount();

            let startLine = pos.lineNumber;
            let endLine = pos.lineNumber;
            if (sel && !sel.isEmpty()) {
              startLine = sel.startLineNumber;
              endLine = sel.endLineNumber;
              // 选区如果落在行首，通常意味着没覆盖最后一行
              if (sel.endColumn === 1 && endLine > startLine) endLine -= 1;
            }
            // 为了“向上填充”，包含一个 donor 行（下一行）
            const donorEnd = Math.min(lineCount, endLine + 1);
            const beforeOff = model.getOffsetAt(pos);
            const next = compressLinesUpward(
              full,
              maxLen,
              startLine - 1,
              donorEnd - 1,
            );
            pendingEditorCursorOffsetRef.current = Math.min(beforeOff, next.length);
            setSql(next);
          },
        }),
      );
    }

    const compressBlockKb = shortcutStringToKeyCode(
      monaco,
      config.hotkeys.compressCurrentBlock,
    );
    if (compressBlockKb != null) {
      disposables.push(
        editor.addAction({
          id: "sql-tool-compress-current-block",
          label: "压缩当前分号块（向上填充）",
          keybindings: [compressBlockKb],
          run: (ed) => {
            const model = ed.getModel();
            const pos = ed.getPosition();
            if (!model || !pos) return;
            const full = model.getValue();
            const off = model.getOffsetAt(pos);
            const idx = blockIndexAtOffset(full, off);
            const blocks = getSqlBlocks(full);
            const b = blocks[idx];
            if (!b) return;
            const maxLen = Math.max(
              8,
              Math.floor(configRef.current.sqlFormatting.maxCharsPerLine) || 72,
            );
            const inner = full.slice(b.start, b.end);
            const compressed = compressLinesUpward(
              inner,
              maxLen,
              0,
              inner.replace(/\r\n/g, "\n").split("\n").length - 1,
            ).trim();
            const next = replaceBlockText(full, idx, compressed);
            pendingEditorCursorOffsetRef.current = Math.min(off, next.length);
            setSql(next);
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

    // Shift+Enter：在当前行下方插入一个新空行并把光标移过去
    disposables.push(
      editor.addAction({
        id: "sql-tool-insert-line-below",
        label: "在下方插入一行",
        keybindings: [monaco.KeyMod.Shift | monaco.KeyCode.Enter],
        run: (ed) => {
          ed.trigger("keyboard", "editor.action.insertLineAfter", null);
        },
      }),
    );

    return () => {
      disposables.forEach((d) => d.dispose());
    };
  }, [
    monacoReadyTick,
    config.hotkeys.copyCurrentBlock,
    config.hotkeys.saveEditorSql,
    config.hotkeys.compressLineOrSelection,
    config.hotkeys.compressCurrentBlock,
    config.quickInserts,
  ]);

  const renderPanel = (slot: PanelSlot) => {
    if (slot === "savedSql") {
      return (
        <SavedSqlPanel
          slots={savedSqlSlots}
          config={config}
          activeSlotId={savedSqlSelectedId}
          onSelectActive={setSavedSqlSelectedId}
          onUpdateSlot={updateSavedSlot}
          onPushToEditor={pushSlotIntoCurrentBlock}
          onDeleteSlot={deleteSavedSlot}
          onReorder={(id, targetIndex) =>
            setSavedSqlSlots((arr) => {
              const idx = arr.findIndex((s) => s.id === id);
              if (idx < 0) return arr;
              const next = arr.slice();
              const [item] = next.splice(idx, 1);
              if (!item) return arr;
              const insertAt = Math.max(0, Math.min(targetIndex > idx ? targetIndex - 1 : targetIndex, next.length));
              next.splice(insertAt, 0, item);
              return next;
            })
          }
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
        onOpenRelations={() => setRelationsOpen(true)}
        onOpenTableCatalog={() => setTableCatalogOpen(true)}
        onOpenConfigDiff={() => setConfigDiffOpen(true)}
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
              patchConfig((c) => ({
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
          onTitleStyleClick={(slot) => {
            if (slot === "search") setPanelStyleTarget("search");
            else if (slot === "quickInsert") setPanelStyleTarget("quickInsert");
            else if (slot === "savedSql") setPanelStyleTarget("savedSql");
          }}
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
            {config.debugMode ? (
              <>
                Monaco · SQL · 当前块 {curBlock.i}/{curBlock.n}（以分号分隔；复制不含分号）· Ln{" "}
                {cursorLc.line}, Col {cursorLc.col} · 软换行＝仅视觉折行、行号不变；硬换行＝真实换行、行号增加（「重排」）·
                Ctrl+滚轮 调字号
              </>
            ) : (
              <>
                当前块 {curBlock.i}/{curBlock.n} · Ln {cursorLc.line}, Col {cursorLc.col}
              </>
            )}
          </div>
          <div style={{ flex: 1, minHeight: 200 }}>
            <Editor
              height="100%"
              language="sql"
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
          onTitleStyleClick={(slot) => {
            if (slot === "search") setPanelStyleTarget("search");
            else if (slot === "quickInsert") setPanelStyleTarget("quickInsert");
            else if (slot === "savedSql") setPanelStyleTarget("savedSql");
          }}
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
        onApply={(c) => patchConfig(() => c)}
        focusJsonTick={jsonFocusTick}
      />

      <HotkeysSettingsModal
        open={hotkeysOpen}
        hotkeys={config.hotkeys}
        quickInserts={config.quickInserts}
        onClose={() => setHotkeysOpen(false)}
        onApply={(next) =>
          patchConfig((c) => ({ ...c, hotkeys: { ...c.hotkeys, ...next } }))
        }
      />

      <CommandMenuModal
        open={commandMenuOpen}
        config={config}
        onClose={() => setCommandMenuOpen(false)}
        onOpenSettings={() => {
          setCommandMenuOpen(false);
          setSettingsOpen(true);
        }}
        onOpenHotkeys={() => {
          setCommandMenuOpen(false);
          setHotkeysOpen(true);
        }}
        onOpenRelations={() => {
          setCommandMenuOpen(false);
          setRelationsOpen(true);
        }}
      />

      <RelationsModal
        open={relationsOpen}
        config={config}
        setConfig={patchConfig}
        onClose={() => setRelationsOpen(false)}
      />

      <TableCatalogModal
        open={tableCatalogOpen}
        config={config}
        onClose={() => setTableCatalogOpen(false)}
        onOpenStyle={() => setPanelStyleTarget("tableCatalog")}
      />

      <ConfigDiffModal
        open={configDiffOpen}
        config={config}
        blocksMeta={blocksMeta}
        onClose={() => setConfigDiffOpen(false)}
        onApplyBlock={(key, value) => {
          patchConfig((c) => ({ ...c, [key]: value as any }));
        }}
        onApplyAll={(incoming) => {
          patchConfig(() => incoming);
        }}
      />

      {panelStyleTarget ? (
        <PanelStyleModal
          open
          target={panelStyleTarget}
          config={config}
          onClose={() => setPanelStyleTarget(null)}
          onApply={(next) => patchConfig((c) => ({ ...c, panelStyles: next }))}
        />
      ) : null}
    </div>
  );
}
