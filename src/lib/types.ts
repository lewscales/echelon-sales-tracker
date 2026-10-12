import type { Role, SlackChannel } from "./config";

export type Me = { id: string; name: string; role: Role };

export type MemberRow = {
  id: string;
  name: string;
  email: string | null;
  role: Role;
  active: boolean;
  /** Only sent to admins. */
  code?: string;
  utmCode: string | null;
};

export type CallRow = {
  id: string;
  leadName: string;
  leadEmail: string | null;
  leadPhone: string | null;
  instagram: string | null;
  leadTimezone: string | null;
  calendarName: string | null;
  program: string | null;
  dateBooked: string;
  dateOfCall: string;
  utmSource: string | null;
  utmCampaign: string | null;
  utmMedium: string | null;
  utmContent: string | null;
  bookingAnswers: Record<string, string>;
  setterId: string | null;
  closerId: string | null;
  handoff: Record<string, string> | null;
  handoffById: string | null;
  handoffAt: string | null;
  outcome: string | null;
  callType: string | null;
  qualified: string | null;
  callRating: number | null;
  recordingUrl: string | null;
  revenue: number;
  cashOnCall: number;
  paymentType: string | null;
  paymentMethod: string | null;
  pif: boolean;
  nextPaymentAmount: number | null;
  nextPaymentDate: string | null;
  paymentPlanDetails: string | null;
  notes: string | null;
  reportedAt: string | null;
};

export type PaymentRow = {
  id: string;
  customerName: string;
  customerEmail: string | null;
  date: string;
  amount: number;
  paymentType: string;
  status: "succeeded" | "failed";
  failureReason: string | null;
  product: string | null;
  paymentMethod: string | null;
  program: string | null;
  notes: string | null;
  setterId: string | null;
  closerId: string | null;
};

export type ApplicationRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  instagram: string | null;
  utmSource: string | null;
  answers: Record<string, string>;
  lowBudget: boolean;
  appliedAt: string;
  chaseStatus: "open" | "contacted" | "not_interested";
  chaseNotes: string | null;
  chasedAt: string | null;
  chasedById: string | null;
  /** Worked out on the server (by email), so it's right even for viewers who can't see call emails. */
  booked: boolean;
  bookedCallId: string | null;
};

export type ReportRow = {
  id: string;
  kind: string;
  /** null for forms filled in by someone outside the team (client onboarding). */
  memberId: string | null;
  day: string;
  data: Record<string, string | number>;
  createdAt: string;
};

export type DataBundle = {
  me: Me;
  members: MemberRow[];
  calls: CallRow[];
  payments: PaymentRow[];
  applications: ApplicationRow[];
  reports: ReportRow[];
  /** Admins only: which Slack channels have a webhook configured. */
  slack?: Record<SlackChannel, boolean>;
  /** Admins only: whether scheduled reminders can run (CRON_SECRET set). */
  cronReady?: boolean;
  appUrl: string;
};
