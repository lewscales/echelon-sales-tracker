"use client";

import { useEffect, useMemo, useState } from "react";
import { CALL_INFO, CALL_OUTCOMES, CALL_TYPES, PAYMENT_METHODS, PAYMENT_TYPES, PROGRAMS, QUALIFIED } from "@/lib/config";
import { addDays, dayOf, fmtDay, fmtDayLong, fmtTime, today } from "@/lib/dates";
import { FORMS, PRECALL_FIELDS, type Field, type FormDef } from "@/lib/forms";
import type { CallRow } from "@/lib/types";
import type { Ctx } from "./App";
import { OutcomePill } from "./Dashboard";
import { CURRENCY_SYMBOL, api, fmtMoney } from "./ui";

type Pick = { type: "form"; form: FormDef } | { type: "call" } | { type: "handoff" };

/** "#forms/dm_eod" (from a Slack reminder) opens that form directly. */
function pickFromHash(): Pick | null {
  if (typeof window === "undefined") return null;
  const [, sub] = window.location.hash.replace("#", "").split("/");
  if (!sub) return null;
  if (sub === "call-report") return { type: "call" };
  if (sub === "handoff") return { type: "handoff" };
  const form = FORMS.find((f) => f.kind === sub && !f.public);
  return form ? { type: "form", form } : null;
}

