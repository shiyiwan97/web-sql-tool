import type {
  AppConfig,
  ContextDividerStyle,
  EditorAppearance,
  FieldGroup,
  HotkeyConfig,
  PanelBoxStyle,
  PanelButtonStyle,
  PanelStyles,
  PanelTextStyle,
  QuickInsertEntry,
  QuickInsertPanelStyle,
  SavedSqlPanelStyle,
  SearchPanelPkBadgeStyle,
  SearchPanelStyle,
  SidebarLayout,
  SqlCompressLevel,
  TableCatalogPanelStyle,
} from "../types";

export function createDefaultConfig(): AppConfig {
  return {
    version: 1,
    theme: "dark",
    debugMode: false,
    fieldGroupTrigger: "#",
    tableGroupTrigger: "$",
    fieldGroupCompletionFormat: {
      left: "{key}",
      right: "{table}: {fields5}",
      showSeparator: true,
    },
    globalSearchGroups: [],
    quickInsertNumberIconBehavior: "dblclick",
    ddsCopybookPathGroups: [
      {
        order: 0,
        schemaCsvPath: "",
        pairing: { ddsSuffix: ".dds", copybookSuffix: ".cbl" },
      },
    ],
    tableResolution: {
      description:
        "多组路径按数组顺序解析；同名表以靠前条目为准（浏览器端仅保存路径，不读本地磁盘）。",
    },
    relations: [],
    sqlFormatting: {
      maxCharsPerLine: 72,
      showColumnGuide: false,
      editorLineBreak: "soft",
      compressLevel: 0,
      searchInsertKeywordsUppercase: true,
    },
    sqlSnippets: [],
    tableRelationSourcePath: null,
    relationIndex: { byTable: {} },
    tableCatalog: [],
    sidebarLayout: {
      left: ["search", "savedSql"],
      right: ["quickInsert"],
    },
    quickInserts: [
      {
        id: "qi-example-1",
        key: "学号",
        value: "001",
        shortcut: "Ctrl+Shift+1",
      },
    ],
    hotkeys: {
      copyCurrentBlock: "Ctrl+Shift+C",
      saveEditorSql: "Ctrl+Alt+S",
      compressLineOrSelection: "Shift+Backspace",
      compressCurrentBlock: "Ctrl+Shift+Backspace",
      openSettings: "Ctrl+Alt+,",
      openHotkeysSettings: "Ctrl+Alt+H",
      openTableCatalog: "",
      openRelations: "",
      nextPlaceholder: "",
      extendSelection: "Ctrl+W",
      shrinkSelection: "Ctrl+Shift+W",
      repositionActivate: "Ctrl+Shift+M",
      repositionSelectPrev: "Left",
      repositionSelectNext: "Right",
      repositionSwapPrev: "Ctrl+Left",
      repositionSwapNext: "Ctrl+Right",
      repositionExtendWithPrev: "Shift+Left",
      repositionExtendWithNext: "Shift+Right",
      repositionShrinkRemovePrev: "Alt+Shift+Left",
      repositionShrinkRemoveNext: "Alt+Shift+Right",
    },
    panelStyles: createDefaultPanelStyles(),
    editorAppearance: createDefaultEditorAppearance(),
    sqlDiagnosticsSettings: {
      enableJoinLargeDrivingSmallWarning: true,
      enableJoinOnConfigMismatchWarning: true,
      joinLargeDrivingSmallMinRows: 100_000,
      showRepositionInvalidCursorHint: true,
    },
  };
}

export function createDefaultEditorAppearance(): EditorAppearance {
  return {
    baseTheme: "auto",
    selectedLineBg: "",
    activeLineNumberFg: "",
    lineNumberFg: "",
  };
}

