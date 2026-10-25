import { NextResponse } from "next/server";
import { get } from "@/lib/db";

// For uptime monitoring: proves the app answers and the database opens.
export async function GET() {
  try {
    get("select 1 as ok");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
