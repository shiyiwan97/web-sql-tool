import { describe, expect, it } from "vitest";
import { analyzeSchemaCsv, parseSchemaCsv } from "./schemaCsv";

describe("parseSchemaCsv", () => {
  it("parses rows and extracts PKs", () => {
    const csv = `表名,列名,注释,类型,长度,精度,是否是key
STUDENT,STUID,学生ID,CHAR,10,,Y
STUDENT,GCLSID,班级ID,CHAR,8,,N
`;
    const out = parseSchemaCsv(csv);
    const s = out.find((x) => x.table === "STUDENT");
    expect(s).toBeTruthy();
    expect(s!.fields).toEqual(["STUID", "GCLSID"]);
    expect(s!.primaryKeys).toEqual(["STUID"]);
  });

  it("handles quoted commas", () => {
    const csv = `table,column,comment,type,length,precision,isKey
T1,C1,"a,b",CHAR,1,,1
`;
    const out = parseSchemaCsv(csv);
    expect(out[0]!.fields).toEqual(["C1"]);
    expect(out[0]!.primaryKeys).toEqual(["C1"]);
  });

  it("reports duplicates and bad numbers", () => {
    const csv = `table,column,comment,type,length,precision,isKey
T1,C1,,CHAR,abc,,1
T1,C1,,CHAR,10,-1,0
,C2,,CHAR,1,,0
T2,,x,CHAR,1,,0
`;
    const { report } = analyzeSchemaCsv(csv);
    expect(report.issues.some((x) => x.kind === "duplicate-column")).toBe(true);
    expect(report.issues.some((x) => x.kind === "bad-length")).toBe(true);
    expect(report.issues.some((x) => x.kind === "bad-precision")).toBe(true);
    expect(report.issues.some((x) => x.kind === "missing-table")).toBe(true);
    expect(report.issues.some((x) => x.kind === "missing-column")).toBe(true);
  });
});