export function createDefaultPanelStyles(): PanelStyles {
  const text = (size: number, color: string): PanelTextStyle => ({ fontSize: size, color });
  const box = (size: number, color: string, w = 0, h = 0): PanelBoxStyle => ({
    fontSize: size,
    color,
    width: w,
    height: h,
  });
  const btn = (label: string, size: number, color: string, w = 0, h = 0): PanelButtonStyle => ({
    label,
    fontSize: size,
    color,
    width: w,
    height: h,
  });
  const search: SearchPanelStyle = {
    tableName: text(12, "#93c5fd"),
    fieldName: text(11, "#a7f3d0"),
    tableComment: text(11, ""),
    fieldComment: text(11, ""),
    fieldType: text(10, ""),
    typeMappings: [
      { from: "CHARACTER", to: "C" },
      { from: "VARCHAR", to: "VC" },
      { from: "DECIMAL", to: "D" },
    ],
    tableItemHeight: 0,
    fieldItemHeight: 0,
    commentWrap: false,
    primaryKeyBadge: {
      label: "PK",
      color: "#facc15",
      backgroundColor: "rgba(250,204,21,0.15)",
      borderColor: "rgba(250,204,21,0.4)",
    },
    contextDivider: {
      color: "#86efac",
      width: 1,
      style: "dashed",
    },
  };
  const tableCatalog: TableCatalogPanelStyle = {
    tableName: text(13, ""),
    fieldName: text(12, "#a7f3d0"),
    tableComment: text(12, ""),
    fieldComment: text(12, ""),
    fieldType: text(12, ""),
    primaryKeyBadge: {
      label: "PK",
      color: "#facc15",
      backgroundColor: "rgba(250,204,21,0.15)",
      borderColor: "rgba(250,204,21,0.4)",
    },
    fieldSearchHighlightBg: "rgba(59,130,246,0.14)",
  };
  const quickInsert: QuickInsertPanelStyle = {
    keyInput: box(11, "", 0, 0),
    valueInput: box(11, "", 0, 0),
    shortcutInput: box(11, "", 0, 0),
    bindButton: btn("绑定…", 11, "", 0, 0),
    deleteButton: btn("×", 14, "", 28, 0),
    addButton: btn("+ 添加一行", 11, "", 0, 0),
    expandTarget: "value",
  };
  const savedSql: SavedSqlPanelStyle = {
    rowBackground: "",
    nameInput: box(11, "", 0, 0),
    showButton: btn("展示", 11, "", 0, 0),
    useButton: btn("使用", 11, "", 0, 0),
    deleteButton: btn("×", 14, "", 28, 0),
    expandTarget: "name",
  };
  return { search, tableCatalog, quickInsert, savedSql };
}

