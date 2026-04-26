import type { AppConfig, TableRelation } from "../types";
import { getSqlBlocks } from "./sqlBlocks";

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 用于判断 JOIN / 逗号表是否已存在，避免重复插入 */
function compactSqlSig(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function tableKey(qualifiedOrShort: string): string {
  const t = qualifiedOrShort.trim();
  const base = t.includes(".") ? t.split(".").pop()! : t;
  return base.toUpperCase();
}

/** Level 1：去掉行首缩进；行内连续空白压成单空格；续行不再添加缩进 */
export function applyCompressLevel1(sql: string): string {
  return sql
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/^\s+/, "").replace(/[ \t]+/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * 按 maxLen 在空格处断行，续行顶格（无缩进）。
 * 仅当单段 token 超过 maxLen 时在 maxLen 处硬断。
 */
export function wrapSqlLinesNoIndent(sql: string, maxLen: number): string {
  if (maxLen < 8) return sql;
  const lines = sql.split("\n");
  const out: string[] = [];
  for (const segment of lines) {
    const line = segment.replace(/^\s+/, "");
    if (!line) {
      out.push("");
      continue;
    }
    if (line.length <= maxLen) {
      out.push(line);
      continue;
    }
    let rest = line;
    while (rest.length > maxLen) {
      let cut = rest.lastIndexOf(" ", maxLen);
      if (cut <= 0) cut = maxLen;
      const piece = rest.slice(0, cut).trimEnd();
      if (!piece) {
        out.push(rest.slice(0, maxLen));
        rest = rest.slice(maxLen).trimStart();
        continue;
      }
      out.push(piece);
      rest = rest.slice(cut).trimStart();
    }
    if (rest) out.push(rest);
  }
  return out.join("\n");
}

/**
 * Level 2：先压成空格分词，再贪心装行——尽可能用满一行再放下一 token。
 */
export function greedyWrapTokens(flat: string, maxLen: number): string {
  const normalized = flat.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  const words = normalized.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if (!w) continue;
    if (w.length > maxLen) {
      if (line) {
        lines.push(line);
        line = "";
      }
      let rest = w;
      while (rest.length > maxLen) {
        lines.push(rest.slice(0, maxLen));
        rest = rest.slice(maxLen);
      }
      line = rest;
      continue;
    }
    const joined = line ? `${line} ${w}` : w;
    if (joined.length <= maxLen) {
      line = joined;
    } else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines.join("\n");
}

/**
 * AS400 / Mocha：物理行恰好写满 maxLen 时，终端会把下一行头拼到上一行末尾。
 * 若下一行以新 token 开头且行首非空白，则在行首补一个空格以断开拼接。
 */
export function applyAs400FullLineJoinGuard(text: string, maxLen: number): string {
  if (maxLen < 1) return text;
  const lines = text.split("\n");
  const out = [...lines];
  for (let i = 1; i < out.length; i++) {
    const prev = out[i - 1];
    if (prev.length !== maxLen) continue;
    let cur = out[i];
    if (!cur.length) continue;
    if (/^\s/.test(cur)) continue;
    out[i] = ` ${cur}`;
  }
  return out.join("\n");
}

/**
 * 复制/导出用格式化。
 * - 行长 maxCharsPerLine 始终生效（level 2 为贪心装行，0/1 为空格折行，均无续行缩进）。
 * - compressLevel 1：轻微压缩；2：强力压缩（单行贪心装填）。
 * - 最后做 AS400 满行衔接保护。
 */
export function applySqlFormatting(sql: string, cfg: AppConfig["sqlFormatting"]): string {
  const maxLen = Math.max(8, Math.floor(cfg.maxCharsPerLine) || 72);
  let s = sql.replace(/\r\n/g, "\n");

  if (cfg.compressLevel >= 1) {
    s = applyCompressLevel1(s);
  }

  if (cfg.compressLevel >= 2) {
    const flat = s.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
    s = greedyWrapTokens(flat, maxLen);
  } else {
    s = wrapSqlLinesNoIndent(s, maxLen);
  }

  s = applyAs400FullLineJoinGuard(s, maxLen);
  return s;
}

/** Map logical table key -> alias in SQL */
export function extractAliasedTables(sql: string): Map<string, string> {
  const map = new Map<string, string>();
  const re =
    /\b(?:FROM|(?:(?:LEFT|RIGHT|INNER|FULL|CROSS)\s+)?JOIN)\s+([\w.]+)\s+(?:AS\s+)?([A-Za-z_]\w*)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    map.set(tableKey(m[1]), m[2].toUpperCase());
  }
  const fromM = sql.match(
    /\bFROM\b([\s\S]*?)(?=\bWHERE\b|\bGROUP\b|\bORDER\b|\bHAVING\b|$)/i,
  );
  if (fromM) {
    const chunk = fromM[1];
    const joinSplit = chunk.split(/\b(?:LEFT|RIGHT|INNER|FULL|CROSS)\s+JOIN\b/i);
    const head = joinSplit[0] ?? "";
    for (const part of head.split(",")) {
      const p = part.trim();
      if (!p) continue;
      const cm = /^([\w.]+)\s+(?:AS\s+)?([A-Za-z_]\w*)/i.exec(p);
      if (cm) map.set(tableKey(cm[1]), cm[2].toUpperCase());
    }
  }
  return map;
}

export function defaultAliasFor(table: string): string {
  const k = tableKey(table);
  if (k.length <= 4) return k.toLowerCase();
  return k.slice(0, 3).toLowerCase() + k.slice(-2).toLowerCase();
}

function applyAliasesToOn(on: string, aliasByTableKey: Map<string, string>): string {
  let s = on;
  const keys = [...aliasByTableKey.keys()].sort((a, b) => b.length - a.length);
  for (const tbl of keys) {
    const al = aliasByTableKey.get(tbl);
    if (!al) continue;
    s = s.replace(new RegExp(`\\b${tbl}\\.`, "gi"), `${al}.`);
  }
  return s;
}

function relationOtherTable(rel: TableRelation, key: string): string | null {
  const a = rel.fromTable.toUpperCase();
  const b = rel.toTable.toUpperCase();
  if (a === key) return b;
  if (b === key) return a;
  return null;
}

function findLinkToPresent(
  key: string,
  present: Set<string>,
  relations: TableRelation[],
): TableRelation | null {
  for (const rel of relations) {
    const o = relationOtherTable(rel, key);
    if (o && present.has(o)) return rel;
  }
  return null;
}

function appendCommaInFrom(
  sql: string,
  qualified: string,
  alias: string,
): { text: string; cursorOffset: number } {
  if (
    new RegExp(`\\b${escapeRe(qualified)}\\s+${escapeRe(alias)}\\b`, "i").test(
      sql,
    )
  ) {
    return { text: sql, cursorOffset: sql.length };
  }
  const whereRe = /\bWHERE\b/i;
  const w = whereRe.exec(sql);
  if (w) {
    const head = sql.slice(0, w.index);
    const tail = sql.slice(w.index);
    const fromRe = /\bFROM\b/i;
    const f = fromRe.exec(head);
    if (!f) return { text: sql, cursorOffset: sql.length };
    const before = head.slice(0, f.index + f[0].length);
    const mid = head.slice(f.index + f[0].length).trimEnd();
    const sep = mid.endsWith(",") ? " " : ", ";
    const headToAlias = `${before} ${mid}${sep}${qualified} ${alias}`;
    const text = `${headToAlias} ${tail}`;
    return { text, cursorOffset: headToAlias.length };
  }
  const fromRe = /\bFROM\b/i;
  const f = fromRe.exec(sql);
  if (!f) {
    const text = `${sql}\nFROM ${qualified} ${alias}`;
    return { text, cursorOffset: text.length };
  }
  const before = sql.slice(0, f.index + f[0].length);
  const mid = sql.slice(f.index + f[0].length).trimEnd();
  const sep = mid.endsWith(",") ? " " : ", ";
  const text = `${before} ${mid}${sep}${qualified} ${alias}`;
  return { text, cursorOffset: text.length };
}

export type InsertFieldResult = { text: string; cursorOffset: number };

/** 在指定分号块内插入字段（保留块外内容与分号布局） */
export function insertFieldIntoSelectAtBlock(
  sql: string,
  table: string,
  field: string,
  config: AppConfig,
  blockIndex: number,
): { sql: string; cursorOffset: number } {
  const blocks = getSqlBlocks(sql);
  if (blocks.length === 0) {
    const r = insertFieldIntoSelect(sql, table, field, config);
    return { sql: r.text, cursorOffset: r.cursorOffset };
  }
  const i = Math.max(0, Math.min(blockIndex, blocks.length - 1));
  const b = blocks[i];
  const inner = insertFieldIntoSelect(b.text, table, field, config);
  return {
    sql: sql.slice(0, b.start) + inner.text + sql.slice(b.end),
    cursorOffset: b.start + inner.cursorOffset,
  };
}

export type InsertTableResult = { text: string; cursorOffset: number | null };

/** 在指定分号块内插入表 / JOIN（保留块外内容） */
export function insertTableWithJoinsAtBlock(
  sql: string,
  tableQualified: string,
  config: AppConfig,
  blockIndex: number,
): { sql: string; cursorOffset: number | null } {
  const blocks = getSqlBlocks(sql);
  if (blocks.length === 0) {
    const r = insertTableWithJoins(sql, tableQualified, config);
    return { sql: r.text, cursorOffset: r.cursorOffset };
  }
  const i = Math.max(0, Math.min(blockIndex, blocks.length - 1));
  const b = blocks[i];
  const inner = insertTableWithJoins(b.text, tableQualified, config);
  const merged = sql.slice(0, b.start) + inner.text + sql.slice(b.end);
  if (inner.cursorOffset === null) {
    return { sql: merged, cursorOffset: null };
  }
  return { sql: merged, cursorOffset: b.start + inner.cursorOffset };
}

const SELECT_PREFIX_LEN = "SELECT ".length;

export function insertFieldIntoSelect(
  sql: string,
  table: string,
  field: string,
  config: AppConfig,
): InsertFieldResult {
  const key = tableKey(table);
  const cat = config.tableCatalog.find((c) => c.table === key);
  const aliases = extractAliasedTables(sql);
  const alias = aliases.get(key) ?? defaultAliasFor(key);
  const col = `${alias}.${field}`;

  const trimmed = sql.trim();
  if (!trimmed) {
    const from = cat?.qualifiedName ?? key;
    const text = `SELECT ${col}\nFROM ${from} ${alias}`;
    return { text, cursorOffset: SELECT_PREFIX_LEN + col.length };
  }

  const fromIdx = /\bFROM\b/i.exec(trimmed);
  if (!fromIdx) {
    const text = `${trimmed}\n, ${col}`;
    return { text, cursorOffset: text.length };
  }

  const before = trimmed.slice(0, fromIdx.index).trimEnd();
  const after = trimmed.slice(fromIdx.index);
  const listPart = before.replace(/^SELECT\s+/i, "").trim();
  if (!listPart || listPart === "*") {
    const text = `SELECT ${col}\n${after}`;
    return { text, cursorOffset: SELECT_PREFIX_LEN + col.length };
  }
  if (/,\s*$/.test(listPart)) {
    const text = `${before} ${col}\n${after}`;
    return { text, cursorOffset: before.length + 1 + col.length };
  }
  const text = `${before}, ${col}\n${after}`;
  return { text, cursorOffset: before.length + 2 + col.length };
}

export function insertTableWithJoins(
  sql: string,
  tableQualified: string,
  config: AppConfig,
): InsertTableResult {
  const key = tableKey(tableQualified);
  const cat = config.tableCatalog.find((c) => c.table === key);
  const qualified = cat?.qualifiedName ?? tableQualified;
  const newAlias = defaultAliasFor(key);

  const trimmed = sql.trim();
  if (!trimmed) {
    const text = `SELECT *\nFROM ${qualified} ${newAlias}`;
    return { text, cursorOffset: text.length };
  }

  const map0 = extractAliasedTables(trimmed);
  if (map0.has(key)) {
    return { text: sql, cursorOffset: null };
  }

  let text = trimmed;
  let map = map0;
  let caretOffset: number | null = null;

  const insertJoin = (joinSql: string, recordCaret: boolean): boolean => {
    const sig = compactSqlSig(joinSql);
    if (sig.length > 0 && compactSqlSig(text).includes(sig)) {
      return false;
    }
    const w = /\bWHERE\b/i.exec(text);
    const pos = w ? w.index : text.length;
    const end = pos + joinSql.length;
    text = text.slice(0, pos) + joinSql + text.slice(pos);
    if (recordCaret) {
      caretOffset = end;
    }
    map = extractAliasedTables(text);
    return true;
  };

  if (!map.has(key)) {
    const present = new Set(map.keys());
    const rel = findLinkToPresent(key, present, config.relations);
    if (rel) {
      const aliasByKey = new Map(map);
      aliasByKey.set(key, newAlias);
      const onClause = applyAliasesToOn(rel.onClause, aliasByKey);
      const jk = rel.joinKind ?? "LEFT";
      insertJoin(`\n${jk} JOIN ${qualified} ${newAlias}\n  ON ${onClause}`, true);
    } else {
      const ac = appendCommaInFrom(text, qualified, newAlias);
      text = ac.text;
      caretOffset = ac.cursorOffset;
      map = extractAliasedTables(text);
    }
  }

  let guard = 0;
  let expanded = true;
  while (expanded && guard++ < 24) {
    expanded = false;
    const present2 = new Set(map.keys());
    for (const rel of config.relations) {
      const a = rel.fromTable.toUpperCase();
      const b = rel.toTable.toUpperCase();
      const hasA = present2.has(a);
      const hasB = present2.has(b);
      if (hasA === hasB) continue;
      const need = hasA ? b : a;
      if (present2.has(need)) continue;
      const needCat = config.tableCatalog.find((c) => c.table === need);
      const needQual = needCat?.qualifiedName ?? need;
      const needAlias = defaultAliasFor(need);
      const aliasByKey = new Map(map);
      aliasByKey.set(need, needAlias);
      const onClause = applyAliasesToOn(rel.onClause, aliasByKey);
      const jk = rel.joinKind ?? "LEFT";
      if (
        insertJoin(`\n${jk} JOIN ${needQual} ${needAlias}\n  ON ${onClause}`, false)
      ) {
        expanded = true;
        break;
      }
    }
  }

  return { text, cursorOffset: caretOffset };
}
