import { all, get, marks, parseJson, type Param } from "./db";
import { ITEM_SELECT } from "./items";
import type { ItemRow } from "./types";
import { doneStatuses, type Category } from "./workflows";

export interface Filter {
  categories?: Category[];
  scope?: "open" | "done" | "all";
  assignee?: "me" | "unassigned" | "any" | string;
  priorities?: number[];
  statuses?: string[];
  requestTypeId?: string | null;
  major?: boolean;
  teamId?: string | null;
  text?: string;
}

export interface Queue {
  id: string;
  name: string;
  filter_json: string;
  position: number;
  owner_id: string | null;
}

export function where(f: Filter, userId: string): { sql: string; params: Param[] } {
  const parts: string[] = [];
  const params: Param[] = [];
  if (f.categories?.length) {
    parts.push(`i.category in (${marks(f.categories.length)})`);
    params.push(...f.categories);
  }
  const scope = f.scope ?? "open";
  if (scope !== "all") {
    parts.push(`i.status ${scope === "open" ? "not in" : "in"} (${marks(doneStatuses().length)})`);
    params.push(...doneStatuses());
  }
  if (f.assignee === "me") {
    parts.push("i.assignee_id = ?");
    params.push(userId);
  } else if (f.assignee === "unassigned") parts.push("i.assignee_id is null");
  else if (f.assignee && f.assignee !== "any") {
    parts.push("i.assignee_id = ?");
    params.push(f.assignee);
  }
  if (f.priorities?.length) {
    parts.push(`i.priority in (${marks(f.priorities.length)})`);
    params.push(...f.priorities);
  }
  if (f.statuses?.length) {
    parts.push(`i.status in (${marks(f.statuses.length)})`);
    params.push(...f.statuses);
  }
  if (f.requestTypeId) {
    parts.push("i.request_type_id = ?");
    params.push(f.requestTypeId);
  }
  if (f.major) parts.push("i.is_major = 1");
  if (f.teamId) {
    parts.push("i.team_id = ?");
    params.push(f.teamId);
  }
  if (f.text?.trim()) {
    const like = `%${f.text.trim()}%`;
    parts.push("(i.key like ? or i.summary like ? or i.description like ?)");
    params.push(like, like, like);
  }
  return { sql: parts.length ? `where ${parts.join(" and ")}` : "", params };
}

export function listItems(f: Filter, userId: string, limit = 500): ItemRow[] {
  const w = where(f, userId);
  const order = (f.scope ?? "open") === "done" ? "i.resolved_at desc" : "i.is_major desc, i.priority, i.created_at";
  return all<ItemRow>(`${ITEM_SELECT} ${w.sql} order by ${order} limit ${Math.floor(limit)}`, ...w.params);
}

// Counts stop at 1000 so a huge queue doesn't slow every page ("999+").
export function countItems(f: Filter, userId: string): number {
  const w = where(f, userId);
  return get<{ n: number }>(`select count(*) as n from (select 1 from items i ${w.sql} limit 1000)`, ...w.params)?.n ?? 0;
}

export const showCount = (n: number) => (n > 999 ? "999+" : String(n));

export function queuesFor(userId: string) {
  const stars = new Set(all<{ queue_id: string }>("select queue_id from queue_stars where user_id = ?", userId).map((s) => s.queue_id));
  return all<Queue>("select * from queues where owner_id is null or owner_id = ? order by owner_id is not null, position, name", userId).map((q) => {
    const filter = parseJson<Filter>(q.filter_json, {});
    return { ...q, filter, count: countItems(filter, userId), starred: stars.has(q.id) };
  });
}
