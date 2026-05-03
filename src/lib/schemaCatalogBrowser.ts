import type { TableSchema } from "./schemaCatalog";
import { loadFileHandle } from "./fsHandleStore";
import { analyzeSchemaCsv, parseSchemaCsv, type AnalyzeSchemaCsvOptions } from "./schemaCsv";
import type { SchemaCsvQualityReport } from "../types";

export async function buildSchemaCatalogFromCsvHandle(args: {
  schemaCsvFileHandleKey: string;
  analyzeOptions?: AnalyzeSchemaCsvOptions;
}): Promise<TableSchema[]> {
  const h = await loadFileHandle(args.schemaCsvFileHandleKey);
  if (!h) throw new Error("Schema CSV 未选择或权限已失效");

  const perm = await (h as any).queryPermission?.({ mode: "read" });
  if (perm === "prompt") await (h as any).requestPermission?.({ mode: "read" });

  const file = await h.getFile();
  const text = await file.text();
  return parseSchemaCsv(text, args.analyzeOptions);
}

export async function analyzeSchemaCatalogFromCsvHandle(args: {
  schemaCsvFileHandleKey: string;
  analyzeOptions?: AnalyzeSchemaCsvOptions;
}): Promise<{ schemas: TableSchema[]; report: SchemaCsvQualityReport }> {
  const h = await loadFileHandle(args.schemaCsvFileHandleKey);
  if (!h) throw new Error("Schema CSV 未选择或权限已失效");

  const perm = await (h as any).queryPermission?.({ mode: "read" });
  if (perm === "prompt") await (h as any).requestPermission?.({ mode: "read" });

  const file = await h.getFile();
  const text = await file.text();
  return analyzeSchemaCsv(text, args.analyzeOptions);
}

