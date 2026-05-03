/** 表 / SELECT 列在分号块内的顺序调整（偏移量为全文下标） */

import { blockIndexAtOffset, getSqlBlocks } from "./sqlBlocks";

export type RepositionKind = "table" | "field";

export interface RepositionSegment {
  start: number;
  end: number;
}

function skipWs(s: string, i: number): number {
  while (i < s.length && /\s/.test(s[i]!)) i++;
  return i;
}

const SQL_ALIAS_RESERVED = /^(WHERE|JOIN|ON|GROUP|ORDER|HAVING|LIMIT|OFFSET|FETCH|UNION|EXCEPT|INTERSECT|QUALIFY)$/i;

/** 从 i 起读取「限定名 + 别名」，返回整段子串结束位置（不含后续空白） */
function readTableAliasEnd(s: string, i: number): number | null {
  const slice = s.slice(i);
  const m = /^([\w.]+)\s+(?:AS\s+)?([A-Za-z_]\w*)/i.exec(slice);
  if (!m) return null;
  if (SQL_ALIAS_RESERVED.test(String(m[2] ?? ""))) return null;
  return i + m[0].length;
}

/** ON 子句结束：深度 0 下下一个 JOIN / WHERE / GROUP / ORDER / HAVING / LIMIT / QUALIFY */
function findOnClauseEnd(s: string, from: number): number {
  let depth = 0;
  let pos = from;
  while (pos < s.length) {
    const ch = s[pos]!;
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    else if (depth === 0) {
      const rest = s.slice(pos);
      let cut = rest.length;
      const tryPat = (re: RegExp) => {
        const mm = re.exec(rest);
        if (mm && mm.index < cut) cut = mm.index;
      };
      tryPat(/^\s*(?:WHERE|GROUP|ORDER|HAVING|LIMIT|QUALIFY)\b/i);
      tryPat(/^\s*(?:(?:LEFT|RIGHT|INNER|FULL|CROSS)\s+)?JOIN\b/i);
      if (cut < rest.length) return pos + cut;
    }
    pos++;
  }
  return s.length;
}

/**
 * 解析当前块中的 JOIN/FROM 顺序片段（每个片段可整体与前一项交换）。
 * 片段覆盖 FROM 区连续区间，中间不留空隙。
 */
export function parseTableSegments(blockText: string, blockBase: number): RepositionSegment[] {
  const text = blockText;
  const out: RepositionSegment[] = [];
  const fromRe = /\bFROM\b/gi;
  const fm = fromRe.exec(text);
  if (!fm) return [];

  let cursor = fm.index + fm[0].length;
  cursor = skipWs(text, cursor);

  const firstEnd = readTableAliasEnd(text, cursor);
  if (firstEnd == null) return [];

  out.push({ start: blockBase + fm.index, end: blockBase + firstEnd });
  cursor = skipWs(text, firstEnd);

  while (cursor < text.length && text[cursor] === ",") {
    const segStart = cursor;
    cursor = skipWs(text, cursor + 1);
    const nextEnd = readTableAliasEnd(text, cursor);
    if (nextEnd == null) break;
    out.push({ start: blockBase + segStart, end: blockBase + nextEnd });
    cursor = skipWs(text, nextEnd);
  }

  while (cursor < text.length) {
    const rest = text.slice(cursor);
    const jm = /^(?:(?:LEFT|RIGHT|INNER|FULL|CROSS)\s+)?JOIN\b/i.exec(rest);
    if (!jm) break;
    const joinStart = cursor + jm.index;
    let pos = cursor + jm.index + jm[0].length;
    pos = skipWs(text, pos);
    const taEnd = readTableAliasEnd(text, pos);
    if (taEnd == null) break;
    const afterTa = skipWs(text, taEnd);
    const onSlice = text.slice(afterTa);
    const onm = /^ON\b/i.exec(onSlice);
    if (!onm) break;
    const onKeyEnd = afterTa + onm.index + onm[0].length;
    const clauseEnd = findOnClauseEnd(text, onKeyEnd);
    out.push({ start: blockBase + joinStart, end: blockBase + clauseEnd });
    cursor = skipWs(text, clauseEnd);
  }

  return out;
}

/** SELECT 与顶层 FROM 之间的列表子串 [start,end)（不含尾部空白） */
export function selectListSpan(blockText: string): { start: number; end: number } | null {
  const m = /^\s*SELECT\b/gi.exec(blockText);
  if (!m) return null;
  let pos = m.index + m[0].length;
  pos = skipWs(blockText, pos);
  const dist = /^DISTINCT\b/i.exec(blockText.slice(pos));
  if (dist) pos = skipWs(blockText, pos + dist[0].length);
  const listStart = pos;
  let depth = 0;
  while (pos < blockText.length) {
    const ch = blockText[pos]!;
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    else if (depth === 0) {
      const rest = blockText.slice(pos);
      const fm = /^\s*FROM\b/i.exec(rest);
      if (fm) {
        let end = pos + fm.index;
        while (end > listStart && /\s/.test(blockText[end - 1]!)) end--;
        if (end <= listStart) return null;
        return { start: listStart, end };
      }
    }
    pos++;
  }
  return null;
}

export interface FieldColumnPiece {
  raw: string;
  /** 在 list slice 内的起始下标 */
  relStart: number;
  relEnd: number;
}

