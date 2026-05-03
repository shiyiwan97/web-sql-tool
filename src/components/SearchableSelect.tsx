import { createPortal } from "react-dom";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

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

const POPOVER_Z = 20000;
const GAP = 6;

function pointerEventInsideRoots(e: PointerEvent, roots: Array<HTMLElement | null>): boolean {
  const clean = roots.filter((x): x is HTMLElement => x != null);
  if (clean.length === 0) return false;
  const path =
    typeof e.composedPath === "function"
      ? e.composedPath()
      : e.target instanceof Node
        ? [e.target]
        : [];
  if (path.length > 0) {
    return path.some((n) => n instanceof Node && clean.some((r) => r.contains(n)));
  }
  const t = e.target;
  return t instanceof Node && clean.some((r) => r.contains(t));
}

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
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [portalPos, setPortalPos] = useState({
    top: 0,
    left: 0,
    width: 0,
    listMaxHeight: 260,
  });

  const reposition = () => {
    const wrap = rootRef.current;
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    const pad = 8;
    const belowTop = r.bottom + GAP;
    const spaceBelow = window.innerHeight - belowTop - pad;
    const listMaxHeight = Math.min(260, Math.max(80, spaceBelow));
    const width = Math.min(r.width, window.innerWidth - pad * 2);
    const left = Math.max(pad, Math.min(r.left, window.innerWidth - width - pad));
    setPortalPos({ top: belowTop, left, width, listMaxHeight });
  };

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (!open) return;
    setQ("");
    /** 冒泡阶段：先让选项收到 pointerdown/click，再判断是否点在体外关闭（捕获阶段会误杀选项点击） */
    const onDoc = (e: PointerEvent) => {
      if (pointerEventInsideRoots(e, [rootRef.current, popoverRef.current])) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onDoc, false);
    return () => document.removeEventListener("pointerdown", onDoc, false);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
  }, [open, options.length, q]);

  useEffect(() => {
    if (!open) return;
    const onScrollResize = () => reposition();
    window.addEventListener("scroll", onScrollResize, true);
    window.addEventListener("resize", onScrollResize);
    return () => {
      window.removeEventListener("scroll", onScrollResize, true);
      window.removeEventListener("resize", onScrollResize);
    };
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

  const popoverEl =
    open &&
    createPortal(
      <div
        ref={popoverRef}
        role="listbox"
        style={{
          position: "fixed",
          zIndex: POPOVER_Z,
          top: portalPos.top,
          left: portalPos.left,
          width: portalPos.width,
          borderRadius: 10,
          border: "1px solid var(--border)",
          background: "var(--bg-elevated)",
          boxShadow: "0 14px 50px rgba(0,0,0,0.35)",
          overflow: "hidden",
        }}
      >
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
        <div style={{ maxHeight: portalPos.listMaxHeight, overflow: "auto" }}>
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
            <div style={{ padding: 10, fontSize: 11, color: "var(--text-muted)" }}>没有匹配项。</div>
          ) : null}
        </div>
      </div>,
      document.body,
    );

  return (
    <div ref={rootRef} style={{ position: "relative", minWidth: 0 }}>
      <button
        type="button"
        disabled={disabled}
        style={{ ...btn, opacity: disabled ? 0.6 : 1 }}
        onClick={() => setOpen((v) => !v)}
      >
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 650,
              color: "var(--text)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {selected ? selected.label : placeholder}
          </div>
          {selected?.subLabel ? (
            <div
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {selected.subLabel}
            </div>
          ) : null}
        </div>
        <div style={{ color: "var(--text-muted)", fontSize: 12, flexShrink: 0 }}>
          {open ? "▲" : "▼"}
        </div>
      </button>
      {popoverEl}
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
