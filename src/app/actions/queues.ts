"use server";

import { isAdmin } from "@/lib/access";
import { requireAgent } from "@/lib/auth";
import { get, now, run, uid } from "@/lib/db";
import { back, bool, id, num, oneOf, str } from "@/lib/form";
import type { Filter } from "@/lib/queues";
import { CATEGORIES, type Category } from "@/lib/workflows";

export async function starAction(fd: FormData): Promise<void> {
  const user = await requireAgent();
  const queueId = id(fd, "queueId");
  if (!queueId) back("/queues");
  if (!run("delete from queue_stars where queue_id = ? and user_id = ?", queueId, user.id)) {
    run("insert or ignore into queue_stars (queue_id, user_id) values (?, ?)", queueId, user.id);
  }
  back(`/queues/${queueId}`);
}

export async function saveQueueAction(fd: FormData): Promise<void> {
  const user = await requireAgent();
  const name = str(fd, "name", 80);
  if (!name) back("/queues/new", { error: "Give the queue a name." });
  const filter: Filter = {
    scope: oneOf(str(fd, "scope"), ["open", "done", "all"] as const, "open"),
    assignee: oneOf(str(fd, "assignee"), ["any", "me", "unassigned"] as const, "any"),
  };
  const cats = fd.getAll("categories").filter((c): c is Category => CATEGORIES.includes(c as Category));
  if (cats.length) filter.categories = cats;
  const prios = fd.getAll("priorities").map(Number).filter((p) => Number.isInteger(p) && p >= 1 && p <= 5);
  if (prios.length) filter.priorities = prios;
  if (bool(fd, "major")) filter.major = true;
  const teamId = id(fd, "teamId");
  if (teamId) filter.teamId = teamId;
  const text = str(fd, "text", 100);
  if (text) filter.text = text;
  const shared = isAdmin(user) && bool(fd, "shared");
  const queueId = uid();
  const position = (get<{ n: number }>("select count(*) as n from queues")?.n ?? 0) + (num(fd, "position") ?? 0);
  run(
    "insert into queues (id, name, filter_json, position, owner_id, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)",
    queueId,
    name,
    JSON.stringify(filter),
    position,
    shared ? null : user.id,
    now(),
    now(),
  );
  run("insert or ignore into queue_stars (queue_id, user_id) values (?, ?)", queueId, user.id);
  back(`/queues/${queueId}`, { ok: "Queue saved and starred." });
}

export async function deleteQueueAction(fd: FormData): Promise<void> {
  const user = await requireAgent();
  const queueId = id(fd, "queueId");
  const q = queueId ? get<{ owner_id: string | null }>("select owner_id from queues where id = ?", queueId) : undefined;
  if (!q || (q.owner_id !== user.id && !isAdmin(user))) back("/queues", { error: "You can delete your own queues; shared ones need an admin." });
  run("delete from queues where id = ?", queueId);
  back("/queues", { ok: "Queue deleted." });
}