export function normalizeConfig(raw: unknown): AppConfig {
  const base = createDefaultConfig();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const sf =
    typeof o.sqlFormatting === "object" && o.sqlFormatting
      ? (o.sqlFormatting as Partial<AppConfig["sqlFormatting"]>)
      : null;
  const merged: AppConfig = {
    ...base,
    version: typeof o.version === "number" ? o.version : base.version,
    theme: o.theme === "light" || o.theme === "dark" ? o.theme : base.theme,
    debugMode: Boolean(o.debugMode ?? base.debugMode),
    ddsCopybookPathGroups: normalizePathGroups(
      o.ddsCopybookPathGroups,
      base.ddsCopybookPathGroups,
    ),
    relations: Array.isArray(o.relations)
      ? (o.relations as TableRelationInput[]).map((r, i) => ({
          id: String(r.id ?? `rel-import-${i}`),
          fromTable: String(r.fromTable ?? "").toUpperCase(),
          toTable: String(r.toTable ?? "").toUpperCase(),
          fieldPairs: Array.isArray(r.fieldPairs)
            ? r.fieldPairs.map((p) => ({
                fromField: String(p?.fromField ?? "").toUpperCase(),
                toField: String(p?.toField ?? "").toUpperCase(),
              }))
            : undefined,
          cardinality: normalizeCardinality(r.cardinality),
          onClause: String(r.onClause ?? ""),
          joinKind: r.joinKind === "INNER" ? "INNER" : "LEFT",
        }))
      : base.relations,
    sqlFormatting: {
      maxCharsPerLine:
        typeof sf?.maxCharsPerLine === "number"
          ? sf.maxCharsPerLine
          : base.sqlFormatting.maxCharsPerLine,
      showColumnGuide:
        typeof sf?.showColumnGuide === "boolean"
          ? sf.showColumnGuide
          : base.sqlFormatting.showColumnGuide,
      editorLineBreak: normalizeEditorLineBreak(sf, base.sqlFormatting.editorLineBreak),
      compressLevel: normalizeCompressLevel(sf, base.sqlFormatting.compressLevel),
      searchInsertKeywordsUppercase:
        typeof sf?.searchInsertKeywordsUppercase === "boolean"
          ? sf.searchInsertKeywordsUppercase
          : base.sqlFormatting.searchInsertKeywordsUppercase,
    },
    sqlSnippets: normalizeSqlSnippets(o.sqlSnippets, base.sqlSnippets),
    tableResolution:
      typeof o.tableResolution === "object" && o.tableResolution
        ? (o.tableResolution as AppConfig["tableResolution"])
        : base.tableResolution,
    tableRelationSourcePath:
      o.tableRelationSourcePath == null
        ? null
        : String(o.tableRelationSourcePath),
    relationIndex:
      typeof o.relationIndex === "object" && o.relationIndex
        ? (o.relationIndex as AppConfig["relationIndex"])
        : base.relationIndex,
    fieldGroupTrigger:
      typeof o.fieldGroupTrigger === "string" && o.fieldGroupTrigger.length > 0
        ? o.fieldGroupTrigger
        : base.fieldGroupTrigger,
    tableGroupTrigger:
      typeof o.tableGroupTrigger === "string" && o.tableGroupTrigger.length > 0
        ? o.tableGroupTrigger
        : base.tableGroupTrigger,
    fieldGroupCompletionFormat: (() => {
      const f = o.fieldGroupCompletionFormat as Record<string, unknown> | undefined;
      return {
        left: typeof f?.left === "string" ? f.left : base.fieldGroupCompletionFormat.left,
        right: typeof f?.right === "string" ? f.right : base.fieldGroupCompletionFormat.right,
        showSeparator:
          typeof f?.showSeparator === "boolean"
            ? f.showSeparator
            : base.fieldGroupCompletionFormat.showSeparator,
      };
    })(),
    globalSearchGroups: (() => {
      const arr = (o as Record<string, unknown>).globalSearchGroups;
      if (!Array.isArray(arr)) return base.globalSearchGroups;
      const out: AppConfig["globalSearchGroups"] = [];
      const seenKeys = new Set<string>();
      for (const item of arr) {
        if (!item || typeof item !== "object") continue;
        const rec = item as Record<string, unknown>;
        const key = typeof rec.key === "string" ? rec.key.trim() : "";
        if (!key) continue;
        const dedupKey = key.toLowerCase();
        if (seenKeys.has(dedupKey)) continue;
        seenKeys.add(dedupKey);
        let kws: string[] = [];
        if (Array.isArray(rec.keywords)) {
          kws = (rec.keywords as unknown[])
            .map((k) => (typeof k === "string" ? k.trim() : ""))
            .filter((k) => k.length > 0);
        } else if (typeof rec.keywords === "string") {
          kws = String(rec.keywords)
            .split(/[,，]/)
            .map((k) => k.trim())
            .filter((k) => k.length > 0);
        }
        // 去重（保持顺序，按大小写不敏感）
        const seenKw = new Set<string>();
        const dedupKws: string[] = [];
        for (const kw of kws) {
          const u = kw.toLowerCase();
          if (seenKw.has(u)) continue;
          seenKw.add(u);
          dedupKws.push(kw);
        }
        out.push({ key, keywords: dedupKws });
      }
      return out;
    })(),
    quickInsertNumberIconBehavior: (() => {
      // 兼容旧字段名 placeholderNumberIconBehavior
      const v =
        o.quickInsertNumberIconBehavior ??
        (o as Record<string, unknown>).placeholderNumberIconBehavior;
      return v === "click" || v === "dblclick" || v === "both" || v === "none"
        ? v
        : base.quickInsertNumberIconBehavior;
    })(),
    tableCatalog: Array.isArray(o.tableCatalog)
      ? (o.tableCatalog as TableCatalogInput[]).map((t) => ({
          table: String(t.table ?? "").toUpperCase(),
          qualifiedName: t.qualifiedName
            ? String(t.qualifiedName)
            : undefined,
          comment: typeof t.comment === "string" ? t.comment : undefined,
          fields: Array.isArray(t.fields)
            ? t.fields.map((f) => String(f).toUpperCase())
            : [],
          primaryKeys: Array.isArray(t.primaryKeys)
            ? t.primaryKeys.map((f) => String(f).toUpperCase())
            : undefined,
          estimatedRowCount: normalizeEstimatedRowCount(t.estimatedRowCount),
          fieldInfo: normalizeFieldInfo(t.fieldInfo),
          fieldGroups: normalizeFieldGroups(t.fieldGroups),
        }))
      : base.tableCatalog,
    sidebarLayout: normalizeSidebarLayout(o.sidebarLayout, base.sidebarLayout),
    quickInserts: normalizeQuickInserts(o.quickInserts, base.quickInserts),
    hotkeys: normalizeHotkeys(o.hotkeys, base.hotkeys),
    panelStyles: normalizePanelStyles(o.panelStyles, base.panelStyles),
    editorAppearance: normalizeEditorAppearance(o.editorAppearance, base.editorAppearance),
    sqlDiagnosticsSettings: normalizeSqlDiagnosticsSettings(
      (o as Record<string, unknown>).sqlDiagnosticsSettings,
      base.sqlDiagnosticsSettings,
    ),
  };
  return merged;
}

