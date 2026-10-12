import { prisma } from "@/lib/prisma";
import { currentMember, forbidden, json, unauthorized } from "@/lib/auth";
import { studentFields } from "@/lib/students";
import { body } from "@/lib/validate";

export async function GET() {
  const me = await currentMember();
  if (!me) return unauthorized();
  if (me.role !== "admin") return forbidden();
  const students = await prisma.student.findMany({ orderBy: { createdAt: "asc" } });
  return json({ students });
}

export async function POST(req: Request) {
  const me = await currentMember();
  if (!me) return unauthorized();
  if (me.role !== "admin") return forbidden();
  const f = studentFields(await body(req), true);
  if ("error" in f) return json({ error: f.error }, 400);
  const student = await prisma.student.create({ data: { ...f.data, name: f.data.name! } });
  return json({ student });
}
