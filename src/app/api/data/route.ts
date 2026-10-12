import { prisma } from "@/lib/prisma";
import { currentMember, json, unauthorized } from "@/lib/auth";
import { applicationRow, callRow, memberRow, paymentRow, reportRow } from "@/lib/serialize";
import { appUrl, slackConfigured } from "@/lib/slack";
import type { DataBundle } from "@/lib/types";
import type { Role } from "@/lib/config";

export const dynamic = "force-dynamic";

// One bundle with everything the signed-in person may see. A team tracker is
// small (thousands of rows, not millions), so the screen filters client-side
// and every filter change is instant.
export async function GET() {
  const me = await currentMember();
  if (!me) return unauthorized();
  const admin = me.role === "admin";

  const [members, calls, payments, applications, reports] = await Promise.all([
    prisma.member.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.bookedCall.findMany({ orderBy: { dateOfCall: "desc" } }),
    prisma.payment.findMany({ orderBy: { date: "desc" } }),
    prisma.application.findMany({ orderBy: { appliedAt: "desc" } }),
    // Admins read every report (incl. client onboarding). Everyone else reads their
    // own, plus the team's setter EOD numbers so DM / SDR Stats are team-wide (as in Airtable).
    prisma.report.findMany({
      where: admin ? {} : { OR: [{ memberId: me.id }, { kind: { in: ["dm_eod", "sdr_eod"] } }] },
      orderBy: [{ day: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  // Booked = an application whose email has a booked call (latest call wins).
  const callByEmail = new Map<string, string>();
  for (const c of [...calls].reverse()) if (c.leadEmail) callByEmail.set(c.leadEmail.toLowerCase(), c.id);

  // Someone else's EOD: activity counts only, never their written reflection,
  // hours or self-ratings.
  const PRIVATE = new Set(["hours", "satisfaction", "leadQuality", "triageQuality", "outboundQuality"]);
  const numbersOnly = (r: (typeof reports)[number]) => {
    if (admin || r.memberId === me.id) return reportRow(r);
    const row = reportRow(r);
    row.data = Object.fromEntries(Object.entries(row.data).filter(([k, v]) => typeof v === "number" && !PRIVATE.has(k)));
    return row;
  };

  const bundle: DataBundle = {
    me: { id: me.id, name: me.name, role: me.role as Role },
    members: members.filter((m) => admin || m.active).map((m) => memberRow(m, me)),
    calls: calls.map((c) => callRow(c, me)),
    payments: payments.map((p) => paymentRow(p, me)),
    applications: applications.map((a) => applicationRow(a, me, (a.email && callByEmail.get(a.email.toLowerCase())) || null)),
    reports: reports.map(numbersOnly),
    appUrl: appUrl(),
    ...(admin ? { slack: slackConfigured(), cronReady: (process.env.CRON_SECRET ?? "").trim().length >= 16 } : {}),
  };
  return json(bundle);
}
