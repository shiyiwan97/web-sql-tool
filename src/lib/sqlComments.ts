/**
 * 去掉 SQL 行注释（--）与块注释（/ * … * /）。
 * 单引号字符串内连续两个单引号为转义，其中的 -- 不当作注释。
 */
export function stripSqlComments(sql: string): string {
  let out = "";
  let i = 0;
  let inString = false;

  while (i < sql.length) {
    const c = sql[i];

    if (inString) {
      out += c;
      if (c === "'" && sql[i + 1] === "'") {
        out += sql[i + 1];
        i += 2;
        continue;
      }
      if (c === "'") inString = false;
      i++;
      continue;
    }

    if (c === "'") {
      inString = true;
      out += c;
      i++;
      continue;
    }

    if (c === "-" && sql[i + 1] === "-") {
      i += 2;
      while (i < sql.length && sql[i] !== "\n" && sql[i] !== "\r") i++;
      if (i < sql.length && sql[i] === "\r") i++;
      if (i < sql.length && sql[i] === "\n") i++;
      continue;
    }

    if (c === "/" && sql[i + 1] === "*") {
      i += 2;
      while (i < sql.length - 1) {
        if (sql[i] === "*" && sql[i + 1] === "/") {
          i += 2;
          break;
        }
        i++;
      }
      continue;
    }

    out += c;
    i++;
  }

  return out
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}
