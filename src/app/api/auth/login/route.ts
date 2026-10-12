import { prisma } from "@/lib/prisma";
import { json, safeEqual, setSession } from "@/lib/auth";
import { body, str } from "@/lib/validate";

// Login is by personal code only. The ADMIN_CODE from the environment is the
// bootstrap key: the first time it's used it creates the owner's admin seat.
export async function POST(req: Request) {
  const b = await body(req);
  const code = (str(b.code, 60) ?? "").toUpperCase();
  if (!code) return json({ error: "Enter your access code" }, 400);

  const adminCode = (process.env.ADMIN_CODE ?? "").trim().toUpperCase();
  if (adminCode && safeEqual(code, adminCode)) {
    const owner = await prisma.member.upsert({
      where: { code: adminCode },
      update: { active: true },
      create: { code: adminCode, name: "Owner", role: "admin" },
    });
    await setSession(owner.id);
    return json({ id: owner.id, name: owner.name, role: owner.role });
  }

  const m = await prisma.member.findUnique({ where: { code } });
  if (!m || !m.active) return json({ error: "That code isn't recognised. Ask your admin for yours." }, 403);
  await setSession(m.id);
  return json({ id: m.id, name: m.name, role: m.role });
}
