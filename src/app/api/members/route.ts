import { prisma } from "@/lib/prisma";
import { currentMember, forbidden, json, newCode, unauthorized } from "@/lib/auth";
import { memberRow } from "@/lib/serialize";
import { body, email, isRole, str, utm } from "@/lib/validate";

export async function POST(req: Request) {
  const me = await currentMember();
  if (!me) return unauthorized();
  if (me.role !== "admin") return forbidden();
  const b = await body(req);
  const name = str(b.name, 80);
  if (!name) return json({ error: "Enter their name" }, 400);
  if (!isRole(b.role)) return json({ error: "Pick their role" }, 400);
  const m = await prisma.member.create({
    data: { name, email: email(b.email), role: b.role, code: newCode(), utmCode: utm(b.utmCode) },
  });
  return json({ member: memberRow(m, me) });
}
