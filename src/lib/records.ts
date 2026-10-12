// Turning untrusted input into BookedCall / Payment / Application fields.
// Shared by the screens and the ingest webhooks so both apply exactly the
// same rules.

import { prisma } from "./prisma";
import { CALL_INFO, CALL_OUTCOMES, DQ_BUDGET_PATTERNS, PAYMENT_METHODS, QUALIFIED } from "./config";
import { answers, date, day, email, isCallType, isPaymentType, money, str, url, utm } from "./validate";

type Input = Record<string, unknown>;

/** Resolve a member reference: an id, or (for webhooks) a name/email. */
async function memberRef(v: unknown): Promise<string | null | undefined> {
  if (v === undefined) return undefined;
  const s = str(v, 200);
  if (!s) return null;
  const byId = await prisma.member.findUnique({ where: { id: s } });
  if (byId) return byId.id;
  const byOther = await prisma.member.findFirst({
    where: { OR: [{ email: s.toLowerCase() }, { name: s }] },
  });
  return byOther?.id ?? null;
}

/** The setter whose tracking code is in this lead source (e.g. "ig-dm-dvd"). */
export async function setterFromUtm(source: string | null): Promise<string | null> {
  if (!source) return null;
  const setters = await prisma.member.findMany({ where: { active: true, utmCode: { not: null } } });
  const hit = setters.find((m) => m.utmCode && source === m.utmCode.toLowerCase());
  return hit?.id ?? null;
}

/** Lead/booking fields. `partial` = only touch keys present in the input. */
export async function callFields(b: Input, partial: boolean) {
  const out: Record<string, unknown> = {};
  const set = (k: string, v: unknown, ...aliases: string[]) => {
    const present = [k, ...aliases].some((a) => a in b);
    if (!partial || present) out[k] = v;
  };
  set("leadName", str(b.leadName ?? b.name, 120), "name");
  set("leadEmail", email(b.leadEmail ?? b.email), "email");
  set("leadPhone", str(b.leadPhone ?? b.phone, 40), "phone");
  set("instagram", str(b.instagram, 80));
  set("leadTimezone", str(b.leadTimezone ?? b.timezone, 80), "timezone");
  set("calendarName", str(b.calendarName, 120));
  set("program", str(b.program, 120));
  set("utmSource", utm(b.utmSource));
  for (const k of ["utmCampaign", "utmMedium", "utmContent"]) set(k, str(b[k], 120));
  if (!partial || "bookingAnswers" in b) out.bookingAnswers = JSON.stringify(answers(b.bookingAnswers));
  if (!partial || "dateOfCall" in b) {
    const d = date(b.dateOfCall);
    if (!d) return { error: "A valid call date is required" };
    out.dateOfCall = d;
  }
  if ("dateBooked" in b) {
    const d = date(b.dateBooked);
    if (d) out.dateBooked = d;
  }
  const setter = await memberRef(b.setterId ?? b.setter);
  if (setter !== undefined) out.setterId = setter;
  if (!partial && !out.setterId) out.setterId = await setterFromUtm((out.utmSource as string) ?? null);
  const closer = await memberRef(b.closerId ?? b.closer);
  if (closer !== undefined) out.closerId = closer;
  if (!partial && !out.leadName) return { error: "Lead name is required" };
  if (partial && ("leadName" in b || "name" in b) && !out.leadName) return { error: "Lead name can't be empty" };
  return { data: out };
}

const isKey = <T extends object>(o: T, v: unknown): v is keyof T => typeof v === "string" && v in o;

/**
 * The Sales Call Report. Closers answer two questions, like the Airtable form:
 * Call info (Live / No Show / Rescheduled / Cancelled) and, for a live call,
 * the outcome (Closed / No Close / Follow Up Call). Both map onto one stored
 * `outcome`, so every stat reads a single field.
 */
