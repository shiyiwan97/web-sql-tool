import { parseDds } from "./dds/ddsParser";
import { parseCopybook } from "./copybook/copybookParser";

export type TableSchema = {
  table: string;
  qualifiedName?: string;
  /** 表级注释 / remark */
  comment?: string;
  fields: string[];
  primaryKeys: string[];
  /** Optional per-field metadata (from CSV, etc.) */
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
  sources: {
    ddsFile?: string;
    copybookFile?: string;
    /** field -> "REC.FIELD" style path in copybook */
    fieldToCopybookPath: Record<string, string>;
  };
};

export type SchemaBuildInput = {
  ddsFiles: Array<{ filename: string; text: string }>;
  copybookFiles: Array<{ filename: string; text: string }>;
};

/**
 * Minimal, standalone catalog builder (browser & tests friendly).
 *
 * Pairing strategy (v1):
 * - DDS + Copybook are paired by basename (table name)
 * - Fields are matched by name; if not found, left unmapped
 *
 * This intentionally keeps parsing & IO separate so the feature can be split/plugged later.
 */
export function buildSchemaCatalog(input: SchemaBuildInput): TableSchema[] {
  const ddsByTable = new Map(
    input.ddsFiles.map((f) => {
      const d = parseDds(f.text, f.filename);
      return [d.table, { file: f.filename, d }] as const;
    }),
  );
  const cpyByName = new Map(
    input.copybookFiles.map((f) => {
      const c = parseCopybook(f.text, f.filename);
      return [c.name, { file: f.filename, c }] as const;
    }),
  );

  const out: TableSchema[] = [];
  for (const [table, { file: ddsFile, d }] of ddsByTable.entries()) {
    const cpy = cpyByName.get(table);
    const fieldNames = d.fields.map((x) => x.name);
    const fieldToCopybookPath: Record<string, string> = {};
    if (cpy) {
      const flatByVar = new Map(cpy.c.flat.map((x) => [x.var, x.path] as const));
      for (const f of fieldNames) {
        const p = flatByVar.get(f);
        if (p) fieldToCopybookPath[f] = p;
      }
    }
    out.push({
      table,
      qualifiedName: undefined,
      fields: fieldNames,
      primaryKeys: d.primaryKeys,
      sources: {
        ddsFile,
        copybookFile: cpy?.file,
        fieldToCopybookPath,
      },
    });
  }
  return out.sort((a, b) => a.table.localeCompare(b.table));
}

