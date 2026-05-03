import { describe, expect, it } from "vitest";
import {
  parseFieldSegments,
  parseTableSegments,
  selectListSpan,
  swapSegmentGroupWithNext,
  swapSegmentGroupWithPrevious,
  tryRepositionEditorSessionAtOffset,
} from "./sqlReposition";

describe("sqlReposition", () => {
  it("parses FROM + JOIN segments with ON", () => {
    const block = `SELECT 1
FROM LIB.STUDENT s
LEFT JOIN LIB.EXAMSCORE e ON s.STUID = e.STUID`;
    const segs = parseTableSegments(block, 0);
    expect(segs.length).toBe(2);
    expect(block.slice(segs[0]!.start, segs[0]!.end)).toMatch(/^FROM\s+LIB\.STUDENT\s+s$/i);
    expect(block.slice(segs[1]!.start, segs[1]!.end)).toMatch(/JOIN\s+LIB\.EXAMSCORE\s+e\s+ON/i);
  });

  it("parses comma-separated FROM tables", () => {
    const block = "SELECT * FROM A a, B b WHERE 1=1";
    const segs = parseTableSegments(block, 0);
    expect(segs.length).toBe(2);
    expect(block.slice(segs[0]!.start, segs[0]!.end)).toMatch(/^FROM\s+A\s+a$/i);
    expect(block.slice(segs[1]!.start, segs[1]!.end)).toMatch(/^,\s*B\s+b$/);
  });

  it("swaps first JOIN with FROM clause", () => {
    const block = `SELECT *
FROM LIB.STUDENT s
LEFT JOIN LIB.EXAMSCORE e ON s.X = e.Y`;
    const segs = parseTableSegments(block, 0);
    const next = swapSegmentGroupWithPrevious(block, segs, 1, 1);
    expect(next).not.toBeNull();
    expect(next!).toMatch(/FROM\s+LIB\.EXAMSCORE\s+e/i);
    expect(next!).toMatch(/JOIN\s+LIB\.STUDENT\s+s/i);
  });

  it("parses SELECT column segments", () => {
    const block = "SELECT s.A, e.B , c FROM T t";
    const span = selectListSpan(block);
    expect(span).not.toBeNull();
    const fields = parseFieldSegments(block, 0);
    expect(fields.length).toBe(3);
    expect(block.slice(fields[0]!.start, fields[0]!.end)).toBe("s.A");
    expect(block.slice(fields[1]!.start, fields[1]!.end)).toBe("e.B");
    expect(block.slice(fields[2]!.start, fields[2]!.end)).toBe("c");
  });

  it("swapSegmentGroupWithNext moves block right", () => {
    const sql = "SELECT a, b, c FROM t";
    const fields = parseFieldSegments(sql, 0);
    expect(fields.length).toBe(3);
    const next = swapSegmentGroupWithNext(sql, fields, 0, 0);
    expect(next).toBe("SELECT b, a, c FROM t");
  });

  it("tryRepositionEditorSessionAtOffset detects table vs field cursor", () => {
    const sql = `SELECT a, b FROM T t;\nSELECT x FROM U u`;
    const fromIdx = sql.indexOf("FROM");
    const sessTable = tryRepositionEditorSessionAtOffset(sql, fromIdx + 1);
    expect(sessTable?.kind).toBe("table");

    const selIdx = sql.indexOf("a,");
    const sessField = tryRepositionEditorSessionAtOffset(sql, selIdx);
    expect(sessField?.kind).toBe("field");

    const whereOnly = "SELECT 1 FROM T WHERE 1=1";
    const w = whereOnly.indexOf("WHERE");
    expect(tryRepositionEditorSessionAtOffset(whereOnly, w)).toBeNull();
  });
});