export function outcomeFields(b: Input) {
  if (b.callInfo === null || b.callInfo === "") {
    return {
      data: {
        outcome: null, callType: null, qualified: null, callRating: null, recordingUrl: null,
        revenue: 0, cashOnCall: 0, paymentType: null, paymentMethod: null, pif: false,
        nextPaymentAmount: null, nextPaymentDate: null, paymentPlanDetails: null, reportedAt: null,
      },
    };
  }
  if (!isKey(CALL_INFO, b.callInfo)) return { error: "Pick what happened: live call, no show, rescheduled or cancelled" };
  if (!isCallType(b.callType)) return { error: "Pick the call type" };
  const live = b.callInfo === "live";
  if (live && !isKey(CALL_OUTCOMES, b.callOutcome)) return { error: "Pick the call outcome" };
  const outcome = live ? (b.callOutcome as string) : (b.callInfo as string);
  const closed = outcome === "closed";

  const qualified = live ? (isKey(QUALIFIED, b.qualified) ? b.qualified : null) : null;
  if (live && !qualified) return { error: "Mark the lead Qualified or DQ" };
  const rating = b.callRating === undefined || b.callRating === null || b.callRating === "" ? null : Math.round(Number(b.callRating));
  if (rating !== null && !(rating >= 1 && rating <= 10)) return { error: "Call rating is 1 to 10" };
  const recordingUrl = b.recordingUrl ? url(b.recordingUrl) : null;
  if (b.recordingUrl && !recordingUrl) return { error: "The recording link must start with https://" };

  const revenue = closed ? money(b.revenue) ?? 0 : 0;
  const cashOnCall = closed || outcome === "follow_up" ? money(b.cashOnCall) ?? 0 : 0;
  if (closed && revenue <= 0) return { error: "Enter the total deal size" };
  if (closed && cashOnCall > revenue) return { error: "Cash collected can't be more than the deal size" };
  const paymentType = closed ? (isPaymentType(b.paymentType) ? b.paymentType : null) : null;
  if (closed && !paymentType) return { error: "Pick the payment type (PIF, Split or Deposit)" };
  const paymentMethod = closed ? str(b.paymentMethod, 60) : null;
  if (paymentMethod && !PAYMENT_METHODS.includes(paymentMethod)) return { error: "Pick a payment method from the list" };
  const owing = closed && paymentType !== "pif";

  return {
    data: {
      outcome,
      callType: b.callType,
      qualified,
      callRating: live ? rating : null,
      recordingUrl: live ? recordingUrl : null,
      revenue,
      cashOnCall,
      paymentType,
      paymentMethod,
      pif: paymentType === "pif",
      ...(closed && b.program !== undefined ? { program: str(b.program, 120) } : {}),
      nextPaymentAmount: owing ? money(b.nextPaymentAmount) : null,
      nextPaymentDate: owing ? day(b.nextPaymentDate) : null,
      paymentPlanDetails: owing ? str(b.paymentPlanDetails, 1000) : null,
      notes: str(b.notes, 4000),
      reportedAt: new Date(),
    },
  };
}

/**
 * A payment. From the processor (webhook) or typed in by an admin. When the
 * processor doesn't know who sold it, the setter, closer, program and type are
 * taken from the lead's booked call (matched by email).
 */
