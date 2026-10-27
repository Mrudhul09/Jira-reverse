import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { canViewItem } from "@/lib/access";
import { get, now, run, tx } from "@/lib/db";
import { addComment, createItem, getItemByKey, logHistory } from "@/lib/items";
import { mailIntakeBlocked } from "@/lib/limits";
import type { RequestType, User } from "@/lib/types";

function tokenMatches(given: string | null): boolean {
  const expected = process.env.INBOUND_TOKEN;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// "Theo Park <theo@example.org>" -> "theo@example.org"
const address = (from: string) => (from.match(/<([^>]+)>/)?.[1] ?? from).trim().toLowerCase();

// Drop the quoted earlier message under a reply.
function newPart(body: string): string {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const cut = lines.findIndex((l) => /^On .+wrote:\s*$/.test(l) || /^-{2,}\s*Original Message/i.test(l) || /^From: /.test(l));
  return (cut >= 0 ? lines.slice(0, cut) : lines).filter((l) => !l.startsWith(">")).join("\n").trim();
}

// Mail intake: the mail provider's inbound webhook (or a small forwarder) posts each message here.
// JSON: {from, subject, text, messageId?}; Postmark-style From/Subject/TextBody/MessageID also work.
// A subject with a work key ([SH-12]) adds a reply to it; anything else raises a new request.
export async function POST(req: Request) {
  if (!process.env.INBOUND_TOKEN) return NextResponse.json({ error: "Email intake is switched off. Set INBOUND_TOKEN to turn it on." }, { status: 503 });
  if (!tokenMatches(req.headers.get("x-inbound-token"))) return NextResponse.json({ error: "Missing or wrong x-inbound-token header." }, { status: 401 });
  if (mailIntakeBlocked()) return NextResponse.json({ error: "Too many emails this minute." }, { status: 429, headers: { "retry-after": "60" } });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Send JSON." }, { status: 400 });
  }
  const from = address(text(body.from ?? body.From, 320));
  const subject = text(body.subject ?? body.Subject, 300);
  const message = newPart(text(body.text ?? body.TextBody, 20_000));
  const messageId = text(body.messageId ?? body.MessageID, 300) || null;
  if (!from) return NextResponse.json({ error: "from is required." }, { status: 400 });

  // Only people who already have an account; everyone else is ignored, quietly.
  const user = get<User>("select id, name, email, role, active from users where lower(email) = ? and active = 1 and system = 0", from);
  if (!user) return NextResponse.json({ ignored: "Nobody here has that email address." }, { status: 202 });
  if (messageId && get("select 1 from inbound_mail where message_id = ?", messageId)) return NextResponse.json({ ignored: "Already received." }, { status: 200 });

  const key = subject.match(/\b([A-Z][A-Z0-9]*-\d+)\b/)?.[1];
  const item = key ? getItemByKey(key) : undefined;
  if (item && canViewItem(user, item)) {
    if (!message) return NextResponse.json({ ignored: "The reply was empty." }, { status: 202 });
    const r = addComment(item.id, user, message);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    if (messageId) run("insert into inbound_mail (message_id, item_id, created_at) values (?, ?, ?)", messageId, item.id, now());
    return NextResponse.json({ key: item.key, added: "reply" }, { status: 200 });
  }

  const type = get<RequestType>(
    "select * from request_types where category = 'service_request' and portal_visible = 1 and restricted_team_id is null and approver_id is null order by position limit 1",
  );
  const created = tx(() => {
    const it = createItem({
      category: "service_request",
      requestType: type ?? null,
      summary: (subject.replace(/^(re|fwd?):\s*/i, "") || "Email with no subject").slice(0, 200),
      description: message,
      reporterId: user.id,
      actorId: user.id,
    });
    logHistory(it.id, user.id, "channel", null, "email");
    if (messageId) run("insert into inbound_mail (message_id, item_id, created_at) values (?, ?, ?)", messageId, it.id, now());
    return it;
  });
  return NextResponse.json({ key: created.key, added: "request" }, { status: 201 });
}
