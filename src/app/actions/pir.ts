"use server";

import { requireAgent } from "@/lib/auth";
import { get, now, run, uid } from "@/lib/db";
import { back, id, str } from "@/lib/form";
import { getItem, logHistory } from "@/lib/items";

export async function savePirAction(fd: FormData): Promise<void> {
  const user = await requireAgent();
  const incidentId = id(fd, "incidentId");
  const incident = incidentId ? getItem(incidentId) : undefined;
  if (!incident || incident.category !== "incident") back("/incidents", { error: "That incident doesn't exist." });
  const page = `/pir/${incident.key}`;
  const parts = ["summary", "impact", "root_cause", "timeline", "actions"].map((f) => str(fd, f, 50_000));
  const publish = str(fd, "op") === "publish";
  if (publish && (!parts[0] || !parts[2])) back(page, { error: "Write at least what happened and the root cause before publishing." });
  const existing = get<{ id: string; status: string }>("select id, status from pirs where incident_id = ?", incident.id);
  const status = publish ? "published" : (existing?.status ?? "draft");
  if (existing) {
    run("update pirs set summary = ?, impact = ?, root_cause = ?, timeline = ?, actions = ?, status = ?, updated_at = ? where id = ?", ...parts, status, now(), existing.id);
  } else {
    run(
      "insert into pirs (id, incident_id, summary, impact, root_cause, timeline, actions, status, author_id, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      uid(),
      incident.id,
      ...parts,
      status,
      user.id,
      now(),
      now(),
    );
  }
  if (publish && existing?.status !== "published") logHistory(incident.id, user.id, "pir", null, "post-incident review published");
  back(page, { ok: publish ? "Published." : "Draft saved." });
}
