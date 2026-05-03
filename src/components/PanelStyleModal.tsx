import {
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type {
  AppConfig,
  PanelBoxStyle,
  PanelButtonStyle,
  PanelStyles,
  PanelTextStyle,
  QuickInsertPanelStyle,
  SavedSqlPanelStyle,
  SearchPanelPkBadgeStyle,
  SearchPanelStyle,
  TableCatalogPanelStyle,
} from "../types";
import { createDefaultPanelStyles } from "../lib/configDefaults";

export type PanelStyleTarget = "search" | "quickInsert" | "savedSql" | "tableCatalog";

type Props = {
  open: boolean;
  target: PanelStyleTarget;
  config: AppConfig;
  onClose: () => void;
  onApply: (next: PanelStyles) => void;
};

const TITLES: Record<PanelStyleTarget, string> = {
  search: "搜索面板 · 样式",
  quickInsert: "快捷赋值面板 · 样式",
  savedSql: "已存 SQL 面板 · 样式",
  tableCatalog: "查看表 · 样式",
};

export function PanelStyleModal({ open, target, config, onClose, onApply }: Props) {
  const [draft, setDraft] = useState<PanelStyles>(config.panelStyles);

  useEffect(() => {
    if (open) setDraft(config.panelStyles);
  }, [open, config.panelStyles]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const resetDefault = () => {
    const def = createDefaultPanelStyles();
    if (target === "search") setDraft({ ...draft, search: def.search });
    if (target === "quickInsert") setDraft({ ...draft, quickInsert: def.quickInsert });
    if (target === "savedSql") setDraft({ ...draft, savedSql: def.savedSql });
    if (target === "tableCatalog") setDraft({ ...draft, tableCatalog: def.tableCatalog });
  };

  return (
    <div
      style={backdrop}
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={modal} role="dialog" aria-modal="true" aria-label={TITLES[target]}>
        <div style={head}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800 }}>{TITLES[target]}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              在右侧实时预览。颜色留空（点击「清除」按钮）将沿用主题默认色。
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" style={btnSm} onClick={resetDefault}>
              恢复默认
            </button>
            <button type="button" style={btnSm} onClick={onClose}>
              取消
            </button>
            <button
              type="button"
              style={primaryBtn}
              onClick={() => {
                onApply(draft);
                onClose();
              }}
            >
              应用并保存
            </button>
          </div>
        </div>

        <div style={body}>
          <section style={editorPane}>
            {target === "search" ? (
              <SearchEditor
                value={draft.search}
                onChange={(s) => setDraft({ ...draft, search: s })}
              />
            ) : target === "tableCatalog" ? (
              <TableCatalogEditor
                value={draft.tableCatalog}
                onChange={(s) => setDraft({ ...draft, tableCatalog: s })}
              />
            ) : target === "quickInsert" ? (
              <QuickInsertEditor
                value={draft.quickInsert}
                onChange={(s) => setDraft({ ...draft, quickInsert: s })}
              />
            ) : (
              <SavedSqlEditor
                value={draft.savedSql}
                onChange={(s) => setDraft({ ...draft, savedSql: s })}
              />
            )}
          </section>
          <section style={previewPane}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8 }}>
              实时预览
            </div>
            <div style={previewBox}>
              {target === "search" ? (
                <SearchPreview style={draft.search} />
              ) : target === "tableCatalog" ? (
                <TableCatalogPreview style={draft.tableCatalog} />
              ) : target === "quickInsert" ? (
                <QuickInsertPreview style={draft.quickInsert} />
              ) : (
                <SavedSqlPreview style={draft.savedSql} />
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ============================== Editors ============================== */

function PrimaryKeyBadgeStyleFields({
  value,
  onChange,
}: {
  value: SearchPanelPkBadgeStyle;
  onChange: (next: SearchPanelPkBadgeStyle) => void;
}) {
  return (
    <>
      <div style={{ ...fieldRow, alignItems: "center" }}>
        <div style={fieldLabel}>文案</div>
        <input
          type="text"
          value={value.label}
          onChange={(e) => onChange({ ...value, label: e.target.value })}
          placeholder="PK"
          style={{ ...inputStyle, width: 120 }}
        />
      </div>
      <div style={{ ...fieldRow, alignItems: "center", flexWrap: "wrap" }}>
        <div style={fieldLabel}>文字颜色</div>
        <ColorInput value={value.color} onChange={(c) => onChange({ ...value, color: c })} />
      </div>
      <div style={{ ...fieldRow, alignItems: "center", flexWrap: "wrap" }}>
        <div style={fieldLabel}>背景色</div>
        <ColorInput
          value={value.backgroundColor}
          onChange={(c) => onChange({ ...value, backgroundColor: c })}
        />
      </div>
      <div style={{ ...fieldRow, alignItems: "center", flexWrap: "wrap" }}>
        <div style={fieldLabel}>边框色</div>
        <ColorInput value={value.borderColor} onChange={(c) => onChange({ ...value, borderColor: c })} />
      </div>
    </>
  );
}

function SearchEditor({
  value,
  onChange,
}: {
  value: SearchPanelStyle;
  onChange: (next: SearchPanelStyle) => void;
}) {
  const fields: Array<{ key: keyof Pick<SearchPanelStyle, "tableName" | "fieldName" | "tableComment" | "fieldComment" | "fieldType">; label: string }> = [
    { key: "tableName", label: "表名" },
    { key: "fieldName", label: "字段名" },
    { key: "tableComment", label: "表注释" },
    { key: "fieldComment", label: "字段注释" },
    { key: "fieldType", label: "字段类型" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Group title="文字样式">
        {fields.map((f) => (
          <TextStyleEditor
            key={f.key}
            label={f.label}
            value={value[f.key]}
            onChange={(t) => onChange({ ...value, [f.key]: t })}
          />
        ))}
      </Group>

      <Group title="主键标注（字段列表）">
        <PrimaryKeyBadgeStyleFields
          value={value.primaryKeyBadge}
          onChange={(pk) => onChange({ ...value, primaryKeyBadge: pk })}
        />
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          颜色项可填 #rrggbb 或 rgba(...)；点「清除」后该项沿用内置默认值。
        </div>
      </Group>

      <Group title="行高与注释换行">
        <div style={fieldRow}>
          <div style={fieldLabel}>表 item 高度</div>
          <NumberInput
            label="px (0=自动)"
            value={value.tableItemHeight}
            onChange={(n) => onChange({ ...value, tableItemHeight: n })}
            min={0}
            max={200}
          />
        </div>
        <div style={fieldRow}>
          <div style={fieldLabel}>字段 item 高度</div>
          <NumberInput
            label="px (0=自动)"
            value={value.fieldItemHeight}
            onChange={(n) => onChange({ ...value, fieldItemHeight: n })}
            min={0}
            max={200}
          />
        </div>
        <div style={fieldRow}>
          <div style={fieldLabel}>注释展示</div>
          <label style={inlineLbl}>
            <input
              type="checkbox"
              checked={value.commentWrap}
              onChange={(e) => onChange({ ...value, commentWrap: e.target.checked })}
            />
            换行展示（不截断）
          </label>
        </div>
      </Group>

      <TypeMappingEditor
        value={value.typeMappings}
        onChange={(m) => onChange({ ...value, typeMappings: m })}
      />
    </div>
  );
}

function TableCatalogEditor({
  value,
  onChange,
}: {
  value: TableCatalogPanelStyle;
  onChange: (next: TableCatalogPanelStyle) => void;
}) {
  const textFields: Array<{
    key: keyof Pick<
      TableCatalogPanelStyle,
      "tableName" | "fieldName" | "tableComment" | "fieldComment" | "fieldType"
    >;
    label: string;
  }> = [
    { key: "tableName", label: "表名" },
    { key: "fieldName", label: "字段名" },
    { key: "tableComment", label: "表注释" },
    { key: "fieldComment", label: "字段注释" },
    { key: "fieldType", label: "字段类型" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {textFields.map((f) => (
        <TextStyleEditor
          key={f.key}
          label={f.label}
          value={value[f.key]}
          onChange={(t) => onChange({ ...value, [f.key]: t })}
        />
      ))}

      <Group title="主键标注（查看表）">
        <PrimaryKeyBadgeStyleFields
          value={value.primaryKeyBadge}
          onChange={(pk) => onChange({ ...value, primaryKeyBadge: pk })}
        />
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          与搜索面板相同选项，仅作用于「查看表」右侧字段表格中的主键列。
        </div>
      </Group>

      <Group title="搜索命中字段名 · 行背景">
        <div style={{ ...fieldRow, alignItems: "center", flexWrap: "wrap" }}>
          <div style={fieldLabel}>高亮背景色</div>
          <ColorInput
            value={value.fieldSearchHighlightBg}
            onChange={(c) => onChange({ ...value, fieldSearchHighlightBg: c })}
          />
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          在「查看表」里左侧搜索时，若关键字命中某行的<strong>字段名</strong>，右侧字段表为该行的背景叠加此颜色。#rrggbb / rgba 均可；点「清除」则不高亮。
        </div>
      </Group>
    </div>
  );
}

function TypeMappingEditor({
  value,
  onChange,
}: {
  value: SearchPanelStyle["typeMappings"];
  onChange: (next: SearchPanelStyle["typeMappings"]) => void;
}) {
  const update = (i: number, patch: Partial<{ from: string; to: string }>) => {
    onChange(value.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  };
  const remove = (i: number) => onChange(value.filter((_, j) => j !== i));
  const add = () => onChange([...value, { from: "", to: "" }]);
  return (
    <Group title="字段类型映射（用于在搜索面板中展示更短的别名）">
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
        例：CHARACTER → C ；DECIMAL → D。映射不区分大小写，匹配时只看类型主名（去掉括号长度）。
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {value.map((m, i) => (
          <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              type="text"
              value={m.from}
              onChange={(e) => update(i, { from: e.target.value.toUpperCase() })}
              placeholder="原类型，如 CHARACTER"
              style={{ ...inputStyle, flex: 1 }}
            />
            <span style={{ color: "var(--text-muted)" }}>→</span>
            <input
              type="text"
              value={m.to}
              onChange={(e) => update(i, { to: e.target.value })}
              placeholder="显示，如 C"
              style={{ ...inputStyle, width: 100 }}
            />
            <button type="button" style={{ ...btnXs, padding: "4px 8px" }} onClick={() => remove(i)}>
              ×
            </button>
          </div>
        ))}
      </div>
      <button type="button" style={{ ...btnSm, marginTop: 8 }} onClick={add}>
        + 添加映射
      </button>
    </Group>
  );
}

function QuickInsertEditor({
  value,
  onChange,
}: {
  value: QuickInsertPanelStyle;
  onChange: (next: QuickInsertPanelStyle) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Group title="3 个输入框（仅一项可勾选『扩展吸收剩余宽度』）">
        <BoxStyleEditor
          label="键名 输入框"
          value={value.keyInput}
          onChange={(b) => onChange({ ...value, keyInput: b })}
          expandChecked={value.expandTarget === "key"}
          onExpand={() => onChange({ ...value, expandTarget: "key" })}
        />
        <BoxStyleEditor
          label="值 输入框"
          value={value.valueInput}
          onChange={(b) => onChange({ ...value, valueInput: b })}
          expandChecked={value.expandTarget === "value"}
          onExpand={() => onChange({ ...value, expandTarget: "value" })}
        />
        <BoxStyleEditor
          label="快捷键 展示框"
          value={value.shortcutInput}
          onChange={(b) => onChange({ ...value, shortcutInput: b })}
          expandChecked={value.expandTarget === "shortcut"}
          onExpand={() => onChange({ ...value, expandTarget: "shortcut" })}
        />
        <div style={{ ...fieldRow, marginTop: 4 }}>
          <div style={fieldLabel}>无扩展</div>
          <label style={inlineLbl}>
            <input
              type="radio"
              name="qi-expand"
              checked={value.expandTarget === "none"}
              onChange={() => onChange({ ...value, expandTarget: "none" })}
            />
            所有输入框使用各自固定宽度（不吸收剩余空间）
          </label>
        </div>
      </Group>
      <Group title="按钮（含文案）">
        <ButtonStyleEditor
          label="绑定 按钮"
          value={value.bindButton}
          onChange={(b) => onChange({ ...value, bindButton: b })}
        />
        <ButtonStyleEditor
          label="删除 按钮"
          value={value.deleteButton}
          onChange={(b) => onChange({ ...value, deleteButton: b })}
        />
        <ButtonStyleEditor
          label="添加一行 按钮"
          value={value.addButton}
          onChange={(b) => onChange({ ...value, addButton: b })}
        />
      </Group>
    </div>
  );
}

function SavedSqlEditor({
  value,
  onChange,
}: {
  value: SavedSqlPanelStyle;
  onChange: (next: SavedSqlPanelStyle) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Group title="行（item）背景">
        <div style={fieldRow}>
          <div style={fieldLabel}>背景色（默认）</div>
          <ColorInput
            value={value.rowBackground}
            onChange={(c) => onChange({ ...value, rowBackground: c })}
          />
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          每条记录可以右键单独覆盖颜色（保存在该记录上，便于区分不同主题/类别）。
        </div>
      </Group>
      <Group title="4 个框（仅一项可勾选『扩展吸收剩余宽度』）">
        <BoxStyleEditor
          label="名称 输入框"
          value={value.nameInput}
          onChange={(b) => onChange({ ...value, nameInput: b })}
          expandChecked={value.expandTarget === "name"}
          onExpand={() => onChange({ ...value, expandTarget: "name" })}
        />
        <ButtonStyleEditor
          label="展示 按钮"
          value={value.showButton}
          onChange={(b) => onChange({ ...value, showButton: b })}
          expandChecked={value.expandTarget === "show"}
          onExpand={() => onChange({ ...value, expandTarget: "show" })}
        />
        <ButtonStyleEditor
          label="使用 按钮"
          value={value.useButton}
          onChange={(b) => onChange({ ...value, useButton: b })}
          expandChecked={value.expandTarget === "use"}
          onExpand={() => onChange({ ...value, expandTarget: "use" })}
        />
        <ButtonStyleEditor
          label="删除 按钮"
          value={value.deleteButton}
          onChange={(b) => onChange({ ...value, deleteButton: b })}
          expandChecked={value.expandTarget === "delete"}
          onExpand={() => onChange({ ...value, expandTarget: "delete" })}
        />
        <div style={{ ...fieldRow, marginTop: 4 }}>
          <div style={fieldLabel}>无扩展</div>
          <label style={inlineLbl}>
            <input
              type="radio"
              name="ss-expand"
              checked={value.expandTarget === "none"}
              onChange={() => onChange({ ...value, expandTarget: "none" })}
            />
            所有框使用各自固定宽度
          </label>
        </div>
      </Group>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 8,
        background: "var(--bg-app)",
        padding: 10,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>
    </div>
  );
}

function TextStyleEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: PanelTextStyle;
  onChange: (next: PanelTextStyle) => void;
}) {
  return (
    <div style={fieldRow}>
      <div style={fieldLabel}>{label}</div>
      <NumberInput
        label="字号"
        value={value.fontSize}
        onChange={(n) => onChange({ ...value, fontSize: n })}
        min={6}
        max={48}
      />
      <ColorInput
        value={value.color}
        onChange={(c) => onChange({ ...value, color: c })}
      />
    </div>
  );
}

function BoxStyleEditor({
  label,
  value,
  onChange,
  expandChecked,
  onExpand,
}: {
  label: string;
  value: PanelBoxStyle;
  onChange: (next: PanelBoxStyle) => void;
  expandChecked?: boolean;
  onExpand?: () => void;
}) {
  return (
    <div style={{ ...fieldRow, flexWrap: "wrap" }}>
      <div style={fieldLabel}>{label}</div>
      <NumberInput
        label="字号"
        value={value.fontSize}
        onChange={(n) => onChange({ ...value, fontSize: n })}
        min={6}
        max={48}
      />
      <NumberInput
        label="宽(px,0=自动)"
        value={value.width}
        onChange={(n) => onChange({ ...value, width: n })}
        min={0}
        max={1200}
      />
      <NumberInput
        label="高(px,0=自动)"
        value={value.height}
        onChange={(n) => onChange({ ...value, height: n })}
        min={0}
        max={300}
      />
      <ColorInput value={value.color} onChange={(c) => onChange({ ...value, color: c })} />
      {onExpand ? (
        <label style={inlineLbl} title="只能勾选一个：勾选的框会吸收行内剩余空间">
          <input type="radio" checked={!!expandChecked} onChange={onExpand} />
          扩展
        </label>
      ) : null}
    </div>
  );
}

function ButtonStyleEditor({
  label,
  value,
  onChange,
  expandChecked,
  onExpand,
}: {
  label: string;
  value: PanelButtonStyle;
  onChange: (next: PanelButtonStyle) => void;
  expandChecked?: boolean;
  onExpand?: () => void;
}) {
  return (
    <div style={{ ...fieldRow, flexWrap: "wrap" }}>
      <div style={fieldLabel}>{label}</div>
      <input
        type="text"
        value={value.label}
        onChange={(e) => onChange({ ...value, label: e.target.value })}
        placeholder="按钮文案"
        style={{ ...inputStyle, width: 140 }}
      />
      <NumberInput
        label="字号"
        value={value.fontSize}
        onChange={(n) => onChange({ ...value, fontSize: n })}
        min={6}
        max={48}
      />
      <NumberInput
        label="宽(px,0=自动)"
        value={value.width}
        onChange={(n) => onChange({ ...value, width: n })}
        min={0}
        max={1200}
      />
      <NumberInput
        label="高(px,0=自动)"
        value={value.height}
        onChange={(n) => onChange({ ...value, height: n })}
        min={0}
        max={300}
      />
      <ColorInput value={value.color} onChange={(c) => onChange({ ...value, color: c })} />
      {onExpand ? (
        <label style={inlineLbl} title="勾选则该按钮在行内吸收剩余空间">
          <input type="radio" checked={!!expandChecked} onChange={onExpand} />
          扩展
        </label>
      ) : null}
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label style={inlineLbl}>
      {label}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(Number.isFinite(n) ? n : 0);
        }}
        style={{ ...inputStyle, width: 64 }}
      />
    </label>
  );
}

function ColorInput({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const safe = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#cccccc";
  return (
    <label style={inlineLbl}>
      颜色
      <input
        type="color"
        value={safe}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: 28, height: 24, border: "1px solid var(--border)", borderRadius: 4, padding: 0, background: "transparent" }}
        title={value || "（沿用主题）"}
      />
      <input
        type="text"
        value={value}
        placeholder="#rrggbb 或留空"
        onChange={(e) => onChange(e.target.value)}
        style={{ ...inputStyle, width: 90 }}
      />
      <button
        type="button"
        style={{ ...btnXs, padding: "2px 6px" }}
        onClick={() => onChange("")}
        title="清除颜色，沿用主题色"
      >
        清除
      </button>
    </label>
  );
}

