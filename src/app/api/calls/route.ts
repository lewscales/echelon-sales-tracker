import { prisma } from "@/lib/prisma";
import { currentMember, forbidden, json, unauthorized } from "@/lib/auth";
import { notifyBooking } from "@/lib/notify";
import { callFields } from "@/lib/records";
import { callRow } from "@/lib/serialize";
import { body } from "@/lib/validate";

// Add a booked call by hand (admins). Calls normally arrive via /api/ingest/call.
export async function POST(req: Request) {
  const me = await currentMember();
  if (!me) return unauthorized();
  if (me.role !== "admin") return forbidden();
  const f = await callFields(await body(req), false);
  if ("error" in f) return json({ error: f.error }, 400);
  const c = await prisma.bookedCall.create({ data: f.data as never });
  await notifyBooking(c);
  return json({ call: callRow(c, me) });
}
