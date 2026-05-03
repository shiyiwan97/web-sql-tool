import { describe, expect, it } from "vitest";
import { applyHardWrapLinesOnly, applySqlFormatting } from "./sqlEditorOps";
import type { SqlFormatting } from "../types";

function fmt(partial: Partial<SqlFormatting> = {}): SqlFormatting {
  return {
    maxCharsPerLine: 72,
    showColumnGuide: false,
    editorLineBreak: "soft",
    compressLevel: 0,
    searchInsertKeywordsUppercase: true,
    ...partial,
  };
}

describe("applySqlFormatting", () => {
  const messy = "SELECT  a,  b\nFROM  t1";

  it("compress level 0 applies line wrap / AS400 guard without merging spaces", () => {
    const out = applySqlFormatting(messy, fmt({ compressLevel: 0 }));
    expect(out).toContain("SELECT");
    expect(out).toMatch(/FROM\s+t1/);
  });

  it("compress level 1 normalizes spaces and trims line starts", () => {
    const out = applySqlFormatting(messy, fmt({ compressLevel: 1 }));
    expect(out).toContain("SELECT a, b");
    expect(out).not.toMatch(/^\s+/m);
  });

  it("compress level 2 greedily packs tokens up to maxCharsPerLine", () => {
    const long =
      "SELECT one, two, three, four, five, six, seven, eight, nine, ten FROM t";
    const out = applySqlFormatting(long, fmt({ compressLevel: 2, maxCharsPerLine: 40 }));
    const lines = out.split("\n").filter(Boolean);
    expect(lines.length).toBeGreaterThanOrEqual(1);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(40);
    }
  });

  it("editorLineBreak does not change formatting output", () => {
    const a = applySqlFormatting(messy, fmt({ editorLineBreak: "soft" }));
    const b = applySqlFormatting(messy, fmt({ editorLineBreak: "hard" }));
    expect(a).toBe(b);
  });

  it("applyHardWrapLinesOnly breaks long lines when hard wrap", () => {
    const cfg = fmt({ editorLineBreak: "hard", maxCharsPerLine: 36, compressLevel: 0 });
    const longLine = "SELECT foo, bar, baz FROM t1 LEFT JOIN t2 ON a = b AND c = d";
    const out = applyHardWrapLinesOnly(longLine, cfg);
    expect(out.includes("\n")).toBe(true);
    for (const line of out.split("\n")) {
      expect(line.length).toBeLessThanOrEqual(36);
    }
  });

  it("applyHardWrapLinesOnly no-op when soft wrap", () => {
    const cfg = fmt({ editorLineBreak: "soft", maxCharsPerLine: 10 });
    const s = "hello world wide";
    expect(applyHardWrapLinesOnly(s, cfg)).toBe(s);
  });
});
