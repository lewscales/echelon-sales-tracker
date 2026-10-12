"use client";

import { useEffect, useRef, useState } from "react";
import { fmtDay, fmtDayLong } from "@/lib/dates";

// Categorical slots, dark mode — validated against the panel surface (#14171E):
// every adjacent pair clears CVD ΔE 8 and normal-vision ΔE 15, all ≥ 3:1.
// Entities get a slot by a stable order (never by rank), and anything past the
// sixth folds into a grey "Other".
export const SERIES = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#9085e9"];
export const OTHER = "#6b7280";
const ACCENT = "var(--accent-light)";
const GRID = "rgba(255,255,255,0.06)";
const AXIS_TEXT = "#606775";

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** A round-number ceiling for the y axis so gridlines land on clean values. */
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * exp >= v) return m * exp;
  return 10 * exp;
}

type Point = { day: string; value: number };

function Tooltip({ x, width, title, value }: { x: number; width: number; title: string; value: string }) {
  const left = Math.min(Math.max(x, 70), width - 70);
  return (
    <div
      className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-xl border border-white/10 bg-elevated px-3 py-2 shadow-xl text-center z-10"
      style={{ left }}
    >
      <div className="text-[11px] text-muted whitespace-nowrap">{title}</div>
      <div className="num text-sm font-bold whitespace-nowrap">{value}</div>
    </div>
  );
}

function xLabelEvery(n: number, width: number) {
  const fit = Math.max(2, Math.floor(width / 64));
  return Math.max(1, Math.ceil(n / fit));
}

const PAD = { top: 44, right: 12, bottom: 26, left: 52 };

