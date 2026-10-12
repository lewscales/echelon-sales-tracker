"use client";

import { useCallback, useEffect, useState } from "react";
import type { Ctx } from "./App";
import { Empty, Modal, Pill, Section, Stat, api } from "./ui";
import { today, fmtDay } from "@/lib/dates";
import { STUDENT_STATUSES } from "@/lib/students";

// Students on Echelon payment plans. Always GBP, whatever the tracker's CURRENCY.

type Student = {
  id: string;
  name: string;
  paid: number;
  owed: number;
  onPlacement: number;
  dueDate: string | null;
  status: keyof typeof STUDENT_STATUSES;
  notes: string | null;
};

// Whole pounds stay clean (£2,600); anything with pence shows both digits (£750.50).
const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });
const gbpPence = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2 });
const fmt = (n: number) => (Number.isInteger(n) ? gbp : gbpPence).format(n);

export function Students({ ctx }: { ctx: Ctx }) {
  const [rows, setRows] = useState<Student[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [paying, setPaying] = useState<Student | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/students", { cache: "no-store" });
    if (res.ok) setRows(((await res.json()) as { students: Student[] }).students);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function save(id: string, patch: Partial<Student>) {
    setRows((rs) => rs && rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    try {
      await api(`/api/students/${id}`, "PATCH", patch);
    } catch (e) {
      ctx.toast((e as Error).message);
      load();
    }
  }

  async function remove(s: Student) {
    try {
      await api(`/api/students/${s.id}`, "DELETE");
      ctx.toast(`${s.name} removed`);
    } catch (e) {
      ctx.toast((e as Error).message);
    }
    load();
  }

  if (!rows) return <Section title="Students">{<Empty>Loading…</Empty>}</Section>;

  const now = today();
  const open = rows.filter((r) => r.status !== "settled");
  const owed = open.reduce((a, r) => a + r.owed, 0);
  const placement = open.reduce((a, r) => a + r.onPlacement, 0);
  const paid = rows.reduce((a, r) => a + r.paid, 0);
  const noDate = open.filter((r) => r.owed > 0 && !r.dueDate).length;
  const overdue = open.filter((r) => r.owed > 0 && r.dueDate && r.dueDate < now);

  return (
    <div className="space-y-6">
      <Section title="Student payments" blurb="Every student on a plan with Echelon. Click any amount, date or note to change it; it saves on its own.">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Stat label="Owed now" value={fmt(owed)} tone="money" big />
          <Stat label="Due on placement" value={fmt(placement)} sub="paid once they land a role" />
          <Stat label="Collected" value={fmt(paid)} tone="good" />
          <Stat label="Overdue" value={String(overdue.length)} tone={overdue.length ? "bad" : undefined} sub={overdue.length ? fmt(overdue.reduce((a, r) => a + r.owed, 0)) : "nothing late"} />
          <Stat label="Dates to set" value={String(noDate)} sub={noDate ? "owe money, no due date" : "all set"} />
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => setAdding(true)}>
            + Add student
          </button>
        </div>

        {rows.length === 0 ? (
          <Empty>No students yet. Add the first one above.</Empty>
        ) : (
          <div className="sunken overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse min-w-[980px]">
                <thead className="bg-[#101318]">
                  <tr>
                    {["Student", "Paid", "Owes", "On placement", "Due date", "Status", "Notes", ""].map((h, i) => (
                      <th key={i} className={`px-3 py-2.5 eyebrow !text-[9.5px] whitespace-nowrap ${i >= 1 && i <= 3 ? "text-right" : "text-left"}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <Row key={r.id} r={r} now={now} save={save} onPay={() => setPaying(r)} onDelete={() => remove(r)} />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t hair px-4 py-2 text-xs text-faint">{rows.length} students</div>
          </div>
        )}
      </Section>

      {adding && (
        <AddStudent
          onClose={() => setAdding(false)}
          onDone={(name) => {
            setAdding(false);
            ctx.toast(`${name} added`);
            load();
          }}
        />
      )}
      {paying && (
        <LogPayment
          s={paying}
          onClose={() => setPaying(null)}
          onDone={async (amount) => {
            const s = paying;
            setPaying(null);
            await save(s.id, { paid: s.paid + amount, owed: Math.max(0, s.owed - amount) });
            ctx.toast(`${fmt(amount)} logged for ${s.name}`);
          }}
        />
      )}
    </div>
  );
}

function Row({ r, now, save, onPay, onDelete }: { r: Student; now: string; save: (id: string, p: Partial<Student>) => void; onPay: () => void; onDelete: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const late = r.status !== "settled" && r.owed > 0 && r.dueDate && r.dueDate < now;
  const needsDate = r.status !== "settled" && r.owed > 0 && !r.dueDate;
  return (
    <tr className={`border-t hair ${r.status === "settled" ? "opacity-55" : ""}`}>
      <td className="px-3 py-2 min-w-[170px]">
        <Cell value={r.name} onSave={(v) => save(r.id, { name: v.trim() })} className="font-semibold" required />
      </td>
      <td className="px-3 py-2 w-[110px]">
        <MoneyCell value={r.paid} onSave={(n) => save(r.id, { paid: n })} tone="text-mint" />
      </td>
      <td className="px-3 py-2 w-[110px]">
        <MoneyCell value={r.owed} onSave={(n) => save(r.id, { owed: n })} tone="text-gold" />
      </td>
      <td className="px-3 py-2 w-[120px]">
        <MoneyCell value={r.onPlacement} onSave={(n) => save(r.id, { onPlacement: n })} />
      </td>
      <td className="px-3 py-2 w-[170px]">
        <DateCell
          label={`Due date for ${r.name}`}
          className={late ? "!border-danger/60 text-danger" : needsDate ? "!border-gold/50" : ""}
          value={r.dueDate}
          onSave={(d) => save(r.id, { dueDate: d })}
        />
        {late && <div className="text-[11px] text-danger mt-1">Overdue since {fmtDay(r.dueDate!)}</div>}
        {needsDate && <div className="text-[11px] text-gold mt-1">Set a date</div>}
      </td>
      <td className="px-3 py-2 w-[120px]">
        <select
          aria-label={`Status for ${r.name}`}
          className="input !py-1.5 !px-2.5 !rounded-xl"
          value={r.status}
          onChange={(e) => save(r.id, { status: e.target.value as Student["status"] })}
        >
          {Object.entries(STUDENT_STATUSES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2 min-w-[220px]">
        <Cell value={r.notes ?? ""} placeholder="Add a note" onSave={(v) => save(r.id, { notes: v.trim() || null })} className="text-muted" />
      </td>
      <td className="px-3 py-2 whitespace-nowrap text-right">
        {r.owed > 0 && (
          <button className="btn-ghost !px-2.5 !py-1.5 !text-xs mr-1" onClick={onPay}>
            Log payment
          </button>
        )}
        {confirm ? (
          <button className="btn-ghost !px-2.5 !py-1.5 !text-xs !text-danger" onClick={onDelete} onBlur={() => setConfirm(false)} autoFocus>
            Remove?
          </button>
        ) : (
          <button className="btn-ghost !px-2.5 !py-1.5 !text-xs" aria-label={`Remove ${r.name}`} onClick={() => setConfirm(true)}>
            ✕
          </button>
        )}
      </td>
    </tr>
  );
}

/** Text that turns into an input on click and saves on blur / Enter. */
function Cell({ value, onSave, className = "", placeholder, required }: { value: string; onSave: (v: string) => void; className?: string; placeholder?: string; required?: boolean }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <input
      className={`w-full bg-transparent rounded-lg px-2 py-1.5 -mx-2 outline-none hover:bg-white/[0.04] focus:bg-white/[0.06] placeholder:text-faint ${className}`}
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        if (v === value) return;
        if (required && !v.trim()) return setV(value);
        onSave(v);
      }}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}

function MoneyCell({ value, onSave, tone = "" }: { value: number; onSave: (n: number) => void; tone?: string }) {
  const [v, setV] = useState(String(value || ""));
  const [focus, setFocus] = useState(false);
  useEffect(() => setV(String(value || "")), [value]);
  return (
    <input
      inputMode="decimal"
      className={`w-full bg-transparent rounded-lg px-2 py-1.5 outline-none text-right num hover:bg-white/[0.04] focus:bg-white/[0.06] ${value ? tone : "text-faint"}`}
      value={focus ? v : value ? fmt(value) : "–"}
      onFocus={() => setFocus(true)}
      onChange={(e) => setV(e.target.value.replace(/[^0-9.]/g, ""))}
      onBlur={() => {
        setFocus(false);
        const n = v === "" ? 0 : Number(v);
        if (Number.isFinite(n) && n >= 0 && n !== value) onSave(Math.round(n * 100) / 100);
        else setV(String(value || ""));
      }}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}

// Saves on blur, not per keystroke: typing a year fires change events with
// half-typed years ("0002"), which would otherwise be saved out of order.
function DateCell({ value, onSave, label, className }: { value: string | null; onSave: (d: string | null) => void; label: string; className: string }) {
  const [v, setV] = useState(value ?? "");
  useEffect(() => setV(value ?? ""), [value]);
  const commit = () => {
    const next = v || null;
    if (next === value) return;
    if (next && Number(next.slice(0, 4)) < 2000) return setV(value ?? "");
    onSave(next);
  };
  return (
    <input
      type="date"
      aria-label={label}
      className={`input !py-1.5 !px-2.5 !rounded-xl num ${className}`}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}

function AddStudent({ onClose, onDone }: { onClose: () => void; onDone: (name: string) => void }) {
  const [f, setF] = useState({ name: "", paid: "", owed: "", onPlacement: "", dueDate: "", notes: "" });
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/api/students", "POST", f);
      onDone(f.name.trim());
    } catch (x) {
      setErr((x as Error).message);
    }
  }
  return (
    <Modal title="Add a student" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="label">Name</span>
          <input className="input mt-1.5" value={f.name} onChange={(e) => set("name")(e.target.value)} autoFocus />
        </label>
        <div className="grid sm:grid-cols-3 gap-3">
          {(["paid", "owed", "onPlacement"] as const).map((k) => (
            <label key={k} className="block">
              <span className="label">{k === "paid" ? "Paid" : k === "owed" ? "Owes" : "On placement"}</span>
              <div className="relative mt-1.5">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-faint">£</span>
                <input className="input num !pl-8" type="number" min={0} step="any" value={f[k]} onChange={(e) => set(k)(e.target.value)} />
              </div>
            </label>
          ))}
        </div>
        <label className="block">
          <span className="label">Due date (optional)</span>
          <input className="input mt-1.5" type="date" value={f.dueDate} onChange={(e) => set("dueDate")(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Notes</span>
          <input className="input mt-1.5" value={f.notes} onChange={(e) => set("notes")(e.target.value)} />
        </label>
        {err && <p className="text-danger text-sm">{err}</p>}
        <button className="btn-primary w-full">Add student</button>
      </form>
    </Modal>
  );
}

function LogPayment({ s, onClose, onDone }: { s: Student; onClose: () => void; onDone: (amount: number) => void }) {
  const [amount, setAmount] = useState(String(s.owed));
  const n = Number(amount);
  const ok = Number.isFinite(n) && n > 0;
  return (
    <Modal title={`Log a payment from ${s.name}`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (ok) onDone(Math.round(n * 100) / 100);
        }}
        className="space-y-4"
      >
        <p className="text-muted text-sm">
          Owes <span className="text-gold font-semibold">{fmt(s.owed)}</span>. The amount moves from &ldquo;Owes&rdquo; to &ldquo;Paid&rdquo;.
        </p>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-faint">£</span>
          <input className="input num !pl-8" type="number" min={0} step="any" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </div>
        {ok && n >= s.owed && <Pill tone="good">This clears what they owe</Pill>}
        <button className="btn-primary w-full" disabled={!ok}>
          Log {ok ? fmt(n) : "payment"}
        </button>
      </form>
    </Modal>
  );
}