export function Forms({ ctx }: { ctx: Ctx }) {
  const { data } = ctx;
  const role = data.me.role;
  const [pick, setPick] = useState<Pick | null>(null);
  useEffect(() => {
    const sync = () => {
      const p = pickFromHash();
      setPick(p && (p.type !== "form" || p.form.roles.includes(role)) ? p : null);
    };
    sync();
    // Clicking "Forms" in the nav (hash back to #forms) returns to the list.
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [role]);

  const back = () => {
    setPick(null);
    if (window.location.hash !== "#forms") history.replaceState(null, "", "#forms");
  };
  const forms = FORMS.filter((f) => f.roles.includes(role) && !f.public);
  const canReport = role === "closer" || role === "admin";
  const canHandoff = role === "admin" || role === "dm_setter" || role === "phone_setter";
  const done = (kind: string) => data.reports.some((r) => r.kind === kind && r.memberId === data.me.id && r.day === today());
  const pendingCalls = data.calls.filter(
    (c) => !c.outcome && dayOf(c.dateOfCall) <= today() && (role === "admin" || !c.closerId || c.closerId === data.me.id)
  ).length;
  const needHandoff = data.calls.filter((c) => !c.handoff && !c.outcome && dayOf(c.dateOfCall) >= today()).length;

  if (pick?.type === "form") return <FormRunner ctx={ctx} form={pick.form} onBack={back} />;
  if (pick?.type === "call") return <CallPicker ctx={ctx} mode="report" onBack={back} />;
  if (pick?.type === "handoff") return <CallPicker ctx={ctx} mode="handoff" onBack={back} />;

  const onboardingLink = `${data.appUrl}/onboarding`;

  return (
    <div className="space-y-6">
      <div>
        <div className="eyebrow">Forms</div>
        <h1 className="display text-3xl sm:text-4xl font-semibold tracking-tight mt-1">What are you filling in?</h1>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {canReport && (
          <Card
            title="Sales Call Report"
            blurb="After EVERY call: pick the booked call and log what happened. This drives every number in Sales Stats."
            badge={pendingCalls ? `${pendingCalls} call${pendingCalls === 1 ? "" : "s"} to report` : "All caught up"}
            badgeTone={pendingCalls ? "warn" : "good"}
            onClick={() => setPick({ type: "call" })}
          />
        )}
        {canHandoff && (
          <Card
            title="Pre-Call Handoff"
            blurb="Before the call: hand the lead over to the closer. Situation, pain, desired state, bottlenecks, beliefs."
            badge={needHandoff ? `${needHandoff} upcoming without one` : "All handed over"}
            badgeTone={needHandoff ? "warn" : "good"}
            onClick={() => setPick({ type: "handoff" })}
          />
        )}
        {forms.map((f) => (
          <Card
            key={f.kind}
            title={f.title}
            blurb={f.blurb}
            badge={f.daily ? (done(f.kind) ? "Done today" : "Due today") : undefined}
            badgeTone={done(f.kind) ? "good" : "warn"}
            onClick={() => setPick({ type: "form", form: f })}
          />
        ))}
      </div>
      {role === "admin" && (
        <div className="surface p-5 space-y-2">
          <div className="eyebrow">Client onboarding form (public link)</div>
          <p className="text-sm text-muted">New clients fill this in themselves, with no login. Send them this link after they pay:</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="num text-sm text-cyan break-all">{onboardingLink}</code>
            <button
              className="btn-ghost !py-1.5 !px-3 !text-xs"
              onClick={() => navigator.clipboard?.writeText(onboardingLink).then(() => ctx.toast("Link copied")).catch(() => null)}
            >
              Copy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({
  title,
  blurb,
  badge,
  badgeTone,
  onClick,
}: {
  title: string;
  blurb: string;
  badge?: string;
  badgeTone?: "good" | "warn";
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="surface card-hover p-5 text-left flex flex-col gap-3 min-h-[160px]">
      <div className="flex items-start justify-between gap-3">
        <h2 className="display text-xl font-bold">{title}</h2>
        {badge && (
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${badgeTone === "good" ? "bg-mint/15 text-mint" : "bg-gold/15 text-gold"}`}>
            {badge}
          </span>
        )}
      </div>
      <p className="text-sm text-muted leading-relaxed">{blurb}</p>
      <span className="mt-auto text-sm font-semibold text-cyan">Open form →</span>
    </button>
  );
}

function Header({ title, blurb, onBack, backLabel = "← All forms" }: { title: string; blurb: string; onBack?: () => void; backLabel?: string }) {
  return (
    <div>
      {onBack && (
        <button className="text-sm text-muted hover:text-ink mb-3" onClick={onBack}>
          {backLabel}
        </button>
      )}
      <h1 className="display text-3xl sm:text-4xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted mt-1.5">{blurb}</p>
    </div>
  );
}

// ─────────────────────────────── Field inputs ───────────────────────────────

type Values = Record<string, string>;

const choice = (on: boolean) =>
  `rounded-2xl border px-4 py-3 text-sm font-semibold text-left transition-colors ${
    on ? "border-brand/60 bg-brand/15 text-ink" : "border-white/[0.08] bg-black/20 text-muted hover:text-ink"
  }`;

export function Scale({ id, max, value, onChange }: { id: string; max: number; value: string; onChange: (v: string) => void }) {
  if (max <= 5) {
    return (
      <div className="flex gap-1" role="radiogroup" aria-labelledby={`${id}-l`}>
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={Number(value) === n}
            aria-label={`${n} of ${max}`}
            onClick={() => onChange(String(n))}
            className={`text-3xl leading-none px-1 transition-transform hover:scale-110 ${Number(value) >= n ? "text-gold" : "text-line2"}`}
          >
            ★
          </button>
        ))}
      </div>
    );
  }
  // 1–10: a row of numbered pills reads faster than ten stars.
  return (
    <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5" role="radiogroup" aria-labelledby={`${id}-l`}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={Number(value) === n}
          onClick={() => onChange(String(n))}
          className={`num rounded-xl border py-2 text-sm font-bold transition-colors ${
            Number(value) === n
              ? "border-gold/60 bg-gold/15 text-gold"
              : Number(value) > n
                ? "border-gold/20 bg-gold/[0.06] text-gold/70"
                : "border-white/[0.08] bg-black/20 text-muted hover:text-ink"
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export function FieldInput({ field, value, onChange }: { field: Field; value: string; onChange: (v: string) => void }) {
  const id = `f-${field.key}`;
  switch (field.type) {
    case "longtext":
      return <textarea id={id} className="input min-h-[96px] resize-y" value={value} onChange={(e) => onChange(e.target.value)} />;
    case "number":
    case "money":
      return (
        <div className="relative">
          {field.type === "money" && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-faint text-sm">{CURRENCY_SYMBOL}</span>}
          <input
            id={id}
            className={`input num ${field.type === "money" ? "!pl-8" : ""}`}
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
    case "date":
      return <input id={id} className="input" type="date" value={value} onChange={(e) => onChange(e.target.value)} />;
    case "url":
      return <input id={id} className="input" type="url" placeholder="https://" value={value} onChange={(e) => onChange(e.target.value)} />;
    case "select":
      return (
        <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose…</option>
          {field.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    case "yesno":
      return (
        <div className="grid sm:grid-cols-2 gap-2" role="radiogroup" aria-labelledby={`${id}-l`}>
          {field.options?.map((o) => (
            <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onChange(o)} className={choice(value === o)}>
              {o}
            </button>
          ))}
        </div>
      );
    case "stars":
      return <Scale id={id} max={field.max ?? 5} value={value} onChange={onChange} />;
    default:
      return <input id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)} />;
  }
}

/** Renders a list of fields with their section headings. */
export function FieldList({ fields, values, set }: { fields: Field[]; values: Values; set: (k: string, v: string) => void }) {
  return (
    <>
      {fields.map((f) => (
        <div key={f.key}>
          {f.section && <div className="eyebrow !text-cyan pt-3 pb-3 border-t hair mt-1">{f.section} ↓</div>}
          <label className="block text-sm font-semibold mb-1.5" htmlFor={`f-${f.key}`} id={`f-${f.key}-l`}>
            {f.label}
            {f.required && <span className="text-danger ml-1">*</span>}
          </label>
          <FieldInput field={f} value={values[f.key] ?? ""} onChange={(v) => set(f.key, v)} />
          {f.hint && <p className="text-xs text-faint mt-1">{f.hint}</p>}
        </div>
      ))}
    </>
  );
}

export function missingRequired(fields: Field[], values: Values): Field | undefined {
  return fields.find((f) => f.required && !values[f.key]?.trim());
}

// ─────────────────────────────── Team form ───────────────────────────────

function FormRunner({ ctx, form, onBack }: { ctx: Ctx; form: FormDef; onBack: () => void }) {
  const { data } = ctx;
  const now = today();
  const [day, setDay] = useState(now);
  const mine = (d: string) => data.reports.find((r) => r.kind === form.kind && r.memberId === data.me.id && r.day === d);
  const toValues = (d: string): Values => {
    const r = form.daily ? mine(d) : undefined;
    return Object.fromEntries(form.fields.map((f) => [f.key, r?.data[f.key] != null ? String(r.data[f.key]) : ""]));
  };
  const [values, setValues] = useState<Values>(() => toValues(now));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const existing = form.daily ? mine(day) : undefined;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const missing = missingRequired(form.fields, values);
    if (missing) {
      setErr(`"${missing.label}" is required`);
      document.getElementById(`f-${missing.key}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      const res = await api<{ replaced: boolean }>("/api/reports", "POST", { kind: form.kind, day, data: values });
      await ctx.reload();
      ctx.toast(res.replaced ? `${form.title} updated` : `${form.title} submitted`);
      onBack();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't submit");
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Header title={form.title} blurb={form.blurb} onBack={onBack} />
      <form onSubmit={submit} className="surface p-5 sm:p-6 space-y-5" noValidate>
        {form.daily && (
          <div>
            <label className="label block mb-1.5" htmlFor="day">
              Date of work
            </label>
            <select
              id="day"
              className="input"
              value={day}
              onChange={(e) => {
                setDay(e.target.value);
                setValues(toValues(e.target.value));
              }}
            >
              {Array.from({ length: 15 }, (_, i) => addDays(now, -i)).map((d, i) => (
                <option key={d} value={d}>
                  {i === 0 ? "Today" : i === 1 ? "Yesterday" : fmtDayLong(d)}
                  {mine(d) ? " (submitted)" : ""}
                </option>
              ))}
            </select>
            {existing && <p className="text-xs text-gold mt-1.5">You already sent this one. Submitting again replaces it.</p>}
          </div>
        )}
        <FieldList fields={form.fields} values={values} set={(k, v) => setValues((s) => ({ ...s, [k]: v }))} />
        {err && <p className="text-danger text-sm">{err}</p>}
        <button className="btn-primary w-full !py-3" disabled={busy}>
          {busy ? "Sending…" : existing ? "Update report" : "Submit"}
        </button>
      </form>
    </div>
  );
}

// ─────────────────────────────── Pick a call (report / handoff) ───────────────────────────────

function CallPicker({ ctx, mode, onBack }: { ctx: Ctx; mode: "report" | "handoff"; onBack: () => void }) {
  const { data, nameOf } = ctx;
  const [showAll, setShowAll] = useState(false);
  const [callId, setCallId] = useState<string | null>(null);
  const role = data.me.role;

  const calls = useMemo(() => {
    const now = today();
    if (mode === "report") {
      return data.calls
        .filter((c) => role === "admin" || !c.closerId || c.closerId === data.me.id)
        .filter((c) => (showAll ? true : !c.outcome && dayOf(c.dateOfCall) <= now))
        .sort((a, b) => (showAll ? b.dateOfCall.localeCompare(a.dateOfCall) : a.dateOfCall.localeCompare(b.dateOfCall)));
    }
    return data.calls
      .filter((c) => !c.outcome && dayOf(c.dateOfCall) >= addDays(now, -1))
      .filter((c) => (showAll ? true : !c.handoff))
      .sort((a, b) => a.dateOfCall.localeCompare(b.dateOfCall));
  }, [data.calls, data.me.id, role, showAll, mode]);
  const call = data.calls.find((c) => c.id === callId) ?? null;

  if (call && mode === "report") return <CallOutcomeForm ctx={ctx} call={call} onDone={() => setCallId(null)} backLabel="← All calls" />;
  if (call && mode === "handoff") return <HandoffForm ctx={ctx} call={call} onDone={() => setCallId(null)} backLabel="← All calls" />;

  return (
    <div className="max-w-3xl space-y-6">
      <Header
        title={mode === "report" ? "Sales Call Report" : "Pre-Call Handoff"}
        blurb={mode === "report" ? "Pick the call you just took, then log the result." : "Pick the upcoming call you set, then brief the closer."}
        onBack={onBack}
      />
      <div className="flex flex-wrap items-center gap-2">
        {[false, true].map((all) => (
          <button
            key={String(all)}
            className={`rounded-xl px-3.5 py-2 text-sm font-semibold border ${
              showAll === all ? "bg-brand/15 border-brand/50" : "border-white/[0.08] text-muted hover:text-ink"
            }`}
            onClick={() => setShowAll(all)}
          >
            {mode === "report" ? (all ? "All calls (edit a report)" : "Waiting for a report") : all ? "All upcoming (edit a handoff)" : "Needs a handoff"}
          </button>
        ))}
      </div>
      {calls.length === 0 ? (
        <div className="sunken text-center text-faint text-sm py-12 px-6">
          {mode === "report"
            ? showAll
              ? "No booked calls yet."
              : "Nothing to report. Every call that's happened has a result logged."
            : "Every upcoming call has a handoff."}
        </div>
      ) : (
        <ul className="space-y-2">
          {calls.map((c) => (
            <li key={c.id}>
              <button
                className="surface card-hover w-full text-left px-4 py-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5"
                onClick={() => setCallId(c.id)}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{c.leadName}</div>
                  <div className="text-xs text-faint truncate">
                    {c.calendarName ?? "Call"} · set by {nameOf(c.setterId)} · closer {nameOf(c.closerId)}
                  </div>
                </div>
                <div className="text-sm text-muted num whitespace-nowrap">
                  {fmtDay(dayOf(c.dateOfCall))} · {fmtTime(c.dateOfCall)}
                </div>
                {mode === "report" ? (
                  <OutcomePill outcome={c.outcome} />
                ) : (
                  <span className={`text-xs font-semibold ${c.handoff ? "text-mint" : "text-gold"}`}>{c.handoff ? "Handed over" : "No handoff"}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─────────────────────────────── Sales Call Report ───────────────────────────────

const LIVE = ["closed", "not_closed", "follow_up"];

export function CallOutcomeForm({ ctx, call, onDone, backLabel }: { ctx: Ctx; call: CallRow; onDone: () => void; backLabel?: string }) {
  const startInfo = !call.outcome ? "" : LIVE.includes(call.outcome) ? "live" : call.outcome;
  const [callInfo, setCallInfo] = useState(startInfo);
  const [callOutcome, setCallOutcome] = useState(call.outcome && LIVE.includes(call.outcome) ? call.outcome : "");
  const [callType, setCallType] = useState(call.callType ?? "first_call");
  const [qualified, setQualified] = useState(call.qualified ?? "");
  const [rating, setRating] = useState(call.callRating ? String(call.callRating) : "");
  const [recording, setRecording] = useState(call.recordingUrl ?? "");
  const [notes, setNotes] = useState(call.notes ?? "");
  const [revenue, setRevenue] = useState(call.revenue ? String(call.revenue) : "");
  const [cash, setCash] = useState(call.cashOnCall ? String(call.cashOnCall) : "");
  const [paymentType, setPaymentType] = useState(call.paymentType ?? "");
  const [method, setMethod] = useState(call.paymentMethod ?? "");
  const [program, setProgram] = useState(call.program ?? "");
  const [planDetails, setPlanDetails] = useState(call.paymentPlanDetails ?? "");
  const [nextAmount, setNextAmount] = useState(call.nextPaymentAmount ? String(call.nextPaymentAmount) : "");
  const [nextDate, setNextDate] = useState(call.nextPaymentDate ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const live = callInfo === "live";
  const closed = live && callOutcome === "closed";
  const takesCash = closed || (live && callOutcome === "follow_up");
  const owing = closed && paymentType && paymentType !== "pif";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!callInfo) return setErr("Pick what happened on the call");
    setBusy(true);
    try {
      await api(`/api/calls/${call.id}`, "PATCH", {
        report: {
          callInfo,
          callOutcome: live ? callOutcome : undefined,
          callType,
          qualified: live ? qualified : undefined,
          callRating: live ? rating : undefined,
          recordingUrl: live ? recording : undefined,
          notes,
          revenue: closed ? revenue : 0,
          cashOnCall: takesCash ? cash || 0 : 0,
          paymentType: closed ? paymentType : undefined,
          paymentMethod: closed ? method : undefined,
          program: closed ? program : undefined,
          paymentPlanDetails: owing ? planDetails : undefined,
          nextPaymentAmount: owing ? nextAmount : undefined,
          nextPaymentDate: owing ? nextDate : undefined,
        },
      });
      await ctx.reload();
      ctx.toast(`Report saved for ${call.leadName}`);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save");
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Header
        title={call.leadName}
        blurb={`${call.calendarName ?? "Call"} · ${fmtDayLong(dayOf(call.dateOfCall))} at ${fmtTime(call.dateOfCall)}`}
        onBack={onDone}
        backLabel={backLabel}
      />
      <form onSubmit={submit} className="surface p-5 sm:p-6 space-y-5">
        <div>
          <label className="block text-sm font-semibold mb-1.5" htmlFor="ctype">
            Call type
          </label>
          <select id="ctype" className="input" value={callType} onChange={(e) => setCallType(e.target.value)}>
            {Object.entries(CALL_TYPES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="block text-sm font-semibold mb-2">
            Call info <span className="text-danger">*</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(CALL_INFO).map(([k, label]) => (
              <button key={k} type="button" onClick={() => setCallInfo(k)} aria-pressed={callInfo === k} className={choice(callInfo === k)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {live && (
          <>
            <div>
              <div className="block text-sm font-semibold mb-2">
                Call outcome <span className="text-danger">*</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(CALL_OUTCOMES).map(([k, label]) => (
                  <button key={k} type="button" onClick={() => setCallOutcome(k)} aria-pressed={callOutcome === k} className={choice(callOutcome === k)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="block text-sm font-semibold mb-2">
                Qualified / DQ <span className="text-danger">*</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(QUALIFIED).map(([k, label]) => (
                  <button key={k} type="button" onClick={() => setQualified(k)} aria-pressed={qualified === k} className={choice(qualified === k)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="block text-sm font-semibold mb-2" id="rating-l">
                Call rating
              </div>
              <Scale id="rating" max={10} value={rating} onChange={setRating} />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5" htmlFor="rec">
                Call recording link
              </label>
              <input id="rec" className="input" type="url" placeholder="https://fathom.video/…" value={recording} onChange={(e) => setRecording(e.target.value)} />
            </div>
          </>
        )}

        <div>
          <label className="block text-sm font-semibold mb-1.5" htmlFor="notes">
            What happened on the call?
          </label>
          <textarea id="notes" className="input min-h-[90px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Objections, next steps, anything worth knowing" />
        </div>

        {takesCash && (
          <div className="border-t hair pt-4 space-y-5">
            <div className="eyebrow !text-cyan">Payment details ↓</div>
            {closed && (
              <div>
                <label className="block text-sm font-semibold mb-1.5" htmlFor="rev">
                  Total deal size <span className="text-danger">*</span>
                </label>
                <MoneyInput id="rev" value={revenue} onChange={setRevenue} />
              </div>
            )}
            <div>
              <label className="block text-sm font-semibold mb-1.5" htmlFor="cash">
                Cash collected
              </label>
              <MoneyInput id="cash" value={cash} onChange={setCash} />
            </div>
            {closed && (
              <>
                <div>
                  <div className="block text-sm font-semibold mb-2">
                    Payment type <span className="text-danger">*</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(PAYMENT_TYPES).map(([k, label]) => (
                      <button key={k} type="button" onClick={() => setPaymentType(k)} aria-pressed={paymentType === k} className={choice(paymentType === k)}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-1.5" htmlFor="method">
                      Payment method
                    </label>
                    <select id="method" className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
                      <option value="">Choose…</option>
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1.5" htmlFor="tier">
                      Program tier
                    </label>
                    <select id="tier" className="input" value={program} onChange={(e) => setProgram(e.target.value)}>
                      <option value="">Choose…</option>
                      {PROGRAMS.map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}
            {owing && (
              <>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-1.5" htmlFor="next">
                      Next payment
                    </label>
                    <MoneyInput id="next" value={nextAmount} onChange={setNextAmount} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1.5" htmlFor="nextd">
                      Date of next payment
                    </label>
                    <input id="nextd" className="input" type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5" htmlFor="plan">
                    Payment plan details
                  </label>
                  <input id="plan" className="input" value={planDetails} onChange={(e) => setPlanDetails(e.target.value)} placeholder="e.g. 3 × £2,000 monthly" />
                </div>
              </>
            )}
          </div>
        )}

        {closed && revenue && (
          <p className="text-sm text-muted">
            Logging a close of <span className="text-white font-semibold">{fmtMoney(Number(revenue))}</span>. Send the client their onboarding link.
          </p>
        )}
        {err && <p className="text-danger text-sm">{err}</p>}
        <button className="btn-primary w-full !py-3" disabled={busy}>
          {busy ? "Saving…" : call.outcome ? "Update report" : "Save report"}
        </button>
      </form>
    </div>
  );
}

// ─────────────────────────────── Pre-call handoff ───────────────────────────────

export function HandoffForm({ ctx, call, onDone, backLabel }: { ctx: Ctx; call: CallRow; onDone: () => void; backLabel?: string }) {
  const [values, setValues] = useState<Values>(() =>
    Object.fromEntries(PRECALL_FIELDS.map((f) => [f.key, call.handoff?.[f.key] ?? ""]))
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const missing = missingRequired(PRECALL_FIELDS, values);
    if (missing) return setErr(`"${missing.label}" is required`);
    setBusy(true);
    try {
      await api(`/api/calls/${call.id}`, "PATCH", { handoff: values });
      await ctx.reload();
      ctx.toast(`Handoff sent for ${call.leadName}`);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save");
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Header
        title={call.leadName}
        blurb={`Handoff to ${ctx.nameOf(call.closerId)} · ${fmtDayLong(dayOf(call.dateOfCall))} at ${fmtTime(call.dateOfCall)}`}
        onBack={onDone}
        backLabel={backLabel}
      />
      <form onSubmit={submit} className="surface p-5 sm:p-6 space-y-5" noValidate>
        <FieldList fields={PRECALL_FIELDS} values={values} set={(k, v) => setValues((s) => ({ ...s, [k]: v }))} />
        {err && <p className="text-danger text-sm">{err}</p>}
        <button className="btn-primary w-full !py-3" disabled={busy}>
          {busy ? "Sending…" : call.handoff ? "Update handoff" : "Send to closer"}
        </button>
      </form>
    </div>
  );
}

function MoneyInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-faint text-sm">{CURRENCY_SYMBOL}</span>
      <input id={id} className="input num !pl-8" type="number" inputMode="decimal" min={0} step="any" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
