export type DdsField = {
  name: string;
  rawType?: string;
  line: number;
};

export type DdsParseResult = {
  /** Derived from DDS file basename (uppercased) */
  table: string;
  recordFormats: string[];
  fields: DdsField[];
  primaryKeys: string[];
  /** Lightweight refs (not yet fully resolved) */
  refs: Array<{ kind: "REFFLD" | "REF"; value: string; line: number }>;
};

function basenameNoExt(pathOrName: string): string {
  const s = pathOrName.replace(/\\/g, "/").split("/").pop() ?? pathOrName;
  const dot = s.lastIndexOf(".");
  return (dot >= 0 ? s.slice(0, dot) : s) || s;
}

export function parseDds(text: string, filename: string): DdsParseResult {
  const table = basenameNoExt(filename).toUpperCase();
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const fields: DdsField[] = [];
  const recordFormats: string[] = [];
  const pk: string[] = [];
  const refs: DdsParseResult["refs"] = [];

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const raw = lines[i] ?? "";
    const s = raw.trimEnd();
    if (!s) continue;
    // comment
    if (/^\s*A\*/.test(s)) continue;

    // Record format: "A          R NAME"
    const rm = /^\s*A\s+R\s+([A-Za-z_]\w*)\b/.exec(s);
    if (rm) {
      recordFormats.push(rm[1].toUpperCase());
      continue;
    }

    // Key line: "A          K FIELD"
    const km = /^\s*A\s+K\s+([A-Za-z_]\w*)\b/.exec(s);
    if (km) {
      pk.push(km[1].toUpperCase());
      continue;
    }

    // Field definition line (common simple DDS): "A            FIELD  10A"
    const fm = /^\s*A\s+([A-Za-z_]\w*)\s+([0-9]+\s*[A-Z]\b.*)?$/i.exec(s);
    if (fm) {
      const name = fm[1].toUpperCase();
      // Exclude keyword-only lines like "A          K ..."
      if (name === "K" || name === "R") continue;
      const rawType = fm[2]?.trim();
      fields.push({ name, rawType, line: lineNo });
      // Some DDS puts key flag in fixed columns; best-effort: col 17 (1-indexed)
      const col17 = raw.length >= 17 ? raw[16] : "";
      if (col17 === "K" && !pk.includes(name)) pk.push(name);
      continue;
    }

    if (/\bREFFLD\b/i.test(s)) refs.push({ kind: "REFFLD", value: s, line: lineNo });
    if (/\bREF\b/i.test(s)) refs.push({ kind: "REF", value: s, line: lineNo });
  }

  return {
    table,
    recordFormats,
    fields,
    primaryKeys: [...new Set(pk)],
    refs,
  };
}

