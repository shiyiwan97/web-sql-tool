import { createStore, get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";
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
/** IndexedDB 中存放完整 bundle 的 key（容量 ~GB 级，远超 localStorage） */
const IDB_BUNDLE_KEY = "config-bundle-v1";
/** 一次性迁移完成标记，避免重复读老数据 */
const IDB_MIGRATED_KEY = "migrated-from-localstorage-v1";

const idbStore = createStore("sql-web-tool", "kv");

/**
 * 同步加载占位（启动期使用）。
 * 真正的数据通过 {@link loadConfigBundleAsync} 异步读取 IDB；
 * 在异步 hydration 完成前不要触发写入回 IDB。
 */
export function loadConfigBundle(): ConfigBundle {
  return createDefaultBundle();
}

/**
 * 异步加载完整 bundle：
 * 1. 优先 IndexedDB；
 * 2. IDB 无数据时尝试从 localStorage 迁移（KEY_BUNDLE → KEY_V1）;
 * 3. 迁移成功后清理 localStorage 的大对象，避免占额。
 */
export async function loadConfigBundleAsync(): Promise<ConfigBundle> {
  // 1) IDB
  try {
    const raw = await idbGet<string | ConfigBundle>(IDB_BUNDLE_KEY, idbStore);
    if (raw) {
      const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
      return normalizeBundle(obj);
    }
  } catch {
    // ignore
  }

  // 2) 迁移 localStorage 旧数据
  try {
    const migrated = await idbGet<boolean>(IDB_MIGRATED_KEY, idbStore);
    if (!migrated) {
      const lsBundle = safeLocalGet(KEY_BUNDLE);
      if (lsBundle) {
        const b = normalizeBundle(JSON.parse(lsBundle));
        await idbSet(IDB_BUNDLE_KEY, b, idbStore);
        await idbSet(IDB_MIGRATED_KEY, true, idbStore);
        safeLocalRemove(KEY_BUNDLE);
        safeLocalRemove(KEY_V1);
        return b;
      }
      const lsV1 = safeLocalGet(KEY_V1);
      if (lsV1) {
        const cfg = normalizeConfig(JSON.parse(lsV1));
        const b = createDefaultBundle();
        b.privateConfig = cfg;
        await idbSet(IDB_BUNDLE_KEY, b, idbStore);
        await idbSet(IDB_MIGRATED_KEY, true, idbStore);
        safeLocalRemove(KEY_BUNDLE);
        safeLocalRemove(KEY_V1);
        return b;
      }
      await idbSet(IDB_MIGRATED_KEY, true, idbStore);
    }
  } catch {
    // ignore
  }

  return createDefaultBundle();
}

/**
 * 异步保存 bundle 到 IDB。
 * 调用方一般不 await（fire-and-forget）；内部捕获错误，避免冒到全局 unhandled rejection。
 * 同步保留导出签名为 void，便于上层调用方式不变。
 */
export function saveConfigBundle(bundle: ConfigBundle): void {
  // 立即触发但不阻塞：失败时控制台告警，不再抛出。
  void idbSet(IDB_BUNDLE_KEY, bundle, idbStore).catch((err) => {
    // eslint-disable-next-line no-console
    console.warn("[storage] saveConfigBundle to IndexedDB failed:", err);
  });
  // 旧的 localStorage 大键如果还残留（极端情况），顺手清掉，免得继续占额
  safeLocalRemove(KEY_BUNDLE);
}

/** 测试 / 重置用：清空 bundle 存储。 */
export async function clearConfigBundleStorage(): Promise<void> {
  try {
    await idbDel(IDB_BUNDLE_KEY, idbStore);
    await idbDel(IDB_MIGRATED_KEY, idbStore);
  } catch {
    // ignore
  }
  safeLocalRemove(KEY_BUNDLE);
  safeLocalRemove(KEY_V1);
}

/** Back-compat API: 同步返回默认 effective config（仅启动期占位）。 */
export function loadConfig(): AppConfig {
  return resolveConfig(loadConfigBundle());
}

/** Back-compat API: 写入 bundle 的 privateConfig。 */
export function saveConfig(config: AppConfig): void {
  const b = createDefaultBundle();
  b.privateConfig = normalizeConfig(config);
  saveConfigBundle(b);
}

function safeLocalGet(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}

function safeLocalRemove(k: string): void {
  try {
    localStorage.removeItem(k);
  } catch {
    // ignore
  }
}
