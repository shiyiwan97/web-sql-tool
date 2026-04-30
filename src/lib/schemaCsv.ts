import type { TableSchema } from "./schemaCatalog";
import type { SchemaCsvQualityReport } from "../types";

export type SchemaCsvRow = {
  table: string;
  tableComment: string;
  column: string;
  comment: string;
  type: string;
  length: number | null;
  precision: number | null;
  isKey: boolean;
};

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let i = 0;
  let inQ = false;
  while (i < line.length) {
    const ch = line[i]!;
    if (inQ) {
      if (ch === "\"") {
        const next = line[i + 1];
        if (next === "\"") {
          cur += "\"";
          i += 2;
          continue;
        }
        inQ = false;
        i++;
        continue;
      }
      cur += ch;
      i++;
      continue;
    }
    if (ch === "\"") {
      inQ = true;
      i++;
      continue;
    }
    if (ch === ",") {
      out.push(cur);
      cur = "";
      i++;
      continue;
    }
    cur += ch;
    i++;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function toBool(v: string): boolean {
  const s = v.trim().toLowerCase();
  return s === "1" || s === "y" || s === "yes" || s === "true" || s === "t" || s === "key";
}

function toNum(v: string): number | null {
  const s = v.trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * CSV columns:
 * 表名, 表注释, 列名, 列注释, 类型, 长度, 精度, 是否是key
 *
 * - First row may be a header (auto-detected)
 * - Extra columns are ignored
 * - Backwards compatible: 旧格式（无表注释列）也能解析；如果第 2 列像列名（短、全大写、无中文），自动按旧格式 7 列处理。
 */
export function parseSchemaCsv(text: string): TableSchema[] {
  return analyzeSchemaCsv(text).schemas;
}

/** 启发式：判断是否旧 7 列格式（无表注释列） */
function looksLikeLegacyLayout(rows: string[][]): boolean {
  // 取最多前 5 个数据行（已剔除表头）观察第 2 列
  // 旧格式第 2 列 = 列名（典型为标识符：字母/数字/下划线，无中文，长度较短）
  // 新格式第 2 列 = 表注释（可空、可含中文/标点、长度通常较长）
  let likelyIdent = 0;
  let total = 0;
  for (const cols of rows) {
    if (cols.length < 2) continue;
    const v = String(cols[1] ?? "").trim();
    if (!v) continue;
    total++;
    if (/^[A-Za-z_][A-Za-z0-9_#@$]*$/.test(v) && v.length <= 18) likelyIdent++;
  }
  if (total === 0) return false;
  return likelyIdent / total >= 0.8;
}

export function analyzeSchemaCsv(text: string): {
  schemas: TableSchema[];
  report: SchemaCsvQualityReport;
} {
  // 保留原始行号（包括空行后跳过的行号映射）
  const rawLines = text.replace(/\r\n/g, "\n").split("\n");
  const indexedLines: Array<{ no: number; line: string }> = [];
  for (let i = 0; i < rawLines.length; i++) {
    const l = rawLines[i] ?? "";
    if (l.trim().length === 0) continue;
    indexedLines.push({ no: i + 1, line: l });
  }
  if (indexedLines.length === 0) {
    return {
      schemas: [],
      report: {
        lines: 0,
        rows: 0,
        tables: 0,
        fields: 0,
        primaryKeyMarks: 0,
        duplicates: 0,
        issues: [],
      },
    };
  }

  // 解析表头（如有）
  const first = parseCsvLine(indexedLines[0]!.line);
  const hasHeader =
    /表名|table/i.test(first[0] ?? "") &&
    (
      /表注释|table.?(remark|comment)/i.test(first[1] ?? "") ||
      /列名|column/i.test(first[1] ?? "")
    );
  const dataStart = hasHeader ? 1 : 0;

  // 嗅探旧/新布局
  const sampleRows = indexedLines
    .slice(dataStart, dataStart + 10)
    .map((x) => parseCsvLine(x.line));
  // 头部明确 "列名" → 强制旧布局
  const headerSaysLegacy = hasHeader && /列名|column/i.test(first[1] ?? "");
  const legacy = headerSaysLegacy || (!hasHeader && looksLikeLegacyLayout(sampleRows));

  // 列号映射
  const COL = legacy
    ? { table: 0, tableComment: -1, column: 1, comment: 2, type: 3, length: 4, precision: 5, isKey: 6 }
    : { table: 0, tableComment: 1, column: 2, comment: 3, type: 4, length: 5, precision: 6, isKey: 7 };

  const rows: SchemaCsvRow[] = [];
  const issues: SchemaCsvQualityReport["issues"] = [];
  let primaryKeyMarks = 0;
  let duplicates = 0;
  const seenCol = new Map<string, Set<string>>();

  const tableComment = new Map<string, string>();

  for (let i = dataStart; i < indexedLines.length; i++) {
    const lineNo = indexedLines[i]!.no;
    const cols = parseCsvLine(indexedLines[i]!.line);
    if (cols.length < 2) continue;

    const rawTable = String(cols[COL.table] ?? "");
    const rawColumn = String(cols[COL.column] ?? "");
    const table = rawTable.trim().toUpperCase();
    const column = rawColumn.trim().toUpperCase();
    if (!table) {
      issues.push({
        line: lineNo,
        kind: "missing-table",
        message: `第 ${lineNo} 行第 ${COL.table + 1} 列：表名为空`,
      });
      continue;
    }
    if (!column) {
      issues.push({
        line: lineNo,
        kind: "missing-column",
        message: `第 ${lineNo} 行第 ${COL.column + 1} 列：列名为空（表 ${table}）`,
      });
      continue;
    }
    const tComment = COL.tableComment >= 0 ? String(cols[COL.tableComment] ?? "").trim() : "";
    if (tComment && !tableComment.has(table)) tableComment.set(table, tComment);

    const lenRaw = String(cols[COL.length] ?? "");
    const precRaw = String(cols[COL.precision] ?? "");
    const length = toNum(lenRaw);
    const precision = toNum(precRaw);
    if (lenRaw.trim() && length == null) {
      issues.push({
        line: lineNo,
        kind: "bad-length",
        message: `第 ${lineNo} 行第 ${COL.length + 1} 列：长度不是数字 「${lenRaw}」（${table}.${column}）`,
      });
    }
    if (precRaw.trim() && precision == null) {
      issues.push({
        line: lineNo,
        kind: "bad-precision",
        message: `第 ${lineNo} 行第 ${COL.precision + 1} 列：精度不是数字 「${precRaw}」（${table}.${column}）`,
      });
    }
    if (length != null && length < 0) {
      issues.push({
        line: lineNo,
        kind: "bad-length",
        message: `第 ${lineNo} 行第 ${COL.length + 1} 列：长度应为非负数（当前 ${length}，${table}.${column}）`,
      });
    }
    if (precision != null && precision < 0) {
      issues.push({
        line: lineNo,
        kind: "bad-precision",
        message: `第 ${lineNo} 行第 ${COL.precision + 1} 列：精度应为非负数（当前 ${precision}，${table}.${column}）`,
      });
    }
    const set = seenCol.get(table) ?? new Set<string>();
    if (set.has(column)) {
      duplicates++;
      issues.push({
        line: lineNo,
        kind: "duplicate-column",
        message: `第 ${lineNo} 行第 ${COL.column + 1} 列：重复列 ${table}.${column}`,
      });
    }
    set.add(column);
    if (!seenCol.has(table)) seenCol.set(table, set);
    const isKey = toBool(String(cols[COL.isKey] ?? ""));
    if (isKey) primaryKeyMarks++;
    rows.push({
      table,
      tableComment: tComment,
      column,
      comment: String(cols[COL.comment] ?? "").trim(),
      type: String(cols[COL.type] ?? "").trim(),
      length,
      precision,
      isKey,
    });
  }

  const byTable = new Map<string, TableSchema>();
  for (const r of rows) {
    let t = byTable.get(r.table);
    if (!t) {
      t = {
        table: r.table,
        qualifiedName: undefined,
        comment: tableComment.get(r.table),
        fields: [],
        primaryKeys: [],
        fieldInfo: {},
        sources: { fieldToCopybookPath: {}, ddsFile: undefined, copybookFile: undefined },
      };
      byTable.set(r.table, t);
    }
    if (!t.fields.includes(r.column)) t.fields.push(r.column);
    if (r.isKey && !t.primaryKeys.includes(r.column)) t.primaryKeys.push(r.column);
    t.fieldInfo = t.fieldInfo ?? {};
    t.fieldInfo[r.column] = {
      comment: r.comment || undefined,
      type: r.type || undefined,
      length: r.length,
      precision: r.precision,
      isKey: r.isKey,
    };
  }

  const schemas = [...byTable.values()].sort((a, b) => a.table.localeCompare(b.table));
  const fields = schemas.reduce((acc, s) => acc + s.fields.length, 0);
  return {
    schemas,
    report: {
      lines: indexedLines.length,
      rows: rows.length,
      tables: schemas.length,
      fields,
      primaryKeyMarks,
      duplicates,
      issues,
    },
  };
}

