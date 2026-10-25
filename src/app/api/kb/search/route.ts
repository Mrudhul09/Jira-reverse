import { NextResponse } from "next/server";
import { isAgent } from "@/lib/access";
import { currentUser } from "@/lib/auth";
import { searchArticles } from "@/lib/kb";

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const q = (new URL(req.url).searchParams.get("q") ?? "").slice(0, 200);
  const results = searchArticles(q, { everyone: !isAgent(user), limit: 4 }).map((a) => ({ id: a.id, title: a.title, excerpt: a.body.slice(0, 140) }));
  return NextResponse.json({ results });
}
