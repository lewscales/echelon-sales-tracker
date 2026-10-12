import { prisma } from "@/lib/prisma";
import { currentMember, forbidden, json, unauthorized } from "@/lib/auth";
import { cleanSubmission, PRECALL_FIELDS } from "@/lib/forms";
import { notifyCallReport, notifyHandoff } from "@/lib/notify";
import { backfillPayments, callFields, outcomeFields } from "@/lib/records";
import { callRow } from "@/lib/serialize";
import { body } from "@/lib/validate";

// PATCH { report: {...} }  → the Sales Call Report (admins + closers)
// PATCH { handoff: {...} } → the setter → closer pre-call handoff (setters + admins)
// PATCH { ...lead fields } → edit the booking (admins only)
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await currentMember();
  if (!me) return unauthorized();
  const { id } = await ctx.params;
  const existing = await prisma.bookedCall.findUnique({ where: { id } });
  if (!existing) return json({ error: "Call not found" }, 404);
  const b = await body(req);

  if (b.report && typeof b.report === "object") {
    if (me.role !== "admin" && me.role !== "closer") return forbidden();
    if (me.role === "closer" && existing.closerId && existing.closerId !== me.id) return forbidden();
    const f = outcomeFields(b.report as Record<string, unknown>);
    if ("error" in f) return json({ error: f.error }, 400);
    const c = await prisma.bookedCall.update({
      where: { id },
      data: {
        ...f.data,
        reportedById: me.id,
        // The closer filing the report owns the call if nobody was assigned.
        ...(existing.closerId ? {} : me.role === "closer" ? { closerId: me.id } : {}),
      },
    });
    if (c.outcome === "closed") await backfillPayments(c.id);
    if (c.outcome) await notifyCallReport(c, !!existing.outcome);
    return json({ call: callRow(c, me) });
  }

  if (b.handoff && typeof b.handoff === "object") {
    if (!["admin", "dm_setter", "phone_setter"].includes(me.role)) return forbidden();
    if (existing.outcome && me.role !== "admin") return json({ error: "This call has already happened and been reported" }, 400);
    const clean = cleanSubmission({ fields: PRECALL_FIELDS }, b.handoff as Record<string, unknown>);
    if ("error" in clean) return json({ error: clean.error }, 400);
    const c = await prisma.bookedCall.update({
      where: { id },
      data: { handoff: JSON.stringify(clean.data), handoffById: me.id, handoffAt: new Date() },
    });
    await notifyHandoff(c, !!existing.handoff);
    return json({ call: callRow(c, me) });
  }

  if (me.role !== "admin") return forbidden();
  const f = await callFields(b, true);
  if ("error" in f) return json({ error: f.error }, 400);
  const c = await prisma.bookedCall.update({ where: { id }, data: f.data as never });
  return json({ call: callRow(c, me) });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await currentMember();
  if (!me) return unauthorized();
  if (me.role !== "admin") return forbidden();
  const { id } = await ctx.params;
  await prisma.bookedCall.delete({ where: { id } }).catch(() => null);
  return json({ ok: true });
}
