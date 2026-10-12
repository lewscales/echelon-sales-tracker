import { prisma } from "@/lib/prisma";
import { currentMember, forbidden, json, unauthorized } from "@/lib/auth";
import { notifyApplication } from "@/lib/notify";
import { applicationFields } from "@/lib/records";
import { applicationRow } from "@/lib/serialize";
import { body } from "@/lib/validate";

// Add an application by hand (admins). They normally arrive via /api/ingest/application.
export async function POST(req: Request) {
  const me = await currentMember();
  if (!me) return unauthorized();
  if (me.role !== "admin") return forbidden();
  const f = applicationFields(await body(req));
  if ("error" in f) return json({ error: f.error }, 400);
  const a = await prisma.application.create({ data: f.data });
  await notifyApplication(a);
  return json({ application: applicationRow(a, me) });
}
