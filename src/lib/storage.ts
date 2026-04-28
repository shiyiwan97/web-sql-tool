import type { AppConfig } from "../types";
import { normalizeConfig } from "./configDefaults";
import {
  createDefaultBundle,
  normalizeBundle,
  resolveConfig,
  type ConfigBundle,
} from "./configBundle";

const KEY_V1 = "sql-web-tool-config-v1";
const KEY_BUNDLE = "sql-web-tool-config-bundle-v1";

export function loadConfigBundle(): ConfigBundle {
  try {
    const raw = localStorage.getItem(KEY_BUNDLE);
    if (raw) return normalizeBundle(JSON.parse(raw));
  } catch {
    // ignore
  }
  // Migrate from v1 single-config storage if present
  try {
    const rawV1 = localStorage.getItem(KEY_V1);
    if (rawV1) {
      const cfg = normalizeConfig(JSON.parse(rawV1));
      const b = createDefaultBundle();
      b.privateConfig = cfg;
      return b;
    }
  } catch {
    // ignore
  }
  return createDefaultBundle();
}

export function saveConfigBundle(bundle: ConfigBundle): void {
  localStorage.setItem(KEY_BUNDLE, JSON.stringify(bundle));
}

/** Back-compat API: returns the effective config (public/private resolved). */
export function loadConfig(): AppConfig {
  return resolveConfig(loadConfigBundle());
}

/** Back-compat API: writes to private config of the bundle. */
export function saveConfig(config: AppConfig): void {
  const b = loadConfigBundle();
  b.privateConfig = normalizeConfig(config);
  saveConfigBundle(b);
}
