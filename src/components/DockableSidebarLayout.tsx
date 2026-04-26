import { useCallback, type ReactNode } from "react";
import type { AppConfig, PanelSlot } from "../types";
import {
  dragMime,
  insertIndexFromPointer,
  moveSlotInLayout,
} from "../lib/sidebarLayoutDnD";

type Props = {
  side: "left" | "right";
  config: AppConfig;
  setConfig: (fn: (c: AppConfig) => AppConfig) => void;
  renderPanel: (slot: PanelSlot) => ReactNode;
};

const PANEL_LABEL: Record<PanelSlot, string> = {
  search: "搜索",
  quickInsert: "快捷赋值",
};

export function DockableSidebarColumn({
  side,
  config,
  setConfig,
  renderPanel,
}: Props) {
  const slots =
    side === "left" ? config.sidebarLayout.left : config.sidebarLayout.right;

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
    if (raw !== "search" && raw !== "quickInsert") return;
    const slot = raw as PanelSlot;
    const el = e.currentTarget as HTMLElement;
    const idx = insertIndexFromPointer(el, e.clientY);
    applyMove(slot, side, idx);
  };

  const borderSide =
    side === "left"
      ? { borderRight: "1px solid var(--border)" }
      : { borderLeft: "1px solid var(--border)" };

  return (
    <div
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        width: "var(--sidebar-w)",
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
        slots.map((slot) => (
          <div
            key={slot}
            data-dock-panel
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              borderBottom: "1px solid var(--border)",
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
        ))
      )}
    </div>
  );
}
