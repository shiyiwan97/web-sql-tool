import { expect, test } from "@playwright/test";
import { createDefaultBundle } from "../src/lib/configBundle";
import type { ConfigBundle } from "../src/lib/configBundle";

function seedBundle(): ConfigBundle {
  const bundle = createDefaultBundle();
  bundle.privateConfig.tableCatalog = [
    {
      table: "CLASS",
      fields: ["GCLSID", "NAME"],
      fieldInfo: { GCLSID: { comment: "班级标识" } },
    },
    {
      table: "STUDENT",
      fields: ["SID", "GCLSID"],
    },
  ];
  bundle.privateConfig.relations = [
    {
      id: "rel-e2e",
      fromTable: "CLASS",
      toTable: "STUDENT",
      fieldPairs: [{ fromField: "", toField: "" }],
      cardinality: "one-to-many",
      onClause: "",
      joinKind: "LEFT",
    },
  ];
  return bundle;
}

test.describe("表关系 · SearchableSelect", () => {
  test("字段1 下拉可选中 GCLSID", async ({ page, context }) => {
    const bundle = seedBundle();
    await context.addInitScript((raw: string) => {
      localStorage.setItem("sql-web-tool-config-bundle-v1", raw);
    }, JSON.stringify(bundle));

    await page.goto("/");

    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("menuitem", { name: "表关系…" }).click();

    const dialog = page.getByRole("dialog", { name: "表关系" });
    await expect(dialog).toBeVisible();

    const fromFieldBtn = dialog.locator("label", { hasText: "字段1" }).locator("..").getByRole("button").first();
    await fromFieldBtn.click();

    const listbox = page.getByRole("listbox");
    await expect(listbox).toBeVisible();
    await listbox.getByRole("button", { name: /GCLSID/ }).click();

    await expect(fromFieldBtn.getByText("GCLSID", { exact: true })).toBeVisible();
    await expect(page.locator('[role="listbox"]')).toHaveCount(0);
  });
});
