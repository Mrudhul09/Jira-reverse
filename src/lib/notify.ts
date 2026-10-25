import { all, get, now, parseJson, run, uid } from "./db";
import { appUrl, queueEmail } from "./mail";
import type { FieldDef } from "./types";

// What an email is about, so people can choose what reaches their inbox.
export const EMAIL_KINDS = {
  assigned: "Work given to me",
  my_requests: "Updates on what I asked for",
  approvals: "Approvals waiting for me",
  team: "New work for my teams",
  alerts: "Alerts, on-call and major incidents",
  sla: "Service-level warnings",
} as const;
export type EmailKind = keyof typeof EMAIL_KINDS;

interface Recipient {
  email: string;
  role: string;
  email_notifications: number;
  email_kinds: string;
}

interface About {
  key: string;
  summary: string;
  reporter_id: string;
  fields_json: string;
  type_fields: string | null;
}

// The requester's own answers, so the email makes sense on its own.
function answers(item: About): string {
  const defs = parseJson<FieldDef[]>(item.type_fields, []);
  const values = parseJson<Record<string, string>>(item.fields_json, {});
  const lines = defs.filter((f) => values[f.key]).map((f) => `${f.label}: ${values[f.key]}`);
  return [`Your request ${item.key}: ${item.summary}`, ...lines].join("\n");
}

// In the app always; by email when the person wants that kind of email.
export function notify(userId: string | null | undefined, itemId: string | null, message: string, kind?: EmailKind): void {
  if (!userId) return;
  const to = get<Recipient>("select email, role, email_notifications, email_kinds from users where id = ? and active = 1 and system = 0", userId);
  if (!to) return;
  run("insert into notifications (id, user_id, item_id, message, created_at) values (?, ?, ?, ?, ?)", uid(), userId, itemId, message, now());
  if (!to.email_notifications) return;
  if (kind && !parseJson<string[]>(to.email_kinds, []).includes(kind)) return;
  const item = itemId
    ? get<About>("select i.key, i.summary, i.reporter_id, i.fields_json, rt.fields_json as type_fields from items i left join request_types rt on rt.id = i.request_type_id where i.id = ?", itemId)
    : undefined;
  const link = item ? `${appUrl()}${to.role === "employee" ? "/portal/requests" : "/items"}/${item.key}` : `${appUrl()}/`;
  const context = item && item.reporter_id === userId ? `\n\n${answers(item)}` : "";
  queueEmail(
    to.email,
    message,
    `${message}${context}\n\nOpen it: ${link}\n\nChoose which emails you get under "Your account" in the app.`,
    itemId,
  );
}

export function notifyTeam(teamId: string | null | undefined, itemId: string | null, message: string, except?: string | null, kind: EmailKind = "team"): void {
  if (!teamId) return;
  for (const m of all<{ user_id: string }>("select user_id from team_members where team_id = ?", teamId)) {
    if (m.user_id !== except) notify(m.user_id, itemId, message, kind);
  }
}
