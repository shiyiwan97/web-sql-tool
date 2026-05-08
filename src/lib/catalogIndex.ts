import type { TableCatalogEntry } from "../types";

export type CatalogIndex = {
  /** UPPER(table key) → entry */
  byKey: Map<string, TableCatalogEntry>;
  /** UPPER(qualifiedName) → entry（含 schema 前缀） */
  byQualified: Map<string, TableCatalogEntry>;
  /** UPPER(field name) → 含此字段的所有 entry（用于裸字段悬停 / 提示） */
  fieldToTables: Map<string, TableCatalogEntry[]>;
};

/**
 * 给定 tableCatalog 数组，返回查找索引；同一数组引用复用同一索引。
 * 用 WeakMap 让旧索引在 catalog 被替换后自然回收。
 */
const cache = new WeakMap<TableCatalogEntry[], CatalogIndex>();

export function getCatalogIndex(catalog: TableCatalogEntry[]): CatalogIndex {
  const cached = cache.get(catalog);
  if (cached) return cached;
  const byKey = new Map<string, TableCatalogEntry>();
  const byQualified = new Map<string, TableCatalogEntry>();
  const fieldToTables = new Map<string, TableCatalogEntry[]>();
  for (const t of catalog) {
    const k = String(t.table).toUpperCase();
    if (!byKey.has(k)) byKey.set(k, t);
    if (t.qualifiedName) {
      const q = t.qualifiedName.toUpperCase();
      if (!byQualified.has(q)) byQualified.set(q, t);
      const last = q.split(".").pop();
      if (last && !byKey.has(last)) byKey.set(last, t);
    }
    for (const f of t.fields) {
      const fu = String(f).toUpperCase();
      let arr = fieldToTables.get(fu);
      if (!arr) {
        arr = [];
        fieldToTables.set(fu, arr);
      }
      arr.push(t);
    }
  }
  const idx: CatalogIndex = { byKey, byQualified, fieldToTables };
  cache.set(catalog, idx);
  return idx;
}

