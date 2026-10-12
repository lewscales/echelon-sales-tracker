"use client";

import { useState } from "react";
import { CALL_TYPES, PAYMENT_TYPES, QUALIFIED } from "@/lib/config";
import { dayOf, fmtDay, fmtDayLong, fmtTime } from "@/lib/dates";
import { PRECALL_FIELDS } from "@/lib/forms";
import type { Ctx } from "./App";
import { OutcomePill } from "./Dashboard";
import { CallOutcomeForm, HandoffForm } from "./Forms";
import { Modal, Pill, fmtMoney } from "./ui";

/** Everything about one booked call on a single screen. */
export function CallDrawer({ ctx, callId, onClose }: { ctx: Ctx; callId: string; onClose: () => void }) {
  const { data, nameOf } = ctx;
  const [mode, setMode] = useState<"view" | "report" | "handoff">("view");
  const call = data.calls.find((c) => c.id === callId);
  if (!call) return null;

  const role = data.me.role;
  const canReport = role === "admin" || (role === "closer" && (!call.closerId || call.closerId === data.me.id));
  const canHandoff = role === "admin" || role === "dm_setter" || role === "phone_setter";
  const app =
    data.applications.find((a) => a.bookedCallId === call.id) ??
    (call.leadEmail ? data.applications.find((a) => a.email?.toLowerCase() === call.leadEmail?.toLowerCase()) : undefined);
  const live = call.outcome === "closed" || call.outcome === "not_closed" || call.outcome === "follow_up";

  if (mode === "report")
    return (
      <Modal title="Sales Call Report" onClose={onClose} wide>
        <CallOutcomeForm ctx={ctx} call={call} onDone={() => setMode("view")} backLabel="← Back to the call" />
      </Modal>
    );
  if (mode === "handoff")
    return (
      <Modal title="Pre-Call Handoff" onClose={onClose} wide>
        <HandoffForm ctx={ctx} call={call} onDone={() => setMode("view")} backLabel="← Back to the call" />
      </Modal>
    );

  return (
    <Modal title={call.leadName} onClose={onClose} wide>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <OutcomePill outcome={call.outcome} />
          <span className="text-sm text-muted">
            {fmtDayLong(dayOf(call.dateOfCall))} at {fmtTime(call.dateOfCall)} · {call.calendarName ?? "Call"}
          </span>
          <div className="ml-auto flex gap-2">
            {canHandoff && !call.outcome && (
              <button className="btn-ghost !py-1.5 !px-3 !text-xs" onClick={() => setMode("handoff")}>
                {call.handoff ? "Edit handoff" : "Add handoff"}
              </button>
            )}
            {canReport && (
              <button className="btn-primary !py-1.5 !px-3 !text-xs" onClick={() => setMode("report")}>
                {call.outcome ? "Edit report" : "Log report"}
              </button>
            )}
          </div>
        </div>

        <Block title="Lead">
          <Grid
            items={[
              ["Email", call.leadEmail],
              ["Phone / WhatsApp", call.leadPhone],
              ["Instagram", call.instagram ?? app?.instagram ?? null],
              ["Lead's timezone", call.leadTimezone],
              ["Lead source", call.utmSource],
              ["Booked on", fmtDay(dayOf(call.dateBooked))],
              ["Setter", nameOf(call.setterId)],
              ["Closer", nameOf(call.closerId)],
            ]}
          />
        </Block>

        {app && (
          <Block title={`Application · ${fmtDay(dayOf(app.appliedAt))}`} tag={app.lowBudget ? <Pill tone="bad">Low budget</Pill> : undefined}>
            <QA items={Object.entries(app.answers)} />
          </Block>
        )}
        {Object.keys(call.bookingAnswers).length > 0 && (
          <Block title="Booking questions">
            <QA items={Object.entries(call.bookingAnswers)} />
          </Block>
        )}

        <Block title="Pre-call handoff" tag={call.handoff ? <span className="text-xs text-faint">by {nameOf(call.handoffById)}</span> : undefined}>
          {call.handoff ? (
            <QA items={PRECALL_FIELDS.filter((f) => call.handoff?.[f.key]).map((f) => [f.label, call.handoff![f.key]])} />
          ) : (
            <p className="text-sm text-faint">No handoff yet.</p>
          )}
        </Block>

        <Block title="Call report">
          {!call.outcome ? (
            <p className="text-sm text-faint">Not reported yet.</p>
          ) : (
            <div className="space-y-3">
              <Grid
                items={([
                  ["Call type", call.callType ? CALL_TYPES[call.callType as keyof typeof CALL_TYPES] : null],
                  ["Qualified / DQ", call.qualified ? QUALIFIED[call.qualified as keyof typeof QUALIFIED] : null],
                  ["Call rating", call.callRating ? `${call.callRating} / 10` : null],
                  ...(call.outcome === "closed"
                    ? ([
                        ["Total deal size", fmtMoney(call.revenue)],
                        ["Cash collected", fmtMoney(call.cashOnCall)],
                        ["Payment type", call.paymentType ? PAYMENT_TYPES[call.paymentType as keyof typeof PAYMENT_TYPES] : null],
                        ["Payment method", call.paymentMethod],
                        ["Program tier", call.program],
                        ["Next payment", call.nextPaymentAmount ? `${fmtMoney(call.nextPaymentAmount)} on ${call.nextPaymentDate ? fmtDay(call.nextPaymentDate) : "–"}` : null],
                        ["Payment plan details", call.paymentPlanDetails],
                      ] as [string, string | null][])
                    : call.cashOnCall
                      ? ([["Cash collected", fmtMoney(call.cashOnCall)]] as [string, string | null][])
                      : []),
                ] as [string, string | null][]).filter(([, v]) => live || v)}
              />
              {call.recordingUrl && (
                <a href={call.recordingUrl} target="_blank" rel="noreferrer noopener" className="inline-block text-sm font-semibold text-cyan hover:underline">
                  ▶ Call recording
                </a>
              )}
              {call.notes && (
                <div className="sunken px-4 py-3 text-sm whitespace-pre-wrap">
                  <div className="eyebrow mb-1">What happened on the call</div>
                  {call.notes}
                </div>
              )}
            </div>
          )}
        </Block>
      </div>
    </Modal>
  );
}

function Block({ title, tag, children }: { title: string; tag?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <div className="eyebrow">{title}</div>
        {tag}
      </div>
      {children}
    </section>
  );
}

function Grid({ items }: { items: [string, string | null][] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {items.map(([k, v]) => (
        <div key={k} className="sunken px-3 py-2 min-w-0">
          <div className="eyebrow truncate">{k}</div>
          <div className="text-sm truncate" title={v ?? undefined}>
            {v || "–"}
          </div>
        </div>
      ))}
    </div>
  );
}

function QA({ items }: { items: [string, string][] }) {
  if (!items.length) return <p className="text-sm text-faint">Nothing recorded.</p>;
  return (
    <dl className="sunken divide-y divide-white/[0.05]">
      {items.map(([q, a]) => (
        <div key={q} className="px-4 py-2.5 grid sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-4 gap-y-0.5">
          <dt className="text-xs text-muted">{q}</dt>
          <dd className="text-sm whitespace-pre-wrap">{a}</dd>
        </div>
      ))}
    </dl>
  );
}
