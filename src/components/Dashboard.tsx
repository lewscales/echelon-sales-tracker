"use client";

import { useMemo, useState } from "react";
import { CALL_TYPES, OUTCOMES, PAYMENT_TYPES, PROGRAMS, QUALIFIED, UTM_SOURCES } from "@/lib/config";
import { dayOf, daysBetween, fmtDay, fmtTime, resolveRange, type DateRange } from "@/lib/dates";
import { activityStats, cashStats, salesStats, upcomingPayments } from "@/lib/metrics";
import type { CallRow, PaymentRow } from "@/lib/types";
import type { Ctx } from "./App";
import { BarChart, Donut, stableOrder, toSlices } from "./charts";
import {
  DateFilter,
  MultiFilter,
  Pill,
  Section,
  Stat,
  Table,
  fmtMoney,
  fmtMoneyShort,
  fmtNum,
  fmtPct,
  type Option,
} from "./ui";

const LAST30: DateRange = { preset: "last30" };

/** Fixed options from config, plus anything older records carry. */
function optionsFrom(fixed: string[], seen: (string | null)[]): Option[] {
  const all = [...fixed];
  for (const v of seen) if (v && !all.includes(v)) all.push(v);
  return all.map((v) => ({ value: v, label: v }));
}

export function outcomeTone(o: string | null): "good" | "bad" | "warn" | "brand" | "plain" {
  if (o === "closed") return "good";
  if (o === "no_show" || o === "cancelled") return "bad";
  if (o === "follow_up" || o === "rescheduled") return "warn";
  if (o === "not_closed") return "plain";
  return "brand";
}
export function OutcomePill({ outcome }: { outcome: string | null }) {
  return <Pill tone={outcomeTone(outcome)}>{outcome ? OUTCOMES[outcome as keyof typeof OUTCOMES] ?? outcome : "Awaiting report"}</Pill>;
}

export function Dashboard({ ctx }: { ctx: Ctx }) {
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">Team dashboard</div>
          <h1 className="display text-3xl sm:text-4xl font-extrabold tracking-tight mt-1">
            Hey {ctx.data.me.name.split(" ")[0]}, here&apos;s the floor.
          </h1>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[
            ["cash", "Cash collected"],
            ["sales", "Sales stats"],
            ["setters", "Setter stats"],
          ].map(([id, label]) => (
            <button key={id} className="btn-ghost !py-2 !px-3 !text-xs" onClick={() => jump(id)}>
              {label}
            </button>
          ))}
          <button className="btn-ghost !py-2 !px-3 !text-xs" onClick={() => window.print()}>
            Print / Save PDF
          </button>
        </div>
      </div>
      <CashSection ctx={ctx} />
      <SalesSection ctx={ctx} />
      <SetterSection ctx={ctx} />
    </div>
  );
}

// ─────────────────────────────── Total Cash Collected ───────────────────────────────

