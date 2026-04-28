export type Cardinality = "one-to-many" | "many-to-one" | "many-to-many";

/** UI 主题（写入配置 JSON，随 localStorage 持久化） */
export type UiTheme = "light" | "dark";

export interface DdsCopybookPairing {
  ddsSuffix: string;
  copybookSuffix: string;
}

export interface DdsCopybookPathGroup {
  order: number;
  ddsPath: string;
  copybookPath: string;
  pairing: DdsCopybookPairing;
}

export interface TableRelation {
  id: string;
  fromTable: string;
  toTable: string;
  cardinality: Cardinality;
  /** Raw ON clause without ON keyword, e.g. "a.ID = b.ID" */
  onClause: string;
  /** Prefer LEFT for optional child rows */
  joinKind?: "LEFT" | "INNER";
}

/** 0 不压缩；1 轻微（去行首缩进等）；2 强力（单行贪心装填到行长） */
export type SqlCompressLevel = 0 | 1 | 2;

/** soft = 仅视觉折行，行号不变；hard = 关闭视觉折行，真实换行使行号 +1（用「重排」或复制格式化） */
export type EditorLineBreak = "soft" | "hard";

export interface SqlFormatting {
  maxCharsPerLine: number;
  /** 在 Monaco 中于「每行最大字符」列绘制竖线（rulers） */
  showColumnGuide: boolean;
  editorLineBreak: EditorLineBreak;
  compressLevel: SqlCompressLevel;
}

/** 本地保存的 SQL 片段（设置中编辑，可导入导出随配置 JSON） */
export interface SqlSnippet {
  id: string;
  name: string;
  text: string;
}

export interface TableCatalogEntry {
  /** Logical table name (e.g. GRADECLS); may match DDS basename */
  table: string;
  /** Optional qualified name for SQL snippets */
  qualifiedName?: string;
  fields: string[];
}

export interface RelationIndex {
  byTable: Record<string, { source?: string; files?: string[] }>;
  mergedAt?: string;
  note?: string;
}

/** 可停靠侧栏面板 */
export type PanelSlot = "search" | "savedSql" | "quickInsert";

export interface SidebarLayout {
  /** 左侧自上而下 */
  left: PanelSlot[];
  /** 右侧自上而下 */
  right: PanelSlot[];
}

/** 快捷粘贴：key 仅展示；value 原样插入；shortcut 如 Ctrl+Shift+1 */
export interface QuickInsertEntry {
  id: string;
  key: string;
  value: string;
  shortcut: string;
}

export interface HotkeyConfig {
  /** 复制当前分号块（格式化、无分号），如 Ctrl+Shift+C */
  copyCurrentBlock: string;
  /** 将当前分号块或选区（去注释）新建为「已存 SQL」一条存档，如 Ctrl+Alt+S */
  saveEditorSql: string;
  /** 压缩当前行/区域（向上填充行），如 Shift+Backspace */
  compressLineOrSelection: string;
  /** 压缩当前分号块，如 Ctrl+Shift+Backspace */
  compressCurrentBlock: string;
}

export interface AppConfig {
  version: number;
  /** 界面主题 */
  theme: UiTheme;
  /** Debug 模式：展示更完整的状态栏信息 */
  debugMode: boolean;
  ddsCopybookPathGroups: DdsCopybookPathGroup[];
  tableResolution: { description: string };
  relations: TableRelation[];
  sqlFormatting: SqlFormatting;
  /** 常用 SQL 片段，便于从 DDS/手工维护的语句入库 */
  sqlSnippets: SqlSnippet[];
  tableRelationSourcePath: string | null;
  relationIndex: RelationIndex;
  /** Field search + insert: built from JSON / future DDS parse */
  tableCatalog: TableCatalogEntry[];
  /** 搜索 / 快捷赋值 面板停靠 */
  sidebarLayout: SidebarLayout;
  quickInserts: QuickInsertEntry[];
  hotkeys: HotkeyConfig;
}
