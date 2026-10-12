// Posting to Slack via incoming webhooks: one webhook URL per channel, set in
// the environment as SLACK_WEBHOOK_<CHANNEL> (see SLACK_CHANNELS in config).
// A post never breaks the action that caused it: failures are logged, and a
// channel without a URL is simply skipped.

import { SLACK_CHANNELS, type SlackChannel } from "./config";

export type Line = [label: string, value: string | number | null | undefined] | { heading: string };

export function slackConfigured(): Record<SlackChannel, boolean> {
  const out = {} as Record<SlackChannel, boolean>;
  for (const k of Object.keys(SLACK_CHANNELS) as SlackChannel[]) out[k] = !!webhookFor(k);
  return out;
}

function webhookFor(channel: SlackChannel): string | null {
  const u = (process.env[`SLACK_WEBHOOK_${channel}`] ?? "").trim();
  return u.startsWith("https://hooks.slack.com/") ? u : null;
}

// Slack mrkdwn treats &, < and > as control characters.
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Render a title + labelled lines in the same shape the team is used to. */
export function format(title: string, lines: Line[]): string {
  const out = [`*${esc(title)}*`];
  for (const l of lines) {
    if (!Array.isArray(l)) {
      out.push(`\n*${esc(l.heading)} ↓*`);
      continue;
    }
    const [label, value] = l;
    const v = value === null || value === undefined || value === "" ? "–" : String(value);
    out.push(`*${esc(label)}:* ${esc(v)}`);
  }
  return out.join("\n");
}

export async function postSlack(channel: SlackChannel, title: string, lines: Line[] = []): Promise<boolean> {
  const hook = webhookFor(channel);
  if (!hook) return false;
  try {
    const res = await fetch(hook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: format(title, lines) }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error(`[slack] ${channel} responded ${res.status}`);
    return res.ok;
  } catch (e) {
    console.error(`[slack] ${channel} failed:`, e instanceof Error ? e.message : e);
    return false;
  }
}

/** Public base URL for links in messages (forms, the dashboard). */
export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3002").replace(/\/+$/, "");
}
