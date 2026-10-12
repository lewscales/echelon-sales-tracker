import { json, safeEqual } from "@/lib/auth";
import { sendReminder } from "@/lib/notify";

// Scheduled reminders, called by a scheduler (Render Cron Job, cron-job.org…):
//   POST /api/cron/eod-reminder       daily, 18:00 UTC
//   POST /api/cron/feedback-reminder  Fridays, 17:00 UTC
// Header: x-cron-secret: <CRON_SECRET>. Refuses everything until it's set.
export async function POST(req: Request, ctx: { params: Promise<{ job: string }> }) {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  if (secret.length < 16) return json({ error: "CRON_SECRET is not set" }, 503);
  const given = req.headers.get("x-cron-secret") ?? "";
  if (!safeEqual(given, secret)) return json({ error: "Unauthorized" }, 401);

  const { job } = await ctx.params;
  if (job === "eod-reminder") return json({ ok: true, posted: await sendReminder("eod") });
  if (job === "feedback-reminder") return json({ ok: true, posted: await sendReminder("feedback") });
  return json({ error: "Unknown job" }, 404);
}
