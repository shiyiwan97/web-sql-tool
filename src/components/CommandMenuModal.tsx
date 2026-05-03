import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { AppConfig } from "../types";

type CommandItem = {
  id: string;
  title: string;
  shortcut?: string;
  detail?: string;
  run?: () => void;
};

type Props = {
  open: boolean;
  config: AppConfig;
  onClose: () => void;
  onOpenSettings: () => void;
  onOpenHotkeys: () => void;
  onOpenRelations: () => void;
};

export function CommandMenuModal({
  open,
  config,
  onClose,
  onOpenSettings,
  onOpenHotkeys,
  onOpenRelations,
}: Props) {
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) return;
    setQ("");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const items = useMemo<CommandItem[]>(() => {
    const hk = config.hotkeys;
    const base: CommandItem[] = [
      {
        id: "open-relations",
        title: "表关系",
        detail: "管理 JOIN 关系（多字段；下拉支持搜索注释）",
        run: onOpenRelations,
      },
      {
        id: "open-settings",
        title: "打开设置",
        detail: "主题 / 编辑器 / SQL 警告设置 / 配置导入导出等",
        run: onOpenSettings,
      },
      {
        id: "open-hotkeys",
        title: "快捷键设置",
        shortcut: hk.openHotkeysSettings,
        detail: "查看/修改快捷键绑定",
        run: onOpenHotkeys,
      },
      {
        id: "copy-current-block",
        title: "复制当前块（格式化、无分号）",
        shortcut: hk.copyCurrentBlock,
      },
      {
        id: "save-editor-sql",
        title: "保存到已存 SQL（自动新增槽位）",
        shortcut: hk.saveEditorSql,
      },
      {
        id: "compress-line-or-selection",
        title: "压缩当前行/区域（向上填充）",
        shortcut: hk.compressLineOrSelection,
      },
      {
        id: "compress-current-block",
        title: "压缩当前分号块",
        shortcut: hk.compressCurrentBlock,
      },
      {
        id: "extend-selection",
        title: "Extend Selection",
        shortcut: hk.extendSelection,
        detail: "扩展选区（JetBrains / IntelliJ IDEA 同名动作）",
      },
      {
        id: "shrink-selection",
        title: "Shrink Selection",
        shortcut: hk.shrinkSelection,
        detail: "缩小选区",
      },
      ...config.quickInserts.map((x) => ({
        id: `qi-${x.id}`,
        title: `快捷赋值：${x.key || "(未命名)"}`,
        shortcut: x.shortcut,
        detail: x.value ? `插入：${x.value}` : undefined,
      })),
    ];
    return base;
  }, [config.hotkeys, config.quickInserts, onOpenSettings, onOpenHotkeys, onOpenRelations]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((x) => {
      const s = `${x.title} ${x.shortcut ?? ""} ${x.detail ?? ""}`.toLowerCase();
      return s.includes(needle);
    });
  }, [items, q]);

  if (!open) return null;

  return (
    <div style={backdrop} role="presentation" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modal} role="dialog" aria-modal="true" aria-label="快捷键与命令菜单">
        <div style={head}>
          <div style={{ fontSize: 12, fontWeight: 700 }}>快捷键 / 命令</div>
          <button type="button" style={btnSm} onClick={onClose}>
            关闭
          </button>
        </div>
        <div style={{ padding: 12, display: "grid", gap: 10 }}>
          <input
            type="search"
            placeholder="搜索命令或快捷键…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={inp}
            autoFocus
          />
          <div style={{ display: "grid", gap: 8, maxHeight: 420, overflow: "auto", minHeight: 0 }}>
            {filtered.map((x) => (
              <button
                key={x.id}
                type="button"
                style={rowBtn}
                onClick={() => {
                  x.run?.();
                  onClose();
                }}
                disabled={!x.run}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: "var(--text)", fontWeight: 650 }}>
                    {x.title}
                  </div>
                  {x.detail ? (
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      {x.detail}
                    </div>
                  ) : null}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {x.shortcut ? <code style={kbd}>{x.shortcut}</code> : <span style={{ width: 10 }} />}
                </div>
              </button>
            ))}
            {filtered.length === 0 ? (
              <div style={{ ...hint, padding: 10 }}>没有匹配项。</div>
            ) : null}
          </div>
          <div style={hint}>提示：按 ESC 关闭。</div>
        </div>
      </div>
    </div>
  );
}

const backdrop: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "var(--modal-backdrop)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  zIndex: 9999,
};

const modal: CSSProperties = {
  width: "min(760px, 100%)",
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--bg-elevated)",
  boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
  overflow: "hidden",
};

const head: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  borderBottom: "1px solid var(--border)",
};

const inp: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  fontSize: 12,
  color: "var(--text)",
  background: "var(--bg-app)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  outline: "none",
};

const rowBtn: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--bg-app)",
  cursor: "pointer",
  textAlign: "left",
};

const btnSm: CSSProperties = {
  padding: "6px 10px",
  fontSize: 11,
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg-app)",
  color: "var(--text)",
  cursor: "pointer",
};

const kbd: CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 11,
  padding: "4px 8px",
  border: "1px solid var(--border)",
  borderRadius: 8,
  background: "rgba(255,255,255,0.04)",
  color: "var(--text-muted)",
  whiteSpace: "nowrap",
};

const hint: CSSProperties = {
  fontSize: 11,
  color: "var(--text-muted)",
};

