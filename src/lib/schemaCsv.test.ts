import { describe, expect, it } from "vitest";
import { analyzeSchemaCsv, parseSchemaCsv } from "./schemaCsv";

describe("parseSchemaCsv", () => {
  it("parses new 8-column layout (with table comment)", () => {
    const csv = `表名,表注释,列名,列注释,类型,长度,精度,是否是key
STUDENT,学生信息表,STUID,学生ID,CHAR,10,,Y
STUDENT,,GCLSID,班级ID,CHAR,8,,N
`;
    const out = parseSchemaCsv(csv);
    const s = out.find((x) => x.table === "STUDENT");
    expect(s).toBeTruthy();
    expect(s!.fields).toEqual(["STUID", "GCLSID"]);
    expect(s!.primaryKeys).toEqual(["STUID"]);
    expect(s!.comment).toBe("学生信息表");
    expect(s!.fieldInfo!.STUID!.comment).toBe("学生ID");
  });

  it("falls back to legacy 7-column layout (header explicitly says 列名)", () => {
    const csv = `表名,列名,注释,类型,长度,精度,是否是key
STUDENT,STUID,学生ID,CHAR,10,,Y
STUDENT,GCLSID,班级ID,CHAR,8,,N
`;
    const out = parseSchemaCsv(csv);
    const s = out.find((x) => x.table === "STUDENT");
    expect(s!.fields).toEqual(["STUID", "GCLSID"]);
    expect(s!.primaryKeys).toEqual(["STUID"]);
  });

  it("handles quoted commas in new layout", () => {
    const csv = `T1,"备注,含逗号",C1,"a,b",CHAR,1,,1
`;
    const out = parseSchemaCsv(csv);
    expect(out[0]!.fields).toEqual(["C1"]);
    expect(out[0]!.primaryKeys).toEqual(["C1"]);
    expect(out[0]!.comment).toBe("备注,含逗号");
  });

  it("reports duplicates and bad numbers with row+column info", () => {
    const csv = `表名,表注释,列名,列注释,类型,长度,精度,是否是key
T1,,C1,,CHAR,abc,,1
T1,,C1,,CHAR,10,-1,0
,,C2,,CHAR,1,,0
T2,,,,CHAR,1,,0
`;
    const { report } = analyzeSchemaCsv(csv);
    expect(report.issues.some((x) => x.kind === "duplicate-column")).toBe(true);
    expect(report.issues.some((x) => x.kind === "bad-length")).toBe(true);
    expect(report.issues.some((x) => x.kind === "bad-precision")).toBe(true);
    expect(report.issues.some((x) => x.kind === "missing-table")).toBe(true);
    expect(report.issues.some((x) => x.kind === "missing-column")).toBe(true);
    // 错误信息应该包含具体行号
    expect(report.issues.every((x) => /第 \d+ 行/.test(x.message))).toBe(true);
  });
});



