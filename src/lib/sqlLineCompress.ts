function splitIndent(line: string): { indent: string; body: string } {
  const m = /^(\s*)(.*)$/.exec(line);
  return { indent: m?.[1] ?? "", body: m?.[2] ?? line };
}

function firstWord(body: string): { word: string; rest: string } | null {
  const trimmed = body.trimStart();
  if (!trimmed) return null;
  const i = trimmed.indexOf(" ");
  if (i === -1) return { word: trimmed, rest: "" };
  return { word: trimmed.slice(0, i), rest: trimmed.slice(i + 1) };
}

/**
 * 将后续行的词尽量向上搬运：若上一行未满（<= maxLen），就从下一行挪若干词到上一行末尾。
 *
 * - 只在 [startLine, endLine]（含）范围内做搬运
 * - 保留每行原始缩进；搬运时以空格作为分词边界
 */
export function compressLinesUpward(
  text: string,
  maxLen: number,
  startLine: number,
  endLine: number,
): string {
  const max = Math.max(8, Math.floor(maxLen) || 72);
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const start = Math.max(0, Math.min(startLine, lines.length - 1));
  const end = Math.max(start, Math.min(endLine, lines.length - 1));

  for (let i = start; i < end; i++) {
    const cur = splitIndent(lines[i] ?? "");
    let curBody = cur.body.trimEnd();

    for (let j = i + 1; j <= end; j++) {
      const nxt = splitIndent(lines[j] ?? "");
      let nxtBody = nxt.body;
      while (true) {
        const fw = firstWord(nxtBody);
        if (!fw) break;
        const joinedBody = curBody ? `${curBody} ${fw.word}` : fw.word;
        const candidateLen = cur.indent.length + joinedBody.length;
        if (candidateLen > max) break;
        curBody = joinedBody;
        nxtBody = fw.rest;
      }
      // 写回当前、下一行（只影响作为 donor 的行）
      lines[i] = (cur.indent + curBody).trimEnd();
      lines[j] = (nxt.indent + nxtBody.trimStart()).trimEnd();
      // 当前行已经填到不能再填了，就停止向下继续拿词
      if ((cur.indent.length + curBody.length) >= max) break;
      // 如果下一行已经空了，继续尝试从更下一行搬词
      if (nxtBody.trimStart()) break;
    }
  }

  return lines.join("\n");
}