/** Line + soft area over time, crosshair tooltip. One series, so no legend. */
export function LineChart({
  data,
  format,
  formatAxis,
  height = 260,
  weekly = false,
  label,
}: {
  data: Point[];
  format: (n: number) => string;
  formatAxis?: (n: number) => string;
  height?: number;
  weekly?: boolean;
  label: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const n = data.length;
  const iw = Math.max(0, width - PAD.left - PAD.right);
  const ih = height - PAD.top - PAD.bottom;
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const x = (i: number) => PAD.left + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => PAD.top + ih - (v / max) * ih;
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.value)}`).join(" ");
  const area = n ? `${line} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z` : "";
  const every = xLabelEvery(n, iw);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);

  function onMove(e: React.MouseEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = n <= 1 ? 0 : Math.round((px / rect.width) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  }

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && n > 0 && (
        <svg width={width} height={height} role="img" aria-label={label}>
          <defs>
            <linearGradient id="lc-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgb(var(--accent-light-rgb))" stopOpacity="0.22" />
              <stop offset="100%" stopColor="rgb(var(--accent-light-rgb))" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={GRID} />
              <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize="10.5" fill={AXIS_TEXT} className="num">
                {(formatAxis ?? format)(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) =>
            i % every === 0 ? (
              <text key={d.day} x={x(i)} y={height - 8} textAnchor="middle" fontSize="10.5" fill={AXIS_TEXT}>
                {fmtDay(d.day)}
              </text>
            ) : null
          )}
          <path d={area} fill="url(#lc-fill)" />
          <path d={line} fill="none" stroke={ACCENT} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {hover != null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top - 4} y2={PAD.top + ih} stroke="rgba(255,255,255,0.18)" strokeDasharray="3 3" />
              <circle cx={x(hover)} cy={y(data[hover].value)} r={5} fill={ACCENT} stroke="#14171E" strokeWidth={2} />
            </g>
          )}
          <rect
            x={PAD.left}
            y={0}
            width={iw}
            height={height}
            fill="transparent"
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
          />
        </svg>
      )}
      {hover != null && data[hover] && (
        <Tooltip
          x={x(hover)}
          width={width}
          title={weekly ? `Week of ${fmtDayLong(data[hover].day)}` : fmtDayLong(data[hover].day)}
          value={format(data[hover].value)}
        />
      )}
    </div>
  );
}

/** Daily columns with a per-bar tooltip. */
export function BarChart({
  data,
  format,
  formatAxis,
  height = 200,
  weekly = false,
  label,
}: {
  data: Point[];
  format: (n: number) => string;
  formatAxis?: (n: number) => string;
  height?: number;
  weekly?: boolean;
  label: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { ...PAD, left: formatAxis ? 52 : 36 };
  const n = data.length;
  const iw = Math.max(0, width - pad.left - pad.right);
  const ih = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const slot = n ? iw / n : 0;
  const gap = Math.min(6, slot * 0.25);
  const bw = Math.max(1, slot - gap);
  const y = (v: number) => pad.top + ih - (v / max) * ih;
  const every = xLabelEvery(n, iw);
  const ticks = [0, 0.5, 1].map((t) => t * max);

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && n > 0 && (
        <svg width={width} height={height} role="img" aria-label={label}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke={GRID} />
              <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" fontSize="10.5" fill={AXIS_TEXT} className="num">
                {(formatAxis ?? format)(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const bx = pad.left + i * slot + gap / 2;
            const h = Math.max(0, y(0) - y(d.value));
            const r = Math.min(4, bw / 2, h);
            const top = y(0) - h;
            // Rounded data-end, square at the baseline.
            const path =
              h <= 0
                ? ""
                : `M${bx},${y(0)} V${top + r} Q${bx},${top} ${bx + r},${top} H${bx + bw - r} Q${bx + bw},${top} ${bx + bw},${top + r} V${y(0)} Z`;
            return (
              <g key={d.day}>
                <path d={path} fill={ACCENT} opacity={hover == null || hover === i ? 1 : 0.45} />
                {i % every === 0 && (
                  <text x={bx + bw / 2} y={height - 8} textAnchor="middle" fontSize="10.5" fill={AXIS_TEXT}>
                    {fmtDay(d.day)}
                  </text>
                )}
                {/* Hit target: the whole column, not just the bar. */}
                <rect
                  x={pad.left + i * slot}
                  y={pad.top}
                  width={slot}
                  height={ih}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                />
              </g>
            );
          })}
        </svg>
      )}
      {hover != null && data[hover] && (
        <Tooltip
          x={pad.left + hover * slot + slot / 2}
          width={width}
          title={weekly ? `Week of ${fmtDayLong(data[hover].day)}` : fmtDayLong(data[hover].day)}
          value={format(data[hover].value)}
        />
      )}
    </div>
  );
}

export type Slice = { key: string; label: string; value: number; color: string };

/** Share of a whole. Legend is always on (label, count, %), so colour never carries identity alone. */
export function Donut({ data, label, noun }: { data: Slice[]; label: string; noun: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  const size = 180;
  const r = 78;
  const inner = 50;
  const c = size / 2;
  let angle = -Math.PI / 2;
  const arcs = data
    .filter((d) => d.value > 0)
    .map((d) => {
      const sweep = (d.value / total) * Math.PI * 2;
      const a0 = angle;
      const a1 = angle + sweep;
      angle = a1;
      const full = sweep >= Math.PI * 2 - 1e-6;
      const large = sweep > Math.PI ? 1 : 0;
      const p = (rad: number, a: number) => `${c + rad * Math.cos(a)},${c + rad * Math.sin(a)}`;
      const path = full
        ? `M${c - r},${c} a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 ${-2 * r},0 M${c - inner},${c} a${inner},${inner} 0 1,1 ${2 * inner},0 a${inner},${inner} 0 1,1 ${-2 * inner},0`
        : `M${p(r, a0)} A${r},${r} 0 ${large} 1 ${p(r, a1)} L${p(inner, a1)} A${inner},${inner} 0 ${large} 0 ${p(inner, a0)} Z`;
      return { ...d, path };
    });
  const focus = hover ? data.find((d) => d.key === hover) : null;

  if (total === 0) {
    return <div className="sunken grid place-items-center text-faint text-sm h-[180px]">No calls in this view</div>;
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} role="img" aria-label={label}>
          {arcs.map((a) => (
            <path
              key={a.key}
              d={a.path}
              fill={a.color}
              fillRule="evenodd"
              stroke="#14171E"
              strokeWidth={2}
              opacity={hover == null || hover === a.key ? 1 : 0.35}
              onMouseEnter={() => setHover(a.key)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="num text-2xl font-bold">{focus ? focus.value : total}</div>
            <div className="text-[11px] text-faint max-w-[84px] truncate">{focus ? focus.label : noun}</div>
          </div>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-1">
        {data.map((d) => (
          <li
            key={d.key}
            className={`flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-sm transition-colors ${hover === d.key ? "bg-white/[0.06]" : ""}`}
            onMouseEnter={() => setHover(d.key)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: d.color }} />
            <span className="truncate text-ink">{d.label}</span>
            <span className="ml-auto num text-muted">{d.value}</span>
            <span className="num text-faint w-12 text-right">{Math.round((d.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Turn counts into slices with colour fixed by the entity's place in `order`
 * (so filtering never repaints a survivor). Only the first six entities in the
 * order get a colour; everything else folds into one grey "Other" slice.
 */
export function toSlices(counts: { key: string; value: number }[], order: string[], labelOf: (k: string) => string): Slice[] {
  const slot = (k: string) => order.indexOf(k);
  const named = counts
    .filter((c) => slot(c.key) >= 0 && slot(c.key) < SERIES.length)
    .sort((a, b) => slot(a.key) - slot(b.key))
    .map((c) => ({ key: c.key, label: labelOf(c.key), value: c.value, color: SERIES[slot(c.key)] }));
  const rest = counts.filter((c) => !(slot(c.key) >= 0 && slot(c.key) < SERIES.length)).reduce((s, c) => s + c.value, 0);
  return rest > 0 ? [...named, { key: "__other", label: "Other", value: rest, color: OTHER }] : named;
}

/**
 * A stable colour order for open-ended values like lead sources: the
 * configured ones first, then the rest by how often they occur across ALL
 * data (not the filtered view), so a source keeps its colour under any filter.
 */
export function stableOrder(fixed: string[], all: (string | null | undefined)[]): string[] {
  const freq = new Map<string, number>();
  for (const v of all) if (v) freq.set(v, (freq.get(v) ?? 0) + 1);
  const known = fixed.filter((v) => freq.has(v));
  const extra = [...freq.keys()].filter((v) => !fixed.includes(v)).sort((a, b) => freq.get(b)! - freq.get(a)!);
  return [...known, ...extra];
}
