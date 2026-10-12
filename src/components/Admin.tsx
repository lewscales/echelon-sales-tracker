"use client";

import { useState } from "react";
import { CALENDARS, PAYMENT_METHODS, PAYMENT_TYPES, PROGRAMS, ROLES, SLACK_CHANNELS, UTM_SOURCES, type Role, type SlackChannel } from "@/lib/config";
import { dayOf, fmtDay, fmtTime, today } from "@/lib/dates";
import type { CallRow, MemberRow, PaymentRow } from "@/lib/types";
import type { Ctx } from "./App";
import { OutcomePill } from "./Dashboard";
import { CURRENCY_SYMBOL, Modal, Pill, Table, api, fmtMoney } from "./ui";

type Tab = "team" | "calls" | "payments" | "connect";

export function Admin({ ctx }: { ctx: Ctx }) {
  const [tab, setTab] = useState<Tab>("team");
  return (
    <div className="space-y-6">
      <div>
        <div className="eyebrow">Admin</div>
        <h1 className="display text-3xl sm:text-4xl font-extrabold tracking-tight mt-1">Run the floor</h1>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {(
          [
            ["team", "Team & logins"],
            ["calls", "Booked calls"],
            ["payments", "Payments"],
            ["connect", "Automations"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            className={`rounded-xl px-3.5 py-2 text-sm font-semibold whitespace-nowrap border ${
              tab === id ? "bg-brand/15 border-brand/50 text-ink" : "border-white/[0.08] text-muted hover:text-ink"
            }`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "team" && <Team ctx={ctx} />}
      {tab === "calls" && <Calls ctx={ctx} />}
      {tab === "payments" && <Payments ctx={ctx} />}
      {tab === "connect" && <Connect ctx={ctx} />}
    </div>
  );
}

function useAction(ctx: Ctx) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function run(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      await ctx.reload();
      ctx.toast(done);
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, err, run, setErr };
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold mb-1.5">
        {label}
        {required && <span className="text-danger ml-1">*</span>}
      </span>
      {children}
    </label>
  );
}

function Select({ value, onChange, options, blank = "–" }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; blank?: string }) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{blank}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

const asOpts = (xs: string[]) => xs.map((x) => ({ value: x, label: x }));

// ─────────────────────────────── Team ───────────────────────────────

function Team({ ctx }: { ctx: Ctx }) {
  const { data } = ctx;
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("dm_setter");
  const [utmCode, setUtmCode] = useState("");
  const [editing, setEditing] = useState<MemberRow | null>(null);
  const a = useAction(ctx);
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard blocked: the code is on screen anyway */
    }
  }

  return (
    <section className="surface lit p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="display text-xl font-bold">Team &amp; logins</h2>
          <p className="text-sm text-muted">Everyone logs in with their own code. Send it to them privately.</p>
        </div>
        <button className="btn-primary" onClick={() => setAdding(true)}>
          + Add team member
        </button>
      </div>
      <Table<MemberRow>
        rows={data.members}
        rowKey={(m) => m.id}
        noun="people"
        empty="No team members yet."
        columns={[
          { key: "name", label: "Name", render: (m) => <span className={`font-semibold ${m.active ? "" : "text-faint line-through"}`}>{m.name}</span> },
          { key: "role", label: "Role", render: (m) => <Pill tone={m.role === "admin" ? "brand" : "plain"}>{ROLES[m.role]}</Pill> },
          { key: "email", label: "Email", render: (m) => <span className="text-muted">{m.email ?? "–"}</span> },
          { key: "utm", label: "Tracking code", render: (m) => (m.utmCode ? <span className="num text-sm">{m.utmCode}</span> : <span className="text-faint">–</span>) },
          {
            key: "code",
            label: "Login code",
            render: (m) => (
              <button className="num text-cyan hover:underline" onClick={() => m.code && copy(m.code)} title="Copy">
                {copied === m.code ? "Copied ✓" : m.code}
              </button>
            ),
          },
          {
            key: "actions",
            label: "",
            render: (m) =>
              m.id === data.me.id ? (
                <span className="text-faint text-xs">That&apos;s you</span>
              ) : (
                <div className="flex gap-1.5 justify-end">
                  <button className="btn-ghost !px-2.5 !py-1 !text-xs" onClick={() => setEditing(m)}>
                    Edit
                  </button>
                  <button
                    className="btn-ghost !px-2.5 !py-1 !text-xs"
                    disabled={a.busy}
                    onClick={() => a.run(() => api(`/api/members/${m.id}`, "PATCH", { newCode: true }), `New code issued for ${m.name}`)}
                  >
                    New code
                  </button>
                  <button
                    className="btn-ghost !px-2.5 !py-1 !text-xs"
                    disabled={a.busy}
                    onClick={() =>
                      a.run(() => api(`/api/members/${m.id}`, "PATCH", { active: !m.active }), m.active ? `${m.name} can no longer log in` : `${m.name} reactivated`)
                    }
                  >
                    {m.active ? "Deactivate" : "Reactivate"}
                  </button>
                </div>
              ),
          },
        ]}
      />
      {a.err && !adding && <p className="text-danger text-sm">{a.err}</p>}

      {adding && (
        <Modal title="Add team member" onClose={() => setAdding(false)}>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await a.run(() => api("/api/members", "POST", { name, email, role, utmCode }), `${name} added. Their code is in the table.`);
              if (ok) {
                setAdding(false);
                setName("");
                setEmail("");
                setUtmCode("");
              }
            }}
          >
            <Field label="Name" required>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </Field>
            <Field label="Email">
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Role" required>
              <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {Object.entries(ROLES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tracking code (setters)">
              <input className="input num" value={utmCode} onChange={(e) => setUtmCode(e.target.value)} placeholder="e.g. ig-dm-dvd" />
              <span className="block text-xs text-faint mt-1">The utm_source on their personal booking link. Bookings with it are credited to them automatically.</span>
            </Field>
            {a.err && <p className="text-danger text-sm">{a.err}</p>}
            <button className="btn-primary w-full" disabled={a.busy || !name.trim()}>
              {a.busy ? "Adding…" : "Add and create login code"}
            </button>
          </form>
        </Modal>
      )}
      {editing && <EditMember ctx={ctx} member={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function EditMember({ ctx, member, onClose }: { ctx: Ctx; member: MemberRow; onClose: () => void }) {
  const [name, setName] = useState(member.name);
  const [email, setEmail] = useState(member.email ?? "");
  const [role, setRole] = useState<Role>(member.role);
  const [utmCode, setUtmCode] = useState(member.utmCode ?? "");
  const a = useAction(ctx);
  return (
    <Modal title={`Edit ${member.name}`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await a.run(() => api(`/api/members/${member.id}`, "PATCH", { name, email, role, utmCode }), `${name} updated`)) onClose();
        }}
      >
        <Field label="Name" required>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email">
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Role" required>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {Object.entries(ROLES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tracking code (setters)">
          <input className="input num" value={utmCode} onChange={(e) => setUtmCode(e.target.value)} placeholder="e.g. ig-dm-dvd" />
        </Field>
        {a.err && <p className="text-danger text-sm">{a.err}</p>}
        <button className="btn-primary w-full" disabled={a.busy || !name.trim()}>
          {a.busy ? "Saving…" : "Save"}
        </button>
      </form>
    </Modal>
  );
}

// ─────────────────────────────── Booked calls ───────────────────────────────

function nowLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function Calls({ ctx }: { ctx: Ctx }) {
  const { data, nameOf } = ctx;
  const [adding, setAdding] = useState(false);
  const [del, setDel] = useState<CallRow | null>(null);
  const empty = { leadName: "", leadEmail: "", leadPhone: "", instagram: "", dateOfCall: nowLocal(), calendarName: CALENDARS[0] ?? "", program: "", utmSource: "", setterId: "", closerId: "" };
  const [f, setF] = useState(empty);
  const a = useAction(ctx);
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const setters = data.members.filter((m) => m.active && (m.role === "dm_setter" || m.role === "phone_setter")).map((m) => ({ value: m.id, label: m.name }));
  const closers = data.members.filter((m) => m.active && (m.role === "closer" || m.role === "admin")).map((m) => ({ value: m.id, label: m.name }));

  return (
    <section className="surface lit p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="display text-xl font-bold">Booked calls</h2>
          <p className="text-sm text-muted">Calls normally arrive on their own from the calendar. Add one here if it didn&apos;t.</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => {
            setF(empty);
            a.setErr(null);
            setAdding(true);
          }}
        >
          + Add booked call
        </button>
      </div>
      <Table<CallRow>
        rows={data.calls}
        rowKey={(c) => c.id}
        noun="calls"
        empty="No booked calls yet."
        onRowClick={(c) => ctx.openCall(c.id)}
        columns={[
          { key: "when", label: "Call date", render: (c) => `${fmtDay(dayOf(c.dateOfCall))} · ${fmtTime(c.dateOfCall)}` },
          { key: "lead", label: "Lead", render: (c) => <span className="font-semibold">{c.leadName}</span> },
          { key: "email", label: "Email", render: (c) => <span className="text-muted">{c.leadEmail ?? "–"}</span> },
          { key: "cal", label: "Calendar", render: (c) => c.calendarName ?? "–" },
          { key: "src", label: "Source", render: (c) => c.utmSource ?? "–" },
          { key: "setter", label: "Setter", render: (c) => nameOf(c.setterId) },
          { key: "closer", label: "Closer", render: (c) => nameOf(c.closerId) },
          { key: "outcome", label: "Outcome", render: (c) => <OutcomePill outcome={c.outcome} /> },
          {
            key: "x",
            label: "",
            render: (c) => (
              <button
                className="text-xs text-faint hover:text-danger"
                onClick={(e) => {
                  e.stopPropagation();
                  setDel(c);
                }}
              >
                Delete
              </button>
            ),
          },
        ]}
      />

      {adding && (
        <Modal title="Add booked call" onClose={() => setAdding(false)}>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await a.run(
                () => api("/api/calls", "POST", { ...f, dateOfCall: new Date(f.dateOfCall).toISOString() }),
                `Call with ${f.leadName} added`
              );
              if (ok) setAdding(false);
            }}
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Lead name" required>
                <input className="input" value={f.leadName} onChange={(e) => set("leadName")(e.target.value)} autoFocus />
              </Field>
              <Field label="Lead email">
                <input className="input" type="email" value={f.leadEmail} onChange={(e) => set("leadEmail")(e.target.value)} />
              </Field>
              <Field label="Phone / WhatsApp">
                <input className="input" value={f.leadPhone} onChange={(e) => set("leadPhone")(e.target.value)} />
              </Field>
              <Field label="Instagram">
                <input className="input" value={f.instagram} onChange={(e) => set("instagram")(e.target.value)} />
              </Field>
              <Field label="Date & time of call" required>
                <input className="input" type="datetime-local" value={f.dateOfCall} onChange={(e) => set("dateOfCall")(e.target.value)} />
              </Field>
              <Field label="Calendar">
                <Select value={f.calendarName} onChange={set("calendarName")} options={asOpts(CALENDARS)} />
              </Field>
              <Field label="Program">
                <Select value={f.program} onChange={set("program")} options={asOpts(PROGRAMS)} />
              </Field>
              <Field label="Lead source">
                <Select value={f.utmSource} onChange={set("utmSource")} options={asOpts(UTM_SOURCES)} />
              </Field>
              <Field label="Setter">
                <Select value={f.setterId} onChange={set("setterId")} options={setters} blank="Nobody" />
              </Field>
              <Field label="Closer">
                <Select value={f.closerId} onChange={set("closerId")} options={closers} blank="Unassigned" />
              </Field>
            </div>
            {a.err && <p className="text-danger text-sm">{a.err}</p>}
            <button className="btn-primary w-full" disabled={a.busy || !f.leadName.trim()}>
              {a.busy ? "Adding…" : "Add call"}
            </button>
          </form>
        </Modal>
      )}
      {del && (
        <Confirm
          text={`Delete the call with ${del.leadName}? Its outcome comes off the dashboard too. This can't be undone.`}
          busy={a.busy}
          onCancel={() => setDel(null)}
          onConfirm={async () => {
            if (await a.run(() => api(`/api/calls/${del.id}`, "DELETE"), "Call deleted")) setDel(null);
          }}
        />
      )}
    </section>
  );
}

