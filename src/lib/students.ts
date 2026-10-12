// Validation for the Students payment tracker (admin only, GBP).

import { money, str, day } from "./validate";

export const STUDENT_STATUSES = { active: "Paying", pending: "Pending", settled: "Settled" } as const;
const isStatus = (v: unknown): v is keyof typeof STUDENT_STATUSES => typeof v === "string" && v in STUDENT_STATUSES;

type Fields = { name?: string; paid?: number; owed?: number; onPlacement?: number; dueDate?: string | null; status?: string; notes?: string | null };

/** Partial for edits; `requireName` for creates. Only keys present in the body are touched. */
export function studentFields(b: Record<string, unknown>, requireName: boolean): { data: Fields } | { error: string } {
  const data: Fields = {};
  if ("name" in b || requireName) {
    const name = str(b.name, 120);
    if (!name) return { error: "Add the student's name" };
    data.name = name;
  }
  for (const k of ["paid", "owed", "onPlacement"] as const) {
    if (!(k in b)) continue;
    const n = b[k] === "" || b[k] === null ? 0 : money(b[k]);
    if (n === null) return { error: "Amounts must be a positive number" };
    data[k] = n;
  }
  if ("dueDate" in b) {
    if (b.dueDate === "" || b.dueDate === null) data.dueDate = null;
    else {
      const d = day(b.dueDate);
      if (!d) return { error: "That date doesn't look right" };
      data.dueDate = d;
    }
  }
  if ("status" in b) {
    if (!isStatus(b.status)) return { error: "Unknown status" };
    data.status = b.status;
  }
  if ("notes" in b) data.notes = str(b.notes, 500);
  return { data };
}
