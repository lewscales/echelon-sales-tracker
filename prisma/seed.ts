// Demo data: a fictional sales team with ~60 days of history, shaped like the
// real funnel (application → booking → handoff → call → payment → onboarding),
// so every number, chart and list has something to show. No real people:
// every lead is made up and every email is @example.com.
//
//   npm run db:seed     (wipes the database first)
//   npm run db:clear    (removes everything but the admin seat)

import { PrismaClient } from "@prisma/client";
import { CALENDARS, PAYMENT_METHODS, PROGRAMS } from "../src/lib/config";
import { addDays, today } from "../src/lib/dates";
import { NO, YES } from "../src/lib/forms";

const prisma = new PrismaClient();

// Deterministic random, so the demo looks the same every time.
let seed = 42;
const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
const weighted = <T,>(xs: [T, number][]) => {
  const total = xs.reduce((s, x) => s + x[1], 0);
  let r = rnd() * total;
  for (const [v, w] of xs) if ((r -= w) <= 0) return v;
  return xs[xs.length - 1][0];
};

const FIRST = ["Aaron", "Bella", "Caleb", "Dana", "Elliot", "Freya", "Gabe", "Hana", "Isaac", "Jade", "Kian", "Lena", "Milo", "Nora", "Owen", "Priya", "Quinn", "Rosa", "Sami", "Tara", "Umar", "Vera", "Wes", "Yara", "Zane"];
const LAST = ["Abbott", "Brooks", "Carter", "Dalton", "Ellis", "Foster", "Grant", "Hayes", "Irwin", "Jensen", "Keller", "Lowe", "Mercer", "Nash", "Ortiz", "Price", "Reyes", "Shaw", "Turner", "Vance", "Wade", "Young"];

const at = (day: string, hour: number, min = 0) =>
  new Date(`${day}T${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:00Z`);
const isWeekend = (day: string) => [0, 6].includes(new Date(`${day}T12:00:00Z`).getUTCDay());

const BUDGETS = ["$1k – $3k", "$3k – $5k", "$5k – $10k", "$10k+", "Less than $1k (I'm sorry, we can't help you right now)"];

