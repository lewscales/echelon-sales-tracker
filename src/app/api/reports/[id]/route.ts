import { prisma } from "@/lib/prisma";
import { currentMember, forbidden, json, unauthorized } from "@/lib/auth";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await currentMember();
  if (!me) return unauthorized();
  const { id } = await ctx.params;
  const r = await prisma.report.findUnique({ where: { id } });
  if (!r) return json({ error: "Not found" }, 404);
  if (me.role !== "admin" && r.memberId !== me.id) return forbidden();
  await prisma.report.delete({ where: { id } });
  return json({ ok: true });
}
