import { all, get, now, run, uid } from "./db";
import { appUrl, queueEmail } from "./mail";

interface Recipient {
  email: string;
  role: string;
  email_notifications: number;
}

// In the app, and by email for people who want it.
export function notify(userId: string | null | undefined, itemId: string | null, message: string): void {
  if (!userId) return;
  const to = get<Recipient>("select email, role, email_notifications from users where id = ? and active = 1 and system = 0", userId);
  if (!to) return;
  run("insert into notifications (id, user_id, item_id, message, created_at) values (?, ?, ?, ?, ?)", uid(), userId, itemId, message, now());
  if (!to.email_notifications) return;
  const key = itemId ? get<{ key: string }>("select key from items where id = ?", itemId)?.key : undefined;
  const link = key ? `${appUrl()}${to.role === "employee" ? "/portal/requests" : "/items"}/${key}` : `${appUrl()}/`;
  queueEmail(
    to.email,
    message,
    `${message}\n\nOpen it: ${link}\n\nYou get these because email updates are on. Turn them off under "Your account" in the app.`,
  );
}

export function notifyTeam(teamId: string | null | undefined, itemId: string | null, message: string, except?: string | null): void {
  if (!teamId) return;
  for (const m of all<{ user_id: string }>("select user_id from team_members where team_id = ?", teamId)) {
    if (m.user_id !== except) notify(m.user_id, itemId, message);
  }
}
