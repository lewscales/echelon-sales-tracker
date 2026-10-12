import { prisma } from "@/lib/prisma";
import { json, safeEqual } from "@/lib/auth";
import { ingestCall } from "@/lib/ingestCall";
import { notifyApplication, notifyPayment } from "@/lib/notify";
import { applicationFields, paymentFields } from "@/lib/records";
import { body, str } from "@/lib/validate";

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
    const r = await ingestCall(b);
    return json(r.body, r.status);
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
