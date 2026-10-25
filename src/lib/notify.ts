import { all, now, run, uid } from "./db";

export function notify(userId: string | null | undefined, itemId: string | null, message: string): void {
  if (!userId) return;
  run("insert into notifications (id, user_id, item_id, message, created_at) values (?, ?, ?, ?, ?)", uid(), userId, itemId, message, now());
}

export function notifyTeam(teamId: string | null | undefined, itemId: string | null, message: string, except?: string | null): void {
  if (!teamId) return;
  for (const m of all<{ user_id: string }>("select user_id from team_members where team_id = ?", teamId)) {
    if (m.user_id !== except) notify(m.user_id, itemId, message);
  }
}
