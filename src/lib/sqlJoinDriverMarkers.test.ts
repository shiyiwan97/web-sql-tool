import { describe, expect, it } from "vitest";
import {
  collectUniqueJoinDriverMessages,
  computeJoinDriverMarkerOffsets,
} from "./sqlJoinDriverMarkers";
import type {
  SqlDiagnosticsSettings,
  TableCatalogEntry,
  TableRelation,
} from "../types";

const tinyCat = (): TableCatalogEntry[] => [
  { table: "BIG", fields: [], estimatedRowCount: 5_000_000 },
  { table: "SMALL", fields: [], estimatedRowCount: 100 },
];

const diag = (
  minRows: number,
  overrides?: Partial<SqlDiagnosticsSettings>,
): SqlDiagnosticsSettings => ({
  enableJoinLargeDrivingSmallWarning: true,
  enableJoinOnConfigMismatchWarning: true,
  joinLargeDrivingSmallMinRows: minRows,
  showRepositionInvalidCursorHint: true,
  ...overrides,
});

const bigSmallRel = (): TableRelation => ({
  id: "r1",
  fromTable: "BIG",
  toTable: "SMALL",
  fieldPairs: [{ fromField: "ID", toField: "ID" }],
  cardinality: "one-to-many",
  onClause: "",
});

describe("computeJoinDriverMarkerOffsets", () => {
  it("FROM 大表 JOIN 小表：两端产生标记，文案为单行模板", () => {
    const sql = "select * from BIG b join SMALL s on b.ID = s.ID";
    const marks = computeJoinDriverMarkerOffsets(sql, tinyCat(), diag(1_000));
    expect(marks.length).toBeGreaterThanOrEqual(2);
    const msgs = collectUniqueJoinDriverMessages(sql, tinyCat(), diag(1_000));
    expect(msgs).toEqual([
      "line:1(块1): 表连接BIG表(5000000条)连接SMALL表(100条)可能出现性能问题",
    ]);
  });

  it("FROM 小表 JOIN 大表：不告警", () => {
    const sql = "select * from SMALL s join BIG b on s.ID = b.ID";
    expect(computeJoinDriverMarkerOffsets(sql, tinyCat(), diag(1)).length).toBe(0);
  });

  it("未达到大行数阈值则不告警", () => {
    const sql = "select * from BIG b join SMALL s on b.ID = s.ID";
    expect(computeJoinDriverMarkerOffsets(sql, tinyCat(), diag(9_000_000)).length).toBe(0);
  });

  it("未登记行数则不告警", () => {
    const sql = "select * from BIG b join SMALL s on b.ID = s.ID";
    const cat: TableCatalogEntry[] = [
      { table: "BIG", fields: [] },
      { table: "SMALL", fields: [], estimatedRowCount: 1 },
    ];
    expect(computeJoinDriverMarkerOffsets(sql, cat, diag(1)).length).toBe(0);
  });

  it("配置的 ON 与 SQL 不一致时提示（提高阈值以免性能提示干扰）", () => {
    const sql = "select * from BIG b join SMALL s on b.X = s.Y";
    const msgs = collectUniqueJoinDriverMessages(
      sql,
      tinyCat(),
      diag(9_000_000),
      [bigSmallRel()],
    );
    expect(msgs).toContain(
      "line:1(块1): 表连接BIG表连接SMALL表，连接条件和配置不同，配置为:BIG.ID=SMALL.ID",
    );
  });

  it("ON 与配置一致则不提示连接条件差异", () => {
    const sql = "select * from BIG b join SMALL s on b.ID = s.ID";
    const msgs = collectUniqueJoinDriverMessages(sql, tinyCat(), diag(9_000_000), [
      bigSmallRel(),
    ]);
    expect(msgs.some((m) => m.includes("连接条件和配置不同"))).toBe(false);
  });

  it("第二个分号块使用块起始行号与块序号", () => {
    const sql =
      "select * from SMALL s join BIG b on s.ID = b.ID;\nselect * from BIG join SMALL on BIG.ID = SMALL.ID";
    const msgs = collectUniqueJoinDriverMessages(sql, tinyCat(), diag(1_000));
    expect(msgs.some((m) => m.startsWith("line:2(块2):"))).toBe(true);
  });

  it("关闭 JOIN 顺序警告时不产生性能类标记", () => {
    const sql = "select * from BIG b join SMALL s on b.ID = s.ID";
    const marks = computeJoinDriverMarkerOffsets(
      sql,
      tinyCat(),
      diag(1, { enableJoinLargeDrivingSmallWarning: false }),
    );
    expect(marks.some((m) => m.message.includes("性能问题"))).toBe(false);
  });

  it("关闭 ON 不一致警告时不产生该类标记", () => {
    const sql = "select * from BIG b join SMALL s on b.X = s.Y";
    const marks = computeJoinDriverMarkerOffsets(
      sql,
      tinyCat(),
      diag(9_000_000, { enableJoinOnConfigMismatchWarning: false }),
      [bigSmallRel()],
    );
    expect(marks.some((m) => m.message.includes("连接条件和配置不同"))).toBe(false);
  });
});
