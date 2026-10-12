import { prisma } from "@/lib/prisma";
import { currentMember, forbidden, json, unauthorized } from "@/lib/auth";
import { studentFields } from "@/lib/students";
import { body } from "@/lib/validate";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await currentMember();
  if (!me) return unauthorized();
  if (me.role !== "admin") return forbidden();
  const { id } = await ctx.params;
  const f = studentFields(await body(req), false);
  if ("error" in f) return json({ error: f.error }, 400);
  const student = await prisma.student.update({ where: { id }, data: f.data }).catch(() => null);
  if (!student) return json({ error: "Student not found" }, 404);
  return json({ student });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await currentMember();
  if (!me) return unauthorized();
  if (me.role !== "admin") return forbidden();
  const { id } = await ctx.params;
  await prisma.student.delete({ where: { id } }).catch(() => null);
  return json({ ok: true });
}
