"use server";

import { redirect } from "next/navigation";
import { isAgent } from "@/lib/access";
import { checkPassword, endSession, requireUser, startSession } from "@/lib/auth";
import { run } from "@/lib/db";
import { str } from "@/lib/form";

export async function signInAction(_prev: { error?: string } | undefined, fd: FormData): Promise<{ error?: string }> {
  const email = str(fd, "email", 200);
  const password = str(fd, "password", 200);
  if (!email || !password) return { error: "Enter your email and password." };
  const user = checkPassword(email, password);
  if (!user) return { error: "That email and password don't match an active account." };
  await startSession(user.id);
  redirect(isAgent(user) ? "/queues" : "/portal");
}

export async function signOutAction(): Promise<void> {
  await endSession();
  redirect("/login");
}

export async function markReadAction(): Promise<void> {
  const user = await requireUser();
  run("update notifications set read = 1 where user_id = ?", user.id);
}
