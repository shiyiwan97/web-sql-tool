import { describe, expect, it } from "vitest";
import { createDefaultConfig } from "./configDefaults";
import { extractAliasedTables, insertTableWithJoins } from "./sqlEditorOps";
import type { AppConfig } from "../types";

function cfgScoreExamAttend(): AppConfig {
  const c = createDefaultConfig();
  c.tableCatalog = [
    { table: "SCORE", fields: ["STUID", "SUBJECT", "EXAMDATE"] },
    { table: "EXAM_ATTEND", fields: ["STUID", "SUBJECT", "EXAMDATE", "SEATNO"] },
  ];
  c.relations = [
    {
      id: "r1",
      fromTable: "SCORE",
      toTable: "EXAM_ATTEND",
      fieldPairs: [
        { fromField: "STUID", toField: "STUID" },
        { fromField: "SUBJECT", toField: "SUBJECT" },
        { fromField: "EXAMDATE", toField: "EXAMDATE" },
      ],
      cardinality: "one-to-many",
      onClause:
        "SCORE.STUID = EXAM_ATTEND.STUID AND SCORE.SUBJECT = EXAM_ATTEND.SUBJECT AND SCORE.EXAMDATE = EXAM_ATTEND.EXAMDATE",
      joinKind: "LEFT",
    },
  ];
  return c;
}

describe("extractAliasedTables", () => {
  it("识别 FROM 表名后无别名（小写）", () => {
    const m = extractAliasedTables("select * from score");
    expect(m.has("SCORE")).toBe(true);
    expect(m.get("SCORE")).toBe("score");
  });

  it("逗号 FROM 段中单表无别名", () => {
    const m = extractAliasedTables("select * from score, student st");
    expect(m.get("SCORE")).toBe("score");
    expect(m.get("STUDENT")).toBe("ST");
  });
});

describe("insertTableWithJoins", () => {
  it("FROM score 无别名时点击 EXAM_ATTEND 走 JOIN，不出现逗号追加后再 JOIN SCORE", () => {
    const config = cfgScoreExamAttend();
    const r = insertTableWithJoins("select * from score", "EXAM_ATTEND", config);
    expect(r.text.toUpperCase()).toContain("JOIN");
    expect(r.text.toUpperCase()).toContain("EXAM_ATTEND");
    expect(r.text.toUpperCase()).not.toMatch(/FROM\s+[\s\S]*SCORE\s*,\s*EXAM_ATTEND/i);
    const joinsScore = r.text.match(/\bJOIN\s+SCORE\b/gi);
    expect(joinsScore?.length ?? 0).toBe(0);
  });

  it("FROM exam_attend 无别名时点击 SCORE 同样 JOIN", () => {
    const config = cfgScoreExamAttend();
    const r = insertTableWithJoins("select * from exam_attend", "SCORE", config);
    expect(r.text.toUpperCase()).toContain("JOIN");
    expect(r.text.toUpperCase()).toContain("SCORE");
    const joinsExam = r.text.match(/\bJOIN\s+EXAM_ATTEND\b/gi);
    expect(joinsExam?.length ?? 0).toBe(0);
  });

  it("searchInsertKeywordsUppercase=false 时使用小写关键字", () => {
    const config = cfgScoreExamAttend();
    config.sqlFormatting.searchInsertKeywordsUppercase = false;
    const r = insertTableWithJoins("select * from score", "EXAM_ATTEND", config);
    expect(r.text).toContain("left join");
    expect(r.text).toContain(" on ");
  });
});
