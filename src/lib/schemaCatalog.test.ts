import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildSchemaCatalog } from "./schemaCatalog";

function read(p: string): string {
  return readFileSync(p, "utf-8");
}

describe("buildSchemaCatalog", () => {
  it("pairs DDS + copybook by basename and extracts fields + PK", () => {
    const root = join(process.cwd(), "test");
    const ddsFiles = [
      { filename: "STUDENT.dds", text: read(join(root, "dds", "STUDENT.dds")) },
      { filename: "GRADECLS.dds", text: read(join(root, "dds", "GRADECLS.dds")) },
    ];
    const copybookFiles = [
      { filename: "STUDENT.cbl", text: read(join(root, "cpy", "STUDENT.cbl")) },
      { filename: "GRADECLS.cbl", text: read(join(root, "cpy", "GRADECLS.cbl")) },
    ];
    const out = buildSchemaCatalog({ ddsFiles, copybookFiles });
    const student = out.find((x) => x.table === "STUDENT");
    expect(student).toBeTruthy();
    expect(student!.fields).toContain("STUID");
    expect(student!.primaryKeys).toEqual(["STUID"]);
    expect(student!.sources.ddsFile).toBe("STUDENT.dds");
    expect(student!.sources.copybookFile).toBe("STUDENT.cbl");
    expect(student!.sources.fieldToCopybookPath["STUID"]).toMatch(/STUID/);
  });
});

