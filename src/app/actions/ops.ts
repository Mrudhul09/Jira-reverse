"use server";

import { incidentFromAlert, getAlert, raiseAlert, setAlertStatus } from "@/lib/alerts";
import { requireAgent } from "@/lib/auth";
import { get, now, run, tx, uid } from "@/lib/db";
import { back, dateTime, id, ids, num, str } from "@/lib/form";
import { getItem } from "@/lib/items";
import { redirect } from "next/navigation";

// Services

export async function saveServiceAction(fd: FormData): Promise<void> {
  await requireAgent();
  const serviceId = id(fd, "id");
  const page = serviceId ? `/services/${serviceId}` : "/services";
  const name = str(fd, "name", 120);
  if (!name) back(page, { error: "A service needs a name." });
  const clash = get<{ id: string }>("select id from services where name = ?", name);
  if (clash && clash.id !== serviceId) back(page, { error: `There's already a service called ${name}.` });
  const tier = Math.min(4, Math.max(1, num(fd, "tier") ?? 3));
  const owner = id(fd, "ownerTeamId");
  const deps = ids(fd, "dependsOn").filter((d) => d !== serviceId);
  const saved = tx(() => {
    const sid = serviceId ?? uid();
    if (serviceId) run("update services set name = ?, description = ?, tier = ?, owner_team_id = ?, updated_at = ? where id = ?", name, str(fd, "description", 2000), tier, owner, now(), sid);
    else run("insert into services (id, name, description, tier, owner_team_id, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)", sid, name, str(fd, "description", 2000), tier, owner, now(), now());
    run("delete from service_dependencies where service_id = ?", sid);
    for (const d of deps) run("insert or ignore into service_dependencies (service_id, depends_on_id) values (?, ?)", sid, d);
    return sid;
  });
  back(`/services/${saved}`, { ok: "Saved." });
}

export async function deleteServiceAction(fd: FormData): Promise<void> {
  await requireAgent();
  const serviceId = id(fd, "id");
  if (serviceId) run("delete from services where id = ?", serviceId);
  back("/services", { ok: "Service deleted. Work items that pointed at it keep their history." });
}

// Alerts

export async function raiseAlertAction(fd: FormData): Promise<void> {
  await requireAgent();
  const message = str(fd, "message", 300);
  if (!message) back("/alerts", { error: "An alert needs a message." });
  const r = raiseAlert({
    message,
    description: str(fd, "description", 4000),
    source: "manual",
    priority: Math.min(5, Math.max(1, num(fd, "priority") ?? 3)),
    alias: str(fd, "alias", 200) || null,
    teamId: id(fd, "teamId"),
  });
  back("/alerts", { ok: r.repeat ? `Counted against open alert #${r.alert.number} with the same alias.` : `Alert #${r.alert.number} raised; whoever is on call was told.` });
}

export async function alertAction(fd: FormData): Promise<void> {
  const user = await requireAgent();
  const alertId = id(fd, "alertId");
  const alert = alertId ? getAlert(alertId) : undefined;
  if (!alert) back("/alerts", { error: "That alert doesn't exist." });
  const op = str(fd, "op");
  if (op === "ack") setAlertStatus(alert.id, "acked", user.id);
  else if (op === "close") setAlertStatus(alert.id, "closed", user.id);
  else if (op === "incident") {
    const itemId = incidentFromAlert(alert.id, user.id);
    if (alert.status === "open") setAlertStatus(alert.id, "acked", user.id);
    redirect(`/items/${getItem(itemId)?.key}?ok=${encodeURIComponent(`Incident opened from alert #${alert.number}.`)}`);
  }
  back("/alerts");
}

// On call

export async function saveScheduleAction(fd: FormData): Promise<void> {
  await requireAgent();
  const scheduleId = id(fd, "id");
  const name = str(fd, "name", 120);
  const teamId = id(fd, "teamId");
  const rotation = ids(fd, "rotation");
  if (!name || !teamId || !rotation.length) back("/oncall", { error: "A schedule needs a name, a team and at least one person." });
  const values = [
    name,
    teamId,
    JSON.stringify(rotation),
    Math.min(672, Math.max(1, num(fd, "shiftHours") ?? 168)),
    dateTime(fd, "startsAt") ?? now(),
    Math.max(1, num(fd, "escalateAfter") ?? 15),
    id(fd, "escalateTo"),
  ] as const;
  if (scheduleId) {
    run("update oncall_schedules set name = ?, team_id = ?, rotation_json = ?, shift_hours = ?, starts_at = ?, escalate_after_minutes = ?, escalate_to_id = ?, updated_at = ? where id = ?", ...values, now(), scheduleId);
  } else {
    run(
      "insert into oncall_schedules (id, name, team_id, rotation_json, shift_hours, starts_at, escalate_after_minutes, escalate_to_id, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      uid(),
      ...values,
      now(),
      now(),
    );
  }
  back("/oncall", { ok: "Schedule saved." });
}

export async function deleteScheduleAction(fd: FormData): Promise<void> {
  await requireAgent();
  const scheduleId = id(fd, "id");
  if (scheduleId) run("delete from oncall_schedules where id = ?", scheduleId);
  back("/oncall", { ok: "Schedule deleted." });
}
