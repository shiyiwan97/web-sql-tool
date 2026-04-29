import type { TableSchema } from "./schemaCatalog";
import { loadFileHandle } from "./fsHandleStore";
import { analyzeSchemaCsv, parseSchemaCsv } from "./schemaCsv";
import type { SchemaCsvQualityReport } from "../types";

export async function buildSchemaCatalogFromCsvHandle(args: {
  schemaCsvFileHandleKey: string;
}): Promise<TableSchema[]> {
  const h = await loadFileHandle(args.schemaCsvFileHandleKey);
  if (!h) throw new Error("Schema CSV 未选择或权限已失效");

  const perm = await (h as any).queryPermission?.({ mode: "read" });
  if (perm === "prompt") await (h as any).requestPermission?.({ mode: "read" });

  const file = await h.getFile();
  const text = await file.text();
  return parseSchemaCsv(text);
}

export async function analyzeSchemaCatalogFromCsvHandle(args: {
  schemaCsvFileHandleKey: string;
}): Promise<{ schemas: TableSchema[]; report: SchemaCsvQualityReport }> {
  const h = await loadFileHandle(args.schemaCsvFileHandleKey);
  if (!h) throw new Error("Schema CSV 未选择或权限已失效");

  const perm = await (h as any).queryPermission?.({ mode: "read" });
  if (perm === "prompt") await (h as any).requestPermission?.({ mode: "read" });

  const file = await h.getFile();
  const text = await file.text();
  return analyzeSchemaCsv(text);
}

