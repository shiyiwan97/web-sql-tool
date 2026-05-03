export type Cardinality = "one-to-one" | "one-to-many" | "many-to-one" | "many-to-many";

/** UI 主题（写入配置 JSON，随 localStorage 持久化） */
export type UiTheme = "light" | "dark";

export interface DdsCopybookPairing {
  ddsSuffix: string;
  copybookSuffix: string;
}

export interface DdsCopybookPathGroup {
  order: number;
  /** Schema CSV file path/label */
  schemaCsvPath: string;
  /** Browser-only file handle key (stored in IndexedDB); not exported in JSON */
  schemaCsvFileHandleKey?: string;
  pairing: DdsCopybookPairing;
}

export interface TableRelation {
  id: string;
  fromTable: string;
  toTable: string;
  /** Field pairs used to build ON preview; supports multi-column joins */
  fieldPairs?: Array<{ fromField: string; toField: string }>;
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
  /** 搜索侧栏点击插入表/JOIN 时，关键字是否大写（SELECT / FROM / LEFT JOIN / ON 等） */
  searchInsertKeywordsUppercase: boolean;
}

/** 编辑器内 SQL 静态提示（JOIN 顺序等） */
export interface SqlDiagnosticsSettings {
  /** 是否启用「左侧大表驱动右侧小表」类 JOIN 顺序提示（依赖查看表中的估计行数） */
  enableJoinLargeDrivingSmallWarning: boolean;
  /** 是否启用「JOIN ON 与配置的表关系不一致」提示 */
  enableJoinOnConfigMismatchWarning: boolean;
  /**
   * JOIN 书写顺序告警：左侧（JOIN 前的表）估计行数 ≥ 该值，且大于右侧表登记行数时提示。
   * 设为 0 表示不设下限（只要左侧大于右侧即提示）。
   */
  joinLargeDrivingSmallMinRows: number;
  /**
   * 调整位置：用快捷键/状态栏尝试进入模式但光标不在可识别的表或 SELECT 列上时，是否弹出说明提示。
   * 「不再显示该提示」会将此项设为 false。
   */
  showRepositionInvalidCursorHint: boolean;
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
  /** 表级注释 / remark（来自 CSV 第 2 列） */
  comment?: string;
  fields: string[];
  /** Primary key fields (best-effort from DDS) */
  primaryKeys?: string[];
  /** 估计行数；用于 JOIN 书写顺序性能提示；未登记则不参与 */
  estimatedRowCount?: number | null;
  /** Optional per-field metadata for searchable dropdowns */
  fieldInfo?: Record<
    string,
    {
      comment?: string;
      type?: string;
      length?: number | null;
      precision?: number | null;
      isKey?: boolean;
    }
  >;
}

export interface RelationIndex {
  byTable: Record<string, { source?: string; files?: string[] }>;
  mergedAt?: string;
  note?: string;
}

/** 可停靠侧栏面板 */
export type PanelSlot = "search" | "savedSql" | "quickInsert";

export type SchemaCsvQualityIssue = {
  line: number;
  kind:
    | "missing-table"
    | "missing-column"
    | "duplicate-column"
    | "bad-length"
    | "bad-precision";
  message: string;
};

export type SchemaCsvQualityReport = {
  lines: number;
  rows: number;
  tables: number;
  fields: number;
  primaryKeyMarks: number;
  duplicates: number;
  issues: SchemaCsvQualityIssue[];
};

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
  /** 打开设置面板，例如 Ctrl+Alt+, */
  openSettings: string;
  /** 打开快捷键设置面板（全局生效） */
  openHotkeysSettings: string;
  /**
   * Extend Selection（扩展选区）：与 IntelliJ IDEA 同名动作同类，映射 Monaco 智能扩选。
   * 默认 Ctrl+W，并在编辑器聚焦时避免触发浏览器关闭标签页。
   */
  extendSelection: string;
  /**
   * Shrink Selection（缩小选区）：与 IntelliJ IDEA 同名动作同类，映射 Monaco 缩小选区。
   */
  shrinkSelection: string;
  /** 「调整位置」模式：检测光标处表/字段并进入重排会话（会话内再按一次可结束会话） */
  repositionActivate: string;
  /** 调整位置：指向前一项（默认 Left；仅在「调整位置」模式中生效） */
  repositionSelectPrev: string;
  repositionSelectNext: string;
  /** 与前一项交换当前选中片段（默认 Ctrl+Left） */
  repositionSwapPrev: string;
  repositionSwapNext: string;
  /** 扩选：与前一项一并选中（默认 Shift+Left） */
  repositionExtendWithPrev: string;
  repositionExtendWithNext: string;
  /** 收缩：从多选中去掉序号最小的一项（仅剩一项时无效） */
  repositionShrinkRemovePrev: string;
  /** 收缩：从多选中去掉序号最大的一项（仅剩一项时无效） */
  repositionShrinkRemoveNext: string;
}

