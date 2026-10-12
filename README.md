# Echelon Sales Tracker

A sales-floor tracker that replaces a client's Airtable base + Discord/Zapier setup:
applications, bookings, call outcomes, cash, setter activity, daily reports, and
Slack notifications. Built for Echelon (Danny).

**Run it locally:** double-click `Start Sales Tracker.command` → http://localhost:3002

## Screens
- **Dashboard**: Total Cash Collected (PIF / Split / Deposit, daily bars, payments, upcoming instalments, failed payments) · Sales Stats (revenue, cash, AOV, close rate incl. qualified-only, show/no-show, DQ, cancels, reschedules, follow-ups, PIFs, call rating, pies by source and closer, calls list) · DM / SDR stats from EODs. Click any call for the full view.
- **Applications**: every application, matched to bookings by email, with the setters' chase list.
- **EOD Reports**: DM, SDR, closer, feedback and client onboarding tables.
- **Forms**: Sales Call Report (two-step like Airtable), Pre-Call Handoff, the three EODs, weekly feedback. The client onboarding form is public at `/onboarding`.
- **Admin**: team, login codes and setter tracking codes, booked calls, payments, and Automations (Zapier, Slack, reminders setup).

## Logins (demo data)
Admin `ADMIN_CODE` · Closer Jojo `TRK-CLOSE1` · DM setter David `TRK-DMSET1` · Phone setter Noah `TRK-PHONE1`

## Data in (4 Zapier Zaps → webhooks, header `x-ingest-secret: $INGEST_SECRET`)
- `POST /api/ingest/application`: Typeform application
- `POST /api/ingest/call`: Calendly booking (`event: cancelled | rescheduled` to mark one)
- `POST /api/ingest/payment`: Stripe / Whop payment (`status: failed` for failures)
Field maps and examples: Admin → Automations.

## Data out (Slack)
The app posts every event itself: applications, bookings, handoffs, call reports, payments, EODs, feedback, onboarding.
One Slack incoming webhook per channel: `SLACK_WEBHOOK_APPLICATIONS`, `_BOOKED_CALLS`, `_PRE_CALL`, `_CALL_REPORTS`,
`_PAYMENTS`, `_EOD_REPORTS`, `_SALES_FEEDBACK`, `_ONBOARDING`. Unset = skipped.
Reminders: `POST /api/cron/eod-reminder` (daily 18:00 UTC) and `/api/cron/feedback-reminder` (Fri 17:00 UTC), header `x-cron-secret: $CRON_SECRET`.

## Configure per client
- Name, colours, programs, calendars, lead sources, payment methods, low-budget rule, currency, Slack channels: `src/lib/config.ts`
- Form questions: `src/lib/forms.ts`
- Every dashboard number: `src/lib/metrics.ts`
- Slack message formats: `src/lib/notify.ts`

## Data
`npm run db:seed` resets to demo data (fictional people, @example.com). `npm run db:clear` removes all demo data before going live.

## Environment
`DATABASE_URL`, `AUTH_SECRET` (16+ chars), `ADMIN_CODE`, `INGEST_SECRET`, `APP_URL` (public URL, for links in Slack), `CRON_SECRET`, `SLACK_WEBHOOK_*`.
On Render, SQLite needs a persistent disk, otherwise every deploy wipes the data.
