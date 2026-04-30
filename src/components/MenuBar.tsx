import { useEffect, useState, type CSSProperties } from "react";

type Props = {
  onOpenSettings: () => void;
  onFocusJsonInSettings: () => void;
  onImportConfig: () => void;
  onExportConfig: () => void;
  onOpenHotkeys: () => void;
  onOpenRelations: () => void;
  onOpenTableCatalog: () => void;
  onOpenConfigDiff: () => void;
};

export function MenuBar({
  onOpenSettings,
  onFocusJsonInSettings,
  onImportConfig,
  onExportConfig,
  onOpenHotkeys,
  onOpenRelations,
  onOpenTableCatalog,
  onOpenConfigDiff,
}: Props) {
  const [open, setOpen] = useState<"file" | "settings" | null>(null);

  /** 捕获阶段关闭，避免子菜单/编辑器内点击顺序导致菜单关不掉或误关 */
  useEffect(() => {
    if (open === null) return;
    const close = (e: PointerEvent) => {
      const el = e.target;
      if (el instanceof Element && el.closest("[data-menubar-root]")) return;
      setOpen(null);
    };
    window.addEventListener("pointerdown", close, true);
    return () => window.removeEventListener("pointerdown", close, true);
  }, [open]);

  return (
    <nav
      className="menubar"
      data-menubar-root
      aria-label="主菜单"
      style={{
        display: "flex",
        alignItems: "stretch",
        height: 30,
        background: "var(--menubar-bg)",
        borderBottom: "1px solid var(--menubar-border)",
        userSelect: "none",
        fontSize: 13,
      }}
    >
      <div style={{ position: "relative" }}>
        <button
          type="button"
          className="menubar-trigger"
          aria-expanded={open === "file"}
          onClick={() => setOpen(open === "file" ? null : "file")}
          style={menubarTriggerStyle(open === "file")}
        >
          File
        </button>
        {open === "file" && (
          <div style={dropdownStyle} role="menu">
            <button
              type="button"
              className="menubar-dd-item"
              style={itemStyle}
              role="menuitem"
              onClick={() => {
                onImportConfig();
                setOpen(null);
              }}
            >
              导入配置 JSON…
            </button>
            <button
              type="button"
              className="menubar-dd-item"
              style={itemStyle}
              role="menuitem"
              onClick={() => {
                onExportConfig();
                setOpen(null);
              }}
            >
              导出配置 JSON…
            </button>
            <button
              type="button"
              className="menubar-dd-item"
              style={itemStyle}
              role="menuitem"
              onClick={() => {
                onOpenConfigDiff();
                setOpen(null);
              }}
            >
              比较 / 合并配置 JSON…
            </button>
          </div>
        )}
      </div>
      <div style={{ position: "relative" }}>
        <button
          type="button"
          className="menubar-trigger"
          aria-expanded={open === "settings"}
          onClick={() => setOpen(open === "settings" ? null : "settings")}
          style={menubarTriggerStyle(open === "settings")}
        >
          Settings
        </button>
        {open === "settings" && (
          <div style={dropdownStyle} role="menu">
            <button
              type="button"
              className="menubar-dd-item"
              style={itemStyle}
              role="menuitem"
              onClick={() => {
                onOpenRelations();
                setOpen(null);
              }}
            >
              表关系…
            </button>
            <button
              type="button"
              className="menubar-dd-item"
              style={itemStyle}
              role="menuitem"
              onClick={() => {
                onOpenTableCatalog();
                setOpen(null);
              }}
            >
              表配置（查看）…
            </button>
            <button
              type="button"
              className="menubar-dd-item"
              style={itemStyle}
              role="menuitem"
              onClick={() => {
                onOpenSettings();
                setOpen(null);
              }}
            >
              打开设置…
            </button>
            <button
              type="button"
              className="menubar-dd-item"
              style={itemStyle}
              role="menuitem"
              onClick={() => {
                onOpenSettings();
                onFocusJsonInSettings();
                setOpen(null);
              }}
            >
              跳转到 JSON 预览
            </button>
            <button
              type="button"
              className="menubar-dd-item"
              style={itemStyle}
              role="menuitem"
              onClick={() => {
                onOpenHotkeys();
                setOpen(null);
              }}
            >
              快捷键…
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

function menubarTriggerStyle(active: boolean): CSSProperties {
  return {
    padding: "0 12px",
    display: "flex",
    alignItems: "center",
    color: active
      ? "var(--menubar-trigger-fg-active)"
      : "var(--menubar-trigger-fg)",
    background: active ? "var(--menubar-trigger-active-bg)" : "transparent",
    border: "none",
    fontSize: 13,
    cursor: "pointer",
  };
}

const dropdownStyle: CSSProperties = {
  position: "absolute",
  top: "100%",
  left: 0,
  minWidth: 200,
  padding: "4px 0",
  background: "var(--menubar-dd-bg)",
  border: "1px solid var(--menubar-dd-border)",
  boxShadow: "0 4px 16px rgba(0,0,0,0.22)",
  zIndex: 4000,
};

const itemStyle: CSSProperties = {
  display: "block",
  width: "100%",
  padding: "6px 20px",
  textAlign: "left",
  border: "none",
  background: "transparent",
  color: "var(--menubar-dd-fg)",
  fontSize: 13,
  cursor: "pointer",
};
