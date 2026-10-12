import { prisma } from "@/lib/prisma";
import { currentMember, forbidden, json, unauthorized } from "@/lib/auth";
import { applicationRow } from "@/lib/serialize";
import { body, str } from "@/lib/validate";

const STATUSES = ["open", "contacted", "not_interested"];

// The setters' chase list: mark an applicant contacted / not interested, add a note.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await currentMember();
  if (!me) return unauthorized();
  if (!["admin", "dm_setter", "phone_setter", "closer"].includes(me.role)) return forbidden();
  const { id } = await ctx.params;
  const b = await body(req);
  const data: Record<string, unknown> = {};
  if ("chaseStatus" in b) {
    if (typeof b.chaseStatus !== "string" || !STATUSES.includes(b.chaseStatus)) return json({ error: "Unknown status" }, 400);
    data.chaseStatus = b.chaseStatus;
    data.chasedAt = new Date();
    data.chasedById = me.id;
  }
  if ("chaseNotes" in b) data.chaseNotes = str(b.chaseNotes, 1000);
  const a = await prisma.application.update({ where: { id }, data }).catch(() => null);
  if (!a) return json({ error: "Application not found" }, 404);
  return json({ application: applicationRow(a, me) });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await currentMember();
  if (!me) return unauthorized();
  if (me.role !== "admin") return forbidden();
  const { id } = await ctx.params;
  await prisma.application.delete({ where: { id } }).catch(() => null);
  return json({ ok: true });
}
