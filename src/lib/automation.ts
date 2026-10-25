import { getAlert, incidentFromAlert } from "./alerts";
import { all, get, now, parseJson, run, uid } from "./db";
import { addComment, getItem, moveItem, updateItem } from "./items";
import { notify } from "./notify";
import { onCallFor } from "./oncall";
import type { User } from "./types";
import type { Category } from "./workflows";

export type Trigger = "item_created" | "status_changed" | "comment_added" | "alert_created";

export const TRIGGERS: Record<Trigger, string> = {
  item_created: "Work item created",
  status_changed: "Status changed",
  comment_added: "Comment added",
  alert_created: "Alert received",
};

export interface Conditions {
  categories?: Category[];
  priorities?: number[];
  status?: string;
  textContains?: string;
  noTeam?: boolean;
}

export type Action =
  | { type: "assign_team"; teamId: string }
  | { type: "assign_user"; userId: string }
  | { type: "set_priority"; priority: number }
  | { type: "comment"; body: string; internal: boolean }
  | { type: "move"; status: string }
  | { type: "mark_major" }
  | { type: "notify_user"; userId: string }
  | { type: "page_oncall" }
  | { type: "open_incident" };

export const ACTION_TYPES = ["assign_team", "assign_user", "set_priority", "comment", "move", "mark_major", "notify_user", "page_oncall", "open_incident"] as const;

export interface Rule {
  id: string;
  name: string;
  trigger: Trigger;
  conditions_json: string;
  actions_json: string;
  enabled: number;
  runs: number;
  position: number;
}

const g = globalThis as unknown as { __itsmRulesRunning?: boolean };

export const robot = () => get<User>("select id, name, email, role, active from users where system = 1")!;

interface Subject {
  category?: Category;
  priority: number;
  status?: string;
  text: string;
  teamId: string | null;
}

function matches(c: Conditions, s: Subject): boolean {
  if (c.categories?.length && (!s.category || !c.categories.includes(s.category))) return false;
  if (c.priorities?.length && !c.priorities.includes(s.priority)) return false;
  if (c.status && c.status !== s.status) return false;
  if (c.textContains && !s.text.toLowerCase().includes(c.textContains.toLowerCase())) return false;
  if (c.noTeam && s.teamId) return false;
  return true;
}

// Rules run in order for one event and never trigger further rules, so they cannot loop.
export function runAutomation(trigger: Trigger, ctx: { itemId?: string; alertId?: string }): void {
  if (g.__itsmRulesRunning) return;
  const rules = all<Rule>("select * from automation_rules where enabled = 1 and trigger = ? order by position, created_at", trigger);
  if (!rules.length) return;
  g.__itsmRulesRunning = true;
  try {
    const bot = robot();
    for (const rule of rules) {
      const item = ctx.itemId ? getItem(ctx.itemId) : undefined;
      const alert = ctx.alertId ? getAlert(ctx.alertId) : undefined;
      const subject: Subject | null = item
        ? { category: item.category, priority: item.priority, status: item.status, text: `${item.summary}\n${item.description}`, teamId: item.team_id }
        : alert
          ? { priority: alert.priority, text: `${alert.message}\n${alert.description}`, teamId: alert.team_id }
          : null;
      if (!subject || !matches(parseJson<Conditions>(rule.conditions_json, {}), subject)) continue;
      const done: string[] = [];
      let ok = true;
      try {
        for (const action of parseJson<Action[]>(rule.actions_json, [])) done.push(perform(action, bot, ctx));
      } catch (err) {
        ok = false;
        done.push(`stopped: ${(err as Error).message}`);
      }
      run("update automation_rules set runs = runs + 1 where id = ?", rule.id);
      run(
        "insert into automation_log (id, rule_id, item_id, ok, result, created_at) values (?, ?, ?, ?, ?, ?)",
        uid(),
        rule.id,
        ctx.itemId ?? getAlert(ctx.alertId ?? "")?.incident_id ?? null,
        ok ? 1 : 0,
        done.join("; "),
        now(),
      );
    }
  } finally {
    g.__itsmRulesRunning = false;
  }
}

function perform(a: Action, bot: User, ctx: { itemId?: string; alertId?: string }): string {
  const itemId = () => {
    if (!ctx.itemId) throw new Error(`${a.type} needs a work item`);
    return ctx.itemId;
  };
  switch (a.type) {
    case "assign_team":
      updateItem(itemId(), bot.id, { team_id: a.teamId });
      return "set team";
    case "assign_user":
      updateItem(itemId(), bot.id, { assignee_id: a.userId });
      return "set assignee";
    case "set_priority":
      updateItem(itemId(), bot.id, { priority: a.priority });
      return `priority P${a.priority}`;
    case "comment": {
      const r = addComment(itemId(), bot, a.body, { internal: a.internal });
      if (!r.ok) throw new Error(r.error);
      return a.internal ? "internal note" : "reply";
    }
    case "move": {
      const r = moveItem(itemId(), a.status, bot.id, { system: true });
      if (!r.ok) throw new Error(r.error);
      return `moved to ${a.status}`;
    }
    case "mark_major":
      updateItem(itemId(), bot.id, { is_major: 1 });
      return "marked major";
    case "notify_user":
      notify(a.userId, ctx.itemId ?? null, ctx.itemId ? `Automation: ${getItem(ctx.itemId)?.key} needs your attention` : "Automation: a new alert needs your attention");
      return "notified";
    case "page_oncall": {
      const teamId = ctx.itemId ? getItem(ctx.itemId)?.team_id : ctx.alertId ? getAlert(ctx.alertId)?.team_id : null;
      const people = onCallFor(teamId);
      const key = ctx.itemId ? getItem(ctx.itemId)?.key : null;
      for (const u of people) notify(u, ctx.itemId ?? null, key ? `On call: ${key} needs you now` : "On call: new alert", "alerts");
      return `paged ${people.length}`;
    }
    case "open_incident": {
      if (!ctx.alertId) throw new Error("open_incident needs an alert");
      const id = incidentFromAlert(ctx.alertId, bot.id);
      return `opened ${getItem(id)?.key}`;
    }
  }
}