async function main() {
  await prisma.report.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.bookedCall.deleteMany();
  await prisma.application.deleteMany();
  await prisma.member.deleteMany();

  const adminCode = (process.env.ADMIN_CODE ?? "APEX-SALES-2026").trim().toUpperCase();
  const mk = (name: string, role: string, code: string, email: string, utmCode: string | null = null) =>
    prisma.member.create({ data: { name, role, code, email, utmCode } });
  await mk("Danny", "admin", adminCode, "admin@example.com");
  const jojo = await mk("Jojo", "closer", "TRK-CLOSE1", "jojo@example.com");
  const marcus = await mk("Marcus", "closer", "TRK-CLOSE2", "marcus@example.com");
  const david = await mk("David", "dm_setter", "TRK-DMSET1", "david@example.com", "ig-dm-dvd");
  const carlos = await mk("Carlos", "dm_setter", "TRK-DMSET2", "carlos@example.com", "ig-dm-carlos");
  const noah = await mk("Noah", "phone_setter", "TRK-PHONE1", "noah@example.com", "sdr-app");
  const closers = [jojo, jojo, marcus];
  const bySource: Record<string, string | null> = { "ig-dm-dvd": david.id, "ig-dm-carlos": carlos.id, "sdr-app": noah.id };

  const now = today();
  const start = addDays(now, -60);
  let leadN = 0;
  const lead = () => {
    const f = FIRST[leadN % FIRST.length];
    const l = LAST[(Math.floor(leadN / FIRST.length) + leadN * 7) % LAST.length];
    leadN++;
    return { name: `${f} ${l}`, email: `${f}.${l}${leadN}@example.com`.toLowerCase(), ig: `@${f.toLowerCase()}trades${leadN}`, phone: `+44 7700 9${String(leadN).padStart(5, "0")}` };
  };

  const counts = { apps: 0, calls: 0, payments: 0 };
  const plans: { name: string; email: string; amount: number; left: number; next: string; program: string; closerId: string; setterId: string | null }[] = [];

  for (let day = start; day <= addDays(now, 7); day = addDays(day, 1)) {
    const future = day > now;

    // ── Applications (Typeform) ──
    const nApps = future ? 0 : isWeekend(day) ? int(1, 3) : int(2, 6);
    for (let i = 0; i < nApps; i++) {
      const who = lead();
      const source = weighted<string>([["yt-bio", 5], ["ig-dm-dvd", 4], ["ig-dm-carlos", 3], ["youtube-fomc-live-stream-160926", 2], ["youtube-give-me-11-minutes-140926", 2], ["webinar", 1]]);
      const budget = weighted<string>([[BUDGETS[0], 3], [BUDGETS[1], 3], [BUDGETS[2], 2], [BUDGETS[3], 1], [BUDGETS[4], 2]]);
      const lowBudget = budget.startsWith("Less than");
      const appliedAt = at(day, int(8, 22), int(0, 59));
      const age = int(60, 100) / 100; // how old the application is relative to today, for chase states
      await prisma.application.create({
        data: {
          name: who.name,
          email: who.email,
          phone: who.phone,
          instagram: who.ig,
          utmSource: source,
          lowBudget,
          appliedAt,
          answers: JSON.stringify({
            "Do you trade full time?": pick(["I balance trading with work", "Yes, full time", "Not yet, I'm learning"]),
            "Current situation": pick(["Losing money, no consistent strategy", "Break-even for a year", "Profitable some months, blowing up others"]),
            "Time trading": pick(["Less than 6 months", "1–2 years", "3+ years"]),
            Age: String(int(19, 52)),
            Budget: budget,
          }),
          chaseStatus: rnd() < 0.25 * age ? "contacted" : "open",
        },
      });
      counts.apps++;

      // ~55% of decent-budget applicants book a strategy call within a few days.
      if (lowBudget || rnd() > 0.55) continue;
      const callDay = addDays(day, int(1, 4));
      if (callDay > addDays(now, 7)) continue;
      await makeCall(who, callDay, CALENDARS[pick([0, 1])], source, {});
    }

    // ── Direct bookings on the Application Call calendars (no prior Typeform) ──
    if (!future && rnd() < 0.5) {
      const who = lead();
      await makeCall(who, addDays(day, int(0, 3)), CALENDARS[pick([2, 3])], pick(["yt-bio", "sdr-app", "ig-dm-dvd"]), {
        "Are you ready to invest mid 4-figures into your trading?": pick(["Yes", "Yes, if it's the right fit"]),
        "Will you show up on time?": "Yes",
      });
    }

    // ── Payment-plan instalments that fall due today ──
    for (const p of plans) {
      if (p.left > 0 && p.next === day && !future) {
        const failedFirst = rnd() < 0.15;
        if (failedFirst) await pay(p.name, p.email, at(day, 9), p.amount, "split", p.program, p.closerId, p.setterId, "failed", "Card declined");
        // Most recover within a minute (checkout retry); a few stay failed.
        if (!failedFirst || rnd() < 0.75) await pay(p.name, p.email, at(day, 9, 1), p.amount, "split", p.program, p.closerId, p.setterId);
        p.left--;
        p.next = addDays(day, 30);
      }
    }
  }

  async function pay(
    name: string, email: string, date: Date, amount: number, paymentType: string, program: string,
    closerId: string, setterId: string | null, status = "succeeded", failureReason: string | null = null
  ) {
    await prisma.payment.create({
      data: {
        customerName: name, customerEmail: email, date, amount, paymentType, program, closerId, setterId, status, failureReason,
        product: "Echelon SDR Bootcamp", paymentMethod: pick(PAYMENT_METHODS),
      },
    });
    counts.payments++;
  }

  async function makeCall(
    who: ReturnType<typeof lead>, day: string, calendar: string, source: string, bookingAnswers: Record<string, string>
  ) {
    const now2 = today();
    const future = day > now2;
    const closer = pick(closers);
    const setterId = bySource[source] ?? null;
    const callAt = at(day, int(10, 19), pick([0, 30]));
    const reported = !future && (day < addDays(now2, -1) || rnd() < 0.4);
    let outcome: string | null = null;
    let qualified: string | null = null;
    let callRating: number | null = null;
    let revenue = 0;
    let cash = 0;
    let paymentType: string | null = null;
    let nextPaymentAmount: number | null = null;
    let nextPaymentDate: string | null = null;
    let paymentPlanDetails: string | null = null;
    const program = weighted<string>([[PROGRAMS[1], 6], [PROGRAMS[0], 2], [PROGRAMS[2], 2]]);
    if (reported) {
      outcome = weighted<string>([["closed", 24], ["not_closed", 26], ["follow_up", 10], ["no_show", 18], ["cancelled", 8], ["rescheduled", 8]]);
      const live = ["closed", "not_closed", "follow_up"].includes(outcome);
      if (live) {
        qualified = rnd() < 0.85 ? "qualified" : "dq";
        if (outcome === "closed") qualified = "qualified";
        callRating = int(5, 10);
      }
      if (outcome === "closed") {
        revenue = program === PROGRAMS[0] ? pick([8000, 9500]) : program === PROGRAMS[2] ? pick([1500, 2000]) : pick([4000, 5000, 5500]);
        paymentType = weighted<string>([["pif", 4], ["split", 4], ["deposit", 2]]);
        cash = paymentType === "pif" ? revenue : paymentType === "deposit" ? 500 : Math.round(revenue / 3);
        if (paymentType !== "pif") {
          const left = revenue - cash;
          const k = paymentType === "deposit" ? 1 : 2;
          nextPaymentAmount = Math.round(left / k);
          nextPaymentDate = addDays(day, paymentType === "deposit" ? 7 : 30);
          paymentPlanDetails = paymentType === "deposit" ? "Deposit now, balance in 7 days" : `${k} more monthly payments of $${nextPaymentAmount}`;
          plans.push({ name: who.name, email: who.email, amount: nextPaymentAmount, left: k, next: nextPaymentDate, program, closerId: closer.id, setterId });
        }
      } else if (outcome === "follow_up" && rnd() < 0.2) {
        cash = 500;
      }
    }
    // Most upcoming and recent calls have a setter handoff.
    const handoff =
      setterId && rnd() < 0.75
        ? JSON.stringify({
            situation: pick(["Works full time, trades the London open", "Student, small account, very motivated", "Ex-prop trader, lost funding twice"]),
            pain: pick(["Keeps revenge trading after a loss", "No clear entry model", "Overtrades on news days"]),
            desired: pick(["Consistent 2–3% a month", "Pass a funded challenge", "Replace their salary in 12 months"]),
            bottlenecks: pick(["Discipline and risk management", "Doesn't journal", "Strategy hopping"]),
            beliefs: pick(["Thinks they need more indicators", "Believes trading is gambling", ""]),
          })
        : null;

    await prisma.bookedCall.create({
      data: {
        leadName: who.name,
        leadEmail: who.email,
        leadPhone: who.phone,
        instagram: who.ig,
        leadTimezone: pick(["Europe/London", "America/New_York", "Europe/Berlin", "Asia/Dubai"]),
        calendarName: calendar,
        program: outcome === "closed" ? program : null,
        dateBooked: at(addDays(day, -int(1, 4)), 12),
        dateOfCall: callAt,
        utmSource: source,
        bookingAnswers: JSON.stringify(bookingAnswers),
        setterId,
        closerId: closer.id,
        handoff,
        handoffById: handoff ? setterId : null,
        handoffAt: handoff ? at(addDays(day, -1), 20) : null,
        outcome,
        callType: reported ? (rnd() < 0.85 ? "first_call" : "follow_up_call") : null,
        qualified,
        callRating,
        recordingUrl: callRating ? `https://example.com/recordings/${who.email.split("@")[0]}` : null,
        revenue,
        cashOnCall: cash,
        paymentType,
        paymentMethod: paymentType ? pick(PAYMENT_METHODS) : null,
        pif: paymentType === "pif",
        nextPaymentAmount,
        nextPaymentDate,
        paymentPlanDetails,
        notes: outcome === "not_closed" ? pick(["Needs to speak to partner", "Money objection", "Timing, wants to start next quarter"]) : outcome === "closed" ? "Strong fit, onboarding link sent" : null,
        reportedAt: reported ? callAt : null,
        reportedById: reported ? closer.id : null,
      },
    });
    counts.calls++;
    if (cash > 0) {
      // Checkout retries: sometimes a failed attempt lands a minute before the success.
      if (rnd() < 0.2) await pay(who.name, who.email, callAt, cash, paymentType ?? "deposit", program, closer.id, setterId, "failed", "insufficient_funds");
      await pay(who.name, who.email, new Date(callAt.getTime() + 60_000), cash, paymentType ?? "deposit", program, closer.id, setterId);
      if (outcome === "closed" && rnd() < 0.7) {
        await prisma.report.create({
          data: {
            kind: "onboarding",
            memberId: null,
            day: addDays(day, int(0, 2)) > now2 ? now2 : addDays(day, int(0, 2)),
            data: JSON.stringify({
              name: who.name,
              email: who.email,
              whatsapp: who.phone,
              whyJoined: pick(["I'm tired of guessing my entries", "Saw the student results and wanted the same structure"]),
              firstHeard: pick(["YouTube, the FOMC live stream", "A friend sent me a reel", "Instagram, a few months ago"]),
              biggestGoal: pick(["Pass a funded challenge this year", "Trade part-time for consistent income"]),
              resonated: pick(["How honest the breakdowns are", "The focus on risk management"]),
              hesitation: pick(["The price", "Whether I'd have time", ""]),
            }),
          },
        });
      }
    }
  }

  // ── End-of-day reports (weekdays, the odd missed day) ──
  let reports = 0;
  const report = async (kind: string, memberId: string, day: string, data: Record<string, string | number>) => {
    await prisma.report.create({ data: { kind, memberId, day, data: JSON.stringify(data), createdAt: at(day, 22, 30) } });
    reports++;
  };
  const yn = (p: number) => (rnd() < p ? YES : NO);
  const reflect = () => ({
    satisfaction: int(5, 10),
    struggle: pick(["Getting replies after the first message", "Qualifying without sounding salesy", "Booking the pitched ones", "Time management"]),
    bottleneck: pick(["Lead volume after lunch", "Too many tyre-kickers", "Leads ghosting after the pitch", "Calendar availability"]),
    wentWell: pick(["Strong openers, lots of replies", "Booked two from old follow-ups", "Kept the convos moving fast", "Good energy all day"]),
    improve: pick(["Qualify harder before pitching", "Faster follow-up on warm leads", "Tighter call reminders", "Less time on unqualified convos"]),
    crmUpdated: yn(0.9),
    remindersDone: yn(0.85),
    sentForReview: yn(0.75),
  });
  for (let day = start; day <= now; day = addDays(day, 1)) {
    if (isWeekend(day)) continue;
    for (const s of [david, carlos]) {
      if (rnd() < 0.08) continue;
      const out = int(25, 60);
      const replies = Math.round(out * (0.15 + rnd() * 0.15));
      const convos = Math.round(replies * 0.8);
      const q = Math.round(convos * (0.3 + rnd() * 0.3));
      const pitched = Math.max(0, q - int(0, 2));
      await report("dm_eod", s.id, day, {
        hours: int(4, 8),
        ...reflect(),
        outbounds: out,
        inbounds: int(0, 4),
        followUps: int(10, 25),
        replies,
        convos,
        qualifiedConvos: q,
        pitchedCalls: pitched,
        callsBooked: Math.round(pitched * (0.2 + rnd() * 0.3)),
        callsRejected: int(0, 2),
        leadQuality: int(4, 9),
      });
    }
    if (rnd() > 0.15) {
      const td = int(15, 35);
      const od = int(50, 90);
      const pitched = int(2, 7);
      await report("sdr_eod", noah.id, day, {
        hours: int(5, 8),
        ...reflect(),
        triageDials: td,
        triagePickUps: Math.round(td * (0.3 + rnd() * 0.2)),
        outboundDials: od,
        outboundPickUps: Math.round(od * (0.15 + rnd() * 0.15)),
        outboundFollowUps: int(3, 12),
        qualifiedConvos: pitched + int(0, 3),
        pitchedCalls: pitched,
        callsBooked: Math.round(pitched * (0.3 + rnd() * 0.4)),
        callsRejected: int(0, 2),
        triageQuality: int(4, 9),
        outboundQuality: int(3, 8),
      });
    }
    for (const c of [jojo, marcus]) {
      if (rnd() < 0.15) continue;
      const r = reflect();
      await report("closer_eod", c.id, day, {
        satisfaction: r.satisfaction,
        struggle: pick(["Pre-framing price", "Partner objections", "Keeping calls under an hour"]),
        bottleneck: pick(["No-shows", "Lead quality from IG", "Too many unqualified bookings"]),
        wentWell: pick(["Tight discovery on every call", "Handled the money objection well", "Two closes on follow-ups"]),
        improve: pick(["Slow down the pitch", "Pre-frame price earlier", "Follow-up cadence"]),
        crmUpdated: r.crmUpdated,
        remindersDone: r.remindersDone,
        sentForReview: r.sentForReview,
      });
    }
  }

  // ── Weekly feedback (Fridays) ──
  for (let day = start; day <= now; day = addDays(day, 1)) {
    if (new Date(`${day}T12:00:00Z`).getUTCDay() !== 5) continue;
    for (const m of [jojo, david, carlos]) {
      if (rnd() < 0.4) continue;
      await report("feedback", m.id, day, {
        leadQuality: int(2, 5),
        goals: pick(["Quit their job within a year", "Pass a funded challenge", "Grow a small account consistently"]),
        pains: pick(["Blown accounts", "No time to sit at the screens", "Information overload from YouTube"]),
        objections: pick(["Price", "Scared it's another course that won't work", "Needs partner sign-off"]),
        phrases: pick(['"I just need a system I can trust"', '"I\'ve tried everything"', '"Is 90 minutes a day really enough?"']),
        journey: pick(["Problem-aware, comparing mentors", "Beginner, low capital", "Intermediate, inconsistent"]),
        other: pick(["YouTube leads are much warmer than IG", "", "More FOMC-style live streams please"]),
      });
    }
  }

  console.log(`Seeded: 6 members, ${counts.apps} applications, ${counts.calls} calls, ${counts.payments} payments, ${reports} team reports.`);
  console.log(`Logins: admin ${adminCode} · closer TRK-CLOSE1 (Jojo) · DM setter TRK-DMSET1 (David) · phone setter TRK-PHONE1 (Noah)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
