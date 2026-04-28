import type { AppConfig, HotkeyConfig } from "../types";
import { createDefaultConfig, normalizeConfig } from "./configDefaults";

export type ModuleSource = "public" | "private" | "merge";

export type ConfigBundle = {
  version: 1;
  publicConfig: AppConfig;
  privateConfig: AppConfig;
  moduleSources: {
    hotkeys: ModuleSource;
  };
};

export function createDefaultBundle(): ConfigBundle {
  const base = createDefaultConfig();
  return {
    version: 1,
    publicConfig: { ...base, hotkeys: { ...base.hotkeys } },
    privateConfig: { ...base, hotkeys: { ...base.hotkeys } },
    moduleSources: { hotkeys: "merge" },
  };
}

function mergeHotkeys(pub: HotkeyConfig, priv: HotkeyConfig): HotkeyConfig {
  return { ...pub, ...priv };
}

/**
 * Resolve effective config from a bundle.
 * - Generally: merge public -> private (private overrides)
 * - Hotkeys: controlled by moduleSources.hotkeys
 */
export function resolveConfig(bundle: ConfigBundle): AppConfig {
  const pub = normalizeConfig(bundle.publicConfig);
  const priv = normalizeConfig(bundle.privateConfig);
  const merged: AppConfig = { ...pub, ...priv };
  const hs = bundle.moduleSources.hotkeys;
  merged.hotkeys =
    hs === "public"
      ? pub.hotkeys
      : hs === "private"
        ? priv.hotkeys
        : mergeHotkeys(pub.hotkeys, priv.hotkeys);
  return merged;
}

export function normalizeBundle(raw: unknown): ConfigBundle {
  const base = createDefaultBundle();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const pub = normalizeConfig((o.publicConfig as any) ?? base.publicConfig);
  const priv = normalizeConfig((o.privateConfig as any) ?? base.privateConfig);
  const ms = (o.moduleSources as any) ?? {};
  const hotkeys =
    ms.hotkeys === "public" || ms.hotkeys === "private" || ms.hotkeys === "merge"
      ? (ms.hotkeys as ModuleSource)
      : base.moduleSources.hotkeys;
  return {
    version: 1,
    publicConfig: pub,
    privateConfig: priv,
    moduleSources: { hotkeys },
  };
}

