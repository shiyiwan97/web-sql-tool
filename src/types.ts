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

export interface SqlFormatting {
  maxCharsPerLine: number;
  /** 在 Monaco 中于「每行最大字符」列绘制竖线（rulers） */
  showColumnGuide: boolean;
  /** 仅影响编辑器内视觉换行参考列 */
  wrapLongLines: boolean;
  compressLevel: SqlCompressLevel;
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
export type PanelSlot = "search" | "quickInsert";

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
}

export interface AppConfig {
  version: number;
  /** 界面主题 */
  theme: UiTheme;
  ddsCopybookPathGroups: DdsCopybookPathGroup[];
  tableResolution: { description: string };
  relations: TableRelation[];
  sqlFormatting: SqlFormatting;
  tableRelationSourcePath: string | null;
  relationIndex: RelationIndex;
  /** Field search + insert: built from JSON / future DDS parse */
  tableCatalog: TableCatalogEntry[];
  /** 搜索 / 快捷赋值 面板停靠 */
  sidebarLayout: SidebarLayout;
  quickInserts: QuickInsertEntry[];
  hotkeys: HotkeyConfig;
}
