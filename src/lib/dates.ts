// Calendar-day maths in the business's timezone. Every rollup keys on a
// YYYY-MM-DD string for the UK day, so "today" means today in London no matter
// where the server or the viewer is.

import { TIMEZONE } from "./config";

const dayFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The UK calendar day (YYYY-MM-DD) a moment falls on. */
export function dayOf(d: Date | string): string {
  return dayFmt.format(typeof d === "string" ? new Date(d) : d);
}

export function today(): string {
  return dayOf(new Date());
}

/** Pure calendar arithmetic on a YYYY-MM-DD string (no timezone involved). */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** 0 = Monday … 6 = Sunday */
function weekdayMon0(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export const PRESETS = {
  today: "Today",
  yesterday: "Yesterday",
  week: "This week",
  last7: "Last 7 days",
  month: "This month",
  last30: "Last 30 days",
  all: "All time",
  custom: "Custom",
} as const;
export type Preset = keyof typeof PRESETS;

export type DateRange = { preset: Preset; from?: string; to?: string };

/** Resolve a range to inclusive [from, to] day strings (undefined = open). */
export function resolveRange(r: DateRange, now = today()): { from?: string; to?: string } {
  switch (r.preset) {
    case "today":
      return { from: now, to: now };
    case "yesterday": {
      const y = addDays(now, -1);
      return { from: y, to: y };
    }
    case "week":
      return { from: addDays(now, -weekdayMon0(now)), to: now };
    case "last7":
      return { from: addDays(now, -6), to: now };
    case "month":
      return { from: now.slice(0, 8) + "01", to: now };
    case "last30":
      return { from: addDays(now, -29), to: now };
    case "custom":
      return { from: r.from || undefined, to: r.to || undefined };
    default:
      return {};
  }
}

export function inRange(day: string, range: { from?: string; to?: string }): boolean {
  if (range.from && day < range.from) return false;
  if (range.to && day > range.to) return false;
  return true;
}

/** Every day from→to inclusive (capped, for chart axes). */
export function daysBetween(from: string, to: string, cap = 400): string[] {
  const out: string[] = [];
  let d = from;
  while (d <= to && out.length < cap) {
    out.push(d);
    d = addDays(d, 1);
  }
  return out;
}

const shortFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const longFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** "8 Sept" from a YYYY-MM-DD string */
export function fmtDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return shortFmt.format(new Date(Date.UTC(y, m - 1, d)));
}
export function fmtDayLong(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return longFmt.format(new Date(Date.UTC(y, m - 1, d)));
}

const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TIMEZONE });
export function fmtTime(d: string | Date): string {
  return timeFmt.format(typeof d === "string" ? new Date(d) : d);
}
