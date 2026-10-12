import { prisma } from "@/lib/prisma";
import { json } from "@/lib/auth";
import { today } from "@/lib/dates";
import { cleanSubmission, formFor } from "@/lib/forms";
import { notifyReport } from "@/lib/notify";
import { body } from "@/lib/validate";

// The client onboarding form is public (new clients have no login), so it gets
// basic abuse protection: a hidden honeypot field and a per-address rate limit.
const hits = new Map<string, number[]>();
const WINDOW = 60 * 60 * 1000;
const LIMIT = 8;

export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW);
  if (recent.length >= LIMIT) return json({ error: "Too many submissions. Try again later." }, 429);
  hits.set(ip, [...recent, now]);

  const b = await body(req);
  // Bots fill every field; people never see this one.
  if (typeof b.website === "string" && b.website.trim() !== "") return json({ ok: true });

  const form = formFor("onboarding")!;
  const raw = b.data && typeof b.data === "object" ? (b.data as Record<string, unknown>) : {};
  const clean = cleanSubmission(form, raw);
  if ("error" in clean) return json({ error: clean.error }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(clean.data.email))) return json({ error: "Enter a valid email address" }, 400);

  const day = today();
  await prisma.report.create({ data: { kind: "onboarding", memberId: null, day, data: JSON.stringify(clean.data) } });
  await notifyReport(form, clean.data, day, null);
  return json({ ok: true });
}
