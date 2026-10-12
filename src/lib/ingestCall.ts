import type { BookedCall } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyBooking, notifyBookingChange } from "@/lib/notify";
import { applicationFields, callFields } from "@/lib/records";
import { email, str } from "@/lib/validate";

/**
 * A booking from the calendar (Zapier, a webhook, or Calendly directly).
 * { event: "cancelled" | "rescheduled" } marks an existing booking; anything
 * else creates it, or updates it when the same externalId arrives again.
 */
export async function ingestCall(b: Record<string, unknown>): Promise<{ status: number; body: Record<string, unknown> }> {
  const externalId = str(b.externalId, 200);
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
    if (!call) return { status: 404, body: { error: "No matching booking found" } };
    const outcome = event === "rescheduled" ? "rescheduled" : "cancelled";
    // A closer's report wins over the calendar: never overwrite a filed outcome.
    if (call.outcome) return { status: 200, body: { ok: true, id: call.id, unchanged: true } };
    const c = await prisma.bookedCall.update({ where: { id: call.id }, data: { outcome, callType: call.callType ?? "first_call" } });
    await notifyBookingChange(c, outcome);
    return { status: 200, body: { ok: true, id: c.id, outcome } };
  }

  const f = await callFields(b, false);
  if ("error" in f) return { status: 400, body: { error: f.error } };
  const existing = externalId ? await prisma.bookedCall.findUnique({ where: { externalId } }) : null;
  if (existing) {
    // A resend from the calendar mustn't wipe a setter or closer someone assigned by hand.
    const data = { ...(f.data as Record<string, unknown>) };
    if (!data.setterId && existing.setterId) delete data.setterId;
    if (!data.closerId && existing.closerId) delete data.closerId;
    const c = await prisma.bookedCall.update({ where: { id: existing.id }, data: data as never });
    return { status: 200, body: { ok: true, id: c.id, updated: true } };
  }
  const c = await prisma.bookedCall.create({ data: { ...(f.data as object), externalId } as never });
  await recordAsApplication(c);
  await notifyBooking(c);
  return { status: 200, body: { ok: true, id: c.id } };
}

/**
 * Every booking is also kept on the Applications page, so there's one running
 * record of everyone who booked (name, phone, email, answers, when). Matched by
 * email: someone who booked before only gets their blanks filled in.
 */
async function recordAsApplication(c: BookedCall) {
  const existing = c.leadEmail ? await prisma.application.findFirst({ where: { email: c.leadEmail } }) : null;
  if (existing) {
    const fill: Record<string, string> = {};
    if (!existing.phone && c.leadPhone) fill.phone = c.leadPhone;
    if (!existing.instagram && c.instagram) fill.instagram = c.instagram;
    if (!existing.utmSource && c.utmSource) fill.utmSource = c.utmSource;
    if (Object.keys(fill).length) await prisma.application.update({ where: { id: existing.id }, data: fill });
    return;
  }
  const f = applicationFields({
    name: c.leadName,
    email: c.leadEmail,
    phone: c.leadPhone,
    instagram: c.instagram,
    utmSource: c.utmSource,
    answers: c.bookingAnswers,
    appliedAt: (c.dateBooked ?? c.createdAt).toISOString(),
  });
  if ("error" in f) return;
  await prisma.application.create({ data: { ...f.data, externalId: `booking:${c.id}` } });
}
