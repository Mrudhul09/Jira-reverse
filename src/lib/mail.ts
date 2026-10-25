import { all, now, run, uid } from "./db";

export const MAX_ATTEMPTS = 5;

export const mailConfigured = () => !!(process.env.RESEND_API_KEY && process.env.MAIL_FROM);

export const appUrl = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");

// Every email goes through the outbox first, so nothing is lost if sending fails.
// Until email is set up, messages are held and admins can see them in Settings.
export function queueEmail(to: string, subject: string, body: string, itemId: string | null = null): void {
  run(
    "insert into outbox (id, to_email, subject, body, status, item_id, created_at) values (?, ?, ?, ?, ?, ?, ?)",
    uid(),
    to,
    subject.slice(0, 200),
    body,
    mailConfigured() ? "queued" : "held",
    itemId,
    now(),
  );
}

interface Queued {
  id: string;
  to_email: string;
  subject: string;
  body: string;
  attempts: number;
}

// Sends queued mail through Resend's public API. Called by the worker every minute.
export async function sendQueued(limit = 25): Promise<{ sent: number; retried: number; failed: number }> {
  const result = { sent: 0, retried: 0, failed: 0 };
  if (!mailConfigured()) return result;
  const batch = all<Queued>("select id, to_email, subject, body, attempts from outbox where status = 'queued' order by created_at limit ?", limit);
  for (const m of batch) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "content-type": "application/json",
          // Same key on a retry, so a message is never delivered twice.
          "idempotency-key": m.id,
        },
        body: JSON.stringify({ from: process.env.MAIL_FROM, to: [m.to_email], subject: m.subject, text: m.body }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      run("update outbox set status = 'sent', attempts = attempts + 1, sent_at = ?, last_error = '' where id = ?", now(), m.id);
      result.sent++;
    } catch (err) {
      const attempts = m.attempts + 1;
      const dead = attempts >= MAX_ATTEMPTS;
      run("update outbox set status = ?, attempts = ?, last_error = ? where id = ?", dead ? "failed" : "queued", attempts, (err as Error).message.slice(0, 300), m.id);
      if (dead) result.failed++;
      else result.retried++;
    }
  }
  return result;
}

export function releaseHeld(): number {
  return run("update outbox set status = 'queued' where status = 'held'");
}
