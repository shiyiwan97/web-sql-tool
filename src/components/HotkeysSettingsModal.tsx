import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { HotkeyConfig, QuickInsertEntry } from "../types";
import { ShortcutCaptureModal, type ShortcutConflictEntry } from "./ShortcutCaptureModal";

type Props = {
  open: boolean;
  hotkeys: HotkeyConfig;
  /** 用于冲突检测的额外占用条目（如快捷赋值） */
  quickInserts?: QuickInsertEntry[];
  onClose: () => void;
  onApply: (next: HotkeyConfig) => void;
};

const LABELS: Record<keyof HotkeyConfig, string> = {
  copyCurrentBlock: "复制当前分号块",
  saveEditorSql: "保存到「已存 SQL」",
  compressLineOrSelection: "压缩当前行/区域",
  compressCurrentBlock: "压缩当前分号块",
  openSettings: "打开设置面板",
  openHotkeysSettings: "打开快捷键设置面板",
  openTableCatalog: "打开「查看表」面板",
  openRelations: "打开「表关系」面板",
  nextPlaceholder: "占位符 · 跳到下一个",
  extendSelection: "Extend Selection",
  shrinkSelection: "Shrink Selection",
  repositionActivate: "调整位置 · 激活 / 结束会话",
  repositionSelectPrev: "调整位置 · 向前选取",
  repositionSelectNext: "调整位置 · 向后选取",
  repositionSwapPrev: "调整位置 · 向前交换",
  repositionSwapNext: "调整位置 · 向后交换",
  repositionExtendWithPrev: "调整位置 · 扩选（含前一项）",
  repositionExtendWithNext: "调整位置 · 扩选（含后一项）",
  repositionShrinkRemovePrev: "调整位置 · 收缩（去掉最前片段）",
  repositionShrinkRemoveNext: "调整位置 · 收缩（去掉最后片段）",
};

const CAPTURE_META: Record<keyof HotkeyConfig, { title: string; description?: ReactNode }> = {
  copyCurrentBlock: {
    title: "绑定：复制当前 SQL 块",
    description: "与主界面「复制」、工具栏行为一致。",
  },
  saveEditorSql: {
    title: "绑定：保存 SQL 到已存列表",
    description:
      "无选区时保存当前分号块，有选区时保存选区内容；去掉注释后自动新建一条存档并选中。",
  },
  compressLineOrSelection: {
    title: "绑定：压缩当前行/区域",
    description: "光标所在行（或选区覆盖的行）会尝试从下一行搬词向上填充，直到接近每行最大字符。",
  },
  compressCurrentBlock: {
    title: "绑定：压缩当前分号块",
    description: "对当前分号块执行同样的向上填充压缩（仅影响当前块）。",
  },
  openSettings: {
    title: "绑定：打开设置面板",
    description: "在编辑器内/外按下都会唤起设置 Modal。建议组合 Ctrl+Alt 等避免冲突。",
  },
  openHotkeysSettings: {
    title: "绑定：打开快捷键设置面板",
    description: "在编辑器内/外按下都会唤起本快捷键面板；默认 Ctrl+Alt+H。",
  },
  openTableCatalog: {
    title: "绑定：打开「查看表」面板",
    description: "在编辑器内/外按下都会唤起「查看表」Modal。默认不绑定，可自行设置。",
  },
  openRelations: {
    title: "绑定：打开「表关系」面板",
    description: "在编辑器内/外按下都会唤起「表关系」Modal。默认不绑定，可自行设置。",
  },
  nextPlaceholder: {
    title: "绑定：跳到下一个占位符",
    description:
      "插入含 ${} 占位符的「已存 SQL」后启动占位符会话；按下此键把当前占位符的值写入并跳到下一个。在编辑器内 Enter / Tab 始终可用，本快捷键用于在编辑器外（如「快捷赋值」栏）触发推进。默认不绑定。",
  },
  extendSelection: {
    title: "绑定：Extend Selection",
    description:
      "扩展选区；默认 Ctrl+W。Chrome / Edge 等常会优先处理 Ctrl+W 关闭标签页，网页可能无法拦截，此时请改用例如 Ctrl+Alt+W。",
  },
  shrinkSelection: {
    title: "绑定：Shrink Selection",
    description: "缩小在上一次 Extend Selection 下扩大的选区。",
  },
  repositionActivate: {
    title: "绑定：调整位置 · 激活",
    description:
      "光标位于 FROM/JOIN 表片段或 SELECT 列名上方可建立会话；会话中再按一次可结束高亮。",
  },
  repositionSelectPrev: {
    title: "绑定：调整位置 · 向前选取",
    description: "仅在调整位置会话内生效；会与编辑器默认左右键冲突，故会话中会屏蔽默认行为。",
  },
  repositionSelectNext: {
    title: "绑定：调整位置 · 向后选取",
  },
  repositionSwapPrev: {
    title: "绑定：调整位置 · 向前交换",
    description: "将当前选中片段与前一项交换位置。",
  },
  repositionSwapNext: {
    title: "绑定：调整位置 · 向后交换",
  },
  repositionExtendWithPrev: {
    title: "绑定：调整位置 · 扩选（前）",
    description: "把紧邻的前一项并入选中集合，便于整块与前一项交换。",
  },
  repositionExtendWithNext: {
    title: "绑定：调整位置 · 扩选（后）",
  },
  repositionShrinkRemovePrev: {
    title: "绑定：调整位置 · 收缩（去掉最前）",
    description:
      "多选时去掉当前选中集合里序号最小的一项；只剩一项时不生效。默认 Alt+Shift+Left。",
  },
  repositionShrinkRemoveNext: {
    title: "绑定：调整位置 · 收缩（去掉最后）",
    description:
      "多选时去掉序号最大的一项；只剩一项时不生效。默认 Alt+Shift+Right。",
  },
};

