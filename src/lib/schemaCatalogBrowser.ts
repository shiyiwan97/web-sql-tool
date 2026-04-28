import { buildSchemaCatalog, type TableSchema } from "./schemaCatalog";
import { loadDirectoryHandle } from "./fsHandleStore";

async function readTextFile(handle: FileSystemFileHandle): Promise<string> {
  const file = await handle.getFile();
  return await file.text();
}

async function collectFilesBySuffix(
  dir: FileSystemDirectoryHandle,
  suffix: string,
): Promise<Array<{ filename: string; text: string }>> {
  const out: Array<{ filename: string; text: string }> = [];
  for await (const [name, entry] of (dir as any).entries() as AsyncIterable<
    [string, FileSystemHandle]
  >) {
    if (entry.kind === "file") {
      if (!name.toLowerCase().endsWith(suffix.toLowerCase())) continue;
      const text = await readTextFile(entry as FileSystemFileHandle);
      out.push({ filename: name, text });
    }
  }
  return out;
}

export async function buildSchemaCatalogFromHandles(args: {
  ddsDirHandleKey: string;
  copybookDirHandleKey: string;
  ddsSuffix: string;
  copybookSuffix: string;
}): Promise<TableSchema[]> {
  const ddsDir = await loadDirectoryHandle(args.ddsDirHandleKey);
  const cpyDir = await loadDirectoryHandle(args.copybookDirHandleKey);
  if (!ddsDir) throw new Error("DDS 目录未选择或权限已失效");
  if (!cpyDir) throw new Error("Copybook 目录未选择或权限已失效");

  // Ensure permission (best-effort)
  const ddsPerm = await (ddsDir as any).queryPermission?.({ mode: "read" });
  if (ddsPerm === "prompt") await (ddsDir as any).requestPermission?.({ mode: "read" });
  const cpyPerm = await (cpyDir as any).queryPermission?.({ mode: "read" });
  if (cpyPerm === "prompt") await (cpyDir as any).requestPermission?.({ mode: "read" });

  const ddsFiles = await collectFilesBySuffix(ddsDir, args.ddsSuffix);
  const copybookFiles = await collectFilesBySuffix(cpyDir, args.copybookSuffix);
  return buildSchemaCatalog({ ddsFiles, copybookFiles });
}