function CashSection({ ctx }: { ctx: Ctx }) {
  const { data, nameOf } = ctx;
  const [range, setRange] = useState<DateRange>(LAST30);
  const [paymentType, setPaymentType] = useState<string[]>([]);
  const [program, setProgram] = useState<string[]>([]);
  const [setter, setSetter] = useState<string[]>([]);
  const [closer, setCloser] = useState<string[]>([]);

  const s = useMemo(
    () => cashStats(data.payments, { range: resolveRange(range), paymentType, program, setter, closer }),
    [data.payments, range, paymentType, program, setter, closer]
  );

  const setterOpts = data.members.filter((m) => m.role === "dm_setter" || m.role === "phone_setter").map((m) => ({ value: m.id, label: m.name }));
  const closerOpts = data.members.filter((m) => m.role === "closer" || m.role === "admin").map((m) => ({ value: m.id, label: m.name }));
  const showEmail = data.me.role === "admin" || data.me.role === "closer";

  return (
    <Section
      id="cash"
      title="Total Cash Collected"
      blurb="Every payment that landed: new sales and payment-plan instalments."
      filters={
        <>
          <DateFilter label="Date of payment" value={range} onChange={setRange} />
          <MultiFilter
            label="Payment type"
            options={Object.entries(PAYMENT_TYPES).map(([value, label]) => ({ value, label }))}
            value={paymentType}
            onChange={setPaymentType}
          />
          <MultiFilter label="Program" options={optionsFrom(PROGRAMS, data.payments.map((p) => p.program))} value={program} onChange={setProgram} />
          <MultiFilter label="Setter" options={setterOpts} value={setter} onChange={setSetter} />
          <MultiFilter label="Closer" options={closerOpts} value={closer} onChange={setCloser} />
        </>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="col-span-2 sunken px-5 py-4 relative overflow-hidden">
          <div className="eyebrow">Cash collected</div>
          <div className="figure text-gold text-5xl sm:text-6xl mt-3">{fmtMoney(s.total)}</div>
          <div className="text-faint text-xs mt-2">
            {fmtNum(s.count)} payment{s.count === 1 ? "" : "s"}
          </div>
        </div>
        <Stat label="PIF" value={fmtMoney(s.pifTotal)} sub={s.total ? `${fmtPct(s.pifTotal / s.total)} of cash` : undefined} />
        <Stat
          label="Split + Deposit"
          value={fmtMoney(s.splitTotal + s.depositTotal)}
          sub={`Split ${fmtMoney(s.splitTotal)} · Deposit ${fmtMoney(s.depositTotal)}`}
        />
      </div>

      <div className="sunken p-4">
        <div className="flex items-baseline justify-between mb-1">
          <div className="eyebrow">{s.bucket === "week" ? "Cash per week" : "Cash per day"}</div>
        </div>
        {s.series.length ? (
          <BarChart
            data={s.series}
            weekly={s.bucket === "week"}
            format={(n) => fmtMoney(n)}
            formatAxis={fmtMoneyShort}
            height={240}
            label="Cash collected over time"
          />
        ) : (
          <div className="h-[200px] grid place-items-center text-faint text-sm">No payments in this view</div>
        )}
      </div>

      <Table<PaymentRow>
        rows={s.rows}
        rowKey={(p) => p.id}
        noun="payments"
        empty="No payments match these filters."
        columns={[
          { key: "date", label: "Date", render: (p) => fmtDay(dayOf(p.date)) },
          { key: "name", label: "Customer", render: (p) => <span className="font-semibold">{p.customerName}</span> },
          ...(showEmail ? [{ key: "email", label: "Email", render: (p: PaymentRow) => <span className="text-muted">{p.customerEmail ?? "–"}</span> }] : []),
          { key: "amount", label: "Amount", align: "right", render: (p) => <span className="text-gold font-semibold">{fmtMoney(p.amount, true)}</span> },
          {
            key: "type",
            label: "Type",
            render: (p) => <Pill tone={p.paymentType === "pif" ? "good" : "plain"}>{PAYMENT_TYPES[p.paymentType as keyof typeof PAYMENT_TYPES] ?? p.paymentType}</Pill>,
          },
          { key: "product", label: "Product", render: (p) => p.product ?? "–" },
          { key: "method", label: "Method", render: (p) => p.paymentMethod ?? "–" },
          { key: "program", label: "Program", render: (p) => p.program ?? "–" },
          { key: "setter", label: "Setter", render: (p) => nameOf(p.setterId) },
          { key: "closer", label: "Closer", render: (p) => nameOf(p.closerId) },
          ...(data.me.role === "admin" ? [{ key: "notes", label: "Notes", className: "max-w-[220px] truncate", render: (p: PaymentRow) => p.notes ?? "" }] : []),
        ]}
      />

      {showEmail && <MoneyWatch ctx={ctx} failed={s.failed} />}
    </Section>
  );
}

// ─────────────────────────────── Sales Stats ───────────────────────────────

function SalesSection({ ctx }: { ctx: Ctx }) {
  const { data, nameOf } = ctx;
  const [range, setRange] = useState<DateRange>(LAST30);
  const [closer, setCloser] = useState<string[]>([]);
  const [callType, setCallType] = useState<string[]>([]);
  const [program, setProgram] = useState<string[]>([]);
  const [utmSource, setUtmSource] = useState<string[]>([]);

  const s = useMemo(
    () => salesStats(data.calls, { range: resolveRange(range), closer, callType, program, utmSource }),
    [data.calls, range, closer, callType, program, utmSource]
  );

  const closers = data.members.filter((m) => m.role === "closer" || m.role === "admin");
  const closerOrder = data.members.filter((m) => m.role === "closer").map((m) => m.id);
  const sourceOrder = stableOrder(UTM_SOURCES, data.calls.map((c) => c.utmSource || "(none)"));
  const showEmail = data.me.role === "admin" || data.me.role === "closer";

  return (
    <Section
      id="sales"
      title="Sales Stats"
      blurb="Booked calls and what happened on them, from the closers' Sales Call Reports."
      filters={
        <>
          <DateFilter label="Date of call" value={range} onChange={setRange} />
          <MultiFilter label="Closer" options={closers.map((m) => ({ value: m.id, label: m.name }))} value={closer} onChange={setCloser} />
          <MultiFilter
            label="Call type"
            options={Object.entries(CALL_TYPES).map(([value, label]) => ({ value, label }))}
            value={callType}
            onChange={setCallType}
          />
          <MultiFilter label="Program" options={optionsFrom(PROGRAMS, data.calls.map((c) => c.program))} value={program} onChange={setProgram} />
          <MultiFilter label="Lead source" options={optionsFrom(UTM_SOURCES, data.calls.map((c) => c.utmSource))} value={utmSource} onChange={setUtmSource} />
        </>
      }
    >
      <div>
        <div className="eyebrow mb-2">Money</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          <Stat label="Total revenue" value={fmtMoney(s.revenue)} tone="money" sub="Contract value closed" />
          <Stat label="Cash collected on calls" value={fmtMoney(s.cashClosed)} tone="money" sub="On closed deals" />
          <Stat label="Average deal size" value={fmtMoney(s.avgDeal)} />
          <Stat label="Average order value" value={fmtMoney(s.aov)} sub="Cash per close" />
          <Stat label="Cash per booked call" value={fmtMoney(s.cashPerBooked)} />
          <Stat label="Cash per live call" value={fmtMoney(s.cashPerLive)} />
        </div>
      </div>

      <div>
        <div className="eyebrow mb-2">Calls</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Stat label="Calls booked" value={fmtNum(s.booked)} sub={s.pending ? `${s.pending} awaiting report` : "All reported"} />
          <Stat label="Close rate" value={fmtPct(s.closeRate)} tone="good" sub="Closed ÷ live calls" />
          <Stat label="Deals closed" value={fmtNum(s.closed)} tone="good" />
          <Stat label="Show rate" value={fmtPct(s.showRate)} sub="Showed ÷ (showed + no-shows)" />
          <Stat label="No-show rate" value={fmtPct(s.noShowRate)} tone={s.noShow ? "bad" : undefined} sub={`${s.noShow} no-shows`} />
          <Stat label="Cancelled" value={fmtNum(s.cancelled)} sub={`${fmtPct(s.cancelRate)} of booked`} />
          <Stat label="Rescheduled" value={fmtNum(s.rescheduled)} sub={`${fmtPct(s.rescheduleRate)} of booked`} />
          <Stat label="Follow-up calls" value={fmtNum(s.followUp)} sub={`${fmtPct(s.followUpRate)} of shows`} />
          <Stat label="PIFs" value={fmtNum(s.pifs)} sub={`${fmtPct(s.pifRate)} of closes`} />
          <Stat label="Live calls" value={fmtNum(s.shows)} sub="Showed up" />
          <Stat label="Close rate (qualified)" value={fmtPct(s.closeRateQualified)} tone="good" sub="Closed ÷ qualified live calls" />
          <Stat label="DQ calls" value={fmtNum(s.dq)} sub={`${fmtPct(s.dqRate)} of booked`} />
          <Stat label="Calls reported" value={fmtNum(s.reported)} sub="Outcome logged" />
          <Stat label="Avg call rating" value={s.avgRating != null ? `${s.avgRating.toFixed(1)} / 10` : "–"} sub="Closer's own score" />
          <Stat label="Pending reports" value={fmtNum(s.pending)} tone={s.pending ? "bad" : undefined} sub="Calls with no outcome" />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        <div className="sunken p-4">
          <div className="eyebrow mb-3">Booked calls by lead source</div>
          <Donut data={toSlices(s.bySource, sourceOrder, (k) => k)} label="Booked calls by lead source" noun="calls" />
        </div>
        <div className="sunken p-4">
          <div className="eyebrow mb-3">Booked calls by closer</div>
          <Donut
            data={toSlices(s.byCloser, closerOrder, (k) => (k === "(unassigned)" ? "Unassigned" : nameOf(k)))}
            label="Booked calls by closer"
            noun="calls"
          />
        </div>
      </div>

      <Table<CallRow>
        rows={s.rows}
        rowKey={(c) => c.id}
        noun="calls"
        empty="No booked calls match these filters."
        onRowClick={(c) => ctx.openCall(c.id)}
        columns={[
          { key: "when", label: "Call date", render: (c) => `${fmtDay(dayOf(c.dateOfCall))} · ${fmtTime(c.dateOfCall)}` },
          { key: "lead", label: "Lead", render: (c) => <span className="font-semibold">{c.leadName}</span> },
          ...(showEmail ? [{ key: "email", label: "Email", render: (c: CallRow) => <span className="text-muted">{c.leadEmail ?? "–"}</span> }] : []),
          { key: "booked", label: "Date booked", render: (c) => fmtDay(dayOf(c.dateBooked)) },
          { key: "cal", label: "Booked on calendar", render: (c) => c.calendarName ?? "–" },
          { key: "outcome", label: "Outcome", render: (c) => <OutcomePill outcome={c.outcome} /> },
          { key: "type", label: "Call type", render: (c) => (c.callType ? CALL_TYPES[c.callType as keyof typeof CALL_TYPES] : "–") },
          { key: "rev", label: "Revenue", align: "right", render: (c) => (c.revenue ? fmtMoney(c.revenue) : "–") },
          { key: "cash", label: "Cash", align: "right", render: (c) => (c.cashOnCall ? <span className="text-gold">{fmtMoney(c.cashOnCall)}</span> : "–") },
          { key: "ptype", label: "Payment", render: (c) => (c.paymentType ? <Pill tone={c.pif ? "good" : "plain"}>{PAYMENT_TYPES[c.paymentType as keyof typeof PAYMENT_TYPES] ?? c.paymentType}</Pill> : "") },
          { key: "q", label: "Qualified", render: (c) => (c.qualified ? <Pill tone={c.qualified === "dq" ? "bad" : "plain"}>{QUALIFIED[c.qualified as keyof typeof QUALIFIED]}</Pill> : "–") },
          { key: "rating", label: "Rating", align: "right", render: (c) => (c.callRating ? `${c.callRating}/10` : "–") },
          {
            key: "rec",
            label: "Recording",
            render: (c) =>
              c.recordingUrl ? (
                <a href={c.recordingUrl} target="_blank" rel="noreferrer noopener" onClick={(e) => e.stopPropagation()} className="text-cyan hover:underline">
                  ▶ Watch
                </a>
              ) : (
                "–"
              ),
          },
          { key: "method", label: "Method", render: (c) => c.paymentMethod ?? "–" },
          { key: "next", label: "Next payment", render: (c) => (c.nextPaymentAmount ? `${fmtMoney(c.nextPaymentAmount)} · ${c.nextPaymentDate ? fmtDay(c.nextPaymentDate) : "–"}` : "–") },
          { key: "program", label: "Program", render: (c) => c.program ?? "–" },
          { key: "src", label: "Lead source", render: (c) => c.utmSource ?? "–" },
          { key: "setter", label: "Setter", render: (c) => nameOf(c.setterId) },
          { key: "closer", label: "Closer", render: (c) => nameOf(c.closerId) },
        ]}
      />
    </Section>
  );
}

// ─────────────────────────────── Setter stats (DM + phone) ───────────────────────────────

const DM_KEYS = [
  ["outbounds", "Outbound"],
  ["inbounds", "Inbound"],
  ["followUps", "Follow ups"],
  ["replies", "Replies"],
  ["convos", "Convos"],
  ["qualifiedConvos", "Qualified convos"],
  ["pitchedCalls", "Pitched calls"],
  ["callsBooked", "Calls booked"],
] as const;
const DM_CHARTS = [
  ["callsBooked", "Calls booked per day"],
  ["outbounds", "Outbound messages per day"],
  ["followUps", "Follow-up messages per day"],
  ["qualifiedConvos", "Qualified convos per day"],
  ["pitchedCalls", "Pitched calls per day"],
  ["replies", "Replies per day"],
] as const;

const PHONE_KEYS = [
  ["triageDials", "Triage dials"],
  ["triagePickUps", "Triage pick ups"],
  ["outboundDials", "Outbound dials"],
  ["outboundPickUps", "Outbound pick ups"],
  ["outboundFollowUps", "Outbound follow ups"],
  ["qualifiedConvos", "Qualified convos"],
  ["pitchedCalls", "Pitched calls"],
  ["callsBooked", "Calls booked"],
] as const;
const PHONE_CHARTS = [
  ["callsBooked", "Calls booked per day"],
  ["outboundDials", "Outbound dials per day"],
  ["triageDials", "Triage dials per day"],
  ["qualifiedConvos", "Qualified convos per day"],
  ["pitchedCalls", "Pitched calls per day"],
  ["outboundFollowUps", "Outbound follow ups per day"],
] as const;

function SetterSection({ ctx }: { ctx: Ctx }) {
  const { data } = ctx;
  const [mode, setMode] = useState<"dm" | "phone">("dm");
  const [range, setRange] = useState<DateRange>(LAST30);
  const [member, setMember] = useState<string[]>([]);

  const kind = mode === "dm" ? "dm_eod" : "sdr_eod";
  const keys = mode === "dm" ? DM_KEYS : PHONE_KEYS;
  const charts = mode === "dm" ? DM_CHARTS : PHONE_CHARTS;
  const role = mode === "dm" ? "dm_setter" : "phone_setter";
  const r = resolveRange(range);

  const s = useMemo(
    () => activityStats(data.reports, kind, [...keys.map((k) => k[0]), "callsRejected"], { range: r, member }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.reports, kind, range, member]
  );

  // Every day in the window (zeros included), so a quiet day reads as quiet, not missing.
  const days = useMemo(() => {
    const seen = s.rows.map((x) => x.day).sort();
    const from = r.from ?? seen[0];
    const to = r.to ?? seen[seen.length - 1];
    return from && to ? daysBetween(from, to, 400) : [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.rows, range]);

  const series = (key: string) => {
    const by = new Map<string, number>();
    for (const row of s.rows) by.set(row.day, (by.get(row.day) ?? 0) + (Number(row.data[key]) || 0));
    return days.map((d) => ({ day: d, value: by.get(d) ?? 0 }));
  };

  const people = data.members.filter((m) => m.role === role).map((m) => ({ value: m.id, label: m.name }));
  const t = s.totals;
  const avg = (k: string) => {
    const vals = s.rows.map((x) => Number(x.data[k])).filter((v) => v > 0);
    return vals.length ? vals.reduce((a, v) => a + v, 0) / vals.length : null;
  };
  const avgQuality = mode === "dm" ? avg("leadQuality") : avg("outboundQuality");

  return (
    <Section
      id="setters"
      title={mode === "dm" ? "DM Stats" : "Phone Setter Stats"}
      blurb={
        "Built from the setters' end-of-day reports. \"Per day\" is the average per report, so per person per working day."
      }
      filters={
        <>
          <div className="inline-flex rounded-xl border border-white/[0.08] bg-white/[0.03] p-0.5">
            {(["dm", "phone"] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={`rounded-[10px] px-3 py-1.5 text-[13px] font-semibold ${mode === m ? "bg-brand/20 text-ink" : "text-muted hover:text-ink"}`}
                onClick={() => {
                  setMode(m);
                  setMember([]);
                }}
              >
                {m === "dm" ? "DM setters" : "Phone setters"}
              </button>
            ))}
          </div>
          <DateFilter label="Date" value={range} onChange={setRange} />
          <MultiFilter label="Setter" options={people} value={member} onChange={setMember} />
        </>
      }
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {keys.map(([k, label]) => (
          <Stat key={k} label={label} value={fmtNum(t[k])} sub={s.perDay[k] != null ? `${fmtNum(s.perDay[k], 1)} per day` : undefined} />
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {mode === "dm" ? (
          <>
            <Stat label="Reply rate" value={fmtPct(t.outbounds ? t.replies / t.outbounds : null)} sub="Replies ÷ outbound" />
            <Stat label="Booking rate" value={fmtPct(t.pitchedCalls ? t.callsBooked / t.pitchedCalls : null)} tone="good" sub="Booked ÷ pitched" />
            <Stat label="Qualify rate" value={fmtPct(t.convos ? t.qualifiedConvos / t.convos : null)} sub="Qualified ÷ convos" />
            <Stat label="Avg DM lead quality" value={avgQuality ? `${avgQuality.toFixed(1)} / 10` : "–"} sub={`${fmtNum(s.reports)} reports filed`} />
          </>
        ) : (
          <>
            <Stat
              label="Pick-up rate"
              value={fmtPct(t.outboundDials + t.triageDials ? (t.outboundPickUps + t.triagePickUps) / (t.outboundDials + t.triageDials) : null)}
              sub="Pick ups ÷ dials"
            />
            <Stat label="Booking rate" value={fmtPct(t.pitchedCalls ? t.callsBooked / t.pitchedCalls : null)} tone="good" sub="Booked ÷ pitched" />
            <Stat label="Avg outbound lead quality" value={avgQuality ? `${avgQuality.toFixed(1)} / 10` : "–"} />
            <Stat label="Reports filed" value={fmtNum(s.reports)} sub={`${s.days} day${s.days === 1 ? "" : "s"}`} />
          </>
        )}
      </div>

      {s.rows.length === 0 ? (
        <div className="sunken grid place-items-center text-faint text-sm py-12 text-center px-6">
          No end-of-day reports in this view yet. They appear here as soon as {mode === "dm" ? "DM" : "phone"} setters submit their EOD.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {charts.map(([k, label]) => (
            <div key={k} className="sunken p-4">
              <div className="flex items-baseline justify-between">
                <div className="eyebrow">{label}</div>
                <div className="num text-sm text-muted">{fmtNum(s.perDay[k], 1)} avg</div>
              </div>
              <BarChart data={series(k)} format={(n) => fmtNum(n)} label={label} />
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

// ─────────────────────────────── Failed + upcoming payments ───────────────────────────────

function MoneyWatch({ ctx, failed }: { ctx: Ctx; failed: (PaymentRow & { recovered: boolean })[] }) {
  const { data, nameOf } = ctx;
  const upcoming = upcomingPayments(data.calls, data.payments);
  const unrecovered = failed.filter((f) => !f.recovered);
  return (
    <div className="grid lg:grid-cols-2 gap-3">
      <div className="sunken p-4">
        <div className="flex items-baseline justify-between mb-3">
          <div className="eyebrow">Upcoming instalments</div>
          <div className="text-xs text-faint">From closed Split / Deposit deals</div>
        </div>
        {upcoming.length === 0 ? (
          <div className="text-sm text-faint py-6 text-center">Nothing owed right now.</div>
        ) : (
          <ul className="divide-y divide-white/[0.06] max-h-72 overflow-y-auto">
            {upcoming.map((u) => (
              <li key={u.call.id}>
                <button className="w-full flex items-center gap-3 py-2.5 text-left text-sm hover:bg-white/[0.03] rounded-lg px-1" onClick={() => ctx.openCall(u.call.id)}>
                  <span className={`num w-16 shrink-0 ${u.overdue ? "text-danger font-semibold" : "text-muted"}`}>{fmtDay(u.due)}</span>
                  <span className="font-semibold truncate">{u.call.leadName}</span>
                  <span className="text-faint text-xs truncate hidden sm:inline">{nameOf(u.call.closerId)}</span>
                  <span className="ml-auto num text-gold">{fmtMoney(u.amount)}</span>
                  {u.overdue && <Pill tone="bad">Overdue</Pill>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="sunken p-4">
        <div className="flex items-baseline justify-between mb-3">
          <div className="eyebrow">Failed payments</div>
          <div className="text-xs text-faint">{failed.length - unrecovered.length} retried successfully</div>
        </div>
        {unrecovered.length === 0 ? (
          <div className="text-sm text-faint py-6 text-center">No failed payments to chase.</div>
        ) : (
          <ul className="divide-y divide-white/[0.06] max-h-72 overflow-y-auto">
            {unrecovered.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="num w-16 shrink-0 text-muted">{fmtDay(dayOf(p.date))}</span>
                <span className="font-semibold truncate">{p.customerName}</span>
                <span className="text-faint text-xs truncate hidden sm:inline">{p.failureReason ?? "No reason given"}</span>
                <span className="ml-auto num text-danger">{fmtMoney(p.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
