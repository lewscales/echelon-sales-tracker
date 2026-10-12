// Every number on the dashboard is computed here, from raw rows, so the
// definitions live in one place and the screen can re-filter instantly.

import type { ApplicationRow, CallRow, PaymentRow, ReportRow } from "./types";
import { dayOf, daysBetween, inRange, addDays, today } from "./dates";

type Range = { from?: string; to?: string };
const has = (list: string[], v: string | null | undefined) => list.length === 0 || (v != null && list.includes(v));

/** a / b, or null when b is 0 (shown as "–", never as 0% or NaN). */
export function ratio(a: number, b: number): number | null {
  return b > 0 ? a / b : null;
}

// ─────────────────────────────── Cash ───────────────────────────────

export type CashFilters = { range: Range; paymentType: string[]; program: string[]; setter: string[]; closer: string[] };

export function cashStats(payments: PaymentRow[], f: CashFilters) {
  const inView = payments
    .filter((p) => inRange(dayOf(p.date), f.range))
    .filter((p) => has(f.paymentType, p.paymentType) && has(f.program, p.program) && has(f.setter, p.setterId) && has(f.closer, p.closerId));
  // A failed attempt that was retried successfully (same customer + amount within
  // a day) is just checkout noise; only the unrecovered ones need chasing.
  const failed = inView
    .filter((p) => p.status === "failed")
    .map((p) => ({
      ...p,
      recovered: payments.some(
        (q) =>
          q.status === "succeeded" &&
          q.customerEmail === p.customerEmail &&
          q.amount === p.amount &&
          Math.abs(new Date(q.date).getTime() - new Date(p.date).getTime()) < 86_400_000
      ),
    }));
  const rows = payments
    .filter((p) => p.status === "succeeded")
    .filter((p) => inRange(dayOf(p.date), f.range))
    .filter((p) => has(f.paymentType, p.paymentType) && has(f.program, p.program) && has(f.setter, p.setterId) && has(f.closer, p.closerId))
    .sort((a, b) => b.date.localeCompare(a.date));

  const total = rows.reduce((s, p) => s + p.amount, 0);
  const byType = (t: string) => rows.filter((p) => p.paymentType === t).reduce((a, p) => a + p.amount, 0);

  // Daily series across the whole window (zero days included, so the line is honest).
  const byDay = new Map<string, number>();
  for (const p of rows) byDay.set(dayOf(p.date), (byDay.get(dayOf(p.date)) ?? 0) + p.amount);
  const days = [...byDay.keys()].sort();
  const from = f.range.from ?? days[0];
  const to = f.range.to ?? days[days.length - 1];
  let series: { day: string; value: number }[] = [];
  let bucket: "day" | "week" = "day";
  if (from && to) {
    const all = daysBetween(from, to, 2000);
    if (all.length > 92) {
      // Long windows: weekly buckets keep the chart readable.
      bucket = "week";
      const weeks = new Map<string, number>();
      for (const d of all) {
        const [y, m, dd] = d.split("-").map(Number);
        const wd = (new Date(Date.UTC(y, m - 1, dd)).getUTCDay() + 6) % 7;
        const wk = addDays(d, -wd);
        weeks.set(wk, (weeks.get(wk) ?? 0) + (byDay.get(d) ?? 0));
      }
      series = [...weeks.entries()].map(([day, value]) => ({ day, value }));
    } else {
      series = all.map((d) => ({ day: d, value: byDay.get(d) ?? 0 }));
    }
  }

  return {
    rows,
    total,
    count: rows.length,
    pifTotal: byType("pif"),
    splitTotal: byType("split"),
    depositTotal: byType("deposit"),
    failed,
    series,
    bucket,
  };
}

// ─────────────────────────────── Sales (booked calls) ───────────────────────────────

export type SalesFilters = { range: Range; closer: string[]; callType: string[]; program: string[]; utmSource: string[] };