export function splitSelectColumns(listSlice: string): FieldColumnPiece[] {
  const list = listSlice;
  const cols: FieldColumnPiece[] = [];
  let depth = 0;
  let segStart = 0;
  for (let i = 0; i <= list.length; i++) {
    const ch = list[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    const atBreak = i === list.length || (ch === "," && depth === 0);
    if (!atBreak) continue;
    const segment = list.slice(segStart, i);
    const raw = segment.trim();
    const lead = segment.length - segment.trimStart().length;
    const rs = segStart + lead;
    const re = rs + raw.length;
    if (raw.length > 0) cols.push({ raw, relStart: rs, relEnd: re });
    segStart = i + 1;
  }
  return cols;
}

export function parseFieldSegments(blockText: string, blockBase: number): RepositionSegment[] {
  const span = selectListSpan(blockText);
  if (!span) return [];
  const listSlice = blockText.slice(span.start, span.end);
  const cols = splitSelectColumns(listSlice);
  return cols.map((c) => ({
    start: blockBase + span.start + c.relStart,
    end: blockBase + span.start + c.relEnd,
  }));
}

/** offset 是否落在任一段内（半开区间） */
export function segmentIndexAtOffset(segments: RepositionSegment[], offset: number): number | null {
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i]!;
    if (offset >= s.start && offset < s.end) return i;
  }
  return null;
}

/**
 * FROM 首段与紧邻的第一个 JOIN 段交换：保持合法 SQL（FROM 必须在 JOIN 之前）。
 * 失败时返回 null，交由通用交换逻辑处理。
 */
function swapFirstFromWithFirstJoin(
  sql: string,
  segments: RepositionSegment[],
): string | null {
  if (segments.length < 2) return null;
  const aText = sql.slice(segments[0]!.start, segments[0]!.end);
  const bText = sql.slice(segments[1]!.start, segments[1]!.end);
  const fromM = /^(\s*)FROM\s+([\w.]+)\s+(?:AS\s+)?([A-Za-z_]\w*)\s*$/is.exec(aText);
  const joinM =
    /^(\s*)(?:(LEFT|RIGHT|INNER|FULL|CROSS)\s+)?JOIN\s+([\w.]+)\s+(?:AS\s+)?([A-Za-z_]\w*)(\s+ON\b[\s\S]*)$/is.exec(
      bText,
    );
  if (!fromM || !joinM) return null;

  const indent = fromM[1] ?? "";
  const gap = sql.slice(segments[0]!.end, segments[1]!.start);
  const joinPrefix = joinM[2] ? `${joinM[2]} JOIN ` : "JOIN ";
  const newA = `${indent}FROM ${joinM[3]} ${joinM[4]}`;
  const newB = `${joinM[1] ?? ""}${joinPrefix}${fromM[2]} ${fromM[3]}${joinM[5] ?? ""}`;
  return sql.slice(0, segments[0]!.start) + newA + gap + newB + sql.slice(segments[1]!.end);
}

export function swapSegmentGroupWithPrevious(
  sql: string,
  segments: RepositionSegment[],
  lo: number,
  hi: number,
): string | null {
  const prev = lo - 1;
  if (prev < 0 || hi >= segments.length || lo > hi) return null;

  if (prev === 0 && lo === 1 && hi === 1) {
    const fixed = swapFirstFromWithFirstJoin(sql, segments);
    if (fixed != null) return fixed;
  }

  const a = segments[prev]!;
  const bLo = segments[lo]!;
  const bHi = segments[hi]!;
  const region1 = sql.slice(a.start, a.end);
  const between = sql.slice(a.end, bLo.start);
  const region2 = sql.slice(bLo.start, bHi.end);
  return sql.slice(0, a.start) + region2 + between + region1 + sql.slice(bHi.end);
}

/** 将 [lo..hi] 与 hi+1 交换（与 swapSegmentGroupWithPrevious 对称） */
export function swapSegmentGroupWithNext(
  sql: string,
  segments: RepositionSegment[],
  lo: number,
  hi: number,
): string | null {
  const next = hi + 1;
  if (next >= segments.length || lo > hi) return null;

  if (lo === 0 && hi === 0 && next === 1) {
    const fixed = swapFirstFromWithFirstJoin(sql, segments);
    if (fixed != null) return fixed;
  }

  const aLo = segments[lo]!;
  const aHi = segments[hi]!;
  const b = segments[next]!;
  const region1 = sql.slice(aLo.start, aHi.end);
  const between = sql.slice(aHi.end, b.start);
  const region2 = sql.slice(b.start, b.end);
  return sql.slice(0, aLo.start) + region2 + between + region1 + sql.slice(b.end);
}

/** 与 App 内调整位置会话一致的数据结构 */
export interface RepositionEditorSession {
  kind: RepositionKind;
  blockIndex: number;
  segments: RepositionSegment[];
  primary: number;
  selected: number[];
}

/**
 * 光标位于当前分号块内某段 FROM/JOIN 表片段或 SELECT 列片段时返回会话，否则 null。
 */
export function tryRepositionEditorSessionAtOffset(
  fullSql: string,
  offset: number,
): RepositionEditorSession | null {
  if (!fullSql.length) return null;
  const blocks = getSqlBlocks(fullSql);
  if (blocks.length === 0) return null;
  const bi = blockIndexAtOffset(fullSql, offset);
  const b = blocks[bi];
  if (!b) return null;
  const blockText = fullSql.slice(b.start, b.end);
  const tableSegs = parseTableSegments(blockText, b.start);
  const fieldSegs = parseFieldSegments(blockText, b.start);
  const ti = segmentIndexAtOffset(tableSegs, offset);
  const fi = segmentIndexAtOffset(fieldSegs, offset);
  if (ti != null && tableSegs.length >= 1) {
    return {
      kind: "table",
      blockIndex: bi,
      segments: tableSegs,
      primary: ti,
      selected: [ti],
    };
  }
  if (fi != null && fieldSegs.length >= 1) {
    return {
      kind: "field",
      blockIndex: bi,
      segments: fieldSegs,
      primary: fi,
      selected: [fi],
    };
  }
  return null;
}
