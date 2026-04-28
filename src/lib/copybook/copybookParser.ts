export type CopybookNode = {
  level: number;
  name: string;
  pic?: string;
  occurs?: string;
  redefines?: string;
  children: CopybookNode[];
  line: number;
};

export type CopybookParseResult = {
  /** Derived from copybook file basename (uppercased) */
  name: string;
  root: CopybookNode | null;
  /** Flattened leaf-ish variables with hierarchical path */
  flat: Array<{ var: string; path: string; level: number; line: number }>;
  /** COPY statements (not resolved here) */
  copies: Array<{ name: string; line: number }>;
};

function basenameNoExt(pathOrName: string): string {
  const s = pathOrName.replace(/\\/g, "/").split("/").pop() ?? pathOrName;
  const dot = s.lastIndexOf(".");
  return (dot >= 0 ? s.slice(0, dot) : s) || s;
}

function isCommentLine(s: string): boolean {
  // Traditional COBOL: '*' or '/' in column 7, but test files use free-ish format.
  const t = s.trimStart();
  return t.startsWith("*") || t.startsWith("*>") || t.startsWith("/*") || t.startsWith("//");
}

export function parseCopybook(text: string, filename: string): CopybookParseResult {
  const name = basenameNoExt(filename).toUpperCase();
  const lines = text.replace(/\r\n/g, "\n").split("\n");

  const copies: CopybookParseResult["copies"] = [];
  const stack: CopybookNode[] = [];
  let root: CopybookNode | null = null;

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const raw = lines[i] ?? "";
    if (!raw.trim()) continue;
    if (isCommentLine(raw)) continue;

    const copyM = /\bCOPY\s+([A-Za-z0-9._-]+)\b/i.exec(raw);
    if (copyM) {
      copies.push({ name: copyM[1], line: lineNo });
      continue;
    }

    // Very forgiving: "05 FIELD PIC X(10)." or "01 REC."
    const m = /^\s*(\d{2})\s+([A-Za-z0-9-]+)\.?\s*(.*)$/i.exec(raw);
    if (!m) continue;
    const level = parseInt(m[1], 10);
    const nodeName = m[2].toUpperCase();
    const rest = m[3] ?? "";

    const pic = /\bPIC\s+([^.\s]+(?:\([^)]*\))?[^.]*)/i.exec(rest)?.[1]?.trim();
    const occurs = /\bOCCURS\s+([^.\s]+(?:\s+TO\s+[^.\s]+)?(?:\s+TIMES)?)/i.exec(rest)?.[1]?.trim();
    const redefines = /\bREDEFINES\s+([A-Za-z0-9-]+)/i.exec(rest)?.[1]?.toUpperCase();

    const node: CopybookNode = {
      level,
      name: nodeName,
      pic,
      occurs,
      redefines,
      children: [],
      line: lineNo,
    };

    while (stack.length && stack[stack.length - 1]!.level >= level) stack.pop();
    const parent = stack[stack.length - 1] ?? null;
    if (parent) parent.children.push(node);
    else root = node;
    stack.push(node);
  }

  const flat: CopybookParseResult["flat"] = [];
  const walk = (n: CopybookNode, path: string[]) => {
    const nextPath = [...path, n.name];
    if (!n.children.length) {
      flat.push({
        var: n.name,
        path: nextPath.join("."),
        level: n.level,
        line: n.line,
      });
    } else {
      for (const c of n.children) walk(c, nextPath);
    }
  };
  if (root) walk(root, []);

  return { name, root, flat, copies };
}

