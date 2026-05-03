import type { AppConfig } from "../types";
import { normalizeConfig } from "./configDefaults";

/**
 * 可用于 diff/合并的配置块清单。
 * 每个块在导入/导出时都会附带 userId、version、updatedAt。
 */
export const CONFIG_BLOCK_KEYS = [
  "theme",
  "debugMode",
  "ddsCopybookPathGroups",
  "tableResolution",
  "relations",
  "sqlFormatting",
  "sqlDiagnosticsSettings",
  "sqlSnippets",
  "tableRelationSourcePath",
  "relationIndex",
  "tableCatalog",
  "sidebarLayout",
  "quickInserts",
  "hotkeys",
  "panelStyles",
] as const;

export type ConfigBlockKey = (typeof CONFIG_BLOCK_KEYS)[number];

export const CONFIG_BLOCK_LABELS: Record<ConfigBlockKey, string> = {
  theme: "主题",
  debugMode: "Debug 模式",
  ddsCopybookPathGroups: "Schema CSV 路径组",
  tableResolution: "表名解析说明",
  relations: "表关系",
  sqlFormatting: "编辑器 SQL（行长 / 换行 / 插入关键字）",
  sqlDiagnosticsSettings: "SQL 警告（JOIN、调整位置提示）",
  sqlSnippets: "SQL 片段",
  tableRelationSourcePath: "表关系外部路径",
  relationIndex: "关系索引",
  tableCatalog: "查看表（catalog）",
  sidebarLayout: "侧栏布局",
  quickInserts: "快捷赋值",
  hotkeys: "快捷键",
  panelStyles: "面板样式",
};

export type ConfigBlockMeta = {
  /** 用户/客户端标识，用于"我的发给别人"场景识别来源 */
  userId: string;
  /** 该块的内部版本号（每次本地变更自增） */
  version: number;
  /** ISO 时间 */
  updatedAt: string;
};

export type ConfigBlocksMeta = Record<ConfigBlockKey, ConfigBlockMeta>;

/** 可携带块元信息的导入/导出文件结构 */
export type PortableConfig = {
  /** 文件总版本，方便未来升级解析 */
  schemaVersion: 1;
  userId: string;
  generatedAt: string;
  /** 各块的元信息（来源/版本/时间） */
  blocksMeta: Partial<ConfigBlocksMeta>;
  /** 实际配置数据（整份 AppConfig，便于直接合并） */
  config: AppConfig;
};

const USER_ID_KEY = "sql-web-tool-user-id";
const META_KEY = "sql-web-tool-blocks-meta-v1";

export function getOrCreateUserId(): string {
  try {
    const existing = localStorage.getItem(USER_ID_KEY);
    if (existing && existing.trim()) return existing;
  } catch {
    // ignore
  }
  const fresh = `user-${globalThis.crypto?.randomUUID?.() ?? String(Date.now())}`;
  try {
    localStorage.setItem(USER_ID_KEY, fresh);
  } catch {
    // ignore
  }
  return fresh;
}

export function setUserId(id: string): void {
  if (!id) return;
  try {
    localStorage.setItem(USER_ID_KEY, id);
  } catch {
    // ignore
  }
}

export function loadBlocksMeta(): ConfigBlocksMeta {
  const base = createDefaultBlocksMeta();
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return base;
    const o = JSON.parse(raw) as Partial<ConfigBlocksMeta> | null;
    if (!o || typeof o !== "object") return base;
    const out = { ...base };
    for (const k of CONFIG_BLOCK_KEYS) {
      const v = (o as any)[k];
      if (v && typeof v === "object") {
        out[k] = {
          userId: typeof v.userId === "string" ? v.userId : base[k].userId,
          version: typeof v.version === "number" ? v.version : base[k].version,
          updatedAt: typeof v.updatedAt === "string" ? v.updatedAt : base[k].updatedAt,
        };
      }
    }
    return out;
  } catch {
    return base;
  }
}

export function saveBlocksMeta(meta: ConfigBlocksMeta): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // ignore
  }
}

export function createDefaultBlocksMeta(): ConfigBlocksMeta {
  const userId = getOrCreateUserId();
  const now = new Date().toISOString();
  const out = {} as ConfigBlocksMeta;
  for (const k of CONFIG_BLOCK_KEYS) {
    out[k] = { userId, version: 1, updatedAt: now };
  }
  return out;
}

/** 为指定块自增版本（用于本地修改后调用） */
export function bumpBlockVersion(
  meta: ConfigBlocksMeta,
  key: ConfigBlockKey,
): ConfigBlocksMeta {
  const userId = getOrCreateUserId();
  return {
    ...meta,
    [key]: {
      userId,
      version: (meta[key]?.version ?? 0) + 1,
      updatedAt: new Date().toISOString(),
    },
  };
}

/** 比较两份配置的某一块内容是否相同（基于 JSON 字符串） */
export function blocksAreEqual(
  a: AppConfig,
  b: AppConfig,
  key: ConfigBlockKey,
): boolean {
  return JSON.stringify((a as any)[key]) === JSON.stringify((b as any)[key]);
}

/** 把配置 + meta 序列化为可分享的 JSON 文件字符串 */
export function buildPortableConfig(
  cfg: AppConfig,
  meta: ConfigBlocksMeta,
): PortableConfig {
  return {
    schemaVersion: 1,
    userId: getOrCreateUserId(),
    generatedAt: new Date().toISOString(),
    blocksMeta: { ...meta },
    config: cfg,
  };
}

/** 解析任意 JSON 文件为 PortableConfig（容错：旧格式只含 AppConfig） */
export function parsePortableJson(raw: unknown): PortableConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  // Already a portable file
  if (o.schemaVersion === 1 && o.config && typeof o.config === "object") {
    const cfg = normalizeConfig(o.config);
    const meta: Partial<ConfigBlocksMeta> = {};
    if (o.blocksMeta && typeof o.blocksMeta === "object") {
      for (const k of CONFIG_BLOCK_KEYS) {
        const v = (o.blocksMeta as any)[k];
        if (v && typeof v === "object") {
          meta[k] = {
            userId: typeof v.userId === "string" ? v.userId : "",
            version: typeof v.version === "number" ? v.version : 1,
            updatedAt: typeof v.updatedAt === "string" ? v.updatedAt : new Date().toISOString(),
          };
        }
      }
    }
    return {
      schemaVersion: 1,
      userId: typeof o.userId === "string" ? o.userId : "",
      generatedAt: typeof o.generatedAt === "string" ? o.generatedAt : new Date().toISOString(),
      blocksMeta: meta,
      config: cfg,
    };
  }
  // Bundle file (publicConfig + privateConfig): use private
  if ("publicConfig" in o && "privateConfig" in o) {
    const cfg = normalizeConfig((o as any).privateConfig);
    return {
      schemaVersion: 1,
      userId: "",
      generatedAt: new Date().toISOString(),
      blocksMeta: {},
      config: cfg,
    };
  }
  // Legacy: bare AppConfig
  return {
    schemaVersion: 1,
    userId: "",
    generatedAt: new Date().toISOString(),
    blocksMeta: {},
    config: normalizeConfig(o),
  };
}

/** 把单一块的内容写回 AppConfig，返回新对象 */
export function applyBlockTo(
  base: AppConfig,
  key: ConfigBlockKey,
  value: unknown,
): AppConfig {
  return { ...base, [key]: value as any };
}

