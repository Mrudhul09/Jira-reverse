import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isAdmin, isAgent } from "./access";
import { get, now, run } from "./db";
import { verifyPassword } from "./password";
import type { User } from "./types";

const COOKIE = "itsm_session";
const TTL_MS = 7 * 24 * 3_600_000;

// Only a hash of the token is stored, so a copied database can't be used to sign in.
const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

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
  run("delete from sessions where expires_at < ?", now());
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
  return row && verifyPassword(password, row.password_hash) ? row : null;
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) run("delete from sessions where token_hash = ?", hashToken(token));
  jar.delete(COOKIE);
}