function normalizeText(raw: unknown, fb: PanelTextStyle): PanelTextStyle {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    fontSize: typeof o.fontSize === "number" && o.fontSize > 0 ? o.fontSize : fb.fontSize,
    color: typeof o.color === "string" ? o.color : fb.color,
  };
}
function normalizeBox(raw: unknown, fb: PanelBoxStyle): PanelBoxStyle {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    fontSize: typeof o.fontSize === "number" && o.fontSize > 0 ? o.fontSize : fb.fontSize,
    color: typeof o.color === "string" ? o.color : fb.color,
    width: typeof o.width === "number" ? Math.max(0, o.width) : fb.width,
    height: typeof o.height === "number" ? Math.max(0, o.height) : fb.height,
  };
}
function normalizeBtn(raw: unknown, fb: PanelButtonStyle): PanelButtonStyle {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    ...normalizeBox(raw, fb),
    label: typeof o.label === "string" ? o.label : fb.label,
  };
}

function normalizeTypeMappings(raw: unknown, fb: SearchPanelStyle["typeMappings"]) {
  if (!Array.isArray(raw)) return [...fb];
  return raw
    .map((r) => {
      const o = (r ?? {}) as Record<string, unknown>;
      return {
        from: String(o.from ?? "").trim().toUpperCase(),
        to: String(o.to ?? "").trim(),
      };
    })
    .filter((x) => x.from.length > 0);
}

function normalizePrimaryKeyBadge(raw: unknown, fb: SearchPanelPkBadgeStyle): SearchPanelPkBadgeStyle {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    label: typeof o.label === "string" ? o.label : fb.label,
    color: typeof o.color === "string" ? o.color : fb.color,
    backgroundColor:
      typeof o.backgroundColor === "string" ? o.backgroundColor : fb.backgroundColor,
    borderColor: typeof o.borderColor === "string" ? o.borderColor : fb.borderColor,
  };
}

