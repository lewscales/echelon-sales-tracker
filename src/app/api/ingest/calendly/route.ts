import { createHmac } from "node:crypto";
import { json, safeEqual } from "@/lib/auth";
import { ingestCall } from "@/lib/ingestCall";

// Calendly webhook (invitee.created / invitee.canceled), no Zapier in between.
// Calendly signs each request with the subscription's signing key, which is set
// to INGEST_SECRET when the subscription is made (scripts/Connect Calendly.command).
//   Header: Calendly-Webhook-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "t.body">

const MAX_AGE_S = 5 * 60;

type QA = { question?: string; answer?: string };
type Invitee = {
  uri?: string;
  name?: string;
  email?: string;
  timezone?: string;
  text_reminder_number?: string | null;
  created_at?: string;
  rescheduled?: boolean;
  questions_and_answers?: QA[];
  tracking?: Record<string, string | null>;
  scheduled_event?: {
    name?: string;
    start_time?: string;
    event_memberships?: { user_email?: string }[];
  };
};

function signed(raw: string, header: string | null, key: string): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.trim().split("=") as [string, string]));
  const t = Number(parts.t);
  if (!parts.v1 || !Number.isFinite(t) || Math.abs(Date.now() / 1000 - t) > MAX_AGE_S) return false;
  const expected = createHmac("sha256", key).update(`${parts.t}.${raw}`).digest("hex");
  return safeEqual(parts.v1, expected);
}

/** The first answer whose question matches, e.g. a phone or Instagram question. */
const answerFor = (qa: QA[], re: RegExp) => qa.find((q) => q.question && re.test(q.question))?.answer ?? null;

export async function POST(req: Request) {
  const key = (process.env.CALENDLY_SIGNING_KEY || process.env.INGEST_SECRET || "").trim();
  const raw = await req.text();
  if (!key || !signed(raw, req.headers.get("calendly-webhook-signature"), key)) return json({ error: "Unauthorized" }, 401);

  let msg: { event?: string; payload?: Invitee };
  try {
    msg = JSON.parse(raw);
  } catch {
    return json({ error: "Bad JSON" }, 400);
  }
  const p = msg.payload ?? {};

  if (msg.event === "invitee.canceled") {
    const r = await ingestCall({ event: p.rescheduled ? "rescheduled" : "cancelled", externalId: p.uri, leadEmail: p.email });
    // Calendly retries anything that isn't 2xx: a cancel for a booking we never saw is not an error.
    return json(r.body, r.status === 404 ? 200 : r.status);
  }
  if (msg.event !== "invitee.created") return json({ ok: true, ignored: msg.event ?? null });

  const qa = p.questions_and_answers ?? [];
  const t = p.tracking ?? {};
  const r = await ingestCall({
    externalId: p.uri,
    leadName: p.name,
    leadEmail: p.email,
    leadPhone: p.text_reminder_number || answerFor(qa, /phone|whats ?app|number/i),
    instagram: answerFor(qa, /instagram|\big\b/i),
    leadTimezone: p.timezone,
    dateOfCall: p.scheduled_event?.start_time,
    dateBooked: p.created_at,
    calendarName: p.scheduled_event?.name,
    utmSource: t.utm_source,
    utmCampaign: t.utm_campaign,
    utmMedium: t.utm_medium,
    utmContent: t.utm_content,
    closer: p.scheduled_event?.event_memberships?.[0]?.user_email,
    bookingAnswers: Object.fromEntries(qa.filter((q) => q.question).map((q) => [q.question, q.answer ?? ""])),
  });
  return json(r.body, r.status);
}