export async function paymentFields(b: Input) {
  const customerName = str(b.customerName ?? b.name, 120);
  if (!customerName) return { error: "Customer name is required" };
  const amount = money(b.amount);
  if (amount === null || amount <= 0) return { error: "Enter an amount above zero" };
  const d = date(b.date);
  if (!d) return { error: "A valid payment date is required" };
  const customerEmail = email(b.customerEmail ?? b.email);
  const failed = b.status === "failed";

  // The deal this money belongs to: their closed call if there is one, else their latest booking.
  const call = customerEmail
    ? (await prisma.bookedCall.findFirst({ where: { leadEmail: customerEmail, outcome: "closed" }, orderBy: { dateOfCall: "desc" } })) ??
      (await prisma.bookedCall.findFirst({ where: { leadEmail: customerEmail }, orderBy: { dateOfCall: "desc" } }))
    : null;

  let paymentType: string | null = isPaymentType(b.paymentType) ? b.paymentType : null;
  // Guessed until the closer's report says otherwise (see backfillPayments).
  const typeAuto = !paymentType && !(call?.outcome === "closed" && call.paymentType);
  if (!paymentType) {
    // First successful payment takes the deal's type (PIF / Deposit / Split);
    // anything after that is an instalment of a split.
    const earlier = customerEmail
      ? await prisma.payment.count({ where: { customerEmail, status: "succeeded", date: { lt: d } } })
      : 0;
    paymentType = earlier > 0 ? "split" : call?.paymentType ?? "pif";
  }

  const setter = await memberRef(b.setterId ?? b.setter);
  const closer = await memberRef(b.closerId ?? b.closer);
  return {
    data: {
      customerName,
      customerEmail,
      amount,
      date: d,
      paymentType,
      typeAuto,
      status: failed ? "failed" : "succeeded",
      failureReason: failed ? str(b.failureReason, 300) : null,
      product: str(b.product, 120),
      paymentMethod: str(b.paymentMethod, 60),
      program: str(b.program, 120) ?? call?.program ?? null,
      notes: str(b.notes, 1000),
      setterId: setter ?? call?.setterId ?? null,
      closerId: closer ?? call?.closerId ?? null,
    },
  };
}

/** An application from the form tool (Typeform). */
export function applicationFields(b: Input) {
  const name = str(b.name, 120);
  if (!name) return { error: "Applicant name is required" };
  const ans = answers(b.answers);
  const budget = Object.entries(ans).find(([k]) => /budget|invest/i.test(k))?.[1] ?? "";
  const lowBudget = DQ_BUDGET_PATTERNS.some((p) => budget.toLowerCase().includes(p.toLowerCase()));
  return {
    data: {
      name,
      email: email(b.email),
      phone: str(b.phone, 40),
      instagram: str(b.instagram, 80),
      utmSource: utm(b.utmSource ?? b.utm),
      answers: JSON.stringify(ans),
      lowBudget,
      appliedAt: date(b.appliedAt) ?? new Date(),
    },
  };
}

/**
 * Money often lands before the closer files the report (Stripe fires during the
 * call). When a call is reported as closed, fill in what the processor couldn't
 * know on that lead's payments: program, setter, closer, and (for guessed
 * types) PIF / Split / Deposit. Values typed in by a person are never touched.
 */
export async function backfillPayments(callId: string) {
  const c = await prisma.bookedCall.findUnique({ where: { id: callId } });
  if (!c || c.outcome !== "closed" || !c.leadEmail) return;
  const payments = await prisma.payment.findMany({
    where: { customerEmail: c.leadEmail, status: "succeeded" },
    orderBy: { date: "asc" },
  });
  let first = true;
  for (const p of payments) {
    const data: Record<string, unknown> = {};
    if (!p.program && c.program) data.program = c.program;
    if (!p.setterId && c.setterId) data.setterId = c.setterId;
    if (!p.closerId && c.closerId) data.closerId = c.closerId;
    if (p.typeAuto && c.paymentType) {
      data.paymentType = first ? c.paymentType : "split";
      data.typeAuto = false;
    }
    first = false;
    if (Object.keys(data).length) await prisma.payment.update({ where: { id: p.id }, data });
  }
}

/** Admin corrections to a payment (the hand-filled columns from Airtable). */
export async function paymentEditFields(b: Input) {
  const out: Record<string, unknown> = {};
  if ("paymentType" in b) {
    if (!isPaymentType(b.paymentType)) return { error: "Pick PIF, Split or Deposit" };
    out.paymentType = b.paymentType;
    out.typeAuto = false;
  }
  if ("program" in b) out.program = str(b.program, 120);
  if ("notes" in b) out.notes = str(b.notes, 1000);
  if ("product" in b) out.product = str(b.product, 120);
  if ("paymentMethod" in b) out.paymentMethod = str(b.paymentMethod, 60);
  if ("setterId" in b) out.setterId = (await memberRef(b.setterId)) ?? null;
  if ("closerId" in b) out.closerId = (await memberRef(b.closerId)) ?? null;
  return { data: out };
}