function SectionTitle({
  children,
  first,
  spanGrid,
}: {
  children: string;
  first?: boolean;
  /** 放在 CSS grid 容器内时横跨所有列 */
  spanGrid?: boolean;
}) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.06em",
        color: "var(--text-muted)",
        textTransform: "uppercase",
        marginTop: first ? 4 : 18,
        marginBottom: 8,
        paddingBottom: 6,
        borderBottom: "1px solid var(--border)",
        ...(spanGrid ? ({ gridColumn: "1 / -1" } satisfies CSSProperties) : {}),
      }}
    >
      {children}
    </div>
  );
}

export function HotkeysSettingsModal({
  open,
  hotkeys,
  quickInserts = [],
  onClose,
  onApply,
}: Props) {
  const [capture, setCapture] = useState<keyof HotkeyConfig | null>(null);

  /** 排除当前正在编辑的项后，列出所有已占用的快捷键 */
  const buildExisting = (excludeKey: keyof HotkeyConfig): ShortcutConflictEntry[] => {
    const out: ShortcutConflictEntry[] = [];
    for (const k of Object.keys(LABELS) as Array<keyof HotkeyConfig>) {
      if (k === excludeKey) continue;
      const sc = hotkeys[k];
      if (sc) out.push({ label: `快捷键 · ${LABELS[k]}`, shortcut: sc });
    }
    for (const qi of quickInserts) {
      if (qi.shortcut) {
        out.push({
          label: `快捷赋值 · ${qi.key || "(未命名)"}`,
          shortcut: qi.shortcut,
        });
      }
    }
    return out;
  };

  useEffect(() => {
    if (!open || capture) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, capture, onClose]);

  const HotkeyRow = (props: { k: keyof HotkeyConfig; detail?: string }) => (
    <div
      role="presentation"
      style={rowCard}
      onClick={(e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          setCapture(props.k);
        }
      }}
      title="按住 Ctrl（macOS：⌘）并单击此卡片可更改快捷键"
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={lbl}>{LABELS[props.k]}</div>
        {props.detail ? <div style={hintSmall}>{props.detail}</div> : null}
        <code style={code}>{hotkeys[props.k] || "（未绑定）"}</code>
      </div>
    </div>
  );

  if (!open) return null;

  const meta = capture ? CAPTURE_META[capture] : null;

  return (
    <>
      <div
        style={backdrop}
        role="presentation"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div style={modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
          <div style={gridWrap}>
            <h2 style={{ gridColumn: "1 / -1", margin: "0 0 10px", fontSize: 15 }}>快捷键</h2>
            <p style={{ ...hint, gridColumn: "1 / -1", marginBottom: 8 }}>
              按住 Ctrl（macOS：⌘）并单击下方卡片即可绑定或更改快捷键；弹出绑定框后按 Esc 仅关闭绑定框。与 Monaco
              编辑器共用同一套解析规则。
            </p>

            <SectionTitle first spanGrid>
              常规
            </SectionTitle>
            <HotkeyRow k="copyCurrentBlock" />
            <HotkeyRow k="saveEditorSql" />
            <HotkeyRow k="compressLineOrSelection" />
            <HotkeyRow k="compressCurrentBlock" />

            <SectionTitle spanGrid>面板操作</SectionTitle>
            <HotkeyRow k="openSettings" />
            <HotkeyRow k="openHotkeysSettings" />
            <HotkeyRow k="openTableCatalog" />
            <HotkeyRow k="openRelations" />

            <SectionTitle spanGrid>已存 SQL · 占位符</SectionTitle>
            <HotkeyRow
              k="nextPlaceholder"
              detail="插入含 ${} 占位符的「已存 SQL」后启动会话：按下推进到下一个占位符。在编辑器内 Enter / Tab 始终可用。"
            />

            <SectionTitle spanGrid>选区（智能扩选）</SectionTitle>
            <HotkeyRow
              k="extendSelection"
              detail="扩展选区（IntelliJ 同名动作）；默认 Ctrl+W。Chrome 可能无法拦截关闭标签，请改用 Ctrl+Alt+W 等。"
            />
            <HotkeyRow
              k="shrinkSelection"
              detail="缩小在上一次 Extend Selection 下扩大的选区。"
            />

            <SectionTitle spanGrid>调整位置（表 / SELECT 列顺序）</SectionTitle>
            <p
              style={{
                ...hintSmall,
                gridColumn: "1 / -1",
                marginTop: 0,
                marginBottom: 4,
              }}
            >
              「激活」快捷键在编辑器聚焦时尝试进入模式：光标须在 FROM/JOIN 表片段或 SELECT
              列上才会出现红绿高亮；否则会弹出右下角通知（可在「设置 → 警告设置」中关闭）。
            </p>
            <HotkeyRow
              k="repositionActivate"
              detail="默认 Ctrl+Shift+M：若光标在表/列片段上则进入「调整位置」并高亮；否则可按设置弹出提示；会话中再按一次结束高亮。"
            />
            <HotkeyRow k="repositionSelectPrev" detail="默认 Left：仅选中上一项。" />
            <HotkeyRow k="repositionSelectNext" detail="默认 Right。" />
            <HotkeyRow
              k="repositionSwapPrev"
              detail="默认 Ctrl+Left：选中块与前一项交换（JOIN ON 随片段移动；首表与首个 JOIN 会做语法修正）。"
            />
            <HotkeyRow k="repositionSwapNext" detail="默认 Ctrl+Right。" />
            <HotkeyRow
              k="repositionExtendWithPrev"
              detail="默认 Shift+Left：把前一项并入选中（可与 Ctrl+Left 一起移动多块）。"
            />
            <HotkeyRow k="repositionExtendWithNext" detail="默认 Shift+Right。" />
            <HotkeyRow
              k="repositionShrinkRemovePrev"
              detail="默认 Alt+Shift+Left：多选时去掉最前一项；仅一项时不生效。"
            />
            <HotkeyRow
              k="repositionShrinkRemoveNext"
              detail="默认 Alt+Shift+Right：多选时去掉最后一项；仅一项时不生效。"
            />

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 12,
                gridColumn: "1 / -1",
              }}
            >
              <button type="button" style={btn} onClick={onClose}>
                关闭
              </button>
            </div>
          </div>
        </div>
      </div>

      {capture && meta ? (
        <ShortcutCaptureModal
          open
          zIndex={13000}
          title={meta.title}
          description={meta.description}
          initialShortcut={hotkeys[capture]}
          existingShortcuts={buildExisting(capture)}
          confirmLabel="保存"
          onClose={() => setCapture(null)}
          onConfirm={(s) => {
            onApply({ ...hotkeys, [capture]: s });
            setCapture(null);
          }}
        />
      ) : null}
    </>
  );
}

