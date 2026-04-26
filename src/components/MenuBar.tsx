import { useEffect, useState, type CSSProperties } from "react";

type Props = {
  onOpenSettings: () => void;
  onFocusJsonInSettings: () => void;
  onImportConfig: () => void;
  onExportConfig: () => void;
  onOpenCopyHotkeyModal: () => void;
};

export function MenuBar({
  onOpenSettings,
  onFocusJsonInSettings,
  onImportConfig,
  onExportConfig,
  onOpenCopyHotkeyModal,
}: Props) {
  const [open, setOpen] = useState<"file" | "settings" | null>(null);
  const [settingsSub, setSettingsSub] = useState<"hotkeys" | null>(null);

  useEffect(() => {
    const close = () => setOpen(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  return (
    <nav
      className="menubar"
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
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ position: "relative" }}>
        <button
          type="button"
          className="menubar-trigger"
          aria-expanded={open === "file"}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(open === "file" ? null : "file");
          }}
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
          </div>
        )}
      </div>
      <div style={{ position: "relative" }}>
        <button
          type="button"
          className="menubar-trigger"
          aria-expanded={open === "settings"}
          onClick={(e) => {
            e.stopPropagation();
            setSettingsSub(null);
            setOpen(open === "settings" ? null : "settings");
          }}
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
            <div
              style={{ position: "relative" }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="menubar-dd-item"
                style={{
                  ...itemStyle,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
                role="menuitem"
                aria-expanded={settingsSub === "hotkeys"}
                onClick={(e) => {
                  e.stopPropagation();
                  setSettingsSub((s) => (s === "hotkeys" ? null : "hotkeys"));
                }}
              >
                <span>快捷键设置</span>
                <span aria-hidden style={{ fontSize: 10, opacity: 0.7 }}>
                  ▶
                </span>
              </button>
              {settingsSub === "hotkeys" ? (
                <div
                  style={{
                    ...dropdownStyle,
                    left: "100%",
                    top: 0,
                    marginLeft: 2,
                    minWidth: 180,
                  }}
                  role="menu"
                >
                  <button
                    type="button"
                    className="menubar-dd-item"
                    style={itemStyle}
                    role="menuitem"
                    onClick={() => {
                      onOpenCopyHotkeyModal();
                      setOpen(null);
                      setSettingsSub(null);
                    }}
                  >
                    配置复制快捷键…
                  </button>
                </div>
              ) : null}
            </div>
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