// ─────────────────────────────── Payments ───────────────────────────────

function Payments({ ctx }: { ctx: Ctx }) {
  const { data, nameOf } = ctx;
  const [adding, setAdding] = useState(false);
  const [del, setDel] = useState<PaymentRow | null>(null);
  const [editing, setEditing] = useState<PaymentRow | null>(null);
  const empty = { customerName: "", customerEmail: "", amount: "", date: today(), paymentType: "pif", product: "", paymentMethod: "", program: "", notes: "", setterId: "", closerId: "" };
  const [f, setF] = useState(empty);
  const a = useAction(ctx);
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const setters = data.members.filter((m) => m.active && (m.role === "dm_setter" || m.role === "phone_setter")).map((m) => ({ value: m.id, label: m.name }));
  const closers = data.members.filter((m) => m.active && (m.role === "closer" || m.role === "admin")).map((m) => ({ value: m.id, label: m.name }));

  return (
    <section className="surface lit p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="display text-xl font-bold">Payments</h2>
          <p className="text-sm text-muted">Every payment that landed. Each instalment of a plan is its own row.</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => {
            setF(empty);
            a.setErr(null);
            setAdding(true);
          }}
        >
          + Add payment
        </button>
      </div>
      <Table<PaymentRow>
        rows={data.payments}
        rowKey={(p) => p.id}
        noun="payments"
        empty="No payments yet."
        onRowClick={setEditing}
        columns={[
          { key: "date", label: "Date", render: (p) => fmtDay(dayOf(p.date)) },
          { key: "name", label: "Customer", render: (p) => <span className="font-semibold">{p.customerName}</span> },
          { key: "email", label: "Email", render: (p) => <span className="text-muted">{p.customerEmail ?? "–"}</span> },
          { key: "amt", label: "Amount", align: "right", render: (p) => <span className="text-gold">{fmtMoney(p.amount, true)}</span> },
          { key: "type", label: "Type", render: (p) => PAYMENT_TYPES[p.paymentType as keyof typeof PAYMENT_TYPES] ?? p.paymentType },
          { key: "status", label: "Status", render: (p) => (p.status === "failed" ? <Pill tone="bad">Failed</Pill> : <Pill tone="good">Paid</Pill>) },
          { key: "product", label: "Product", render: (p) => p.product ?? "–" },
          { key: "method", label: "Method", render: (p) => p.paymentMethod ?? "–" },
          { key: "program", label: "Program", render: (p) => p.program ?? "–" },
          { key: "notes", label: "Notes", className: "max-w-[200px] truncate", render: (p) => p.notes ?? "" },
          { key: "setter", label: "Setter", render: (p) => nameOf(p.setterId) },
          { key: "closer", label: "Closer", render: (p) => nameOf(p.closerId) },
          {
            key: "x",
            label: "",
            render: (p) => (
              <button
                className="text-xs text-faint hover:text-danger"
                onClick={(e) => {
                  e.stopPropagation();
                  setDel(p);
                }}
              >
                Delete
              </button>
            ),
          },
        ]}
      />

      {adding && (
        <Modal title="Add payment" onClose={() => setAdding(false)}>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              // Noon UTC keeps a date-only payment on the same calendar day in any timezone.
              const ok = await a.run(() => api("/api/payments", "POST", { ...f, setterId: f.setterId || undefined, closerId: f.closerId || undefined, date: `${f.date}T12:00:00Z` }), `Payment from ${f.customerName} added`);
              if (ok) setAdding(false);
            }}
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Customer name" required>
                <input className="input" value={f.customerName} onChange={(e) => set("customerName")(e.target.value)} autoFocus />
              </Field>
              <Field label="Customer email">
                <input className="input" type="email" value={f.customerEmail} onChange={(e) => set("customerEmail")(e.target.value)} />
              </Field>
              <Field label="Amount" required>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-faint text-sm">{CURRENCY_SYMBOL}</span>
                  <input className="input num !pl-8" type="number" min={0} step="any" value={f.amount} onChange={(e) => set("amount")(e.target.value)} />
                </div>
              </Field>
              <Field label="Date of payment" required>
                <input className="input" type="date" value={f.date} onChange={(e) => set("date")(e.target.value)} />
              </Field>
              <Field label="Payment type" required>
                <select className="input" value={f.paymentType} onChange={(e) => set("paymentType")(e.target.value)}>
                  {Object.entries(PAYMENT_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Program">
                <Select value={f.program} onChange={set("program")} options={asOpts(PROGRAMS)} />
              </Field>
              <Field label="Product">
                <input className="input" value={f.product} onChange={(e) => set("product")(e.target.value)} placeholder="e.g. Echelon SDR Bootcamp" />
              </Field>
              <Field label="Payment method">
                <Select value={f.paymentMethod} onChange={set("paymentMethod")} options={asOpts(PAYMENT_METHODS)} />
              </Field>
              <Field label="Setter">
                <Select value={f.setterId} onChange={set("setterId")} options={setters} blank="From their booked call" />
              </Field>
              <Field label="Closer">
                <Select value={f.closerId} onChange={set("closerId")} options={closers} blank="From their booked call" />
              </Field>
            </div>
            <Field label="Notes">
              <input className="input" value={f.notes} onChange={(e) => set("notes")(e.target.value)} />
            </Field>
            {a.err && <p className="text-danger text-sm">{a.err}</p>}
            <button className="btn-primary w-full" disabled={a.busy || !f.customerName.trim() || !f.amount}>
              {a.busy ? "Adding…" : "Add payment"}
            </button>
          </form>
        </Modal>
      )}
      {editing && <EditPayment ctx={ctx} payment={editing} setters={setters} closers={closers} onClose={() => setEditing(null)} />}
      {del && (
        <Confirm
          text={`Delete ${fmtMoney(del.amount, true)} from ${del.customerName}? It comes off Total Cash Collected. This can't be undone.`}
          busy={a.busy}
          onCancel={() => setDel(null)}
          onConfirm={async () => {
            if (await a.run(() => api(`/api/payments/${del.id}`, "DELETE"), "Payment deleted")) setDel(null);
          }}
        />
      )}
    </section>
  );
}

