/**
 * 从 KeyboardEvent 生成与 monacoKeybinding 解析器一致的快捷键字符串（如 Ctrl+Shift+1）。
 * 使用 code 区分数字行与 Shift 产生的符号。
 */
export function shortcutStringFromKeyboardEvent(e: KeyboardEvent): string | null {
  if (e.repeat) return null;
  const main = mainKeyFromCode(e);
  if (main === null) return null;

  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.metaKey) parts.push("Cmd");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");

  if (
    parts.length === 0 &&
    !/^[a-zA-Z0-9]$/.test(main) &&
    !/^F\d+$/.test(main) &&
    !/^(Left|Right|Up|Down)$/.test(main)
  ) {
    return null;
  }

  return [...parts, main].join("+");
}

/** 用于比较两段快捷键字符串是否等价（修饰键顺序无关） */
export function normalizeShortcutSpec(s: string): string {
  return s
    .split("+")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean)
    .map((p) => (p === "control" ? "ctrl" : p === "cmd" || p === "command" ? "meta" : p))
    .sort((a, b) => {
      const order = ["ctrl", "alt", "shift", "meta"];
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      if (ai >= 0 && bi >= 0) return ai - bi;
      if (ai >= 0) return -1;
      if (bi >= 0) return 1;
      return a.localeCompare(b);
    })
    .join("+");
}

function mainKeyFromCode(e: KeyboardEvent): string | null {
  const c = e.code;
  if (c.startsWith("Key") && c.length === 4) return c.slice(3).toUpperCase();
  if (c.startsWith("Digit")) return c.slice(5);
  if (/^F(1[0-2]|[1-9])$/.test(c)) return c;
  if (c === "ArrowLeft") return "Left";
  if (c === "ArrowRight") return "Right";
  if (c === "ArrowUp") return "Up";
  if (c === "ArrowDown") return "Down";

  if (
    e.key.length === 1 &&
    /[a-zA-Z]/.test(e.key) &&
    !e.ctrlKey &&
    !e.metaKey &&
    !e.altKey
  ) {
    return e.key.toUpperCase();
  }
  if (
    e.key.length === 1 &&
    /[0-9]/.test(e.key) &&
    !e.shiftKey &&
    !e.ctrlKey &&
    !e.metaKey
  ) {
    return e.key;
  }

  return null;
}
