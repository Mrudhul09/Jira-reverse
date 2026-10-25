import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isAdmin, isAgent } from "./access";
import { get, now, run } from "./db";
import { hashPassword, verifyPassword } from "./password";
import type { User } from "./types";

const COOKIE = "itsm_session";
const TTL_MS = 7 * 24 * 3_600_000;
const RESET_TTL_MS = 30 * 60_000;

// Only hashes of tokens are stored, so a copied database can't be used to sign in or reset.
const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
// Compared against when an email is unknown, so a wrong email takes as long as a wrong password.
const DUMMY = hashPassword(randomBytes(16).toString("hex"));

export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  return (
    get<User>(
      `select u.id, u.name, u.email, u.role, u.active from sessions s join users u on u.id = s.user_id
        where s.token_hash = ? and s.expires_at > ? and u.active = 1`,
      hashToken(token),
      now(),
    ) ?? null
  );
}

export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireAgent(): Promise<User> {
  const u = await requireUser();
  if (!isAgent(u)) redirect("/portal");
  return u;
}

export async function requireAdmin(): Promise<User> {
  const u = await requireAgent();
  if (!isAdmin(u)) redirect("/queues");
  return u;
}

export async function startSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  run("insert into sessions (token_hash, user_id, expires_at, created_at) values (?, ?, ?, ?)", hashToken(token), userId, now() + TTL_MS, now());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.ALLOW_HTTP !== "1",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

export function checkPassword(email: string, password: string): (User & { password_hash: string }) | null {
  const row = get<User & { password_hash: string }>(
    "select id, name, email, role, active, password_hash from users where email = ? and active = 1 and system = 0",
    email.trim(),
  );
  const ok = verifyPassword(password, row?.password_hash ?? DUMMY);
  return row && ok ? row : null;
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) run("delete from sessions where token_hash = ?", hashToken(token));
  jar.delete(COOKIE);
}

export function endAllSessions(userId: string): void {
  run("delete from sessions where user_id = ?", userId);
}

// Returns the raw token for the email link; only its hash is kept.
export function createReset(userId: string, ip: string): string {
  const token = randomBytes(32).toString("base64url");
  run("insert into password_resets (token_hash, user_id, expires_at, requested_ip, created_at) values (?, ?, ?, ?, ?)", hashToken(token), userId, now() + RESET_TTL_MS, ip, now());
  return token;
}

export function resetUser(token: string): { userId: string } | null {
  const row = get<{ user_id: string }>(
    "select r.user_id from password_resets r join users u on u.id = r.user_id where r.token_hash = ? and r.used_at is null and r.expires_at > ? and u.active = 1",
    hashToken(token),
    now(),
  );
  return row ? { userId: row.user_id } : null;
}

export function consumeReset(token: string, password: string): boolean {
  const r = resetUser(token);
  if (!r) return false;
  run("update password_resets set used_at = ? where token_hash = ?", now(), hashToken(token));
  // One reset link at a time: any others for this person stop working too.
  run("update password_resets set used_at = ? where user_id = ? and used_at is null", now(), r.userId);
  run("update users set password_hash = ?, updated_at = ? where id = ?", hashPassword(password), now(), r.userId);
  endAllSessions(r.userId);
  return true;
}

export const MIN_PASSWORD = 12;