function EditPayment({
  ctx,
  payment,
  setters,
  closers,
  onClose,
}: {
  ctx: Ctx;
  payment: PaymentRow;
  setters: { value: string; label: string }[];
  closers: { value: string; label: string }[];
  onClose: () => void;
}) {
  const [f, setF] = useState({
    paymentType: payment.paymentType,
    program: payment.program ?? "",
    product: payment.product ?? "",
    paymentMethod: payment.paymentMethod ?? "",
    setterId: payment.setterId ?? "",
    closerId: payment.closerId ?? "",
    notes: payment.notes ?? "",
  });
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const a = useAction(ctx);
  return (
    <Modal title={`${payment.customerName} · ${fmtMoney(payment.amount, true)}`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await a.run(() => api(`/api/payments/${payment.id}`, "PATCH", f), "Payment updated")) onClose();
        }}
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Payment type" required>
            <select className="input" value={f.paymentType} onChange={(e) => set("paymentType")(e.target.value)}>
              {Object.entries(PAYMENT_TYPES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Program">
            <Select value={f.program} onChange={set("program")} options={asOpts(PROGRAMS)} />
          </Field>
          <Field label="Product">
            <input className="input" value={f.product} onChange={(e) => set("product")(e.target.value)} />
          </Field>
          <Field label="Payment method">
            <Select value={f.paymentMethod} onChange={set("paymentMethod")} options={asOpts(PAYMENT_METHODS)} />
          </Field>
          <Field label="Setter">
            <Select value={f.setterId} onChange={set("setterId")} options={setters} blank="Nobody" />
          </Field>
          <Field label="Closer">
            <Select value={f.closerId} onChange={set("closerId")} options={closers} blank="Unassigned" />
          </Field>
        </div>
        <Field label="Notes">
          <input className="input" value={f.notes} onChange={(e) => set("notes")(e.target.value)} />
        </Field>
        {a.err && <p className="text-danger text-sm">{a.err}</p>}
        <button className="btn-primary w-full" disabled={a.busy}>
          {a.busy ? "Saving…" : "Save"}
        </button>
      </form>
    </Modal>
  );
}

