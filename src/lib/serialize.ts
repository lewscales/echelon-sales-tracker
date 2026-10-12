import type { Application, BookedCall, Member, Payment, Report } from "@prisma/client";
import type { ApplicationRow, CallRow, MemberRow, PaymentRow, ReportRow } from "./types";
import type { Role } from "./config";
import { parseJson } from "./validate";

// Who sees what:
//  • Admins see everything, including login codes.
//  • Closers see lead contact details (they run the calls).
//  • Setters see applicants' contact details (they chase unbooked
//    applications), but not the email/phone on calls and payments.
export const seesContacts = (role: string) => role === "admin" || role === "closer";

export function memberRow(m: Member, viewer: Member): MemberRow {
  return {
    id: m.id,
    name: m.name,
    email: viewer.role === "admin" ? m.email : null,
    role: m.role as Role,
    active: m.active,
    utmCode: m.utmCode,
    ...(viewer.role === "admin" ? { code: m.code } : {}),
  };
}

export function callRow(c: BookedCall, viewer: Member): CallRow {
  const contacts = seesContacts(viewer.role);
  return {
    id: c.id,
    leadName: c.leadName,
    leadEmail: contacts ? c.leadEmail : null,
    leadPhone: contacts ? c.leadPhone : null,
    instagram: c.instagram,
    leadTimezone: c.leadTimezone,
    calendarName: c.calendarName,
    program: c.program,
    dateBooked: c.dateBooked.toISOString(),
    dateOfCall: c.dateOfCall.toISOString(),
    utmSource: c.utmSource,
    utmCampaign: c.utmCampaign,
    utmMedium: c.utmMedium,
    utmContent: c.utmContent,
    bookingAnswers: parseJson(c.bookingAnswers, {}),
    setterId: c.setterId,
    closerId: c.closerId,
    handoff: c.handoff ? parseJson(c.handoff, {}) : null,
    handoffById: c.handoffById,
    handoffAt: c.handoffAt?.toISOString() ?? null,
    outcome: c.outcome,
    callType: c.callType,
    qualified: c.qualified,
    callRating: c.callRating,
    recordingUrl: contacts ? c.recordingUrl : null,
    revenue: c.revenue,
    cashOnCall: c.cashOnCall,
    paymentType: c.paymentType,
    paymentMethod: c.paymentMethod,
    pif: c.pif,
    nextPaymentAmount: c.nextPaymentAmount,
    nextPaymentDate: c.nextPaymentDate,
    paymentPlanDetails: contacts ? c.paymentPlanDetails : null,
    notes: contacts ? c.notes : null,
    reportedAt: c.reportedAt?.toISOString() ?? null,
  };
}

export function paymentRow(p: Payment, viewer: Member): PaymentRow {
  return {
    id: p.id,
    customerName: p.customerName,
    customerEmail: seesContacts(viewer.role) ? p.customerEmail : null,
    date: p.date.toISOString(),
    amount: p.amount,
    paymentType: p.paymentType,
    status: p.status === "failed" ? "failed" : "succeeded",
    failureReason: p.failureReason,
    product: p.product,
    paymentMethod: p.paymentMethod,
    program: p.program,
    notes: viewer.role === "admin" ? p.notes : null,
    setterId: p.setterId,
    closerId: p.closerId,
  };
}

/**
 * Setters need an applicant's contact details to chase them, but only while
 * they're on the chase list. Once booked, the lead belongs to the closer.
 */
export function applicationRow(a: Application, viewer: Member, bookedCallId: string | null = null): ApplicationRow {
  const contacts = seesContacts(viewer.role) || !bookedCallId;
  return {
    id: a.id,
    name: a.name,
    email: contacts ? a.email : null,
    phone: contacts ? a.phone : null,
    instagram: contacts ? a.instagram : null,
    utmSource: a.utmSource,
    answers: parseJson(a.answers, {}),
    lowBudget: a.lowBudget,
    appliedAt: a.appliedAt.toISOString(),
    chaseStatus: (["open", "contacted", "not_interested"].includes(a.chaseStatus) ? a.chaseStatus : "open") as ApplicationRow["chaseStatus"],
    chaseNotes: a.chaseNotes,
    chasedAt: a.chasedAt?.toISOString() ?? null,
    chasedById: a.chasedById,
    booked: !!bookedCallId,
    bookedCallId,
  };
}

export function reportRow(r: Report): ReportRow {
  return { id: r.id, kind: r.kind, memberId: r.memberId, day: r.day, data: parseJson(r.data, {}), createdAt: r.createdAt.toISOString() };
}
