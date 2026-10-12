// Small input helpers shared by the API routes. Everything from the client is
// untrusted: trim, cap lengths, and reject what doesn't fit.

import { OUTCOMES, CALL_TYPES, PAYMENT_TYPES, ROLES } from "./config";

export function str(v: unknown, max = 200): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim().slice(0, max);
  return s === "" ? null : s;
}

export function email(v: unknown): string | null {
  const s = str(v, 200);
  if (!s) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s.toLowerCase() : null;
}

export function money(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 100_000_000) return null;
  return Math.round(n * 100) / 100;
}

/** Accepts an ISO timestamp or a YYYY-MM-DD / YYYY-MM-DDTHH:mm local value. */
export function date(v: unknown): Date | null {
  const s = str(v, 40);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const isOutcome = (v: unknown): v is keyof typeof OUTCOMES => typeof v === "string" && v in OUTCOMES;
export const isCallType = (v: unknown): v is keyof typeof CALL_TYPES => typeof v === "string" && v in CALL_TYPES;
export const isPaymentType = (v: unknown): v is keyof typeof PAYMENT_TYPES => typeof v === "string" && v in PAYMENT_TYPES;
export const isRole = (v: unknown): v is keyof typeof ROLES => typeof v === "string" && v in ROLES;

export async function body(req: Request): Promise<Record<string, unknown>> {
  try {
    const b = await req.json();
    return b && typeof b === "object" ? (b as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Lead-source codes arrive messy from forms and booking links ("yt-bio,yt-bio",
 * " yt-bio", "YT Bio"). Normalise to one lowercase, hyphenated code.
 */
export function utm(v: unknown): string | null {
  const s = str(v, 200);
  if (!s) return null;
  const first = s
    .split(",")
    .map((x) => x.trim())
    .find((x) => x !== "");
  if (!first) return null;
  return first.toLowerCase().replace(/\s+/g, "-").slice(0, 120);
}

/** Question → answer pairs from a form or booking tool (object or JSON string). */
export function answers(v: unknown): Record<string, string> {
  let o: unknown = v;
  if (typeof v === "string") {
    try {
      o = JSON.parse(v);
    } catch {
      return {};
    }
  }
  if (!o || typeof o !== "object" || Array.isArray(o)) return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(o as Record<string, unknown>).slice(0, 40)) {
    const key = String(k).trim().slice(0, 200);
    const s = str(val, 2000);
    if (key && s) out[key] = s;
  }
  return out;
}

export function url(v: unknown): string | null {
  const s = str(v, 1000);
  return s && /^https?:\/\/\S+$/i.test(s) ? s : null;
}

/** YYYY-MM-DD only. */
export function day(v: unknown): string | null {
  const s = str(v, 10);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export function parseJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}
