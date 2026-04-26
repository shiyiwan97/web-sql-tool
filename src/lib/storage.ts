import type { AppConfig } from "../types";
import { createDefaultConfig, normalizeConfig } from "./configDefaults";

const KEY = "sql-web-tool-config-v1";

export function loadConfig(): AppConfig {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return createDefaultConfig();
    return normalizeConfig(JSON.parse(raw));
  } catch {
    return createDefaultConfig();
  }
}

export function saveConfig(config: AppConfig): void {
  localStorage.setItem(KEY, JSON.stringify(config));
}