function normalizePanelStyles(raw: unknown, fb: PanelStyles): PanelStyles {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  const s = (o.search ?? {}) as Record<string, any>;
  const tc = (o.tableCatalog ?? {}) as Record<string, any>;
  const qi = (o.quickInsert ?? {}) as Record<string, any>;
  const sv = (o.savedSql ?? {}) as Record<string, any>;
  const expandTarget = (v: unknown, allowed: string[], fb2: string) =>
    typeof v === "string" && allowed.includes(v) ? (v as any) : fb2;
  return {
    search: {
      tableName: normalizeText(s.tableName, fb.search.tableName),
      fieldName: normalizeText(s.fieldName, fb.search.fieldName),
      tableComment: normalizeText(s.tableComment, fb.search.tableComment),
      fieldComment: normalizeText(s.fieldComment, fb.search.fieldComment),
      fieldType: normalizeText(s.fieldType, fb.search.fieldType),
      typeMappings: normalizeTypeMappings(s.typeMappings, fb.search.typeMappings),
      tableItemHeight:
        typeof s.tableItemHeight === "number" ? Math.max(0, s.tableItemHeight) : fb.search.tableItemHeight,
      fieldItemHeight:
        typeof s.fieldItemHeight === "number" ? Math.max(0, s.fieldItemHeight) : fb.search.fieldItemHeight,
      commentWrap: typeof s.commentWrap === "boolean" ? s.commentWrap : fb.search.commentWrap,
      primaryKeyBadge: normalizePrimaryKeyBadge(s.primaryKeyBadge, fb.search.primaryKeyBadge),
      contextDivider: normalizeContextDivider(s.contextDivider, fb.search.contextDivider),
    },
    tableCatalog: {
      tableName: normalizeText(tc.tableName, fb.tableCatalog.tableName),
      fieldName: normalizeText(tc.fieldName, fb.tableCatalog.fieldName),
      tableComment: normalizeText(tc.tableComment, fb.tableCatalog.tableComment),
      fieldComment: normalizeText(tc.fieldComment, fb.tableCatalog.fieldComment),
      fieldType: normalizeText(tc.fieldType, fb.tableCatalog.fieldType),
      primaryKeyBadge: normalizePrimaryKeyBadge(tc.primaryKeyBadge, fb.tableCatalog.primaryKeyBadge),
      fieldSearchHighlightBg:
        typeof tc.fieldSearchHighlightBg === "string"
          ? tc.fieldSearchHighlightBg
          : fb.tableCatalog.fieldSearchHighlightBg,
    },
    quickInsert: {
      keyInput: normalizeBox(qi.keyInput, fb.quickInsert.keyInput),
      valueInput: normalizeBox(qi.valueInput, fb.quickInsert.valueInput),
      shortcutInput: normalizeBox(qi.shortcutInput, fb.quickInsert.shortcutInput),
      bindButton: normalizeBtn(qi.bindButton, fb.quickInsert.bindButton),
      deleteButton: normalizeBtn(qi.deleteButton, fb.quickInsert.deleteButton),
      addButton: normalizeBtn(qi.addButton, fb.quickInsert.addButton),
      expandTarget: expandTarget(
        qi.expandTarget,
        ["key", "value", "shortcut", "none"],
        fb.quickInsert.expandTarget,
      ),
    },
    savedSql: {
      rowBackground: typeof sv.rowBackground === "string" ? sv.rowBackground : fb.savedSql.rowBackground,
      nameInput: normalizeBox(sv.nameInput, fb.savedSql.nameInput),
      showButton: normalizeBtn(sv.showButton, fb.savedSql.showButton),
      useButton: normalizeBtn(sv.useButton, fb.savedSql.useButton),
      deleteButton: normalizeBtn(sv.deleteButton, fb.savedSql.deleteButton),
      expandTarget: expandTarget(
        sv.expandTarget,
        ["name", "show", "use", "delete", "none"],
        fb.savedSql.expandTarget,
      ),
    },
  };
}

function normalizeEditorAppearance(raw: unknown, fb: EditorAppearance): EditorAppearance {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const allowed = ["auto", "vs", "vs-dark", "hc-black", "hc-light"];
  const baseTheme =
    typeof o.baseTheme === "string" && allowed.includes(o.baseTheme as string)
      ? (o.baseTheme as EditorAppearance["baseTheme"])
      : fb.baseTheme;
  return {
    baseTheme,
    selectedLineBg: typeof o.selectedLineBg === "string" ? o.selectedLineBg : fb.selectedLineBg,
    activeLineNumberFg:
      typeof o.activeLineNumberFg === "string" ? o.activeLineNumberFg : fb.activeLineNumberFg,
    lineNumberFg: typeof o.lineNumberFg === "string" ? o.lineNumberFg : fb.lineNumberFg,
  };
}


