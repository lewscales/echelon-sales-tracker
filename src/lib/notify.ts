// Every Slack message the tracker sends, in one place. Formats mirror the
// posts the team already knows from Discord (title, labelled lines, "↓" blocks).

import type { Application, BookedCall, Payment } from "@prisma/client";
import { CALL_INFO, CALL_OUTCOMES, CALL_TYPES, PAYMENT_TYPES, QUALIFIED, ROLES, TIMEZONE, CURRENCY, type Role } from "./config";
import { FORMS, PRECALL_FIELDS, type FormDef } from "./forms";
import { prisma } from "./prisma";
import { appUrl, postSlack, type Line } from "./slack";
import { parseJson } from "./validate";

const when = new Intl.DateTimeFormat("en-GB", {
  weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TIMEZONE, timeZoneName: "short",
});
const fmtMoney = new Intl.NumberFormat("en-GB", { style: "currency", currency: CURRENCY, minimumFractionDigits: 2 });
const money = (n: number | null | undefined) => (n == null ? null : fmtMoney.format(n));
const label = <T extends Record<string, string>>(o: T, k: string | null | undefined) => (k ? o[k as keyof T] ?? k : null);
const nameOf = async (id: string | null | undefined) => (id ? (await prisma.member.findUnique({ where: { id } }))?.name ?? null : null);
const qa = (o: Record<string, string>): Line[] => Object.entries(o).map(([k, v]) => [k, v]);

export async function notifyApplication(a: Application) {
  await postSlack("APPLICATIONS", "New Typeform application", [
    ["Name", a.name],
    ["Phone", a.phone],
    ["Email", a.email],
    ["Instagram", a.instagram],
    ["UTM", a.utmSource],
    ...(a.lowBudget ? ([["Flag", "Low budget (kept off the chase list)"]] as Line[]) : []),
    { heading: "Typeform questions" },
    ...qa(parseJson(a.answers, {})),
  ]);
}

/** A new booking. With a matching application its answers are attached. */
export async function notifyBooking(c: BookedCall) {
  const app = c.leadEmail
    ? await prisma.application.findFirst({ where: { email: c.leadEmail }, orderBy: { appliedAt: "desc" } })
    : null;
  const booking = parseJson<Record<string, string>>(c.bookingAnswers, {});
  // Like the old Zaps: the event type decides the format (Application Call calendars vs Strategy Calls).
  const fromApplicationForm = /application/i.test(c.calendarName ?? "");
  await postSlack("BOOKED_CALLS", fromApplicationForm ? "New call booked from Application Form" : "New call booked", [
    ["Name", c.leadName],
    ["WhatsApp number", c.leadPhone],
    ["Email", c.leadEmail],
    ["Instagram", c.instagram ?? app?.instagram],
    ["Date of call", when.format(c.dateOfCall)],
    ["Timezone of lead", c.leadTimezone],
    ["Calendar", c.calendarName],
    ["UTM", c.utmSource],
    ["Setter", await nameOf(c.setterId)],
    ["Closer", await nameOf(c.closerId)],
    ...(app ? ([{ heading: "Typeform questions" }, ...qa(parseJson(app.answers, {}))] as Line[]) : []),
    ...(Object.keys(booking).length ? ([{ heading: "Calendly questions" }, ...qa(booking)] as Line[]) : []),
  ]);
}

export async function notifyBookingChange(c: BookedCall, change: "cancelled" | "rescheduled") {
  await postSlack("BOOKED_CALLS", change === "cancelled" ? "Call cancelled by lead" : "Call rescheduled by lead", [
    ["Name", c.leadName],
    ["Was booked for", when.format(c.dateOfCall)],
    ["Calendar", c.calendarName],
    ["Closer", await nameOf(c.closerId)],
  ]);
}

export async function notifyHandoff(c: BookedCall, updated = false) {
  const h = parseJson<Record<string, string>>(c.handoff, {});
  await postSlack("PRE_CALL", `${updated ? "Updated pre-call handoff" : "Pre-call handoff"}: ${c.leadName}`, [
    ["Call", when.format(c.dateOfCall)],
    ["Setter", await nameOf(c.handoffById)],
    ["Closer", await nameOf(c.closerId)],
    { heading: "Handoff" },
    ...PRECALL_FIELDS.filter((f) => h[f.key]).map((f): Line => [f.label, h[f.key]]),
  ]);
}

