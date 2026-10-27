import { all, marks, now, run, uid } from "./db";
import { ITEM_SELECT } from "./items";
import { sendQueued } from "./mail";
import { notify, notifyTeam } from "./notify";
import { slaStatesFor } from "./sla";
import type { ItemRow } from "./types";
import { doneStatuses } from "./workflows";

const g = globalThis as unknown as { __itsmWorker?: ReturnType<typeof setInterval>; __itsmJobsBusy?: boolean };

async function record(job: string, fn: () => Promise<string> | string): Promise<void> {
  const started = now();
  try {
    const detail = await fn();
    run("insert into job_runs (id, job, ok, detail, started_at, finished_at) values (?, ?, 1, ?, ?, ?)", uid(), job, detail, started, now());
  } catch (err) {
    run("insert into job_runs (id, job, ok, detail, started_at, finished_at) values (?, ?, 0, ?, ?, ?)", uid(), job, (err as Error).message.slice(0, 500), started, now());
  }
}

// Tells the assignee (or the team) once when an SLA is nearly due, and once when it's missed.
export function slaWatch(at = now()): string {
  const open = all<ItemRow>(`${ITEM_SELECT} where i.status not in (${marks(doneStatuses().length)})`, ...doneStatuses());
  let sent = 0;
  for (const [itemId, states] of slaStatesFor(open, at)) {
    const item = open.find((i) => i.id === itemId)!;
    for (const s of states) {
      const kind = s.state === "breached" ? "breached" : s.warning ? "warning" : null;
      if (!kind) continue;
      const fresh = run("insert or ignore into sla_notices (item_id, sla_id, kind, created_at) values (?, ?, ?, ?)", item.id, s.slaId, kind, at);
      if (!fresh) continue;
      const msg = kind === "breached" ? `${item.key} missed "${s.name}"` : `${item.key} is close to missing "${s.name}"`;
      if (item.assignee_id) notify(item.assignee_id, item.id, msg, "sla");
      else notifyTeam(item.team_id, item.id, msg, null, "sla");
      sent++;
    }
  }
  return `${sent} SLA notice(s)`;
}

// An alert nobody acknowledged in time goes to the schedule's escalation person, once.
export function escalate(at = now()): string {
  const due = all<{ id: string; number: number; message: string; escalate_to_id: string }>(
    `select a.id, a.number, a.message, s.escalate_to_id from alerts a join oncall_schedules s on s.team_id = a.team_id
      where a.status = 'open' and a.escalated_at is null and s.escalate_to_id is not null
        and a.created_at + s.escalate_after_minutes * 60000 <= ?
      group by a.id`,
    at,
  );
  for (const a of due) {
    if (!run("update alerts set escalated_at = ? where id = ? and escalated_at is null", at, a.id)) continue;
    notify(a.escalate_to_id, null, `Escalated: alert #${a.number} "${a.message}" hasn't been acknowledged`, "alerts");
  }
  return `${due.length} escalation(s)`;
}

export function cleanup(at = now()): string {
  const day = 86_400_000;
  const removed =
    run("delete from sessions where expires_at < ?", at) +
    run("delete from login_attempts where created_at < ?", at - 30 * day) +
    run("delete from password_resets where expires_at < ?", at - day) +
    run("delete from job_runs where started_at < ?", at - 7 * day) +
    run("delete from notifications where read = 1 and created_at < ?", at - 180 * day) +
    run("delete from outbox where status = 'sent' and created_at < ?", at - 90 * day);
  return `${removed} old row(s) removed`;
}

export async function runJobs(): Promise<void> {
  if (g.__itsmJobsBusy) return;
  g.__itsmJobsBusy = true;
  try {
    await record("sla-watch", () => slaWatch());
    await record("escalate", () => escalate());
    await record("mail", async () => {
      const r = await sendQueued();
      return `${r.sent} sent, ${r.retried} to retry, ${r.failed} gave up`;
    });
    await record("cleanup", () => cleanup());
  } finally {
    g.__itsmJobsBusy = false;
  }
}

export function startWorker(): void {
  if (g.__itsmWorker) return;
  g.__itsmWorker = setInterval(() => void runJobs(), 60_000);
  setTimeout(() => void runJobs(), 5_000);
}