function Confirm({ text, busy, onCancel, onConfirm }: { text: string; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Modal title="Are you sure?" onClose={onCancel}>
      <p className="text-sm text-muted">{text}</p>
      <div className="flex gap-2 mt-5">
        <button className="btn-ghost flex-1" onClick={onCancel}>
          Keep it
        </button>
        <button className="btn flex-1 bg-danger/90 hover:bg-danger text-white" onClick={onConfirm} disabled={busy}>
          {busy ? "Deleting…" : "Delete"}
        </button>
      </div>
    </Modal>
  );
}

// ─────────────────────────────── Automations ───────────────────────────────

const ZAPS: { title: string; trigger: string; path: string; body: string; notes: string }[] = [
  {
    title: "1. New application",
    trigger: "Typeform → New Entry (the application form)",
    path: "/api/ingest/application",
    body: `{
  "externalId": "<Typeform response token>",
  "name": "<Name>",
  "email": "<Email>",
  "phone": "<Phone>",
  "instagram": "<Instagram>",
  "utmSource": "<hidden field utm_source>",
  "answers": {
    "Do you trade full time?": "<answer>",
    "Current situation": "<answer>",
    "Time trading": "<answer>",
    "Age": "<answer>",
    "Budget": "<answer>"
  }
}`,
    notes: "Replaces the #applications post and the Google Sheet. Low-budget answers are flagged automatically.",
  },
  {
    title: "2. New booking",
    trigger: "Calendly → Invitee Created (all four event types)",
    path: "/api/ingest/call",
    body: `{
  "externalId": "<Invitee URI>",
  "leadName": "<Invitee Name>",
  "leadEmail": "<Invitee Email>",
  "phone": "<Text Reminder Number / phone question>",
  "dateOfCall": "<Event Start Time>",
  "timezone": "<Invitee Timezone>",
  "calendarName": "<Event Type Name>",
  "utmSource": "<Tracking UTM Source>",
  "utmCampaign": "<Tracking UTM Campaign>",
  "closer": "<Event host email>",
  "bookingAnswers": { "<Question 1>": "<Answer 1>", "<Question 2>": "<Answer 2>" }
}`,
    notes:
      "Replaces both #booked-calls posts. The application answers are attached by email automatically, so no lookup step is needed. The setter is credited from their tracking code.",
  },
  {
    title: "3. Cancelled or rescheduled booking",
    trigger: "Calendly → Invitee Canceled",
    path: "/api/ingest/call",
    body: `{
  "event": "<Rescheduled = true ? 'rescheduled' : 'cancelled'>",
  "externalId": "<Invitee URI>",
  "leadEmail": "<Invitee Email>"
}`,
    notes: "Keeps cancel and reschedule rates accurate without waiting for the closer. A closer's report always wins.",
  },
  {
    title: "4. Payment (successful or failed)",
    trigger: "Stripe → New Charge / Failed Charge (or Whop → Payment Succeeded / Failed)",
    path: "/api/ingest/payment",
    body: `{
  "externalId": "<Charge ID>",
  "status": "succeeded",
  "customerName": "<Customer Name>",
  "customerEmail": "<Customer Email>",
  "amount": "<Amount (in dollars, not cents)>",
  "date": "<Created>",
  "product": "<Description / Product Name>",
  "paymentMethod": "<Payment Method Type>",
  "failureReason": "<Failure Message, for failed only>"
}`,
    notes:
      "Use the same Zap twice (status succeeded / failed) or one Zap with Paths. Setter, closer, program and PIF/Split/Deposit are filled from the lead's booked call.",
  },
];

