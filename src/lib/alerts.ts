import { runAutomation } from "./automation";
import { get, nextNumber, now, run, tx, uid } from "./db";
import { createItem, getItem, logHistory } from "./items";
import { notify } from "./notify";
import { onCallFor } from "./oncall";

export interface Alert {
  id: string;
  number: number;
  alias: string | null;
  source: string;
  message: string;
  description: string;
  priority: number;
  status: "open" | "acked" | "closed";
  team_id: string | null;
  acked_by: string | null;
  incident_id: string | null;
  count: number;
  escalated_at: number | null;
  metric: string | null;
  metric_value: number | null;
  resource: string | null;
  asset_id: string | null;
  created_at: number;
  updated_at: number;
}

export const getAlert = (id: string) => get<Alert>("select * from alerts where id = ?", id);

export interface NewAlert {
  message: string;
  description?: string;
  source?: string;
  priority?: number;
  alias?: string | null;
  teamId?: string | null;
  metric?: string | null;
  metricValue?: number | null;
  resource?: string | null;
  assetId?: string | null;
}

// An open alert with the same alias is the same trouble: count it, don't page again.
export function raiseAlert(a: NewAlert): { alert: Alert; repeat: boolean } {
  const t = now();
  if (a.alias) {
    const open = get<Alert>("select * from alerts where alias = ? and status != 'closed'", a.alias);
    if (open) {
      run("update alerts set count = count + 1, updated_at = ? where id = ?", t, open.id);
      return { alert: getAlert(open.id)!, repeat: true };
    }
  }
  const id = uid();
  tx(() =>
    run(
      "insert into alerts (id, number, alias, source, message, description, priority, team_id, metric, metric_value, resource, asset_id, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      id,
      nextNumber("alert"),
      a.alias ?? null,
      a.source ?? "manual",
      a.message,
      a.description ?? "",
      a.priority ?? 3,
      a.teamId ?? null,
      a.metric ?? null,
      a.metricValue ?? null,
      a.resource ?? null,
      a.assetId ?? null,
      t,
      t,
    ),
  );
  for (const u of onCallFor(a.teamId)) notify(u, null, `Alert P${a.priority ?? 3}: ${a.message}`, "alerts");
  runAutomation("alert_created", { alertId: id });
  return { alert: getAlert(id)!, repeat: false };
}

export function setAlertStatus(id: string, status: "acked" | "closed", userId: string): void {
  run("update alerts set status = ?, acked_by = coalesce(acked_by, ?), updated_at = ? where id = ?", status, userId, now(), id);
}

export function incidentFromAlert(alertId: string, actorId: string): string {
  const alert = getAlert(alertId);
  if (!alert) throw new Error("Alert not found");
  if (alert.incident_id && getItem(alert.incident_id)) return alert.incident_id;
  const item = createItem({
    category: "incident",
    summary: alert.message,
    description: [alert.description, `Opened from alert #${alert.number} (${alert.source}).`].filter(Boolean).join("\n\n"),
    reporterId: actorId,
    actorId,
    priority: alert.priority,
    teamId: alert.team_id,
  });
  run("update alerts set incident_id = ?, updated_at = ? where id = ?", item.id, now(), alertId);
  logHistory(item.id, actorId, "alert", null, `linked alert #${alert.number}`);
  if (alert.asset_id) {
    run("insert or ignore into item_assets (item_id, asset_id) values (?, ?)", item.id, alert.asset_id);
    const label = get<{ label: string }>("select label from asset_objects where id = ?", alert.asset_id)?.label;
    if (label) logHistory(item.id, actorId, "asset", null, label);
  }
  return item.id;
}