type TableRelationInput = {
  id?: string;
  fromTable?: string;
  toTable?: string;
  fieldPairs?: Array<{ fromField?: string; toField?: string }>;
  cardinality?: string;
  onClause?: string;
  joinKind?: string;
};

type TableCatalogInput = {
  table?: string;
  qualifiedName?: string;
  comment?: string;
  fields?: string[];
  primaryKeys?: string[];
  estimatedRowCount?: unknown;
  fieldInfo?: Record<
    string,
    { comment?: unknown; type?: unknown; length?: unknown; precision?: unknown; isKey?: unknown }
  >;
  fieldGroups?: unknown;
};

function normalizeEstimatedRowCount(raw: unknown): number | undefined {
  if (raw == null || raw === "") return undefined;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.floor(n);
}

function normalizeSqlDiagnosticsSettings(
  raw: unknown,
  fb: AppConfig["sqlDiagnosticsSettings"],
): AppConfig["sqlDiagnosticsSettings"] {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const min = o.joinLargeDrivingSmallMinRows;
  const joinLargeDrivingSmallMinRows =
    typeof min === "number" && Number.isFinite(min) && min >= 0
      ? Math.floor(min)
      : fb.joinLargeDrivingSmallMinRows;
  const enableJoinLargeDrivingSmallWarning =
    typeof o.enableJoinLargeDrivingSmallWarning === "boolean"
      ? o.enableJoinLargeDrivingSmallWarning
      : fb.enableJoinLargeDrivingSmallWarning;
  const enableJoinOnConfigMismatchWarning =
    typeof o.enableJoinOnConfigMismatchWarning === "boolean"
      ? o.enableJoinOnConfigMismatchWarning
      : fb.enableJoinOnConfigMismatchWarning;
  const showRepositionInvalidCursorHint =
    typeof o.showRepositionInvalidCursorHint === "boolean"
      ? o.showRepositionInvalidCursorHint
      : fb.showRepositionInvalidCursorHint;
  return {
    enableJoinLargeDrivingSmallWarning,
    enableJoinOnConfigMismatchWarning,
    joinLargeDrivingSmallMinRows,
    showRepositionInvalidCursorHint,
  };
}

function normalizeFieldInfo(
  raw: unknown,
): AppConfig["tableCatalog"][number]["fieldInfo"] | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, any>;
  const out: Record<string, any> = {};
  for (const k of Object.keys(o)) {
    const kk = String(k).toUpperCase();
    const v = o[k];
    if (!v || typeof v !== "object") continue;
    out[kk] = {
      comment: typeof v.comment === "string" ? v.comment : undefined,
      type: typeof v.type === "string" ? v.type : undefined,
      length: typeof v.length === "number" ? v.length : v.length == null ? null : undefined,
      precision:
        typeof v.precision === "number" ? v.precision : v.precision == null ? null : undefined,
      isKey: typeof v.isKey === "boolean" ? v.isKey : undefined,
    };
  }
  return Object.keys(out).length ? (out as any) : undefined;
}

function normalizeEditorLineBreak(
  sf: Partial<AppConfig["sqlFormatting"]> & { wrapLongLines?: boolean } | null,
  fallback: AppConfig["sqlFormatting"]["editorLineBreak"],
): AppConfig["sqlFormatting"]["editorLineBreak"] {
  if (!sf) return fallback;
  if (sf.editorLineBreak === "soft" || sf.editorLineBreak === "hard") {
    return sf.editorLineBreak;
  }
  if (typeof sf.wrapLongLines === "boolean") {
    return sf.wrapLongLines ? "soft" : "hard";
  }
  return fallback;
}

