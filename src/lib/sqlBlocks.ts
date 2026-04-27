/** 分号分隔的 SQL 块（复制时不含分号）；不解析字符串内分号，为简化实现 */

export interface SqlBlockRange {
  /** 块文本，trim 后，不含分号 */
  text: string;
  /** 在全文中的起始偏移（trim 后第一个字符） */
  start: number;
  /** 在全文中的结束偏移（trim 后最后一个字符的下一个位置） */
  end: number;
}

export function getSqlBlocks(sql: string): SqlBlockRange[] {
  const out: SqlBlockRange[] = [];
  let pos = 0;
  const len = sql.length;
  while (pos <= len) {
    const semi = sql.indexOf(";", pos);
    const endRaw = semi === -1 ? len : semi;
    const slice = sql.slice(pos, endRaw);
    const lead = slice.length - slice.trimStart().length;
    const trail = slice.length - slice.trimEnd().length;
    const t = slice.trim();
    if (t.length > 0) {
      out.push({
        text: t,
        start: pos + lead,
        end: endRaw - trail,
      });
    }
    if (semi === -1) break;
    pos = semi + 1;
  }
  return out;
}

export function blockIndexAtOffset(sql: string, offset: number): number {
  const blocks = getSqlBlocks(sql);
  if (blocks.length === 0) return 0;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (offset >= b.start && offset <= b.end) return i;
  }
  if (offset < blocks[0].start) return 0;
  for (let i = 0; i < blocks.length - 1; i++) {
    if (offset > blocks[i].end && offset < blocks[i + 1].start) {
      return i + 1;
    }
  }
  return blocks.length - 1;
}

export function getBlockTextForCopy(sql: string, index: number): string {
  const blocks = getSqlBlocks(sql);
  if (blocks.length === 0) return sql.trim();
  const i = Math.max(0, Math.min(index, blocks.length - 1));
  return blocks[i].text;
}

/** 用新文本替换第 index 个分号块（保持块外与分号布局不变） */
export function replaceBlockText(
  sql: string,
  blockIndex: number,
  newInnerText: string,
): string {
  const blocks = getSqlBlocks(sql);
  const inner = newInnerText.trim();
  if (blocks.length === 0) {
    return inner;
  }
  const i = Math.max(0, Math.min(blockIndex, blocks.length - 1));
  const b = blocks[i];
  return sql.slice(0, b.start) + inner + sql.slice(b.end);
}

export function countSqlBlocks(sql: string): number {
  return getSqlBlocks(sql).length;
}
