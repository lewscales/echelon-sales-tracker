"use client";

import { useEffect, useRef, useState } from "react";
import { CURRENCY } from "@/lib/config";
import { PRESETS, type DateRange, type Preset } from "@/lib/dates";

// ─────────────────────────────── Formatting ───────────────────────────────

const money0 = new Intl.NumberFormat("en-US", { style: "currency", currency: CURRENCY, maximumFractionDigits: 0 });
const money2 = new Intl.NumberFormat("en-US", { style: "currency", currency: CURRENCY, minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moneyCompact = new Intl.NumberFormat("en-US", { style: "currency", currency: CURRENCY, notation: "compact", maximumFractionDigits: 1 });

/** "$", "£" … for input prefixes. */
export const CURRENCY_SYMBOL = money0.formatToParts(0).find((p) => p.type === "currency")?.value ?? "";

/** "–" for a value that can't be computed (e.g. a rate with nothing to divide by). */
export const DASH = "–";

export function fmtMoney(n: number | null | undefined, cents = false): string {
  if (n == null) return DASH;
  return (cents ? money2 : money0).format(n);
}
export function fmtMoneyShort(n: number): string {
  return Math.abs(n) >= 10_000 ? moneyCompact.format(n) : money0.format(n);
}
export function fmtPct(n: number | null | undefined): string {
  if (n == null) return DASH;
  const p = n * 100;
  return `${p.toFixed(Number.isInteger(Math.round(p * 10) / 10) ? 0 : 1)}%`;
}
export function fmtNum(n: number | null | undefined, decimals = 0): string {
  if (n == null) return DASH;
  return n.toLocaleString("en-GB", { maximumFractionDigits: decimals });
}

// ─────────────────────────────── Brand mark ───────────────────────────────

/** Three rising bars in a rounded frame: currentColor, so it tints anywhere. */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} fill="none" aria-hidden>
      <rect x="10" y="10" width="80" height="80" rx="22" fill="currentColor" opacity="0.14" />
      <rect x="10" y="10" width="80" height="80" rx="22" stroke="currentColor" strokeWidth="6" />
      <rect x="28" y="54" width="11" height="20" rx="4" fill="currentColor" />
      <rect x="44.5" y="42" width="11" height="32" rx="4" fill="currentColor" />
      <rect x="61" y="28" width="11" height="46" rx="4" fill="currentColor" />
    </svg>
  );
}

// ─────────────────────────────── Layout pieces ───────────────────────────────

