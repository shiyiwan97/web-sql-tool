import type { TableSchema } from "./schemaCatalog";
import type { SchemaCsvQualityReport } from "../types";

export type SchemaCsvRow = {
  table: string;
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
 * 表名, 列名, 注释, 类型, 长度, 精度, 是否是key
 *
 * First row may be a header. Extra columns are ignored.
 */
export function parseSchemaCsv(text: string): TableSchema[] {
  return analyzeSchemaCsv(text).schemas;
}

export function analyzeSchemaCsv(text: string): {
  schemas: TableSchema[];
  report: SchemaCsvQualityReport;
} {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
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
  const rows: SchemaCsvRow[] = [];
  const issues: SchemaCsvQualityReport["issues"] = [];
  let primaryKeyMarks = 0;
  let duplicates = 0;
  const seenCol = new Map<string, Set<string>>(); // table -> columns

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const cols = parseCsvLine(lines[i]!);
    if (cols.length < 2) continue;
    // header detection
    if (
      i === 0 &&
      /表名|table/i.test(cols[0] ?? "") &&
      /列名|column/i.test(cols[1] ?? "")
    ) {
      continue;
    }
    const rawTable = String(cols[0] ?? "");
    const rawColumn = String(cols[1] ?? "");
    const table = rawTable.trim().toUpperCase();
    const column = rawColumn.trim().toUpperCase();
    if (!table) {
      issues.push({ line: lineNo, kind: "missing-table", message: "缺少表名（第1列）" });
      continue;
    }
    if (!column) {
      issues.push({ line: lineNo, kind: "missing-column", message: "缺少列名（第2列）" });
      continue;
    }
    const lenRaw = String(cols[4] ?? "");
    const precRaw = String(cols[5] ?? "");
    const length = toNum(lenRaw);
    const precision = toNum(precRaw);
    if (lenRaw.trim() && length == null) {
      issues.push({ line: lineNo, kind: "bad-length", message: `长度无效：${JSON.stringify(lenRaw)}` });
    }
    if (precRaw.trim() && precision == null) {
      issues.push({
        line: lineNo,
        kind: "bad-precision",
        message: `精度无效：${JSON.stringify(precRaw)}`,
      });
    }
    if (length != null && length < 0) {
      issues.push({ line: lineNo, kind: "bad-length", message: `长度应为非负数：${length}` });
    }
    if (precision != null && precision < 0) {
      issues.push({ line: lineNo, kind: "bad-precision", message: `精度应为非负数：${precision}` });
    }
    const set = seenCol.get(table) ?? new Set<string>();
    if (set.has(column)) {
      duplicates++;
      issues.push({
        line: lineNo,
        kind: "duplicate-column",
        message: `重复列：${table}.${column}`,
      });
    }
    set.add(column);
    if (!seenCol.has(table)) seenCol.set(table, set);
    const isKey = toBool(String(cols[6] ?? ""));
    if (isKey) primaryKeyMarks++;
    rows.push({
      table,
      column,
      comment: String(cols[2] ?? "").trim(),
      type: String(cols[3] ?? "").trim(),
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
      lines: lines.length,
      rows: rows.length,
      tables: schemas.length,
      fields,
      primaryKeyMarks,
      duplicates,
      issues,
    },
  };
}

