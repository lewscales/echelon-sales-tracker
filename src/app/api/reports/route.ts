import { prisma } from "@/lib/prisma";
import { currentMember, forbidden, json, unauthorized } from "@/lib/auth";
import { cleanSubmission, formFor } from "@/lib/forms";
import { reportRow } from "@/lib/serialize";
import { body } from "@/lib/validate";
import { today, addDays } from "@/lib/dates";
import { notifyReport } from "@/lib/notify";

export async function POST(req: Request) {
  const me = await currentMember();
  if (!me) return unauthorized();
  const b = await body(req);

  const form = formFor(String(b.kind ?? ""));
  if (!form) return json({ error: "Unknown form" }, 400);
  if (form.public) return json({ error: "This form is filled in by the client through its public link" }, 400);
  if (!form.roles.includes(me.role as never)) return forbidden();

  // The day a report is for: today by default; back-filling up to 14 days is
  // allowed (people forget), the future is not.
  const now = today();
  const day = typeof b.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.day) ? b.day : now;
  if (day > now) return json({ error: "That date is in the future" }, 400);
  if (day < addDays(now, -14)) return json({ error: "You can only back-fill the last 14 days" }, 400);

  const raw = b.data && typeof b.data === "object" ? (b.data as Record<string, unknown>) : {};
  const clean = cleanSubmission(form, raw);
  if ("error" in clean) return json({ error: clean.error }, 400);
  const data = JSON.stringify(clean.data);

  if (form.daily) {
    // One EOD per person per day — a resubmission corrects it rather than doubling the numbers.
    const existing = await prisma.report.findFirst({ where: { kind: form.kind, memberId: me.id, day } });
    if (existing) {
      const r = await prisma.report.update({ where: { id: existing.id }, data: { data } });
      await notifyReport(form, clean.data, day, me, true);
      return json({ report: reportRow(r), replaced: true });
    }
  }
  const r = await prisma.report.create({ data: { kind: form.kind, memberId: me.id, day, data } });
  await notifyReport(form, clean.data, day, me);
  return json({ report: reportRow(r), replaced: false });
}
