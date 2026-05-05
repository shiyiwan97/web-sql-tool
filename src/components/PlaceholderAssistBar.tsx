import { useMemo, type CSSProperties } from "react";

export type PlaceholderItem = {
  /** 占位符变量名（${name} 中的 name） */
  name: string;
  /** Monaco decoration id（用于跟随编辑追踪当前位置） */
  decorationId: string;
};

export type PlaceholderSession = {
  /** 文档顺序排列的全部占位符（包含同名重复项） */
  items: PlaceholderItem[];
  /** 当前激活下标（指向 items） */
  activeIdx: number;
  /** 各唯一 name 共享的输入值 */
  values: Record<string, string>;
};

type Props = {
  session: PlaceholderSession;
  /** 修改某个 name 的输入值 */
  onChangeValue: (name: string, value: string) => void;
  /**
   * 把指定 name 的输入值写入「当前」激活占位符。
   * advance=true 写入后跳到下一个占位符；false 仅写入不切换。
   */
  onApply: (name: string, advance: boolean) => void;
  /** 跳转到指定 items 下标对应的占位符（点击行/输入聚焦时调用） */
  onJumpTo: (idx: number) => void;
  /** 关闭会话（清除 decoration、隐藏本栏） */
  onClose: () => void;
};

export function PlaceholderAssistBar({
  session,
  onChangeValue,
  onApply,
  onJumpTo,
  onClose,
}: Props) {
  const groups = useMemo(() => {
    const seen = new Map<
      string,
      { count: number; firstIdx: number; allIdxs: number[] }
    >();
    session.items.forEach((it, i) => {
      const g = seen.get(it.name);
      if (g) {
        g.count += 1;
        g.allIdxs.push(i);
      } else {
        seen.set(it.name, { count: 1, firstIdx: i, allIdxs: [i] });
      }
    });
    return [...seen.entries()].map(([name, g]) => ({ name, ...g }));
  }, [session.items]);

  const activeName = session.items[session.activeIdx]?.name;
  const total = session.items.length;
  const remaining = Math.max(0, total - session.activeIdx);

  return (
    <div style={barStyle} role="region" aria-label="占位符快捷赋值">
      <div style={titleStyle}>
        <span style={{ color: "#fbbf24" }}>占位符会话</span>
        <span style={{ color: "var(--text-muted)" }}>
          {session.activeIdx + 1}/{total} · 剩余 {remaining}
        </span>
        <span
          style={{ color: "var(--text-muted)", fontSize: 11, marginLeft: 8 }}
        >
          编辑器内 Enter / Tab 推进；Esc 结束；双击右侧值＝写入并推进；双击左侧变量名＝写入但不推进
        </span>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          style={btnGhost}
          onClick={onClose}
          title="结束占位符会话（Esc）"
        >
          结束 (Esc)
        </button>
      </div>

      <div style={chipsWrap}>
        {groups.map((g) => {
          const isActive = g.name === activeName;
          const countSuffix = g.count > 1 ? `\u00a0×${g.count}` : "";
          return (
            <div
              key={g.name}
              style={{
                ...chipStyle,
                ...(isActive ? chipActiveStyle : null),
              }}
              title={
                g.count > 1
                  ? `共 ${g.count} 处。当前活动占位符若同名则共享此值。`
                  : undefined
              }
            >
              <span
                style={nameStyle}
                onDoubleClick={() => onApply(g.name, false)}
                onClick={() => onJumpTo(g.firstIdx)}
                title={`双击：把右侧值写入当前占位符（不切换）\n单击：跳到第一处 \${${g.name}}`}
              >
                {g.name}
                {countSuffix}
              </span>
              <input
                className="input"
                style={inputStyle}
                value={session.values[g.name] ?? ""}
                placeholder={`<${g.name}>`}
                spellCheck={false}
                onChange={(e) => onChangeValue(g.name, e.target.value)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onApply(g.name, true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    onApply(g.name, true);
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    onClose();
                  }
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── styles ───
const barStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  padding: "6px 12px",
  background: "rgba(251, 191, 36, 0.08)",
  borderBottom: "1px solid rgba(251, 191, 36, 0.35)",
  fontSize: 12,
};

const titleStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  fontSize: 11,
  fontWeight: 600,
};

const chipsWrap: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const chipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 0,
  padding: 0,
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  overflow: "hidden",
};

const chipActiveStyle: CSSProperties = {
  border: "1px solid #fbbf24",
  boxShadow: "0 0 0 2px rgba(251, 191, 36, 0.18)",
};

const nameStyle: CSSProperties = {
  padding: "4px 8px",
  fontFamily: "var(--mono)",
  fontSize: 11,
  color: "#fbbf24",
  cursor: "pointer",
  userSelect: "none",
  background: "rgba(251, 191, 36, 0.1)",
  borderRight: "1px solid var(--border)",
  whiteSpace: "nowrap",
};

const inputStyle: CSSProperties = {
  minWidth: 100,
  width: 140,
  padding: "4px 8px",
  fontFamily: "var(--mono)",
  fontSize: 11,
  color: "var(--text)",
  background: "var(--bg-app)",
  border: "none",
  outline: "none",
};

const btnGhost: CSSProperties = {
  padding: "3px 10px",
  fontSize: 11,
  border: "1px solid var(--border)",
  borderRadius: 4,
  background: "var(--bg-app)",
  color: "var(--text-muted)",
  cursor: "pointer",
};
