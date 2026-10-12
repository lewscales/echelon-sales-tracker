import { prisma } from "@/lib/prisma";
import { currentMember, forbidden, json, unauthorized } from "@/lib/auth";
import { notifyPayment } from "@/lib/notify";
import { paymentFields } from "@/lib/records";
import { paymentRow } from "@/lib/serialize";
import { body } from "@/lib/validate";

export async function POST(req: Request) {
  const me = await currentMember();
  if (!me) return unauthorized();
  if (me.role !== "admin") return forbidden();
  const f = await paymentFields(await body(req));
  if ("error" in f) return json({ error: f.error }, 400);
  const p = await prisma.payment.create({ data: f.data });
  await notifyPayment(p);
  return json({ payment: paymentRow(p, me) });
}