export function Section({
  id,
  title,
  blurb,
  filters,
  children,
}: {
  id?: string;
  title: string;
  blurb?: string;
  filters?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="surface lit p-4 sm:p-6 scroll-mt-28">
      <div className="mb-4">
        <h2 className="display text-2xl sm:text-[28px] font-extrabold tracking-tight">{title}</h2>
        {blurb && <p className="text-muted text-sm mt-1">{blurb}</p>}
      </div>
      {filters && <div className="flex flex-wrap gap-2 mb-5">{filters}</div>}
      <div className="space-y-5">{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone,
  big = false,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "money" | "good" | "bad";
  big?: boolean;
}) {
  const color = tone === "money" ? "text-gold" : tone === "good" ? "text-mint" : tone === "bad" ? "text-danger" : "text-ink";
  return (
    <div className="sunken px-4 py-3.5 min-w-0">
      <div className="eyebrow truncate" title={label}>{label}</div>
      <div className={`num font-bold mt-2 ${big ? "text-3xl sm:text-4xl" : "text-xl sm:text-2xl"} ${color} truncate`}>{value}</div>
      {sub && <div className="text-faint text-xs mt-1 truncate">{sub}</div>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="sunken grid place-items-center text-center text-faint text-sm px-6 py-10">{children}</div>;
}

export function Pill({ children, tone = "plain" }: { children: React.ReactNode; tone?: "plain" | "good" | "bad" | "warn" | "brand" }) {
  const cls = {
    plain: "bg-white/[0.06] text-muted",
    good: "bg-mint/15 text-mint",
    bad: "bg-danger/15 text-danger",
    warn: "bg-gold/15 text-gold",
    brand: "bg-brand/15 text-cyan",
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${cls}`}>{children}</span>;
}

export function Stars({ value, max = 5 }: { value: number; max?: number }) {
  if (max > 5) {
    const n = Math.round(value);
    const tone = n >= 8 ? "text-mint" : n >= 5 ? "text-gold" : "text-danger";
    return (
      <span className={`num font-semibold whitespace-nowrap ${tone}`} aria-label={`${n} out of ${max}`}>
        {n}
        <span className="text-faint font-normal">/{max}</span>
      </span>
    );
  }
  const n = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span className="whitespace-nowrap tracking-[0.05em]" aria-label={`${n} out of 5`}>
      <span className="text-gold">{"★".repeat(n)}</span>
      <span className="text-line2">{"★".repeat(5 - n)}</span>
    </span>
  );
}

// ─────────────────────────────── Filters ───────────────────────────────

function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

const chip =
  "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[13px] font-semibold transition-colors whitespace-nowrap";
const chipOff = "border-white/[0.08] bg-white/[0.03] text-muted hover:bg-white/[0.07] hover:text-ink";
const chipOn = "border-brand/50 bg-brand/15 text-ink";

function Caret() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="opacity-60">
      <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export type Option = { value: string; label: string };

/** A filter chip that opens a checklist. Nothing ticked = no filter. */
export function MultiFilter({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [shift, setShift] = useState(0);
  const ref = useOutside(open, () => setOpen(false));
  const active = value.length > 0;
  const summary =
    value.length === 1 ? options.find((o) => o.value === value[0])?.label ?? label : value.length > 1 ? `${label} · ${value.length}` : label;
  return (
    <div className="relative" ref={ref}>
      <button type="button" className={`${chip} ${active ? chipOn : chipOff}`} onClick={(e) => {
          // Nudge the menu left just enough to stay on screen (phones).
          const left = e.currentTarget.getBoundingClientRect().left;
          setShift(Math.max(16 - left, Math.min(0, window.innerWidth - 16 - (left + Math.min(240, window.innerWidth - 32)))));
          setOpen((o) => !o);
        }}
        aria-expanded={open}
      >
        <span className="max-w-[160px] truncate">{summary}</span>
        <Caret />
      </button>
      {open && (
        <div className={`absolute top-full mt-2 z-40 w-60 max-w-[calc(100vw-2rem)] left-0 rounded-2xl border border-white/10 bg-elevated p-1.5 shadow-2xl`} style={{ left: shift }}>
          {options.length === 0 && <div className="px-3 py-2 text-sm text-faint">Nothing to filter yet</div>}
          <div className="max-h-72 overflow-y-auto">
            {options.map((o) => {
              const on = value.includes(o.value);
              return (
                <label key={o.value} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm cursor-pointer hover:bg-white/[0.06]">
                  <input
                    type="checkbox"
                    className="accent-[var(--accent)] w-4 h-4"
                    checked={on}
                    onChange={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
                  />
                  <span className="truncate">{o.label}</span>
                </label>
              );
            })}
          </div>
          {active && (
            <button type="button" className="w-full mt-1 rounded-xl px-3 py-2 text-left text-sm text-muted hover:bg-white/[0.06]" onClick={() => onChange([])}>
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function DateFilter({ label, value, onChange }: { label: string; value: DateRange; onChange: (v: DateRange) => void }) {
  const [open, setOpen] = useState(false);
  const [shift, setShift] = useState(0);
  const ref = useOutside(open, () => setOpen(false));
  const active = value.preset !== "all";
  const summary =
    value.preset === "custom"
      ? `${value.from || "…"} → ${value.to || "…"}`
      : value.preset === "all"
        ? label
        : PRESETS[value.preset];
  return (
    <div className="relative" ref={ref}>
      <button type="button" className={`${chip} ${active ? chipOn : chipOff}`} onClick={(e) => {
          // Nudge the menu left just enough to stay on screen (phones).
          const left = e.currentTarget.getBoundingClientRect().left;
          setShift(Math.max(16 - left, Math.min(0, window.innerWidth - 16 - (left + Math.min(256, window.innerWidth - 32)))));
          setOpen((o) => !o);
        }}
        aria-expanded={open}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden className="opacity-70">
          <rect x="2" y="3" width="12" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span>{summary}</span>
        <Caret />
      </button>
      {open && (
        <div className={`absolute top-full mt-2 z-40 w-64 max-w-[calc(100vw-2rem)] left-0 rounded-2xl border border-white/10 bg-elevated p-1.5 shadow-2xl`} style={{ left: shift }}>
          <div className="px-3 pt-1.5 pb-1 eyebrow">{label}</div>
          {(Object.keys(PRESETS) as Preset[])
            .filter((p) => p !== "custom")
            .map((p) => (
              <button
                key={p}
                type="button"
                className={`w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-white/[0.06] ${value.preset === p ? "text-cyan font-semibold" : ""}`}
                onClick={() => {
                  onChange({ preset: p });
                  setOpen(false);
                }}
              >
                {PRESETS[p]}
              </button>
            ))}
          <div className="border-t hair mt-1 pt-2 px-2 pb-1.5 space-y-1.5">
            <div className="eyebrow px-1">Custom range</div>
            <div className="grid grid-cols-2 gap-1.5">
              <input
                type="date"
                className="input !px-2 !py-1.5 !text-xs !rounded-xl"
                value={value.preset === "custom" ? value.from ?? "" : ""}
                onChange={(e) => onChange({ preset: "custom", from: e.target.value, to: value.preset === "custom" ? value.to : undefined })}
                aria-label="From"
              />
              <input
                type="date"
                className="input !px-2 !py-1.5 !text-xs !rounded-xl"
                value={value.preset === "custom" ? value.to ?? "" : ""}
                onChange={(e) => onChange({ preset: "custom", to: e.target.value, from: value.preset === "custom" ? value.from : undefined })}
                aria-label="To"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────── Table ───────────────────────────────

export type Column<T> = {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
  align?: "left" | "right";
  /** Extra classes on the cell (e.g. a max width). */
  className?: string;
};

export function Table<T>({
  rows,
  columns,
  rowKey,
  empty,
  noun = "rows",
  onRowClick,
  maxHeight = 520,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (r: T) => string;
  empty: string;
  noun?: string;
  onRowClick?: (r: T) => void;
  maxHeight?: number;
}) {
  if (rows.length === 0) return <Empty>{empty}</Empty>;
  return (
    <div className="sunken overflow-hidden">
      <div className="overflow-auto" style={{ maxHeight }}>
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10 bg-[#101318]">
            <tr>
              <th className="w-10 px-3 py-2.5 text-left eyebrow !text-[9.5px]">#</th>
              {columns.map((c) => (
                <th key={c.key} className={`px-3 py-2.5 eyebrow !text-[9.5px] whitespace-nowrap ${c.align === "right" ? "text-right" : "text-left"}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={rowKey(r)}
                className={`border-t hair ${onRowClick ? "cursor-pointer hover:bg-white/[0.035]" : ""}`}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
              >
                <td className="px-3 py-2.5 text-faint num text-xs">{i + 1}</td>
                {columns.map((c) => (
                  <td key={c.key} className={`px-3 py-2.5 align-top ${c.align === "right" ? "text-right num" : ""} ${c.className ?? "whitespace-nowrap"}`}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t hair px-4 py-2 text-xs text-faint">
        {rows.length.toLocaleString()} {noun}
      </div>
    </div>
  );
}

// ─────────────────────────────── Modal + toast ───────────────────────────────

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/60 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`surface w-full ${wide ? "max-w-3xl" : "max-w-lg"} max-h-[88vh] flex flex-col`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b hair">
          <h3 className="display text-lg font-bold">{title}</h3>
          <button className="btn-ghost !px-3 !py-1.5" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function Toast({ text, onDone }: { text: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] rounded-2xl bg-elevated border border-white/10 px-5 py-3 text-sm font-semibold shadow-2xl flex items-center gap-2" role="status">
      <span className="w-2 h-2 rounded-full bg-mint" />
      {text}
    </div>
  );
}

/** POST/PATCH/DELETE helper: returns the JSON body or throws the server's message. */
export async function api<T = unknown>(url: string, method: string, payload?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: payload !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: payload !== undefined ? JSON.stringify(payload) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error || "Something went wrong. Try again.");
  return json as T;
}
