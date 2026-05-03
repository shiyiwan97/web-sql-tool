import type {
  SqlDiagnosticsSettings,
  TableCatalogEntry,
  TableRelation,
} from "../types";
import { getSqlBlocks } from "./sqlBlocks";
import { extractAliasedTables, tableKey } from "./sqlEditorOps";

export type JoinDriverMarkerOffset = {
  start: number;
  end: number;
  message: string;
};

function estRows(catalog: TableCatalogEntry[], key: string): number | undefined {
  const t = catalog.find((c) => c.table.toUpperCase() === key.toUpperCase());
  const n = t?.estimatedRowCount;
  if (n == null || typeof n !== "number" || !Number.isFinite(n) || n < 0) return undefined;
  return Math.floor(n);
}

function lineNumberAtOffset(full: string, offset: number): number {
  let line = 1;
  const upto = Math.min(Math.max(0, offset), full.length);
  for (let i = 0; i < upto; i++) {
    if (full.charCodeAt(i) === 10) line++;
  }
  return line;
}

/** 与 RelationsModal 一致的 ON 预览（无 ON 关键字） */
function rebuildExpectedOn(rel: TableRelation): string {
  const aT = rel.fromTable?.trim().toUpperCase();
  const bT = rel.toTable?.trim().toUpperCase();
  if (!aT || !bT) return String(rel.onClause ?? "").trim();
  const pairs = Array.isArray(rel.fieldPairs) ? rel.fieldPairs : [];
  const cooked = pairs
    .map((p) => ({
      a: String(p?.fromField ?? "").trim().toUpperCase(),
      b: String(p?.toField ?? "").trim().toUpperCase(),
    }))
    .filter((p) => p.a && p.b);
  if (cooked.length === 0) return String(rel.onClause ?? "").trim();
  return cooked.map((p) => `${aT}.${p.a} = ${bT}.${p.b}`).join(" AND ");
}