function normalizeSqlSnippets(
  raw: unknown,
  fallback: AppConfig["sqlSnippets"],
): AppConfig["sqlSnippets"] {
  if (!Array.isArray(raw)) return [...fallback];
  return raw.map((x, i) => {
    const o = x as Record<string, unknown>;
    return {
      id: String(o.id ?? `snip-import-${i}`),
      name: String(o.name ?? ""),
      text: String(o.text ?? ""),
    };
  });
}

function normalizeCompressLevel(
  sf: Partial<AppConfig["sqlFormatting"]> | null,
  fallback: SqlCompressLevel,
): SqlCompressLevel {
  if (!sf) return fallback;
  const l = sf.compressLevel;
  if (l === 0 || l === 1 || l === 2) return l;
  if (typeof l === "number" && Number.isFinite(l)) {
    const n = Math.round(l);
    if (n === 0 || n === 1 || n === 2) return n as SqlCompressLevel;
  }
  const legacy = sf as { compressSql?: boolean };
  if (legacy.compressSql === true) return 2;
  if (legacy.compressSql === false) return 0;
  return fallback;
}

type PanelSlot = SidebarLayout["left"][number];

const ALL_SLOTS: PanelSlot[] = ["search", "savedSql", "quickInsert"];

function normalizeSidebarLayout(
  raw: unknown,
  fallback: SidebarLayout,
): SidebarLayout {
  const fb = { left: [...fallback.left], right: [...fallback.right] };
  if (!raw || typeof raw !== "object") return fb;
  const r = raw as Record<string, unknown>;
  let left = parsePanelColumn(r.left);
  let right = parsePanelColumn(r.right);
  if (left.length === 0 && right.length === 0) return fb;

  const seen = new Set<PanelSlot>();
  const uniqueInOrder = (arr: PanelSlot[]): PanelSlot[] => {
    const out: PanelSlot[] = [];
    for (const s of arr) {
      if (seen.has(s)) continue;
      seen.add(s);
      out.push(s);
    }
    return out;
  };
  left = uniqueInOrder(left);
  right = uniqueInOrder(right);

  for (const slot of ALL_SLOTS) {
    if (seen.has(slot)) continue;
    if (fb.left.includes(slot)) left.push(slot);
    else if (fb.right.includes(slot)) right.push(slot);
    else left.push(slot);
    seen.add(slot);
  }
  return { left, right };
}

function parsePanelColumn(raw: unknown): PanelSlot[] {
  if (!Array.isArray(raw)) return [];
  const out: PanelSlot[] = [];
  for (const x of raw) {
    const s = String(x);
    if (s === "search" || s === "savedSql" || s === "quickInsert") out.push(s);
  }
  return out;
}

function normalizeQuickInserts(
  raw: unknown,
  fallback: QuickInsertEntry[],
): QuickInsertEntry[] {
  if (!Array.isArray(raw)) return [...fallback];
  return raw.map((e, i) => {
    const o = e as Record<string, unknown>;
    const scope = o.bgScope === "icon" ? "icon" : "row";
    const bgColor = typeof o.bgColor === "string" && o.bgColor ? o.bgColor : undefined;
    return {
      id: String(o.id ?? `qi-${i}`),
      key: String(o.key ?? ""),
      value: String(o.value ?? ""),
      shortcut: String(o.shortcut ?? ""),
      bgColor,
      bgScope: scope,
    };
  });
}

function normalizePathGroups(
  raw: unknown,
  fallback: AppConfig["ddsCopybookPathGroups"],
): AppConfig["ddsCopybookPathGroups"] {
  if (!Array.isArray(raw)) return fallback.map((x) => ({ ...x }));
  return raw.map((g, i) => {
    const o = g as Record<string, unknown>;
    return {
      order: typeof o.order === "number" ? o.order : i,
      schemaCsvPath: String(o.schemaCsvPath ?? (o.ddsPath ?? "")),
      schemaCsvFileHandleKey:
        typeof o.schemaCsvFileHandleKey === "string"
          ? o.schemaCsvFileHandleKey
          : typeof o.ddsDirHandleKey === "string"
            ? o.ddsDirHandleKey
            : undefined,
      pairing: {
        ddsSuffix: String((o.pairing as any)?.ddsSuffix ?? ".dds"),
        copybookSuffix: String((o.pairing as any)?.copybookSuffix ?? ".cbl"),
      },
    };
  });
}