/** Same four shapes as the Discord Zap paths: live report / no-show / cancelled / rescheduled. */
export async function notifyCallReport(c: BookedCall, updated = false) {
  const closer = await nameOf(c.closerId ?? c.reportedById);
  const tag = updated ? " (updated)" : "";
  const live = c.outcome === "closed" || c.outcome === "not_closed" || c.outcome === "follow_up";
  if (!live) {
    const title = c.outcome === "no_show" ? "No-Show" : c.outcome === "cancelled" ? "Cancelled Call" : "Rescheduled Call";
    await postSlack("CALL_REPORTS", title + tag, [
      ["Lead Name", c.leadName],
      ["Closer", closer],
      ["Call type", label(CALL_TYPES, c.callType)],
      ["Call info", label(CALL_INFO, c.outcome)],
      ["Notes", c.notes],
    ]);
    return;
  }
  const closed = c.outcome === "closed";
  await postSlack("CALL_REPORTS", "Live Sales Call Report" + tag, [
    ["Lead Name", c.leadName],
    ["Closer", closer],
    { heading: "Call details" },
    ["Call type", label(CALL_TYPES, c.callType)],
    ["Call info", "Live Call"],
    ["Call outcome", label(CALL_OUTCOMES, c.outcome)],
    ["Qualified / DQ", label(QUALIFIED, c.qualified)],
    ["Call rating", c.callRating ? `${c.callRating}/10` : null],
    ["What happened on call", c.notes],
    ["Call recording", c.recordingUrl],
    ...(closed
      ? ([
          { heading: "Payment details" },
          ["Total deal size", money(c.revenue)],
          ["Cash collected", money(c.cashOnCall)],
          ["Payment type", label(PAYMENT_TYPES, c.paymentType)],
          ["Payment method", c.paymentMethod],
          ["Program tier", c.program],
          ["Payment plan details", c.paymentPlanDetails],
          ["Next payment", money(c.nextPaymentAmount)],
          ["Date of next payment", c.nextPaymentDate],
        ] as Line[])
      : []),
  ]);
}

export async function notifyPayment(p: Payment) {
  if (p.status === "failed") {
    await postSlack("PAYMENTS", "FAILED payment", [
      ["Customer name", p.customerName],
      ["Customer email", p.customerEmail],
      ["Amount failed", money(p.amount)],
      ["Product name", p.product],
      ["Payment method", p.paymentMethod],
      ["Failed payment reason", p.failureReason],
    ]);
    return;
  }
  await postSlack("PAYMENTS", "New successful payment", [
    ["Customer name", p.customerName],
    ["Customer email", p.customerEmail],
    ["Amount", money(p.amount)],
    ["Product", p.product],
    ["Payment method", p.paymentMethod],
    ["Payment type", label(PAYMENT_TYPES, p.paymentType)],
    ["Closer", await nameOf(p.closerId)],
    ["Setter", await nameOf(p.setterId)],
  ]);
}

/** Any team form (EODs, feedback) or the client onboarding form. */
export async function notifyReport(
  form: FormDef,
  data: Record<string, string | number>,
  day: string,
  member: { name: string; role: string } | null,
  updated = false
) {
  const title =
    (form.kind === "feedback" ? "New sales team feedback form submitted" : form.kind === "onboarding" ? "New onboarding form submitted" : `${form.title} Report`) +
    (updated ? " (updated)" : "");
  const lines: Line[] = [];
  if (member) {
    lines.push([form.kind === "closer_eod" ? "Closer" : form.kind === "feedback" ? "Name" : "Setter", member.name]);
    if (form.kind === "feedback") lines.push(["Your role", ROLES[member.role as Role] ?? member.role]);
    lines.push([form.kind === "feedback" ? "Date submitted" : "Date of work", day]);
  }
  // Onboarding and feedback answers sit under a "Details ↓" block, as on Discord.
  const detailsAt = form.kind === "onboarding" ? 3 : form.kind === "feedback" ? 0 : -1;
  form.fields.forEach((f, i) => {
    if (i === detailsAt) lines.push({ heading: "Details" });
    if (f.section) lines.push({ heading: f.section });
    const v = data[f.key];
    lines.push([f.label.replace(/\?$/, ""), f.type === "stars" && v != null ? `${v}/${f.max ?? 5}` : v]);
  });
  await postSlack(form.slack, title, lines);
}

/** Scheduled nudges, same wording and timing idea as the old Discord ones. */
export async function sendReminder(job: "eod" | "feedback") {
  const base = appUrl();
  if (job === "eod") {
    const forms = FORMS.filter((f) => f.daily);
    return postSlack(
      "EOD_REPORTS",
      "Fill out your EOD reports",
      forms.map((f): Line => [f.title.replace(" EOD", ""), `${base}/#forms/${f.kind}`])
    );
  }
  return postSlack("SALES_FEEDBACK", "Fill out the weekly sales team feedback form", [["Form", `${base}/#forms/feedback`]]);
}
