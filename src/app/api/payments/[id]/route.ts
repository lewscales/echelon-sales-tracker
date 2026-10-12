import { prisma } from "@/lib/prisma";
import { currentMember, forbidden, json, unauthorized } from "@/lib/auth";
import { paymentEditFields } from "@/lib/records";
import { paymentRow } from "@/lib/serialize";
import { body } from "@/lib/validate";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await currentMember();
  if (!me) return unauthorized();
  if (me.role !== "admin") return forbidden();
  const { id } = await ctx.params;
  const f = await paymentEditFields(await body(req));
  if ("error" in f) return json({ error: f.error }, 400);
  const p = await prisma.payment.update({ where: { id }, data: f.data }).catch(() => null);
  if (!p) return json({ error: "Payment not found" }, 404);
  return json({ payment: paymentRow(p, me) });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await currentMember();
  if (!me) return unauthorized();
  if (me.role !== "admin") return forbidden();
  const { id } = await ctx.params;
  await prisma.payment.delete({ where: { id } }).catch(() => null);
  return json({ ok: true });
}
