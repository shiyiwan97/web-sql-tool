import type * as Monaco from "monaco-editor";
import type { HotkeyConfig } from "../types";
import { normalizeShortcutSpec, shortcutStringFromKeyboardEvent } from "./shortcutFormat";

type CaptureCtx = {
  getEditor: () => Monaco.editor.IStandaloneCodeEditor | null;
  getHotkeys: () => HotkeyConfig;
  /** 调整位置激活键在模式关闭时也会处理；方向键仅在模式开启时由 handler 消费 */
  handleRepositionKeyDown: (e: KeyboardEvent) => boolean;
};

let ctx: CaptureCtx | null = null;

/** App 挂载后注入；卸载时可置 null */
export function setSelectionHotkeyCaptureContext(next: CaptureCtx | null) {
  ctx = next;
}

function onKeyDownCapture(e: KeyboardEvent) {
  const c = ctx;
  if (!c) return;
  const ed = c.getEditor();
  if (!ed?.hasTextFocus()) return;

  if (c.handleRepositionKeyDown(e)) {
    e.preventDefault();
    e.stopImmediatePropagation();
    return;
  }

  const pressed = shortcutStringFromKeyboardEvent(e);
  if (!pressed) return;
  const norm = normalizeShortcutSpec(pressed);
  const hk = c.getHotkeys();
  const ext = hk.extendSelection.trim();
  const shr = hk.shrinkSelection.trim();

  if (ext && norm === normalizeShortcutSpec(ext)) {
    e.preventDefault();
    e.stopImmediatePropagation();
    ed.trigger("keyboard", "editor.action.smartSelect.expand", null);
    return;
  }
  if (shr && norm === normalizeShortcutSpec(shr)) {
    e.preventDefault();
    e.stopImmediatePropagation();
    ed.trigger("keyboard", "editor.action.smartSelect.shrink", null);
  }
}

let installed = false;

/** 在入口尽早调用，使捕获阶段先于多数脚本执行（仍无法保证盖住浏览器 UI 对 Ctrl+W 的处理） */
export function installSelectionHotkeyCapture() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("keydown", onKeyDownCapture, { capture: true });
}