/**
 * 文本样式（仅作用于颜色与字号；空字符串/0 表示沿用主题/默认）
 */
export interface PanelTextStyle {
  fontSize: number;
  /** 16 进制色 "#rrggbb"；"" 表示沿用主题色 */
  color: string;
}

/**
 * 输入/按钮的盒子样式
 *  - width/height 为 0 表示自动（不强制）
 *  - label 仅对按钮有效
 */
export interface PanelBoxStyle {
  fontSize: number;
  color: string;
  width: number;
  height: number;
}

export interface PanelButtonStyle extends PanelBoxStyle {
  label: string;
}

/** 搜索 / 查看表等面板共用的：主键字段旁标注（如 PK） */
export interface SearchPanelPkBadgeStyle {
  /** 显示文案；空则显示 PK */
  label: string;
  /** 文字颜色；空则用默认金色 */
  color: string;
  /** 背景色；空则用默认半透明底 */
  backgroundColor: string;
  /** 边框色；空则用默认 */
  borderColor: string;
}

/** 搜索面板：5 类文字 */
export interface SearchPanelStyle {
  tableName: PanelTextStyle;
  fieldName: PanelTextStyle;
  tableComment: PanelTextStyle;
  fieldComment: PanelTextStyle;
  fieldType: PanelTextStyle;
  /** 主键字段旁标注 */
  primaryKeyBadge: SearchPanelPkBadgeStyle;
  /** 字段类型映射：例如 { CHARACTER: "C", DECIMAL: "D" } */
  typeMappings: Array<{ from: string; to: string }>;
  /** 表 item 行高（px，0 = 自动） */
  tableItemHeight: number;
  /** 字段 item 行高（px，0 = 自动） */
  fieldItemHeight: number;
  /** 注释/描述是否换行展示（false = 单行省略） */
  commentWrap: boolean;
}

/** 快捷赋值面板：3 个输入框 + 3 个按钮 */
export interface QuickInsertPanelStyle {
  keyInput: PanelBoxStyle;
  valueInput: PanelBoxStyle;
  shortcutInput: PanelBoxStyle;
  bindButton: PanelButtonStyle;
  deleteButton: PanelButtonStyle;
  addButton: PanelButtonStyle;
  /** 当行有富余空间时，由这个目标输入框吸收（none = 不扩展） */
  expandTarget: "key" | "value" | "shortcut" | "none";
}

/** 已存 SQL 面板：1 个输入 + 3 个按钮 + 行背景 */
export interface SavedSqlPanelStyle {
  /** 行（item）默认背景色 */
  rowBackground: string;
  nameInput: PanelBoxStyle;
  showButton: PanelButtonStyle;
  useButton: PanelButtonStyle;
  deleteButton: PanelButtonStyle;
  /** 当行有富余空间时，由这个目标吸收 */
  expandTarget: "name" | "show" | "use" | "delete" | "none";
}

/** 查看表 Modal：表格与注释的文字样式 + 搜索命中字段行的背景 */
export interface TableCatalogPanelStyle {
  tableName: PanelTextStyle;
  fieldName: PanelTextStyle;
  tableComment: PanelTextStyle;
  fieldComment: PanelTextStyle;
  fieldType: PanelTextStyle;
  /** 主键字段旁标注（与搜索面板同款可选项） */
  primaryKeyBadge: SearchPanelPkBadgeStyle;
  /** 左侧搜索命中字段名时，右侧字段列表该行的背景色；空表示不加背景 */
  fieldSearchHighlightBg: string;
}

export interface PanelStyles {
  search: SearchPanelStyle;
  quickInsert: QuickInsertPanelStyle;
  savedSql: SavedSqlPanelStyle;
  tableCatalog: TableCatalogPanelStyle;
}

/** 编辑器（Monaco）外观设置 */
export interface EditorAppearance {
  /** 基础主题；空字符串/"auto" 时跟随 AppConfig.theme（dark→vs-dark, light→vs） */
  baseTheme: "auto" | "vs" | "vs-dark" | "hc-black" | "hc-light";
  /** 当前光标行的高亮背景色；"" 表示沿用主题默认 */
  selectedLineBg: string;
  /** 当前光标行的行号颜色（active line number）；"" 表示沿用主题默认 */
  activeLineNumberFg: string;
  /** 普通行的行号颜色；"" 表示沿用主题默认 */
  lineNumberFg: string;
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
  /** 各面板的字体/颜色/盒子尺寸自定义；为空时使用默认 */
  panelStyles: PanelStyles;
  /** 编辑器（Monaco）外观自定义 */
  editorAppearance: EditorAppearance;
  /** JOIN 顺序等编辑器提示阈值 */
  sqlDiagnosticsSettings: SqlDiagnosticsSettings;
}
