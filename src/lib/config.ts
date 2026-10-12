// ============================================================================
//  WHITE-LABEL CONFIG — edit this ONE file to rebrand the tracker for a client.
//
//  The form questions live in src/lib/forms.ts.
//  The admin login code lives in .env / render.yaml (ADMIN_CODE).
// ============================================================================

export const BRAND = {
  /** Product name — header, login screen, page title. */
  name: "Echelon Sales Tracker",
  short: "Sales Tracker",
  /** Whose floor this is — shows under the logo. */
  client: "Echelon",
  tagline: "Every call, every pound, every rep. One screen.",
  description: "Sales team tracker: cash, call outcomes, setter activity and daily reports.",
};

export const THEME = {
  accent: "#1FB5C9",
  accentLight: "#5ED3E0",
  accentDeep: "#13879A",
};

/** Options offered in dropdowns. Change freely — old records keep their value. */
export const PROGRAMS = ["High Tier", "Mid Tier", "Low Tier"];
/** Calendar / event-type names (as the scheduling tool sends them). */
export const CALENDARS = [
  "Strategy Call",
  "Application Call",
];
/** Known lead sources, in the order their pie-chart colours are assigned. */
export const UTM_SOURCES = ["yt-bio", "ig-dm-dvd", "ig-dm-carlos", "sdr-app", "webinar"];
export const PAYMENT_METHODS = ["Card", "Apple / Google Pay", "BNPL", "Bank Transfer"];

/**
 * An application whose budget answer contains any of these (case-insensitive)
 * is flagged low-budget and kept off the setters' chase list by default.
 */
export const DQ_BUDGET_PATTERNS = ["less than $1k", "under $1k", "less than £1k", "under £1k", "can't help you"];

/** Currency every money figure is shown in (ISO code). */
export const CURRENCY = "GBP";

/** IANA zone used for "today", "this week" and every daily rollup. */
export const TIMEZONE = "Europe/London";

export const ROLES = {
  admin: "Admin",
  closer: "Closer",
  dm_setter: "DM Setter",
  phone_setter: "Phone Setter",
} as const;
export type Role = keyof typeof ROLES;

export const OUTCOMES = {
  closed: "Closed",
  not_closed: "No close",
  follow_up: "Follow-up call",
  no_show: "No show",
  cancelled: "Cancelled",
  rescheduled: "Rescheduled",
} as const;
export type Outcome = keyof typeof OUTCOMES;

export const CALL_TYPES = {
  first_call: "First call",
  follow_up_call: "Follow-up call",
} as const;

export const PAYMENT_TYPES = {
  pif: "PIF",
  split: "Split",
  deposit: "Deposit",
} as const;

/** The two-step call status closers answer, mapped onto one stored outcome. */
export const CALL_INFO = {
  live: "Live Call",
  no_show: "No Show",
  rescheduled: "Rescheduled",
  cancelled: "Cancelled",
} as const;
export const CALL_OUTCOMES = {
  closed: "Closed",
  not_closed: "No Close",
  follow_up: "Follow Up Call",
} as const;

export const QUALIFIED = {
  qualified: "Qualified",
  dq: "DQ",
} as const;

/**
 * Slack channels the tracker posts to. Each is an incoming-webhook URL set in
 * the environment (SLACK_WEBHOOK_<KEY>). A channel with no URL is skipped.
 */
export const SLACK_CHANNELS = {
  APPLICATIONS: "#applications",
  BOOKED_CALLS: "#booked-calls",
  PRE_CALL: "#pre-call",
  CALL_REPORTS: "#call-reports",
  PAYMENTS: "#payments",
  EOD_REPORTS: "#eod-reports",
  SALES_FEEDBACK: "#sales-feedback",
  ONBOARDING: "#onboarding",
} as const;
export type SlackChannel = keyof typeof SLACK_CHANNELS;

export function hexToRgb(hex: string): string {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

export function themeCssVars(): Record<string, string> {
  return {
    "--accent": THEME.accent,
    "--accent-light": THEME.accentLight,
    "--accent-deep": THEME.accentDeep,
    "--accent-rgb": hexToRgb(THEME.accent),
    "--accent-light-rgb": hexToRgb(THEME.accentLight),
    "--accent-deep-rgb": hexToRgb(THEME.accentDeep),
  };
}
