"use server";

import { redirect } from "next/navigation";
import { isAgent } from "@/lib/access";
import { MIN_PASSWORD, checkPassword, createReset, endAllSessions, endSession, requireUser, startSession, consumeReset } from "@/lib/auth";
import { get, now, run } from "@/lib/db";
import { back, bool, str } from "@/lib/form";
import { clientIp, recordSignIn, resetBlocked, signInBlocked } from "@/lib/limits";
import { appUrl, queueEmail } from "@/lib/mail";
import { EMAIL_KINDS, type EmailKind } from "@/lib/notify";
import { hashPassword, verifyPassword } from "@/lib/password";

export async function signInAction(_prev: { error?: string } | undefined, fd: FormData): Promise<{ error?: string }> {
  const email = str(fd, "email", 200).toLowerCase();
  const password = str(fd, "password", 200);
  if (!email || !password) return { error: "Enter your email and password." };
  const ip = await clientIp();
  if (signInBlocked(email, ip)) return { error: "Too many tries. Wait 15 minutes, or reset your password." };
  const user = checkPassword(email, password);
  recordSignIn(email, ip, !!user);
  if (!user) return { error: "That email and password don't match an active account." };
  await startSession(user.id);
  redirect(isAgent(user) ? "/queues" : "/portal");
}

export async function signOutAction(): Promise<void> {
  await endSession();
  redirect("/login");
}

export async function signOutEverywhereAction(): Promise<void> {
  const user = await requireUser();
  endAllSessions(user.id);
  await endSession();
  redirect("/login?ok=Signed+out+on+every+device.");
}

export async function markReadAction(): Promise<void> {
  const user = await requireUser();
  run("update notifications set read = 1 where user_id = ?", user.id);
}

// Same answer whether or not the email exists, so it can't be used to find accounts.
export async function forgotAction(fd: FormData): Promise<void> {
  const email = str(fd, "email", 200).toLowerCase();
  const done = "If that email belongs to an account, a reset link is on its way. It works for 30 minutes.";
  if (!email) back("/login/forgot", { error: "Enter your work email." });
  const ip = await clientIp();
  const user = get<{ id: string; name: string; email: string }>("select id, name, email from users where email = ? and active = 1 and system = 0", email);
  if (resetBlocked(ip, user?.id ?? null)) back("/login/forgot", { ok: done });
  if (user) {
    const token = createReset(user.id, ip);
    queueEmail(
      user.email,
      "Reset your IT Help password",
      `Hi ${user.name.split(" ")[0]},\n\nSomeone (hopefully you) asked to reset your password. Choose a new one here within 30 minutes:\n\n${appUrl()}/login/reset?token=${token}\n\nDidn't ask? Ignore this email; your password stays the same.`,
    );
  }
  back("/login/forgot", { ok: done });
}

export async function resetAction(fd: FormData): Promise<void> {
  const token = str(fd, "token", 200);
  const password = str(fd, "password", 200);
  const page = `/login/reset?token=${encodeURIComponent(token)}`;
  if (password.length < MIN_PASSWORD) back(page, { error: `Use at least ${MIN_PASSWORD} characters.` });
  if (password !== str(fd, "confirm", 200)) back(page, { error: "The two passwords don't match." });
  if (!consumeReset(token, password)) back("/login/forgot", { error: "That link has expired or was already used. Ask for a new one." });
  redirect("/login?ok=Password+changed.+Sign+in+with+your+new+one.");
}

export async function changePasswordAction(fd: FormData): Promise<void> {
  const user = await requireUser();
  const row = get<{ password_hash: string }>("select password_hash from users where id = ?", user.id)!;
  const next = str(fd, "password", 200);
  if (!verifyPassword(str(fd, "current", 200), row.password_hash)) back("/portal/account", { error: "Your current password isn't right." });
  if (next.length < MIN_PASSWORD) back("/portal/account", { error: `Use at least ${MIN_PASSWORD} characters.` });
  if (next !== str(fd, "confirm", 200)) back("/portal/account", { error: "The two new passwords don't match." });
  run("update users set password_hash = ?, updated_at = ? where id = ?", hashPassword(next), now(), user.id);
  endAllSessions(user.id);
  await startSession(user.id);
  back("/portal/account", { ok: "Password changed. Other devices have been signed out." });
}

export async function emailPrefsAction(fd: FormData): Promise<void> {
  const user = await requireUser();
  const kinds = fd.getAll("kinds").filter((k): k is EmailKind => typeof k === "string" && k in EMAIL_KINDS);
  run("update users set email_notifications = ?, email_kinds = ?, updated_at = ? where id = ?", bool(fd, "email") ? 1 : 0, JSON.stringify(kinds), now(), user.id);
  back("/portal/account", { ok: "Saved." });
}
