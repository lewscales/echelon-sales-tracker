import { prisma } from "@/lib/prisma";
import { currentMember, forbidden, json, newCode, unauthorized } from "@/lib/auth";
import { memberRow } from "@/lib/serialize";
import { body, email, isRole, str, utm } from "@/lib/validate";

// Edit a team member: name, email, role, active, or { newCode: true } to issue
// a fresh login code (the old one stops working immediately).
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await currentMember();
  if (!me) return unauthorized();
  if (me.role !== "admin") return forbidden();
  const { id } = await ctx.params;
  const target = await prisma.member.findUnique({ where: { id } });
  if (!target) return json({ error: "Not found" }, 404);
  const b = await body(req);

  const data: Record<string, unknown> = {};
  if ("name" in b) {
    const n = str(b.name, 80);
    if (!n) return json({ error: "Name can't be empty" }, 400);
    data.name = n;
  }
  if ("email" in b) data.email = email(b.email);
  if ("utmCode" in b) data.utmCode = utm(b.utmCode);
  if ("role" in b) {
    if (!isRole(b.role)) return json({ error: "Unknown role" }, 400);
    if (target.id === me.id && b.role !== "admin") return json({ error: "You can't remove your own admin access" }, 400);
    data.role = b.role;
  }
  if ("active" in b) {
    if (target.id === me.id && b.active === false) return json({ error: "You can't deactivate yourself" }, 400);
    data.active = b.active === true;
  }
  if (b.newCode === true) {
    if (target.code === (process.env.ADMIN_CODE ?? "").trim().toUpperCase())
      return json({ error: "The owner code is set in the server settings (ADMIN_CODE)" }, 400);
    data.code = newCode();
  }
  const m = await prisma.member.update({ where: { id }, data });
  return json({ member: memberRow(m, me) });
}
