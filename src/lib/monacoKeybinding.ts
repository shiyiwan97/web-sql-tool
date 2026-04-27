import type * as Monaco from "monaco-editor";

/**
 * 将 "Ctrl+Shift+1" / "ctrl+shift+a" 等解析为 monaco KeyMod|KeyCode。
 * 不支持组合键链，仅单组修饰键 + 主键。
 */
export function shortcutStringToKeyCode(
  monaco: typeof Monaco,
  spec: string,
): number | null {
  const raw = spec
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/·/g, "");
  if (!raw) return null;
  const parts = raw.split("+").filter(Boolean);
  let mod = 0;
  const keys: string[] = [];
  for (const p of parts) {
    if (p === "ctrl" || p === "control") mod |= monaco.KeyMod.CtrlCmd;
    else if (p === "shift") mod |= monaco.KeyMod.Shift;
    else if (p === "alt") mod |= monaco.KeyMod.Alt;
    else if (p === "meta" || p === "cmd" || p === "win")
      mod |= monaco.KeyMod.WinCtrl;
    else keys.push(p);
  }
  const key = keys.join("");
  if (!key) return null;

  const digit = /^[0-9]$/.exec(key);
  if (digit) {
    const n = key.charCodeAt(0) - 48;
    const arr = [
      monaco.KeyCode.Digit0,
      monaco.KeyCode.Digit1,
      monaco.KeyCode.Digit2,
      monaco.KeyCode.Digit3,
      monaco.KeyCode.Digit4,
      monaco.KeyCode.Digit5,
      monaco.KeyCode.Digit6,
      monaco.KeyCode.Digit7,
      monaco.KeyCode.Digit8,
      monaco.KeyCode.Digit9,
    ];
    return mod | arr[n];
  }

  if (key.length === 1 && key >= "a" && key <= "z") {
    const kc = `Key${key.toUpperCase()}` as keyof typeof monaco.KeyCode;
    const code = monaco.KeyCode[kc];
    if (typeof code === "number") return mod | code;
  }

  const fn = /^f([1-9]|1[0-2])$/.exec(key);
  if (fn) {
    const n = parseInt(fn[1], 10);
    const fk = (`F${n}` as keyof typeof monaco.KeyCode);
    const code = monaco.KeyCode[fk];
    if (typeof code === "number") return mod | code;
  }

  const specials: Record<string, number> = {
    backspace: monaco.KeyCode.Backspace,
    del: monaco.KeyCode.Delete,
    delete: monaco.KeyCode.Delete,
    enter: monaco.KeyCode.Enter,
    tab: monaco.KeyCode.Tab,
    esc: monaco.KeyCode.Escape,
    escape: monaco.KeyCode.Escape,
    space: monaco.KeyCode.Space,
    up: monaco.KeyCode.UpArrow,
    down: monaco.KeyCode.DownArrow,
    left: monaco.KeyCode.LeftArrow,
    right: monaco.KeyCode.RightArrow,
  };
  if (specials[key] != null) return mod | specials[key];

  return null;
}
