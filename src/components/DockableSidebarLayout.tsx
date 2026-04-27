import { Fragment, useCallback, useRef, type ReactNode } from "react";
import type { AppConfig, PanelSlot } from "../types";
import {
  dragMime,
  insertIndexFromPointer,
  moveSlotInLayout,
} from "../lib/sidebarLayoutDnD";
import { normalizeRatios } from "../lib/sidebarUiStorage";

type Props = {
  side: "left" | "right";
  widthPx: number;
  panelRatios: number[];
  onPanelRatiosChange: (ratios: number[]) => void;
  config: AppConfig;
  setConfig: (fn: (c: AppConfig) => AppConfig) => void;
  renderPanel: (slot: PanelSlot) => ReactNode;
};

const PANEL_LABEL: Record<PanelSlot, string> = {
  search: "搜索",
  savedSql: "已存 SQL",
  quickInsert: "快捷赋值",
};

export function DockableSidebarColumn({
  side,
  widthPx,
  panelRatios,
  onPanelRatiosChange,
  config,
  setConfig,
  renderPanel,
}: Props) {
  const slots =
    side === "left" ? config.sidebarLayout.left : config.sidebarLayout.right;
  const colRef = useRef<HTMLDivElement>(null);

  const applyMove = useCallback(
    (slot: PanelSlot, targetSide: "left" | "right", index: number) => {
      setConfig((c) => ({
        ...c,
        sidebarLayout: moveSlotInLayout(
          c.sidebarLayout,
          slot,
          targetSide,
          index,
        ),
      }));
    },
    [setConfig],
  );

  const onDragStart = (slot: PanelSlot) => (e: React.DragEvent) => {
    e.dataTransfer.setData(dragMime(), slot);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (e: React.DragEvent) => {
    if (!Array.from(e.dataTransfer.types).includes(dragMime())) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData(dragMime());
    if (raw !== "search" && raw !== "savedSql" && raw !== "quickInsert") return;
    const slot = raw as PanelSlot;
    const el = e.currentTarget as HTMLElement;
    const idx = insertIndexFromPointer(el, e.clientY);
    applyMove(slot, side, idx);
  };

  const startRowResize = (boundaryIndex: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const colEl = colRef.current;
    if (!colEl) return;
    const startH = colEl.getBoundingClientRect().height;
    const startRatios = [...panelRatios];
    const onMove = (ev: MouseEvent) => {
      const dy = ev.clientY - startY;
      const i = boundaryIndex;
      const j = boundaryIndex + 1;
      if (j >= startRatios.length) return;
      const deltaRatio = dy / Math.max(startH, 160);
      const a = startRatios[i] + deltaRatio;
      const b = startRatios[j] - deltaRatio;
      const minR = 0.06;
      if (a < minR || b < minR) return;
      const next = [...startRatios];
      next[i] = a;
      next[j] = b;
      onPanelRatiosChange(normalizeRatios(next));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const borderSide =
    side === "left"
      ? { borderRight: "1px solid var(--border)" }
      : { borderLeft: "1px solid var(--border)" };

  const ratios =
    panelRatios.length === slots.length && slots.length > 0
      ? panelRatios
      : slots.map(() => 1);

  return (
    <div
      ref={colRef}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        width: widthPx,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        background: "var(--bg-panel)",
        ...borderSide,
      }}
    >
      {slots.length === 0 ? (
        <div
          style={{
            flex: 1,
            minHeight: 48,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            color: "var(--text-muted)",
            padding: 8,
            textAlign: "center",
          }}
        >
          拖拽面板标题栏到此处（{side === "left" ? "左" : "右"}侧）
        </div>
      ) : (
        slots.map((slot, idx) => (
          <Fragment key={slot}>
            {idx > 0 ? (
              <div
                role="separator"
                aria-orientation="horizontal"
                onMouseDown={startRowResize(idx - 1)}
                style={{
                  flexShrink: 0,
                  height: 5,
                  cursor: "row-resize",
                  background: "var(--border)",
                }}
                title="拖动调整上下高度"
              />
            ) : null}
            <div
              data-dock-panel
              style={{
                flexGrow: ratios[idx] ?? 1,
                flexBasis: 0,
                flexShrink: 1,
                minHeight: 52,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <div
                draggable
                onDragStart={onDragStart(slot)}
                style={{
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  background: "var(--bg-elevated)",
                  cursor: "grab",
                  userSelect: "none",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <span aria-hidden style={{ letterSpacing: "-0.12em" }}>
                  ⠿
                </span>
                {PANEL_LABEL[slot]}
              </div>
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {renderPanel(slot)}
              </div>
            </div>
          </Fragment>
        ))
      )}
    </div>
  );
}

/** 左右栏与编辑器之间的竖向分隔条（拖动改栏宽） */
export function SidebarWidthHandle(props: {
  onDrag: (deltaX: number) => void;
  ariaLabel: string;
}) {
  const startRef = useRef({ x: 0 });

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    startRef.current.x = e.clientX;
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startRef.current.x;
      startRef.current.x = ev.clientX;
      props.onDrag(dx);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div
      role="separator"
      aria-label={props.ariaLabel}
      onMouseDown={onMouseDown}
      style={{
        flexShrink: 0,
        width: 6,
        cursor: "col-resize",
        background: "transparent",
        alignSelf: "stretch",
      }}
    />
  );
}
