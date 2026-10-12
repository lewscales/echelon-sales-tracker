"use client";

import { useMemo, useState } from "react";
import { UTM_SOURCES } from "@/lib/config";
import { dayOf, fmtDay, fmtDayLong, resolveRange, type DateRange } from "@/lib/dates";
import { applicationStats } from "@/lib/metrics";
import type { ApplicationRow } from "@/lib/types";
import type { Ctx } from "./App";
import { Donut, stableOrder, toSlices } from "./charts";
import { DateFilter, Modal, MultiFilter, Pill, Section, Stat, Table, api, fmtNum, fmtPct } from "./ui";

type Row = ApplicationRow;
const CHASE = { open: "To chase", contacted: "Contacted", not_interested: "Not interested" } as const;

export function Applications({ ctx }: { ctx: Ctx }) {
  const { data, nameOf } = ctx;
  const [range, setRange] = useState<DateRange>({ preset: "last30" });
  const [source, setSource] = useState<string[]>([]);
  const [view, setView] = useState<"chase" | "all">("all");
  const [open, setOpen] = useState<Row | null>(null);

  const s = useMemo(
    () => applicationStats(data.applications, { range: resolveRange(range), utmSource: source }),
    [data.applications, range, source]
  );
  const sourceOrder = stableOrder(UTM_SOURCES, data.applications.map((a) => a.utmSource || "(none)"));
  const sourceOpts = sourceOrder.filter((v) => v !== "(none)").map((v) => ({ value: v, label: v }));
  const rows: Row[] = view === "chase" ? s.chase : s.rows;

  return (
    <div className="space-y-6">
      <h1 className="display text-3xl sm:text-[34px] font-semibold">Applications</h1>

      <Section
        title="Application funnel"
        blurb="Everyone who applied or booked a call. Bookings from Calendly land here automatically, matched by email."
        filters={
          <>
            <DateFilter label="Date applied" value={range} onChange={setRange} />
            <MultiFilter label="Lead source" options={sourceOpts} value={source} onChange={setSource} />
          </>
        }
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Applications" value={fmtNum(s.total)} big />
          <Stat label="Booked a call" value={fmtNum(s.booked)} tone="good" sub={`${fmtPct(s.bookRate)} of applications`} big />
          <Stat label="To chase" value={fmtNum(s.chase.filter((a) => a.chaseStatus === "open").length)} tone={s.chase.length ? "bad" : undefined} sub="Applied, not booked" big />
          <Stat label="Low budget" value={fmtNum(s.lowBudget)} sub="Auto-flagged from the budget answer" big />
        </div>
        <div className="sunken p-4">
          <div className="eyebrow mb-3">Applications by lead source</div>
          <Donut data={toSlices(s.bySource, sourceOrder, (k) => k)} label="Applications by lead source" noun="applications" />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              ["chase", `Chase list (${s.chase.length})`],
              ["all", `All applications (${s.total})`],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              className={`rounded-xl px-3.5 py-2 text-sm font-semibold border ${view === v ? "bg-brand/15 border-brand/50" : "border-white/[0.08] text-muted hover:text-ink"}`}
              onClick={() => setView(v)}
            >
              {label}
            </button>
          ))}
          <span className="text-xs text-faint ml-auto">Click a row for their answers and to mark them chased</span>
        </div>

        <Table<Row>
          rows={rows}
          rowKey={(a) => a.id}
          noun="applications"
          empty={view === "chase" ? "Nobody to chase. Everyone who applied has booked or been marked." : "No applications in this view."}
          onRowClick={setOpen}
          columns={[
            { key: "date", label: "Added", render: (a) => fmtDay(dayOf(a.appliedAt)) },
            { key: "name", label: "Name", render: (a) => <span className="font-semibold">{a.name}</span> },
            { key: "phone", label: "Phone", render: (a) => <span className="text-muted">{a.phone ?? "–"}</span> },
            { key: "email", label: "Email", render: (a) => <span className="text-muted">{a.email ?? "–"}</span> },
            {
              key: "call",
              label: "Call",
              render: (a) => {
                const c = a.bookedCallId ? ctx.data.calls.find((x) => x.id === a.bookedCallId) : null;
                return c ? fmtDay(dayOf(c.dateOfCall)) : "–";
              },
            },
            { key: "ig", label: "Instagram", render: (a) => <span className="text-muted">{a.instagram ?? "–"}</span> },
            { key: "src", label: "Lead source", render: (a) => a.utmSource ?? "–" },
            {
              key: "budget",
              label: "Budget",
              className: "max-w-[220px] truncate",
              render: (a) => Object.entries(a.answers).find(([k]) => /budget|invest/i.test(k))?.[1] ?? "–",
            },
            {
              key: "status",
              label: "Status",
              render: (a) =>
                a.booked ? (
                  <Pill tone="good">Booked</Pill>
                ) : a.lowBudget ? (
                  <Pill tone="bad">Low budget</Pill>
                ) : (
                  <Pill tone={a.chaseStatus === "open" ? "warn" : "plain"}>{CHASE[a.chaseStatus]}</Pill>
                ),
            },
            { key: "chased", label: "Last chased", render: (a) => (a.chasedAt ? `${fmtDay(dayOf(a.chasedAt))} · ${nameOf(a.chasedById)}` : "–") },
          ]}
        />
      </Section>

      {open && (
        <ApplicationModal
          ctx={ctx}
          app={open}
          bookedCallId={open.bookedCallId ?? undefined}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

function ApplicationModal({ ctx, app, bookedCallId, onClose }: { ctx: Ctx; app: Row; bookedCallId?: string; onClose: () => void }) {
  const [notes, setNotes] = useState(app.chaseNotes ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(chaseStatus?: ApplicationRow["chaseStatus"]) {
    setBusy(true);
    setErr(null);
    try {
      await api(`/api/applications/${app.id}`, "PATCH", { chaseNotes: notes, ...(chaseStatus ? { chaseStatus } : {}) });
      await ctx.reload();
      ctx.toast(chaseStatus ? `${app.name}: ${CHASE[chaseStatus].toLowerCase()}` : "Notes saved");
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save");
      setBusy(false);
    }
  }

  return (
    <Modal title={app.name} onClose={onClose} wide>
      <div className="space-y-5">
        <div className="text-sm text-muted">
          Applied {fmtDayLong(dayOf(app.appliedAt))} · source {app.utmSource ?? "unknown"}
          {app.lowBudget && (
            <span className="ml-2">
              <Pill tone="bad">Low budget</Pill>
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            ["Phone", app.phone],
            ["Email", app.email],
            ["Instagram", app.instagram],
          ].map(([k, v]) => (
            <div key={k} className="sunken px-3 py-2 min-w-0">
              <div className="eyebrow">{k}</div>
              <div className="text-sm truncate">{v || "–"}</div>
            </div>
          ))}
        </div>
        <dl className="sunken divide-y divide-white/[0.05]">
          {Object.entries(app.answers).map(([q, a]) => (
            <div key={q} className="px-4 py-2.5 grid sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-4">
              <dt className="text-xs text-muted">{q}</dt>
              <dd className="text-sm whitespace-pre-wrap">{a}</dd>
            </div>
          ))}
        </dl>

        {bookedCallId ? (
          <button
            className="btn-primary w-full"
            onClick={() => {
              onClose();
              ctx.openCall(bookedCallId);
            }}
          >
            They booked: open the call →
          </button>
        ) : (
          <div className="space-y-3">
            <label className="block text-sm font-semibold" htmlFor="chase-notes">
              Chase notes
            </label>
            <textarea
              id="chase-notes"
              className="input min-h-[80px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Messaged on IG, asked to book Thursday…"
            />
            {err && <p className="text-danger text-sm">{err}</p>}
            <div className="grid sm:grid-cols-3 gap-2">
              <button className="btn-primary" disabled={busy} onClick={() => save("contacted")}>
                Mark contacted
              </button>
              <button className="btn-ghost" disabled={busy} onClick={() => save("not_interested")}>
                Not interested
              </button>
              <button className="btn-ghost" disabled={busy} onClick={() => save(app.chaseStatus === "open" ? undefined : "open")}>
                {app.chaseStatus === "open" ? "Save notes" : "Back to chase list"}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
