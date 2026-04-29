import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

export type SearchOption = {
  value: string;
  label: string;
  subLabel?: string;
  /** extra text for searching (e.g. comments) */
  searchText?: string;
};

type Props = {
  value: string;
  options: SearchOption[];
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
};

export function SearchableSelect({
  value,
  options,
  placeholder = "选择…",
  disabled = false,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQ("");
    const onDoc = (e: PointerEvent) => {
      const el = e.target as Element | null;
      if (el && rootRef.current?.contains(el)) return;
      setOpen(false);
    };
    window.addEventListener("pointerdown", onDoc, true);
    return () => window.removeEventListener("pointerdown", onDoc, true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((o) => {
      const s = `${o.label} ${o.value} ${o.subLabel ?? ""} ${o.searchText ?? ""}`.toLowerCase();
      return s.includes(needle);
    });
  }, [options, q]);

  return (
    <div ref={rootRef} style={{ position: "relative", minWidth: 0 }}>
      <button
        type="button"
        disabled={disabled}
        style={{ ...btn, opacity: disabled ? 0.6 : 1 }}
        onClick={() => setOpen((v) => !v)}
      >
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ fontSize: 12, fontWeight: 650, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {selected ? selected.label : placeholder}
          </div>
          {selected?.subLabel ? (
            <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {selected.subLabel}
            </div>
          ) : null}
        </div>
        <div style={{ color: "var(--text-muted)", fontSize: 12, flexShrink: 0 }}>
          {open ? "▲" : "▼"}
        </div>
      </button>

      {open ? (
        <div style={popover} role="listbox">
          <div style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>
            <input
              ref={inputRef}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索…"
              style={searchInp}
            />
          </div>
          <div style={{ maxHeight: 260, overflow: "auto" }}>
            {filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                style={item}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: "var(--text)", fontWeight: 650 }}>
                    {o.label}
                  </div>
                  {o.subLabel ? (
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      {o.subLabel}
                    </div>
                  ) : null}
                </div>
              </button>
            ))}
            {filtered.length === 0 ? (
              <div style={{ padding: 10, fontSize: 11, color: "var(--text-muted)" }}>
                没有匹配项。
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const btn: CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg-app)",
  color: "var(--text)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  textAlign: "left",
};

const popover: CSSProperties = {
  position: "absolute",
  zIndex: 6000,
  top: "calc(100% + 6px)",
  left: 0,
  right: 0,
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--bg-elevated)",
  boxShadow: "0 14px 50px rgba(0,0,0,0.35)",
  overflow: "hidden",
};

const searchInp: CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg-app)",
  color: "var(--text)",
  fontSize: 12,
  outline: "none",
};

const item: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "none",
  borderBottom: "1px solid var(--border)",
  background: "transparent",
  cursor: "pointer",
  textAlign: "left",
};

