import type { GlobalSearchGroup, TableCatalogEntry } from "../types";
import { getCatalogIndex } from "./catalogIndex";

export type GlobalSearchGroupTableHit = {
  entry: TableCatalogEntry;
  /** 命中表名/qn/注释 的关键词集合（大写） */
  matchedKeywords: string[];
};

export type GlobalSearchGroupFieldHit = {
  entry: TableCatalogEntry;
  /** 该表中命中的字段（保留原大小写） */
  fields: string[];
  /** 命中此表中字段/字段注释 的关键词集合（大写） */
  matchedKeywords: string[];
};

export type GlobalSearchGroupHits = {
  group: GlobalSearchGroup;
  /** 表级命中（按 catalog 顺序） */
  tableHits: GlobalSearchGroupTableHit[];
  /** 字段级命中（按 catalog 顺序，单表内字段去重） */
  fieldHits: GlobalSearchGroupFieldHit[];
};

/**
 * 找到所有 key 以 `keyTyped`（大小写不敏感）开头的全局搜索组。
 * 例如已配置 `julia` / `juliana`，输入 `j` 都返回。
 */
export function findGlobalSearchGroupsByPrefix(
  keyTyped: string,
  groups: readonly GlobalSearchGroup[],
): GlobalSearchGroup[] {
  const k = keyTyped.toLowerCase();
  return groups.filter((g) => g.key.toLowerCase().startsWith(k));
}

/**
 * 匹配范围：
 *  - `"table"` — 仅匹配表名 / qualifiedName / 表注释，fieldHits 始终为 []
 *  - `"field"` — 仅匹配字段名 / 字段注释，tableHits 始终为 []
 */
export type MatchScope = "table" | "field";

/**
 * 用 `group.keywords` 在整个 catalog 上匹配。复用 `getCatalogIndex` 缓存。
 *
 * @param scope "table" → 只做表级匹配（表名/注释）；"field" → 只做字段级匹配（字段名/注释）
 * `maxFieldsPerTable` 用于限制单表字段数，防止巨大表把 UI 撑爆。
 */
export function matchGlobalSearchGroup(
  group: GlobalSearchGroup,
  catalog: readonly TableCatalogEntry[],
  maxFieldsPerTable: number,
  scope: MatchScope = "field",
): GlobalSearchGroupHits {
  const idx = getCatalogIndex(catalog as TableCatalogEntry[]);
  const keywords = group.keywords
    .map((k) => k.trim())
    .filter((k) => k.length > 0)
    .map((k) => k.toUpperCase());
  const empty: GlobalSearchGroupHits = { group, tableHits: [], fieldHits: [] };
  if (keywords.length === 0) return empty;

  const tableHits: GlobalSearchGroupTableHit[] = [];
  const fieldHits: GlobalSearchGroupFieldHit[] = [];

  // 遍历目录中的每个表（catalog 顺序）
  for (const entry of catalog) {
    if (scope === "table") {
      const tNameU = entry.table.toUpperCase();
      const tQnU = (entry.qualifiedName ?? "").toUpperCase();
      const tCommentU = String(entry.comment ?? "").toUpperCase();
      const tableMatched = new Set<string>();
      for (const kw of keywords) {
        if (tNameU.includes(kw) || tQnU.includes(kw) || tCommentU.includes(kw)) {
          tableMatched.add(kw);
        }
      }
      if (tableMatched.size > 0) {
        tableHits.push({ entry, matchedKeywords: [...tableMatched] });
      }
    } else {
      // scope === "field"
      const info = entry.fieldInfo ?? {};
      const matchedFields: string[] = [];
      const fieldMatched = new Set<string>();
      for (const f of entry.fields) {
        const fU = String(f).toUpperCase();
        const cU = String(info[fU]?.comment ?? "").toUpperCase();
        let hit = false;
        for (const kw of keywords) {
          if (fU.includes(kw) || cU.includes(kw)) {
            fieldMatched.add(kw);
            hit = true;
          }
        }
        if (hit) {
          matchedFields.push(f);
          if (matchedFields.length >= maxFieldsPerTable) break;
        }
      }
      if (matchedFields.length > 0) {
        fieldHits.push({ entry, fields: matchedFields, matchedKeywords: [...fieldMatched] });
      }
    }
  }

  // 强引用 idx 防止 lint 警告并保留缓存意图
  void idx;
  return { group, tableHits, fieldHits };
}

/**
 * 把 needle 按 `|` 拆为多个关键词（OR 语义）。
 * 空段、空白会被丢弃；都为空时返回 []。
 */
export function splitOrKeywords(needle: string): string[] {
  if (!needle) return [];
  return needle
    .split("|")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

