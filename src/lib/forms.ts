// Every team form, defined as data. Add/rename a question here and the form,
// the EOD tables and the stats all follow — no other file needs touching.
// (Keep a field's `key` stable once people have submitted; the label can change.)

import type { Role } from "./config";
import type { SlackChannel } from "./config";

export type FieldType = "number" | "money" | "text" | "longtext" | "select" | "yesno" | "stars" | "date" | "url";

export type Field = {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  required?: boolean;
  hint?: string;
  /** Shown as a column in the EOD tables. */
  column?: boolean;
  /** Top of the scale for "stars" (default 5). */
  max?: number;
  /** Group heading shown above this field (mirrors the "Numbers ↓" style blocks). */
  section?: string;
};

export type FormDef = {
  kind: "dm_eod" | "sdr_eod" | "closer_eod" | "feedback" | "onboarding";
  title: string;
  blurb: string;
  roles: Role[];
  /** One per person per day — resubmitting the same day replaces it. */
  daily: boolean;
  /** Filled in by someone outside the team via a public link (no login). */
  public?: boolean;
  /** Which Slack channel a submission is posted to. */
  slack: SlackChannel;
  fields: Field[];
};

export const YES = "Yes, it's done";
export const NO = "No, I'll do it now";
const YESNO = [YES, NO];

const hours: Field = { key: "hours", label: "Hours worked", type: "number", column: true };
const performance: Field[] = [
  { key: "satisfaction", label: "Performance satisfaction", type: "stars", max: 10, required: true, column: true, section: "Performance" },
  { key: "struggle", label: "Biggest struggle", type: "longtext", required: true, column: true },
  { key: "bottleneck", label: "Biggest bottleneck", type: "longtext", required: true, column: true },
  { key: "wentWell", label: "What went well?", type: "longtext", required: true, column: true },
  { key: "improve", label: "What needs improvement?", type: "longtext", required: true, column: true },
];
const tracking = (reviewLabel: string): Field[] => [
  { key: "crmUpdated", label: "CRM & tracking done?", type: "yesno", options: YESNO, required: true, column: true, section: "Tracking" },
  { key: "remindersDone", label: "Call reminders done?", type: "yesno", options: YESNO, required: true, column: true },
  { key: "sentForReview", label: reviewLabel, type: "yesno", options: YESNO, required: true, column: true },
];
const n = (key: string, label: string, section?: string): Field => ({ key, label, type: "number", required: true, column: true, section });

export const FORMS: FormDef[] = [
  {
    kind: "dm_eod",
    title: "DM Setter EOD",
    blurb: "Your numbers and a quick reflection. Two minutes, every day you work.",
    roles: ["dm_setter", "admin"],
    daily: true,
    slack: "EOD_REPORTS",
    fields: [
      hours,
      ...performance,
      ...tracking("Sent convos to review?"),
      n("outbounds", "Outbounds", "Numbers"),
      n("inbounds", "Inbounds"),
      n("followUps", "Follow ups"),
      n("replies", "Replies"),
      n("convos", "Convos"),
      n("qualifiedConvos", "Qualified convos"),
      n("pitchedCalls", "Pitched calls"),
      n("callsBooked", "Calls booked"),
      { key: "callsRejected", label: "Calls rejected", type: "number", column: true },
      { key: "leadQuality", label: "DMs lead quality ranking", type: "stars", max: 10, required: true, column: true },
    ],
  },
  {
    kind: "sdr_eod",
    title: "SDR (Phone Setter) EOD",
    blurb: "Dials, pick-ups and how good the leads were.",
    roles: ["phone_setter", "admin"],
    daily: true,
    slack: "EOD_REPORTS",
    fields: [
      hours,
      ...performance,
      ...tracking("Sent calls to review?"),
      n("triageDials", "Triage dials", "Numbers"),
      n("triagePickUps", "Triage pick ups"),
      n("outboundDials", "Outbound dials"),
      n("outboundPickUps", "Outbound pick ups"),
      n("outboundFollowUps", "Outbound follow ups"),
      n("qualifiedConvos", "Qualified convos"),
      n("pitchedCalls", "Pitched calls"),
      n("callsBooked", "Calls booked"),
      { key: "callsRejected", label: "Calls rejected", type: "number", column: true },
      { key: "triageQuality", label: "Triage lead quality ranking", type: "stars", max: 10, required: true, column: true },
      { key: "outboundQuality", label: "Outbound lead quality ranking", type: "stars", max: 10, required: true, column: true },
    ],
  },
  {
    kind: "closer_eod",
    title: "Closer EOD",
    blurb: "How your day went. Individual call results go in the Sales Call Report.",
    roles: ["closer", "admin"],
    daily: true,
    slack: "EOD_REPORTS",
    fields: [...performance, ...tracking("Sent calls for review?")],
  },
  {
    kind: "feedback",
    title: "Sales Team Feedback",
    blurb: "What you're hearing from leads this week. This is how the content gets better.",
    roles: ["closer", "dm_setter", "phone_setter", "admin"],
    daily: false,
    slack: "SALES_FEEDBACK",
    fields: [
      { key: "leadQuality", label: "Rate lead quality", type: "stars", max: 5, required: true, column: true },
      { key: "goals", label: "Goals / aspirations", type: "longtext", required: true, column: true },
      { key: "pains", label: "Pain points", type: "longtext", required: true, column: true },
      { key: "objections", label: "Objections / hesitations / fears", type: "longtext", required: true, column: true },
      { key: "phrases", label: "Language / phrases leads repeat", type: "longtext", required: true, column: true },
      { key: "journey", label: "Lead phase of journey", type: "longtext", required: true, column: true },
      { key: "other", label: "Other feedback", type: "longtext", column: true },
    ],
  },
  {
    kind: "onboarding",
    title: "Client Onboarding",
    blurb: "Welcome in! A few quick questions so we can get you started the right way.",
    roles: ["admin"],
    daily: false,
    public: true,
    slack: "ONBOARDING",
    fields: [
      { key: "name", label: "Name", type: "text", required: true, column: true },
      { key: "email", label: "Email", type: "text", required: true, column: true },
      { key: "whatsapp", label: "WhatsApp", type: "text", required: true, column: true },
      { key: "whyJoined", label: "What made you join the program?", type: "longtext", required: true, column: true },
      { key: "firstHeard", label: "When and where did you first see or hear about me?", type: "longtext", required: true, column: true },
      { key: "biggestGoal", label: "What is your biggest goal you're looking to achieve working together?", type: "longtext", required: true, column: true },
      { key: "resonated", label: "What about me or my content resonated the most with you?", type: "longtext", column: true },
      { key: "hesitation", label: "What (if any) was your biggest hesitation before joining?", type: "longtext", column: true },
    ],
  },
];

