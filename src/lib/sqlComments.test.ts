import { describe, expect, it } from "vitest";
import { stripSqlComments } from "./sqlComments";

describe("stripSqlComments", () => {
  it("removes line comments", () => {
    expect(stripSqlComments("SELECT 1\n-- hi\nFROM t")).toBe("SELECT 1\nFROM t");
  });

  it("removes block comments", () => {
    expect(stripSqlComments("SELECT /* x */ 1")).toBe("SELECT  1");
  });

  it("keeps -- inside single-quoted string", () => {
    expect(stripSqlComments("SELECT '--not' FROM t")).toBe("SELECT '--not' FROM t");
  });
});