function normalizeHotkeys(raw: unknown, fallback: HotkeyConfig): HotkeyConfig {
  if (!raw || typeof raw !== "object") return { ...fallback };
  const h = raw as Record<string, unknown>;
  return {
    copyCurrentBlock: String(h.copyCurrentBlock ?? fallback.copyCurrentBlock),
    saveEditorSql: String(h.saveEditorSql ?? fallback.saveEditorSql),
    compressLineOrSelection: String(
      h.compressLineOrSelection ?? fallback.compressLineOrSelection,
    ),
    compressCurrentBlock: String(
      h.compressCurrentBlock ?? fallback.compressCurrentBlock,
    ),
    openSettings: String(h.openSettings ?? fallback.openSettings),
    openHotkeysSettings: String(h.openHotkeysSettings ?? fallback.openHotkeysSettings),
    openTableCatalog: String(h.openTableCatalog ?? fallback.openTableCatalog),
    openRelations: String(h.openRelations ?? fallback.openRelations),
    nextPlaceholder: String(h.nextPlaceholder ?? fallback.nextPlaceholder),
    extendSelection: String(h.extendSelection ?? fallback.extendSelection),
    shrinkSelection: String(h.shrinkSelection ?? fallback.shrinkSelection),
    repositionActivate: String(h.repositionActivate ?? fallback.repositionActivate),
    repositionSelectPrev: String(h.repositionSelectPrev ?? fallback.repositionSelectPrev),
    repositionSelectNext: String(h.repositionSelectNext ?? fallback.repositionSelectNext),
    repositionSwapPrev: String(h.repositionSwapPrev ?? fallback.repositionSwapPrev),
    repositionSwapNext: String(h.repositionSwapNext ?? fallback.repositionSwapNext),
    repositionExtendWithPrev: String(
      h.repositionExtendWithPrev ?? fallback.repositionExtendWithPrev,
    ),
    repositionExtendWithNext: String(
      h.repositionExtendWithNext ?? fallback.repositionExtendWithNext,
    ),
    repositionShrinkRemovePrev: String(
      h.repositionShrinkRemovePrev ?? fallback.repositionShrinkRemovePrev,
    ),
    repositionShrinkRemoveNext: String(
      h.repositionShrinkRemoveNext ?? fallback.repositionShrinkRemoveNext,
    ),
  };
}

function normalizeContextDivider(raw: unknown, fb: ContextDividerStyle): ContextDividerStyle {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const allowed: Array<ContextDividerStyle["style"]> = ["solid", "dashed", "dotted"];
  return {
    color: typeof o.color === "string" ? o.color : fb.color,
    width: typeof o.width === "number" && o.width >= 0 ? Math.round(o.width) : fb.width,
    style: (allowed as string[]).includes(o.style as string)
      ? (o.style as ContextDividerStyle["style"])
      : fb.style,
  };
}

function normalizeFieldGroups(raw: unknown): FieldGroup[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: FieldGroup[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const key = typeof o.key === "string" ? o.key.trim() : "";
    if (!key) continue;
    const fields = Array.isArray(o.fields)
      ? o.fields.map((f) => String(f).toUpperCase()).filter(Boolean)
      : [];
    out.push({ key, fields });
  }
  return out.length > 0 ? out : undefined;
}

function normalizeCardinality(c: string | undefined): AppConfig["relations"][0]["cardinality"] {
  const v = String(c ?? "").toLowerCase().replace(/\s+/g, "");
  if (v === "one-to-one" || v === "1:1") return "one-to-one";
  if (v === "many-to-many" || v === "m:n") return "many-to-many";
  if (v === "many-to-one" || v === "n:1") return "many-to-one";
  if (v === "one-to-many" || v === "1:n") return "one-to-many";
  return "one-to-many";
}