const hintSmall: CSSProperties = {
  fontSize: 11,
  color: "var(--text-muted)",
  margin: "0 0 6px",
  lineHeight: 1.45,
};

const backdrop: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 11000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  background: "var(--modal-backdrop)",
};

const modal: CSSProperties = {
  width: "min(1240px, 100%)",
  maxHeight: "90vh",
  overflow: "auto",
  padding: 22,
  borderRadius: "var(--radius)",
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  boxShadow: "0 16px 48px rgba(0,0,0,0.35)",
};

/** 桌面一行 4 列；在窄屏由 min(1240px) 与 padding 自然折行或横向滚动 */
const gridWrap: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "14px",
  alignItems: "stretch",
};

const hint: CSSProperties = {
  fontSize: 12,
  color: "var(--text-muted)",
  margin: "0 0 8px",
  lineHeight: 1.5,
};

const rowCard: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: "12px 14px",
  border: "1px solid var(--border)",
  borderRadius: 8,
  background: "var(--bg-app)",
  minWidth: 0,
  cursor: "default",
};

const lbl: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 4,
};

const code: CSSProperties = {
  display: "block",
  fontFamily: "var(--mono)",
  fontSize: 12,
  color: "var(--btn-primary-fg)",
};

const btn: CSSProperties = {
  padding: "8px 14px",
  fontSize: 13,
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--bg-app)",
  color: "var(--text)",
  cursor: "pointer",
  flexShrink: 0,
};
