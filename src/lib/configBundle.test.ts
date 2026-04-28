import { describe, expect, it } from "vitest";
import { createDefaultBundle, resolveConfig } from "./configBundle";

describe("config bundle", () => {
  it("merges private over public by default", () => {
    const b = createDefaultBundle();
    b.publicConfig.theme = "light";
    b.privateConfig.theme = "dark";
    const cfg = resolveConfig(b);
    expect(cfg.theme).toBe("dark");
  });

  it("can source hotkeys from public or private", () => {
    const b = createDefaultBundle();
    b.publicConfig.hotkeys.copyCurrentBlock = "Ctrl+Shift+C";
    b.privateConfig.hotkeys.copyCurrentBlock = "Alt+K";

    b.moduleSources.hotkeys = "public";
    expect(resolveConfig(b).hotkeys.copyCurrentBlock).toBe("Ctrl+Shift+C");

    b.moduleSources.hotkeys = "private";
    expect(resolveConfig(b).hotkeys.copyCurrentBlock).toBe("Alt+K");

    b.moduleSources.hotkeys = "merge";
    expect(resolveConfig(b).hotkeys.copyCurrentBlock).toBe("Alt+K");
  });
});