function Connect({ ctx }: { ctx: Ctx }) {
  const { data } = ctx;
  const origin = data.appUrl;
  const slack = data.slack;
  return (
    <div className="space-y-6">
      <section className="surface lit p-4 sm:p-6 space-y-4">
        <div>
          <h2 className="display text-xl font-bold">Zapier: 4 Zaps bring outside data in</h2>
          <p className="text-sm text-muted mt-1 max-w-3xl">
            Each Zap ends with <b>Webhooks by Zapier → POST</b> to the address below, Payload Type <b>JSON</b>, with the header{" "}
            <code className="num text-cyan">x-ingest-secret</code> set to the <code className="num text-cyan">INGEST_SECRET</code> from the server
            settings. Everything else (forms, call reports, EODs, reminders) happens inside the tracker and posts to Slack itself, so it needs no Zap.
          </p>
        </div>
        {ZAPS.map((z) => (
          <div key={z.title} className="sunken p-4 space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="font-semibold">{z.title}</div>
              <div className="text-xs text-faint">Trigger: {z.trigger}</div>
            </div>
            <div className="num text-sm text-cyan break-all">POST {origin}{z.path}</div>
            <pre className="num text-xs text-muted overflow-x-auto whitespace-pre">{z.body}</pre>
            <p className="text-xs text-faint">{z.notes}</p>
          </div>
        ))}
      </section>

      <section className="surface lit p-4 sm:p-6 space-y-4">
        <div>
          <h2 className="display text-xl font-bold">Slack channels</h2>
          <p className="text-sm text-muted mt-1 max-w-3xl">
            In Slack, add the <b>Incoming Webhooks</b> app and create one webhook per channel. Put each URL in the server settings as{" "}
            <code className="num text-cyan">SLACK_WEBHOOK_&lt;NAME&gt;</code>. A channel that isn&apos;t set up is skipped, so nothing breaks.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          {(Object.keys(SLACK_CHANNELS) as SlackChannel[]).map((k) => (
            <div key={k} className="sunken px-4 py-3 flex items-center gap-3">
              <span className={`w-2 h-2 rounded-full ${slack?.[k] ? "bg-mint" : "bg-line2"}`} />
              <span className="font-semibold">{SLACK_CHANNELS[k]}</span>
              <code className="num text-[11px] text-faint ml-auto">SLACK_WEBHOOK_{k}</code>
              <span className={`text-xs ${slack?.[k] ? "text-mint" : "text-faint"}`}>{slack?.[k] ? "Connected" : "Not set"}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="surface lit p-4 sm:p-6 space-y-3">
        <h2 className="display text-xl font-bold">Scheduled reminders</h2>
        <p className="text-sm text-muted max-w-3xl">
          Set <code className="num text-cyan">CRON_SECRET</code> (16+ random characters) in the server settings, then have a scheduler (a Render Cron Job
          or cron-job.org) POST these with the header <code className="num text-cyan">x-cron-secret</code>:
        </p>
        <div className="sunken p-4 num text-sm space-y-1.5">
          <div>
            <span className="text-cyan">POST {origin}/api/cron/eod-reminder</span> <span className="text-faint">· every day 18:00 UTC → #eod-reports</span>
          </div>
          <div>
            <span className="text-cyan">POST {origin}/api/cron/feedback-reminder</span> <span className="text-faint">· Fridays 17:00 UTC → #sales-feedback</span>
          </div>
        </div>
        <p className={`text-sm ${data.cronReady ? "text-mint" : "text-gold"}`}>
          {data.cronReady ? "CRON_SECRET is set. Reminders are ready." : "CRON_SECRET is not set yet, so reminders are off."}
        </p>
      </section>
    </div>
  );
}
