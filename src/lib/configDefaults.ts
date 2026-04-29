import type {
  AppConfig,
  HotkeyConfig,
  QuickInsertEntry,
  SidebarLayout,
  SqlCompressLevel,
} from "../types";

let id = 0;
const rid = () => `rel-${++id}`;

export function createDefaultConfig(): AppConfig {
  id = 0;
  return {
    version: 1,
    theme: "dark",
    debugMode: false,
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
    relations: [
      {
        id: rid(),
        fromTable: "GRADECLS",
        toTable: "STUDENT",
        cardinality: "one-to-many",
        onClause: "GRADECLS.GCLSID = STUDENT.GCLSID",
        joinKind: "LEFT",
      },
      {
        id: rid(),
        fromTable: "STUDENT",
        toTable: "EXAMSCORE",
        cardinality: "one-to-many",
        onClause: "STUDENT.STUID = EXAMSCORE.STUID",
        joinKind: "LEFT",
      },
    ],
    sqlFormatting: {
      maxCharsPerLine: 72,
      showColumnGuide: false,
      editorLineBreak: "soft",
      compressLevel: 0,
    },
    sqlSnippets: [],
    tableRelationSourcePath: null,
    relationIndex: { byTable: {} },
    tableCatalog: [
      {
        table: "GRADECLS",
        qualifiedName: "LIB.GRADECLS",
        fields: ["GCLSID", "GRADEYR", "CLASSNM", "ROOMNO"],
      },
      {
        table: "STUDENT",
        qualifiedName: "LIB.STUDENT",
        fields: ["STUID", "GCLSID", "STUNM", "GENDER", "BIRTHDT"],
      },
      {
        table: "EXAMSCORE",
        qualifiedName: "LIB.EXAMSCORE",
        fields: ["STUID", "EXAMDATE", "SUBJECT", "SCORE", "FULLSCR"],
      },
    ],
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
    },
  };
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
            ? r.fieldPairs
                .map((p) => ({
                  fromField: String(p?.fromField ?? "").toUpperCase(),
                  toField: String(p?.toField ?? "").toUpperCase(),
                }))
                .filter((p) => p.fromField && p.toField)
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
    tableCatalog: Array.isArray(o.tableCatalog)
      ? (o.tableCatalog as TableCatalogInput[]).map((t) => ({
          table: String(t.table ?? "").toUpperCase(),
          qualifiedName: t.qualifiedName
            ? String(t.qualifiedName)
            : undefined,
          fields: Array.isArray(t.fields)
            ? t.fields.map((f) => String(f).toUpperCase())
            : [],
          primaryKeys: Array.isArray(t.primaryKeys)
            ? t.primaryKeys.map((f) => String(f).toUpperCase())
            : undefined,
          fieldInfo: normalizeFieldInfo(t.fieldInfo),
        }))
      : base.tableCatalog,
    sidebarLayout: normalizeSidebarLayout(o.sidebarLayout, base.sidebarLayout),
    quickInserts: normalizeQuickInserts(o.quickInserts, base.quickInserts),
    hotkeys: normalizeHotkeys(o.hotkeys, base.hotkeys),
  };
  return merged;
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
  fields?: string[];
  primaryKeys?: string[];
  fieldInfo?: Record<
    string,
    { comment?: unknown; type?: unknown; length?: unknown; precision?: unknown; isKey?: unknown }
  >;
};

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
    return {
      id: String(o.id ?? `qi-${i}`),
      key: String(o.key ?? ""),
      value: String(o.value ?? ""),
      shortcut: String(o.shortcut ?? ""),
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
  };
}

function normalizeCardinality(c: string | undefined): AppConfig["relations"][0]["cardinality"] {
  const v = String(c ?? "").toLowerCase().replace(/\s+/g, "");
  if (v === "one-to-one" || v === "1:1") return "one-to-one";
  if (v === "many-to-many" || v === "m:n") return "many-to-many";
  if (v === "many-to-one" || v === "n:1") return "many-to-one";
  if (v === "one-to-many" || v === "1:n") return "one-to-many";
  return "one-to-many";
}