export function salesStats(calls: CallRow[], f: SalesFilters) {
  const rows = calls
    .filter((c) => inRange(dayOf(c.dateOfCall), f.range))
    .filter((c) => has(f.closer, c.closerId) && has(f.callType, c.callType) && has(f.program, c.program) && has(f.utmSource, c.utmSource))
    .sort((a, b) => b.dateOfCall.localeCompare(a.dateOfCall));

  const n = (o: string) => rows.filter((c) => c.outcome === o).length;
  const booked = rows.length;
  const closed = n("closed");
  const notClosed = n("not_closed");
  const followUp = n("follow_up");
  const noShow = n("no_show");
  const cancelled = n("cancelled");
  const rescheduled = n("rescheduled");
  const pending = rows.filter((c) => !c.outcome).length;
  const reported = booked - pending;
  const live = rows.filter((c) => c.outcome === "closed" || c.outcome === "not_closed" || c.outcome === "follow_up");
  const liveQualified = live.filter((c) => c.qualified === "qualified");
  const dq = rows.filter((c) => c.qualified === "dq").length;
  const rated = live.filter((c) => c.callRating != null);
  const shows = closed + notClosed + followUp;
  const closedRows = rows.filter((c) => c.outcome === "closed");
  const pifs = closedRows.filter((c) => c.pif).length;
  const revenue = closedRows.reduce((s, c) => s + c.revenue, 0);
  // All cash on calls (incl. a follow-up deposit) feeds cash per booked/live call,
  // like Airtable's "cash or zero" averages; the headline tile and AOV are closed deals only.
  const cash = rows.reduce((s, c) => s + c.cashOnCall, 0);
  const cashClosed = closedRows.reduce((s, c) => s + c.cashOnCall, 0);

  return {
    rows,
    booked,
    pending,
    reported,
    dq,
    dqRate: ratio(dq, booked),
    closeRateQualified: ratio(liveQualified.filter((c) => c.outcome === "closed").length, liveQualified.length),
    avgRating: rated.length ? rated.reduce((a, c) => a + (c.callRating ?? 0), 0) / rated.length : null,
    shows,
    closed,
    noShow,
    cancelled,
    rescheduled,
    followUp,
    pifs,
    revenue,
    cash,
    avgDeal: ratio(revenue, closed),
    cashClosed,
    aov: ratio(cashClosed, closed),
    cashPerBooked: ratio(cash, booked),
    cashPerLive: ratio(cash, shows),
    closeRate: ratio(closed, shows),
    // Show rate counts only calls that were due to happen (showed or no-showed);
    // cancellations and reschedules never had the chance to show.
    showRate: ratio(shows, shows + noShow),
    noShowRate: ratio(noShow, shows + noShow),
    cancelRate: ratio(cancelled, booked),
    rescheduleRate: ratio(rescheduled, booked),
    followUpRate: ratio(followUp, shows),
    pifRate: ratio(pifs, closed),
    bySource: countBy(rows, (c) => c.utmSource || "(none)"),
    // Like the Airtable pie: calls with no closer are left out rather than shown as a slice.
    byCloser: countBy(rows.filter((c) => c.closerId), (c) => c.closerId!),
  };
}

function countBy<T>(rows: T[], key: (r: T) => string) {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
  return [...m.entries()].map(([k, v]) => ({ key: k, value: v })).sort((a, b) => b.value - a.value);
}

// ─────────────────────────────── Setter activity (from EODs) ───────────────────────────────

export type ActivityFilters = { range: Range; member: string[] };

/**
 * Sums numeric answers across reports. "Per day" is the average per report,
 * i.e. per person per working day, matching how a setter's daily target reads.
 */
export function activityStats(reports: ReportRow[], kind: string, keys: string[], f: ActivityFilters) {
  const rows = reports.filter((r) => r.kind === kind && inRange(r.day, f.range) && has(f.member, r.memberId));
  const totals: Record<string, number> = {};
  for (const k of keys) totals[k] = rows.reduce((s, r) => s + (Number(r.data[k]) || 0), 0);
  const days = new Set(rows.map((r) => r.day)).size;
  const perDay: Record<string, number | null> = {};
  for (const k of keys) perDay[k] = rows.length ? totals[k] / rows.length : null;
  return { rows, totals, perDay, days, reports: rows.length };
}

// ─────────────────────────────── Applications ───────────────────────────────

export type AppFilters = { range: Range; utmSource: string[] };

/** Applications vs bookings, matched by email. "Unbooked" = the chase list. */
export function applicationStats(apps: ApplicationRow[], f: AppFilters) {
  const rows = apps.filter((a) => inRange(dayOf(a.appliedAt), f.range) && has(f.utmSource, a.utmSource));
  const booked = rows.filter((a) => a.booked).length;
  const lowBudget = rows.filter((a) => a.lowBudget).length;
  const chase = rows.filter((a) => !a.booked && !a.lowBudget && a.chaseStatus !== "not_interested");
  return {
    rows,
    total: rows.length,
    booked,
    bookRate: ratio(booked, rows.length),
    lowBudget,
    chase,
    bySource: countBy(rows, (a) => a.utmSource || "(none)"),
  };
}

// ─────────────────────────────── Upcoming instalments ───────────────────────────────

/** Next payments promised on closed split/deposit deals, soonest first. */
export function upcomingPayments(calls: CallRow[], payments: PaymentRow[]) {
  const now = today();
  return calls
    .filter((c) => c.outcome === "closed" && c.nextPaymentDate && c.nextPaymentAmount)
    .map((c) => {
      // Paid if a successful payment from this lead landed on/after the due date's window start.
      const paid = payments.some(
        (p) =>
          p.status === "succeeded" &&
          !!c.leadEmail &&
          p.customerEmail === c.leadEmail &&
          dayOf(p.date) >= addDays(c.nextPaymentDate!, -7) &&
          dayOf(p.date) > dayOf(c.dateOfCall)
      );
      return { call: c, due: c.nextPaymentDate!, amount: c.nextPaymentAmount!, paid, overdue: !paid && c.nextPaymentDate! < now };
    })
    .filter((x) => !x.paid)
    .sort((a, b) => a.due.localeCompare(b.due));
}
