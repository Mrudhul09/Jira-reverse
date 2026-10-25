import { redirect } from "next/navigation";

export function str(fd: FormData, name: string, max = 10_000): string {
  const v = fd.get(name);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export function num(fd: FormData, name: string): number | null {
  const v = str(fd, name, 32);
  if (!v) return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

export function id(fd: FormData, name: string): string | null {
  const v = str(fd, name, 64);
  return /^[0-9a-f-]{36}$/i.test(v) ? v : null;
}

export function ids(fd: FormData, name: string): string[] {
  return fd.getAll(name).filter((v): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v));
}

export function bool(fd: FormData, name: string): boolean {
  const v = fd.get(name);
  return v === "on" || v === "1" || v === "true";
}

// datetime-local value, read in the server's time zone.
export function dateTime(fd: FormData, name: string): number | null {
  const v = str(fd, name, 32);
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

export function oneOf<T extends string>(v: string, options: readonly T[], fallback: T): T {
  return (options as readonly string[]).includes(v) ? (v as T) : fallback;
}

// Only same-site paths, so a form can't send people off-site.
export function safePath(p: string, fallback: string): string {
  return p.startsWith("/") && !p.startsWith("//") && !p.startsWith("/\\") ? p : fallback;
}

export function back(path: string, msg?: { error?: string; ok?: string }): never {
  const url = new URL(path, "http://local");
  url.searchParams.delete("error");
  url.searchParams.delete("ok");
  if (msg?.error) url.searchParams.set("error", msg.error);
  if (msg?.ok) url.searchParams.set("ok", msg.ok);
  redirect(url.pathname + url.search);
}
