import type { PanelSlot, SidebarLayout } from "../types";

const MIME = "application/x-sql-web-tool-panel";

export function dragMime(): string {
  return MIME;
}

export function moveSlotInLayout(
  layout: SidebarLayout,
  slot: PanelSlot,
  targetSide: "left" | "right",
  insertIndex: number,
): SidebarLayout {
  const left = layout.left.filter((s) => s !== slot);
  const right = layout.right.filter((s) => s !== slot);
  const col = targetSide === "left" ? left : right;
  const i = Math.max(0, Math.min(insertIndex, col.length));
  col.splice(i, 0, slot);
  return targetSide === "left" ? { left: col, right } : { left, right: col };
}

export function insertIndexFromPointer(
  container: HTMLElement,
  clientY: number,
): number {
  const nodes = Array.from(
    container.querySelectorAll<HTMLElement>("[data-dock-panel]"),
  );
  if (nodes.length === 0) return 0;
  for (let i = 0; i < nodes.length; i++) {
    const r = nodes[i].getBoundingClientRect();
    const mid = (r.top + r.bottom) / 2;
    if (clientY < mid) return i;
  }
  return nodes.length;
}