function escapeReTable(tbl: string): string {
  return tbl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function applyAliasesToOn(on: string, aliasByTableKey: Map<string, string>): string {
  let s = on;
  const keys = [...aliasByTableKey.keys()].sort((a, b) => b.length - a.length);
  for (const tbl of keys) {
    const al = aliasByTableKey.get(tbl);
    if (!al) continue;
    s = s.replace(new RegExp(`\\b${escapeReTable(tbl)}\\.`, "gi"), `${al}.`);
  }
  return s;
}

function normalizeOnCompare(on: string): string {
  const u = on.replace(/\s+/g, " ").trim().toUpperCase();
  const parts = u.split(/\s+AND\s+/).map((p) => p.replace(/\s*=\s*/, "=").trim()).filter(Boolean);
  parts.sort();
  return parts.join(" AND ");
}

function compactConfigOnForMessage(rel: TableRelation): string {
  const raw = rebuildExpectedOn(rel);
  return raw
    .split(/\s+AND\s+/i)
    .map((p) => p.replace(/\s+/g, ""))
    .filter(Boolean)
    .join(",");
}

function findRelationForPair(
  relations: TableRelation[],
  leftKey: string,
  rightKey: string,
): TableRelation | null {
  for (const r of relations) {
    const a = r.fromTable.trim().toUpperCase();
    const b = r.toTable.trim().toUpperCase();
    if (!a || !b) continue;
    if ((a === leftKey && b === rightKey) || (a === rightKey && b === leftKey)) return r;
  }
  return null;
}

/** JOIN 目标表名之后若存在别名（可选 AS），跳过至 ON 之前 */
function offsetAfterJoinTableAlias(sql: string, afterTableEnd: number): number {
  const tail = sql.slice(afterTableEnd);
  const alias = /^\s+(?:AS\s+)?([A-Za-z_]\w*)(?=\s+\bON\b)/i.exec(tail);
  if (alias) return afterTableEnd + alias[0].length;
  return afterTableEnd;
}

function extractOnAfterJoin(sql: string, joinMatchEnd: number): string | null {
  const rest = sql.slice(joinMatchEnd);
  const onLead = /^\s*\bON\b\s+/i.exec(rest);
  if (!onLead) return null;
  const start = joinMatchEnd + onLead[0].length;
  const tail = sql.slice(start);
  const stop =
    /\s+(?:(?:LEFT|RIGHT|INNER|FULL|CROSS)\s+)?JOIN\b|\bWHERE\b|\bGROUP\b|\bORDER\b|\bHAVING\b|\bUNION\b(?=\s|$)/i.exec(
      tail,
    );
  const end = stop ? start + stop.index : sql.length;
  const body = sql.slice(start, end).trim();
  return body.length > 0 ? body : null;
}

type LastRef = { key: string; start: number; end: number };

function scanJoinsInBlock(
  blockText: string,
  baseOffset: number,
  blockStartLine: number,
  blockIndex1Based: number,
  catalog: TableCatalogEntry[],
  settings: SqlDiagnosticsSettings,
  relations: TableRelation[],
): JoinDriverMarkerOffset[] {
  const out: JoinDriverMarkerOffset[] = [];
  const threshold = Math.max(0, Math.floor(settings.joinLargeDrivingSmallMinRows) || 0);
  const aliasMap = extractAliasedTables(blockText);

  const re =
    /\b(FROM)\s+([\w.]+)|\b(?:(?:LEFT|RIGHT|INNER|FULL|CROSS)\s+)?JOIN\s+([\w.]+)/gi;

  let last: LastRef | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(blockText)) !== null) {
    const joinEnd = m.index + m[0].length;
    if (m[2]) {
      const tbl = m[2];
      const relStart = m.index + m[0].indexOf(tbl);
      last = { key: tableKey(tbl), start: relStart, end: relStart + tbl.length };
      continue;
    }
    const tbl = m[3];
    if (!tbl) continue;
    const rightStart = m.index + m[0].indexOf(tbl);
    const rightEnd = rightStart + tbl.length;
    const rightKey = tableKey(tbl);
    if (!last) {
      last = { key: rightKey, start: rightStart, end: rightEnd };
      continue;
    }

    const leftKey = last.key;

    const sqlOn = extractOnAfterJoin(blockText, offsetAfterJoinTableAlias(blockText, joinEnd));
    const rel = findRelationForPair(relations, leftKey, rightKey);
    if (
      settings.enableJoinOnConfigMismatchWarning &&
      rel &&
      sqlOn
    ) {
      const expectedRaw = rebuildExpectedOn(rel);
      if (expectedRaw.trim().length > 0) {
        const expectedAliased = applyAliasesToOn(expectedRaw, aliasMap);
        const sqlNorm = normalizeOnCompare(sqlOn);
        const cfgNorm = normalizeOnCompare(expectedAliased);
        if (sqlNorm !== cfgNorm) {
          const compactCfg = compactConfigOnForMessage(rel);
          const mismatchMsg = `line:${blockStartLine}(块${blockIndex1Based}): 表连接${leftKey}表连接${rightKey}表，连接条件和配置不同，配置为:${compactCfg}`;
          out.push({ start: baseOffset + last.start, end: baseOffset + last.end, message: mismatchMsg });
          out.push({
            start: baseOffset + rightStart,
            end: baseOffset + rightEnd,
            message: mismatchMsg,
          });
        }
      }
    }

    const leftRows = estRows(catalog, leftKey);
    const rightRows = estRows(catalog, rightKey);
    if (
      settings.enableJoinLargeDrivingSmallWarning &&
      leftRows != null &&
      rightRows != null &&
      leftRows > rightRows &&
      (threshold === 0 || leftRows >= threshold)
    ) {
      const perfMsg = `line:${blockStartLine}(块${blockIndex1Based}): 表连接${leftKey}表(${leftRows}条)连接${rightKey}表(${rightRows}条)可能出现性能问题`;
      out.push({ start: baseOffset + last.start, end: baseOffset + last.end, message: perfMsg });
      out.push({
        start: baseOffset + rightStart,
        end: baseOffset + rightEnd,
        message: perfMsg,
      });
    }

    last = { key: rightKey, start: rightStart, end: rightEnd };
  }

  return out;
}

/**
 * 书写顺序下「JOIN 前的表」估计行数大于「JOIN 后的表」，且达到阈值时，
 * 在两处表名位置给出警告；若配置了表关系且 ON 与配置不一致，另给出提示。
 * 文案中的 line 为该分号块起始行号，块序号为 1-based。
 */
export function computeJoinDriverMarkerOffsets(
  sql: string,
  catalog: TableCatalogEntry[],
  settings: SqlDiagnosticsSettings,
  relations: TableRelation[] = [],
): JoinDriverMarkerOffset[] {
  const blocks = getSqlBlocks(sql);
  if (blocks.length === 0) return [];
  const out: JoinDriverMarkerOffset[] = [];
  for (let bi = 0; bi < blocks.length; bi++) {
    const b = blocks[bi];
    const blockStartLine = lineNumberAtOffset(sql, b.start);
    out.push(
      ...scanJoinsInBlock(b.text, b.start, blockStartLine, bi + 1, catalog, settings, relations),
    );
  }
  return out;
}

export function collectUniqueJoinDriverMessages(
  sql: string,
  catalog: TableCatalogEntry[],
  settings: SqlDiagnosticsSettings,
  relations: TableRelation[] = [],
): string[] {
  const offs = computeJoinDriverMarkerOffsets(sql, catalog, settings, relations);
  return [...new Set(offs.map((o) => o.message))];
}
