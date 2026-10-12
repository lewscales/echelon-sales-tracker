import { prisma } from "@/lib/prisma";
import { json, safeEqual } from "@/lib/auth";
import { notifyApplication, notifyBooking, notifyBookingChange, notifyPayment } from "@/lib/notify";
import { applicationFields, callFields, paymentFields } from "@/lib/records";
import { body, email, str } from "@/lib/validate";

// Machine entry point for Zapier / Make / a webhook. Header: x-ingest-secret: <INGEST_SECRET>
//
//   POST /api/ingest/application  Typeform application
//   POST /api/ingest/call         Calendly booking. { event: "cancelled" | "rescheduled" } marks an existing one
//   POST /api/ingest/payment      Stripe / Whop payment. { status: "failed" } for a failed attempt
//
// Field lists and examples: Admin → Automations. Sending the same externalId
// again updates the row instead of duplicating it (and doesn't re-post to Slack).
export async function POST(req: Request, ctx: { params: Promise<{ type: string }> }) {
  const secret = (process.env.INGEST_SECRET ?? "").trim();
  const given = req.headers.get("x-ingest-secret") ?? "";
  if (!secret || !safeEqual(given, secret)) return json({ error: "Unauthorized" }, 401);

  const { type } = await ctx.params;
  const b = await body(req);
  const externalId = str(b.externalId, 200);

  if (type === "application") {
    const f = applicationFields(b);
    if ("error" in f) return json({ error: f.error }, 400);
    const existing = externalId ? await prisma.application.findUnique({ where: { externalId } }) : null;
    if (existing) {
      // A resend only changes what it actually carries: never wipe answers or reset appliedAt.
      const data: Record<string, unknown> = { name: f.data.name };
      for (const k of ["email", "phone", "instagram", "appliedAt"] as const) if (k in b) data[k] = f.data[k];
      if ("utmSource" in b || "utm" in b) data.utmSource = f.data.utmSource;
      if ("answers" in b) Object.assign(data, { answers: f.data.answers, lowBudget: f.data.lowBudget });
      const a = await prisma.application.update({ where: { id: existing.id }, data });
      return json({ ok: true, id: a.id, updated: true });
    }
    const a = await prisma.application.create({ data: { ...f.data, externalId } });
    await notifyApplication(a);
    return json({ ok: true, id: a.id });
  }

  if (type === "call") {
    const event = String(b.event ?? "created").toLowerCase();
    if (event === "cancelled" || event === "canceled" || event === "rescheduled") {
      // Find the booking: by its id from the calendar, else the lead's next unreported call.
      const leadEmail = email(b.leadEmail ?? b.email);
      const call =
        (externalId && (await prisma.bookedCall.findUnique({ where: { externalId } }))) ||
        (leadEmail &&
          // Only a call that hasn't happened yet: never a past call still awaiting its report.
          (await prisma.bookedCall.findFirst({
            where: { leadEmail, outcome: null, dateOfCall: { gte: new Date(Date.now() - 3 * 3600_000) } },
            orderBy: { dateOfCall: "asc" },
          }))) ||
        null;
      if (!call) return json({ error: "No matching booking found" }, 404);
      const outcome = event === "rescheduled" ? "rescheduled" : "cancelled";
      // A closer's report wins over the calendar: never overwrite a filed outcome.
      if (call.outcome) return json({ ok: true, id: call.id, unchanged: true });
      const c = await prisma.bookedCall.update({ where: { id: call.id }, data: { outcome, callType: call.callType ?? "first_call" } });
      await notifyBookingChange(c, outcome);
      return json({ ok: true, id: c.id, outcome });
    }

    const f = await callFields(b, false);
    if ("error" in f) return json({ error: f.error }, 400);
    const existing = externalId ? await prisma.bookedCall.findUnique({ where: { externalId } }) : null;
    if (existing) {
      // A resend from the calendar mustn't wipe a setter or closer someone assigned by hand.
      const data = { ...(f.data as Record<string, unknown>) };
      if (!data.setterId && existing.setterId) delete data.setterId;
      if (!data.closerId && existing.closerId) delete data.closerId;
      const c = await prisma.bookedCall.update({ where: { id: existing.id }, data: data as never });
      return json({ ok: true, id: c.id, updated: true });
    }
    const c = await prisma.bookedCall.create({ data: { ...(f.data as object), externalId } as never });
    await notifyBooking(c);
    return json({ ok: true, id: c.id });
  }

  if (type === "payment") {
    const f = await paymentFields(b);
    if ("error" in f) return json({ error: f.error }, 400);
    const existing = externalId ? await prisma.payment.findUnique({ where: { externalId } }) : null;
    if (existing) {
      const p = await prisma.payment.update({ where: { id: existing.id }, data: f.data });
      return json({ ok: true, id: p.id, updated: true });
    }
    const p = await prisma.payment.create({ data: { ...f.data, externalId } });
    await notifyPayment(p);
    return json({ ok: true, id: p.id });
  }

  return json({ error: "Unknown type. Use /api/ingest/application, /call or /payment" }, 404);
}
