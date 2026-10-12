"use client";

import { useMemo, useState } from "react";
import { fmtDay, fmtDayLong, inRange, resolveRange, type DateRange } from "@/lib/dates";
import { FORMS, YES, type Field, type FormDef } from "@/lib/forms";
import type { ReportRow } from "@/lib/types";
import type { Ctx } from "./App";
import { DateFilter, Modal, MultiFilter, Pill, Stars, Table, fmtMoney, fmtNum, type Column } from "./ui";

/** How one answer reads in a table cell or the detail view. */
export function Answer({ field, value, full = false }: { field: Field; value: string | number | undefined; full?: boolean }) {
  if (value === undefined || value === "") return <span className="text-faint">–</span>;
  switch (field.type) {
    case "stars":
      return <Stars value={Number(value)} max={field.max ?? 5} />;
    case "url":
      return (
        <a href={String(value)} target="_blank" rel="noreferrer noopener" className="text-cyan hover:underline">
          Open link
        </a>
      );
    case "yesno":
      return <Pill tone={value === YES ? "good" : "bad"}>{value === YES ? "Yes" : "No"}</Pill>;
    case "money":
      return <span className="num text-gold">{fmtMoney(Number(value), true)}</span>;
    case "number":
      return <span className="num">{fmtNum(Number(value), 2)}</span>;
    case "date":
      return <>{fmtDay(String(value))}</>;
    default:
      return full ? (
        <span className="whitespace-pre-wrap">{String(value)}</span>
      ) : (
        <span className="block max-w-[260px] truncate" title={String(value)}>
          {String(value)}
        </span>
      );
  }
}

export function EodReports({ ctx }: { ctx: Ctx }) {
  const { data, nameOf } = ctx;
  const admin = data.me.role === "admin";
  // Admins see every form; everyone else sees the ones they fill in.
  const forms = FORMS.filter((f) => admin || f.roles.includes(data.me.role));
  const [kind, setKind] = useState<FormDef["kind"]>(forms[0]?.kind ?? "dm_eod");
  const [range, setRange] = useState<DateRange>({ preset: "last30" });
  const [member, setMember] = useState<string[]>([]);
  const [open, setOpen] = useState<ReportRow | null>(null);

  const form = forms.find((f) => f.kind === kind) ?? forms[0];
  const rows = useMemo(() => {
    const r = resolveRange(range);
    return data.reports.filter(
      (x) =>
        x.kind === form?.kind &&
        (admin || x.memberId === data.me.id) &&
        inRange(x.day, r) &&
        (member.length === 0 || (x.memberId != null && member.includes(x.memberId)))
    );
  }, [data.reports, data.me.id, admin, form, range, member]);

  if (!form) return null;

  // Client onboarding has no team member: it's the client's own name.
  const who = (r: ReportRow) => (r.memberId ? nameOf(r.memberId) : String(r.data.name ?? "Client"));
  const people = [...new Set(data.reports.filter((r) => r.kind === form.kind && r.memberId).map((r) => r.memberId!))].map((id) => ({
    value: id,
    label: nameOf(id),
  }));

  const columns: Column<ReportRow>[] = [
    { key: "day", label: "Date", render: (r) => fmtDay(r.day) },
    { key: "who", label: form.public ? "Client" : "Name", render: (r) => <span className="font-semibold">{who(r)}</span> },
    ...form.fields
      .filter((f) => f.column && !(form.public && f.key === "name"))
      .map((f) => ({
        key: f.key,
        label: f.label.replace(/\?$/, ""),
        align: f.type === "number" || f.type === "money" ? ("right" as const) : undefined,
        render: (r: ReportRow) => <Answer field={f} value={r.data[f.key]} />,
      })),
  ];

  return (
    <div className="space-y-6">
      <div>
        <div className="eyebrow">{admin ? "Every report the team has filed" : "Your reports"}</div>
        <h1 className="display text-3xl sm:text-4xl font-extrabold tracking-tight mt-1">End-of-day reports</h1>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {forms.map((f) => (
          <button
            key={f.kind}
            className={`rounded-xl px-3.5 py-2 text-sm font-semibold whitespace-nowrap border transition-colors ${
              f.kind === form.kind ? "bg-brand/15 border-brand/50 text-ink" : "border-white/[0.08] text-muted hover:text-ink"
            }`}
            onClick={() => {
              setKind(f.kind);
              setMember([]);
            }}
          >
            {f.title}
            <span className="ml-2 num text-xs text-faint">{data.reports.filter((r) => r.kind === f.kind && (admin || r.memberId === data.me.id)).length}</span>
          </button>
        ))}
      </div>

      <section className="surface lit p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          <DateFilter label="Report date" value={range} onChange={setRange} />
          {admin && !form.public && <MultiFilter label="Name" options={people} value={member} onChange={setMember} />}
          <span className="text-faint text-xs self-center ml-auto">Click a row to read the full report</span>
        </div>
        <Table<ReportRow>
          rows={rows}
          columns={columns}
          rowKey={(r) => r.id}
          noun="reports"
          empty={`No ${form.title} reports in this view yet.`}
          onRowClick={setOpen}
          maxHeight={640}
        />
      </section>

      {open && (
        <Modal title={`${form.title}: ${who(open)}`} onClose={() => setOpen(null)}>
          <div className="text-sm text-muted mb-4">{fmtDayLong(open.day)}</div>
          <dl className="space-y-3">
            {form.fields.map((f) => (
              <div key={f.key} className="sunken px-4 py-3">
                <dt className="eyebrow mb-1.5">{f.label}</dt>
                <dd className="text-sm">
                  <Answer field={f} value={open.data[f.key]} full />
                </dd>
              </div>
            ))}
          </dl>
        </Modal>
      )}
    </div>
  );
}
