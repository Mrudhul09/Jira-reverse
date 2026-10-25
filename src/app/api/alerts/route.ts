import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { raiseAlert } from "@/lib/alerts";
import { get } from "@/lib/db";

function tokenMatches(given: string | null): boolean {
  const expected = process.env.ALERT_TOKEN;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Monitoring intake. JSON: {message, description?, priority? 1-5, alias?, source?, team? (team name)}
export async function POST(req: Request) {
  if (!process.env.ALERT_TOKEN) return NextResponse.json({ error: "Alert intake is switched off. Set ALERT_TOKEN to turn it on." }, { status: 503 });
  if (!tokenMatches(req.headers.get("x-alert-token"))) return NextResponse.json({ error: "Missing or wrong x-alert-token header." }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Send JSON." }, { status: 400 });
  }
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const message = text(body.message, 300);
  if (!message) return NextResponse.json({ error: "message is required." }, { status: 400 });
  const teamName = text(body.team, 120);
  const team = teamName ? get<{ id: string }>("select id from teams where name = ?", teamName) : undefined;
  if (teamName && !team) return NextResponse.json({ error: `There's no team called ${teamName}.` }, { status: 400 });
  const p = Number(body.priority);
  const { alert, repeat } = raiseAlert({
    message,
    description: text(body.description, 4000),
    source: text(body.source, 60) || "api",
    priority: Number.isInteger(p) && p >= 1 && p <= 5 ? p : 3,
    alias: text(body.alias, 200) || null,
    teamId: team?.id ?? null,
  });
  return NextResponse.json({ number: alert.number, status: alert.status, count: alert.count, repeat }, { status: repeat ? 200 : 201 });
}
