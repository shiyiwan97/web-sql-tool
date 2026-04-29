import { describe, expect, it } from "vitest";
import { buildSchemaCatalog } from "./schemaCatalog";

describe("buildSchemaCatalog", () => {
  it("pairs DDS + copybook by basename and extracts fields + PK", () => {
    const ddsFiles = [
      {
        filename: "STUDENT.dds",
        text: `A          R STUDENTF
A            STUID       10A
A            GCLSID       8A
A          K STUID
`,
      },
      {
        filename: "GRADECLS.dds",
        text: `A          R GRADECLSF
A            GCLSID       8A
A          K GCLSID
`,
      },
    ];
    const copybookFiles = [
      {
        filename: "STUDENT.cbl",
        text: `01  STUDENT-REC.
  05 STUID PIC X(10).
  05 GCLSID PIC X(08).
`,
      },
      {
        filename: "GRADECLS.cbl",
        text: `01  GRADECLS-REC.
  05 GCLSID PIC X(08).
`,
      },
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