/* ============================== Helpers ============================== */

export function styleFromText(t: PanelTextStyle): CSSProperties {
  const out: CSSProperties = { fontSize: t.fontSize };
  if (t.color) out.color = t.color;
  return out;
}
export function styleFromBox(b: PanelBoxStyle): CSSProperties {
  const out: CSSProperties = { fontSize: b.fontSize };
  if (b.color) out.color = b.color;
  if (b.width > 0) out.width = b.width;
  if (b.height > 0) out.height = b.height;
  return out;
}

/** 主键标注：解析空字符串为内置默认 */
export function pkBadgeResolved(b: SearchPanelPkBadgeStyle): {
  label: string;
  boxStyle: CSSProperties;
} {
  const label = b.label.trim() || "PK";
  const color = b.color.trim() || "#facc15";
  const backgroundColor = b.backgroundColor.trim() || "rgba(250,204,21,0.15)";
  const borderColor = b.borderColor.trim() || "rgba(250,204,21,0.4)";
  return {
    label,
    boxStyle: {
      fontSize: 9,
      fontWeight: 700,
      padding: "1px 4px",
      background: backgroundColor,
      color,
      border: `1px solid ${borderColor}`,
      borderRadius: 3,
    },
  };
}

/** 字段类型主名映射：取 "DECIMAL(8,0)" 中的 DECIMAL 做匹配；未命中返回原字符串 */
export function applyTypeMapping(
  raw: string,
  mappings: SearchPanelStyle["typeMappings"],
): string {
  if (!raw) return raw;
  const head = raw.split(/[(\s]/)[0]?.toUpperCase() ?? raw.toUpperCase();
  const hit = mappings.find((m) => m.from.toUpperCase() === head);
  if (!hit) return raw;
  // 保留括号部分（长度/精度）
  const tail = raw.slice(head.length);
  return `${hit.to}${tail}`;
}

/* ============================== Previews ============================== */

function SearchPreview({ style }: { style: SearchPanelStyle }) {
  const renderField = (f: string, t: string, c: string, pk: boolean) => {
    const tShort = applyTypeMapping(t, style.typeMappings);
    const pkRes = pk ? pkBadgeResolved(style.primaryKeyBadge) : null;
    return (
      <li
        key={f}
        style={{
          padding: "6px 12px 6px 24px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "baseline",
          gap: 6,
          minHeight: style.fieldItemHeight > 0 ? style.fieldItemHeight : undefined,
          height: style.fieldItemHeight > 0 ? style.fieldItemHeight : undefined,
        }}
      >
        {pkRes ? <span style={pkRes.boxStyle}>{pkRes.label}</span> : null}
        <code style={{ fontFamily: "var(--mono)", ...styleFromText(style.fieldName) }}>s.{f}</code>
        <span
          style={{
            fontFamily: "var(--mono)",
            padding: "0 4px",
            border: "1px solid var(--border)",
            borderRadius: 3,
            ...styleFromText(style.fieldType),
          }}
        >
          {tShort}
        </span>
        <span
          style={{
            ...styleFromText(style.fieldComment),
            whiteSpace: style.commentWrap ? "normal" : "nowrap",
            overflow: style.commentWrap ? "visible" : "hidden",
            textOverflow: style.commentWrap ? "clip" : "ellipsis",
            minWidth: 0,
          }}
        >
          {c}
        </span>
      </li>
    );
  };
  return (
    <div
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "8px 12px",
          background: "var(--bg-app)",
          borderBottom: "1px solid var(--border)",
          height: style.tableItemHeight > 0 ? style.tableItemHeight : undefined,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <code style={{ fontFamily: "var(--mono)", fontWeight: 700, ...styleFromText(style.tableName) }}>
          LIB.STUDENT
        </code>
        <span style={styleFromText(style.tableComment)}>· 学生信息表（一段较长的注释，演示是否换行展示）</span>
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {renderField("STUID", "CHARACTER(10)", "学生唯一编号", true)}
        {renderField("STUNM", "VARCHAR(40)", "学生姓名（含一段较长的描述用于检验换行）", false)}
        {renderField("BIRTHDT", "DECIMAL(8,0)", "生日 yyyymmdd", false)}
      </ul>
    </div>
  );
}

function TableCatalogPreview({ style }: { style: TableCatalogPanelStyle }) {
  const hitBg = style.fieldSearchHighlightBg.trim();
  const pk = pkBadgeResolved(style.primaryKeyBadge);
  const rows = [
    { f: "STUID", t: "CHAR(10)", c: "学生ID", nameHit: true, isPk: true },
    { f: "STUNM", t: "VARCHAR(40)", c: "学生姓名", nameHit: false, isPk: false },
  ];
  return (
    <div
      style={{
        background: "var(--bg-app)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: 12,
      }}
    >
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
        预览：假设搜索「STU」，字段名 STUID 命中 → 行背景如下；首行含主键标注
      </div>
      <div style={{ fontWeight: 700, ...styleFromText(style.tableName) }}>LIB.STUDENT</div>
      <div style={styleFromText(style.tableComment)}>学生信息表</div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
        <thead>
          <tr>
            <th style={th}>字段</th>
            <th style={th}>类型</th>
            <th style={th}>注释</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((x) => (
            <tr
              key={x.f}
              style={{
                borderTop: "1px solid var(--border)",
                ...(hitBg && x.nameHit ? { background: hitBg } : {}),
              }}
            >
              <td style={{ ...td, fontFamily: "var(--mono)", ...styleFromText(style.fieldName) }}>
                <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                  {x.isPk ? <span style={pk.boxStyle}>{pk.label}</span> : null}
                  <span>{x.f}</span>
                </span>
              </td>
              <td style={{ ...td, fontFamily: "var(--mono)", ...styleFromText(style.fieldType) }}>{x.t}</td>
              <td style={{ ...td, ...styleFromText(style.fieldComment) }}>{x.c}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QuickInsertPreview({ style }: { style: QuickInsertPanelStyle }) {
  const flexFor = (t: QuickInsertPanelStyle["expandTarget"], me: typeof t) => (t === me ? 1 : "0 0 auto");
  const wrap = (b: PanelBoxStyle, me: QuickInsertPanelStyle["expandTarget"]) => {
    const base = styleFromBox(b);
    const f = flexFor(style.expandTarget, me);
    return { ...base, flex: f as any };
  };
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        background: "var(--bg-app)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: 10,
      }}
    >
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <input style={{ ...inpPrev, ...wrap(style.keyInput, "key") }} placeholder="键名" defaultValue="学号" />
        <input style={{ ...inpPrev, ...wrap(style.valueInput, "value") }} placeholder="值" defaultValue="001" />
        <input
          style={{ ...inpPrev, ...wrap(style.shortcutInput, "shortcut") }}
          readOnly
          defaultValue="Ctrl+Shift+1"
        />
        <button style={{ ...btnPrev, ...styleFromBox(style.bindButton) }}>{style.bindButton.label}</button>
        <button style={{ ...btnPrev, ...styleFromBox(style.deleteButton) }}>{style.deleteButton.label}</button>
      </div>
      <button style={{ ...btnPrev, alignSelf: "flex-start", ...styleFromBox(style.addButton) }}>
        {style.addButton.label}
      </button>
    </div>
  );
}

function SavedSqlPreview({ style }: { style: SavedSqlPanelStyle }) {
  const flexFor = (t: SavedSqlPanelStyle["expandTarget"], me: typeof t) => (t === me ? 1 : "0 0 auto");
  const wrap = (b: PanelBoxStyle, me: SavedSqlPanelStyle["expandTarget"]) => {
    const base = styleFromBox(b);
    const f = flexFor(style.expandTarget, me);
    return { ...base, flex: f as any };
  };
  const rowBg = style.rowBackground || "var(--bg-elevated)";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        background: "var(--bg-app)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: 10,
      }}
    >
      {[1, 2].map((i) => (
        <div
          key={i}
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            background: rowBg,
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: 8,
            flexWrap: "wrap",
          }}
        >
          <span style={{ color: "var(--text-muted)", fontSize: 12, cursor: "grab" }} title="拖动排序">⠿</span>
          <input
            style={{ ...inpPrev, ...wrap(style.nameInput, "name") }}
            placeholder="名称"
            defaultValue={`存档 ${i}`}
          />
          <button style={{ ...btnPrev, ...wrap(style.showButton, "show") }}>{style.showButton.label}</button>
          <button style={{ ...btnPrev, ...wrap(style.useButton, "use") }}>{style.useButton.label}</button>
          <button style={{ ...btnPrev, ...wrap(style.deleteButton, "delete") }}>{style.deleteButton.label}</button>
        </div>
      ))}
    </div>
  );
}

