import { headers } from "next/headers";
import { get, now, run, uid } from "./db";

const MIN = 60_000;

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim().slice(0, 64);
}

// Sign-in: 10 failures per email and 30 per address in 15 minutes.
export function signInBlocked(email: string, ip: string, at = now()): boolean {
  const since = at - 15 * MIN;
  const byEmail = get<{ n: number }>("select count(*) as n from login_attempts where email = ? and ok = 0 and created_at > ?", email, since)!.n;
  const byIp = get<{ n: number }>("select count(*) as n from login_attempts where ip = ? and ok = 0 and created_at > ?", ip, since)!.n;
  return byEmail >= 10 || byIp >= 30;
}

export function recordSignIn(email: string, ip: string, ok: boolean): void {
  run("insert into login_attempts (id, email, ip, ok, created_at) values (?, ?, ?, ?, ?)", uid(), email.slice(0, 200), ip, ok ? 1 : 0, now());
}

// Password reset emails: 5 per address and 3 per account an hour.
export function resetBlocked(ip: string, userId: string | null, at = now()): boolean {
  const since = at - 60 * MIN;
  const byIp = get<{ n: number }>("select count(*) as n from password_resets where requested_ip = ? and created_at > ?", ip, since)!.n;
  const byUser = userId ? get<{ n: number }>("select count(*) as n from password_resets where user_id = ? and created_at > ?", userId, since)!.n : 0;
  return byIp >= 5 || byUser >= 3;
}

// In-memory window for the alert API: monitoring storms shouldn't flood the database.
const g = globalThis as unknown as { __itsmAlertHits?: number[] };
export function alertIntakeBlocked(limitPerMinute = 60): boolean {
  const t = now();
  const hits = (g.__itsmAlertHits ?? []).filter((h) => h > t - MIN);
  hits.push(t);
  g.__itsmAlertHits = hits;
  return hits.length > limitPerMinute;
}
