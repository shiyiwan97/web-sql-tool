/** Monaco 编辑器悬停（supportHtml）内使用的 HTML 表格片段 */

export function escapeHoverHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const TABLE =
  "border-collapse:collapse;width:100%;margin-top:4px;font-size:11px;line-height:1.45;table-layout:fixed;border:1px solid rgba(127,127,127,0.45)";
const CELL =
  "border:1px solid rgba(127,127,127,0.45);padding:4px 7px;text-align:left;vertical-align:top;word-break:break-word";
const TH = `${CELL};font-weight:600;background:rgba(127,127,127,0.14)`;
/** 列「键」：固定宽度；仅主键行显示 🔑，其余为空（对齐靠 colgroup） */
const CELL_PK = `${CELL};width:2rem;min-width:2rem;max-width:2rem;text-align:center;vertical-align:middle;padding:4px 3px;box-sizing:border-box`;

function th(label: string): string {
  return `<th style="${TH}">${label ? escapeHoverHtml(label) : "&nbsp;"}</th>`;
}

function td(innerHtml: string): string {
  return `<td style="${CELL}">${innerHtml}</td>`;
}

function tdPk(isKey: boolean): string {
  const inner = isKey ? "🔑" : "";
  return `<td style="${CELL_PK}">${inner}</td>`;
}

/** isKey, fieldName, type, comment — 键单独窄列 */
export function hoverTableFieldTypeComment(
  rows: Array<[boolean, string, string, string]>,
): string {
  const head = `<thead><tr>${th("键")}${th("字段")}${th("类型")}${th("注释")}</tr></thead>`;
  const body = rows
    .map(([isKey, fieldName, typeText, comment]) => {
      const f = escapeHoverHtml(fieldName);
      const t = typeText ? `<code>${escapeHoverHtml(typeText)}</code>` : "—";
      const c = comment ? escapeHoverHtml(comment) : "—";
      return `<tr>${tdPk(isKey)}${td(f)}${td(t)}${td(c)}</tr>`;
    })
    .join("");
  return `<table style="${TABLE}"><colgroup><col style="width:2rem" /><col style="width:24%" /><col style="width:28%" /><col style="width:46%" /></colgroup>${head}<tbody>${body}</tbody></table>`;
}

/** isKey, tableName, fieldName, type, comment（多表同名字段） */
export function hoverTableTableFieldTypeComment(
  rows: Array<[boolean, string, string, string, string]>,
): string {
  const head = `<thead><tr>${th("键")}${th("表")}${th("字段")}${th("类型")}${th("注释")}</tr></thead>`;
  const body = rows
    .map(([isKey, tableName, fieldName, typeText, comment]) => {
      const tab = escapeHoverHtml(tableName);
      const f = escapeHoverHtml(fieldName);
      const t = typeText ? `<code>${escapeHoverHtml(typeText)}</code>` : "—";
      const c = comment ? escapeHoverHtml(comment) : "—";
      return `<tr>${tdPk(isKey)}${td(tab)}${td(f)}${td(t)}${td(c)}</tr>`;
    })
    .join("");
  return `<table style="${TABLE}"><colgroup><col style="width:2rem" /><col style="width:16%" /><col style="width:20%" /><col style="width:26%" /><col style="width:38%" /></colgroup>${head}<tbody>${body}</tbody></table>`;
}