/* ============================== Styles ============================== */

const backdrop: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "var(--modal-backdrop)",
  padding: 16,
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
const modal: CSSProperties = {
  width: "min(1180px, 100%)",
  height: "min(760px, 100%)",
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: 14,
  boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};
const head: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 14px",
  borderBottom: "1px solid var(--border)",
  flexWrap: "wrap",
};
const body: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: "grid",
  gridTemplateColumns: "minmax(420px, 540px) 1fr",
};
const editorPane: CSSProperties = {
  padding: 14,
  borderRight: "1px solid var(--border)",
  overflow: "auto",
  background: "var(--bg-panel)",
};
const previewPane: CSSProperties = {
  padding: 14,
  overflow: "auto",
  background: "var(--bg-app)",
};
const previewBox: CSSProperties = {
  padding: 10,
};
const fieldRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};
const fieldLabel: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text)",
  minWidth: 110,
};
const inlineLbl: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  fontSize: 11,
  color: "var(--text-muted)",
};
const inputStyle: CSSProperties = {
  padding: "4px 6px",
  fontSize: 11,
  color: "var(--text)",
  background: "var(--bg-app)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  outline: "none",
};
const btnSm: CSSProperties = {
  padding: "6px 10px",
  fontSize: 11,
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--bg-app)",
  color: "var(--text)",
  cursor: "pointer",
};
const btnXs: CSSProperties = {
  ...btnSm,
  padding: "2px 6px",
  fontSize: 10,
};
const primaryBtn: CSSProperties = {
  ...btnSm,
  borderColor: "var(--accent)",
  background: "var(--accent-dim)",
  color: "var(--btn-primary-fg)",
  fontWeight: 600,
};
const th: CSSProperties = {
  padding: "4px 8px",
  fontSize: 11,
  textAlign: "left",
  color: "var(--text-muted)",
  fontWeight: 600,
  borderBottom: "1px solid var(--border)",
};
const td: CSSProperties = { padding: "4px 8px", verticalAlign: "top" };
const inpPrev: CSSProperties = {
  minWidth: 0,
  padding: "6px 8px",
  color: "var(--text)",
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  outline: "none",
};
const btnPrev: CSSProperties = {
  padding: "6px 8px",
  border: "1px solid var(--border)",
  borderRadius: 6,
  background: "var(--bg-elevated)",
  color: "var(--text)",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

/** 帮助：把样式应用到任意宿主组件（导出供别处用） */
export const panelStyleHelpers = { styleFromText, styleFromBox };

