import { describe, expect, it } from "vitest";
import { normalizeConfig } from "./configDefaults";

describe("normalizeConfig", () => {
  it("保留仅填写一侧的 fieldPairs（表关系 UI 草稿）", () => {
    const cfg = normalizeConfig({
      relations: [
        {
          id: "r1",
          fromTable: "CLASS",
          toTable: "STUDENT",
          fieldPairs: [{ fromField: "GCLSID", toField: "" }],
          cardinality: "one-to-many",
          onClause: "",
          joinKind: "LEFT",
        },
      ],
    });
    expect(cfg.relations[0]?.fieldPairs).toEqual([{ fromField: "GCLSID", toField: "" }]);
  });

  it("保留全空的字段对（多字段 UI 占位行）", () => {
    const cfg = normalizeConfig({
      relations: [
        {
          id: "r1",
          fromTable: "CLASS",
          toTable: "STUDENT",
          fieldPairs: [
            { fromField: "GCLSID", toField: "GCLSID" },
            { fromField: "", toField: "" },
          ],
          cardinality: "one-to-many",
          onClause: "",
          joinKind: "LEFT",
        },
      ],
    });
    expect(cfg.relations[0]?.fieldPairs).toEqual([
      { fromField: "GCLSID", toField: "GCLSID" },
      { fromField: "", toField: "" },
    ]);
  });
});