/**
 * The setter → closer handoff, filled in against a booked call before it
 * happens (replaces the hand-typed template in #pre-call).
 */
export const PRECALL_FIELDS: Field[] = [
  { key: "situation", label: "Current situation", type: "longtext", required: true },
  { key: "pain", label: "Pain", type: "longtext", required: true },
  { key: "desired", label: "Desired state", type: "longtext", required: true },
  { key: "bottlenecks", label: "Bottlenecks", type: "longtext", required: true },
  { key: "beliefs", label: "Limiting beliefs", type: "longtext" },
  { key: "notes", label: "Anything else the closer should know", type: "longtext" },
];

export function formFor(kind: string): FormDef | undefined {
  return FORMS.find((f) => f.kind === kind);
}

/** Validate + coerce a submission against its form. Returns clean data or an error. */
export function cleanSubmission(
  form: { fields: Field[] },
  raw: Record<string, unknown>
): { data: Record<string, string | number> } | { error: string } {
  const out: Record<string, string | number> = {};
  for (const f of form.fields) {
    const v = raw[f.key];
    const empty = v === undefined || v === null || String(v).trim() === "";
    if (empty) {
      if (f.required) return { error: `"${f.label}" is required` };
      continue;
    }
    switch (f.type) {
      case "number":
      case "money": {
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0 || n > 1_000_000_000) return { error: `"${f.label}" must be a number` };
        out[f.key] = f.type === "number" ? Math.round(n * 100) / 100 : Math.round(n * 100) / 100;
        break;
      }
      case "stars": {
        const n = Math.round(Number(v));
        const max = f.max ?? 5;
        if (!(n >= 1 && n <= max)) return { error: `"${f.label}" needs a score from 1 to ${max}` };
        out[f.key] = n;
        break;
      }
      case "select":
      case "yesno": {
        const s = String(v);
        if (!f.options?.includes(s)) return { error: `Pick an option for "${f.label}"` };
        out[f.key] = s;
        break;
      }
      case "date": {
        const s = String(v);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return { error: `"${f.label}" must be a date` };
        out[f.key] = s;
        break;
      }
      case "url": {
        const s = String(v).trim();
        if (!/^https?:\/\/\S+$/i.test(s) || s.length > 1000) return { error: `"${f.label}" must be a link starting with https://` };
        out[f.key] = s;
        break;
      }
      default: {
        const s = String(v).trim().slice(0, 4000);
        out[f.key] = s;
      }
    }
  }
  return { data: out };
}
