import { isAgent } from "./access";
import { runAutomation } from "./automation";
import { all, get, nextNumber, now, run, tx, uid, type Param } from "./db";
import { notify, notifyTeam } from "./notify";
import { PRIORITY_LABEL, priorityFrom } from "./priority";
import type { Approval, Comment, HistoryRow, Item, ItemRow, RequestType, User } from "./types";
import { CATEGORY_LABEL, WORKFLOWS, isDone, nextStatuses, type Category } from "./workflows";

export const ITEM_SELECT = `
  select i.*, r.name as reporter_name, a.name as assignee_name, t.name as team_name, rt.name as request_type_name
    from items i
    join users r on r.id = i.reporter_id
    left join users a on a.id = i.assignee_id
    left join teams t on t.id = i.team_id
    left join request_types rt on rt.id = i.request_type_id`;

export const getItem = (id: string) => get<ItemRow>(`${ITEM_SELECT} where i.id = ?`, id);
export const getItemByKey = (key: string) => get<ItemRow>(`${ITEM_SELECT} where i.key = ?`, key.toUpperCase());

export interface Result {
  ok: boolean;
  error?: string;
}

const nameOf = (table: "users" | "teams", id: Param | undefined) =>
  id ? (get<{ name: string }>(`select name from ${table} where id = ?`, id)?.name ?? null) : null;

const LONG_FIELDS = new Set(["description", "plan_implementation", "plan_backout", "plan_test", "root_cause", "workaround", "resolution"]);

// What history shows a person: names, not ids.
function shown(field: string, v: Param | undefined): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (field === "assignee_id") return nameOf("users", v);
  if (field === "team_id") return nameOf("teams", v);
  if (field === "priority") return PRIORITY_LABEL[Number(v)] ?? String(v);
  if (field === "is_major") return Number(v) ? "major" : "not major";
  if (field === "planned_start" || field === "planned_end") return new Date(Number(v)).toISOString();
  return String(v);
}

export function logHistory(itemId: string, actorId: string | null, field: string, oldV: string | null, newV: string | null, at = now()): void {
  run("insert into history (id, item_id, actor_id, field, old_value, new_value, created_at) values (?, ?, ?, ?, ?, ?, ?)", uid(), itemId, actorId, field, oldV, newV, at);
}

export interface NewItem {
  category: Category;
  requestType?: RequestType | null;
  summary: string;
  description?: string;
  reporterId: string;
  actorId: string;
  priority?: number | null;
  impact?: number | null;
  urgency?: number | null;
  teamId?: string | null;
  assigneeId?: string | null;
  fields?: Record<string, string>;
  isMajor?: boolean;
  changeType?: string | null;
  changeRisk?: string | null;
  plannedStart?: number | null;
  plannedEnd?: number | null;
  planImplementation?: string;
  planBackout?: string;
  planTest?: string;
  serviceIds?: string[];
  assetIds?: string[];
}

export function createItem(n: NewItem): ItemRow {
  const rt = n.requestType ?? null;
  const wf = WORKFLOWS[n.category];
  const approverId = n.category === "service_request" ? (rt?.approver_id ?? null) : null;
  const status = approverId && wf.approval ? wf.approval.status : wf.initial;
  const priority = n.priority ?? (n.impact && n.urgency ? priorityFrom(n.impact, n.urgency) : 3);
  const teamId = n.teamId ?? rt?.team_id ?? null;
  const id = uid();
  const t = now();
  tx(() => {
    const key = `SH-${nextNumber("item")}`;
    run(
      `insert into items (id, key, category, request_type_id, summary, description, status, priority, impact, urgency, reporter_id,
         assignee_id, team_id, is_major, change_type, change_risk, planned_start, planned_end, plan_implementation, plan_backout,
         plan_test, fields_json, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      key,
      n.category,
      rt?.id ?? null,
      n.summary.trim(),
      (n.description ?? "").trim(),
      status,
      priority,
      n.impact ?? null,
      n.urgency ?? null,
      n.reporterId,
      n.assigneeId ?? null,
      teamId,
      n.isMajor ? 1 : 0,
      n.category === "change" ? (n.changeType ?? "normal") : null,
      n.category === "change" ? (n.changeRisk ?? "low") : null,
      n.plannedStart ?? null,
      n.plannedEnd ?? null,
      n.planImplementation ?? "",
      n.planBackout ?? "",
      n.planTest ?? "",
      JSON.stringify(n.fields ?? {}),
      t,
      t,
    );
    for (const s of n.serviceIds ?? []) run("insert or ignore into item_services (item_id, service_id) values (?, ?)", id, s);
    for (const a of n.assetIds ?? []) run("insert or ignore into item_assets (item_id, asset_id) values (?, ?)", id, a);
    logHistory(id, n.actorId, "created", null, status, t);
    if (approverId) addApprovals(id, [approverId], "all", "Approval");
  });
  const item = getItem(id)!;
  if (item.assignee_id) notify(item.assignee_id, id, `${item.key} was assigned to you: ${item.summary}`, "assigned");
  else notifyTeam(teamId, id, `New ${CATEGORY_LABEL[n.category].toLowerCase()} ${item.key}: ${item.summary}`, n.actorId);
  runAutomation("item_created", { itemId: id });
  return getItem(id)!;
}

function addApprovals(itemId: string, approverIds: string[], rule: "all" | "any", stage: string): void {
  const key = get<{ key: string }>("select key from items where id = ?", itemId)?.key ?? "";
  for (const a of Array.from(new Set(approverIds))) {
    run("insert or ignore into approvals (id, item_id, approver_id, stage, rule, created_at) values (?, ?, ?, ?, ?, ?)", uid(), itemId, a, stage, rule, now());
    notify(a, itemId, `Your approval is needed on ${key} (${stage})`, "approvals");
  }
}

function round(itemId: string, prefix: string): number {
  return (get<{ n: number }>("select count(distinct stage) as n from approvals where item_id = ? and stage like ?", itemId, `${prefix}%`)?.n ?? 0) + 1;
}

// Change advisory board: members of the team named CAB, else the admins.
function cabIds(): string[] {
  const cab = all<{ id: string }>(
    "select u.id from team_members m join teams t on t.id = m.team_id join users u on u.id = m.user_id where t.name = 'CAB' and u.active = 1",
  ).map((r) => r.id);
  return cab.length ? cab : all<{ id: string }>("select id from users where role = 'admin' and active = 1 and system = 0").map((r) => r.id);
}

// Peer reviewers: the change's team, minus whoever raised it.
function peerIds(item: Item): string[] {
  const team = all<{ id: string }>(
    `select u.id from team_members m join users u on u.id = m.user_id
      where m.team_id = ? and u.active = 1 and u.role != 'employee' and u.system = 0 and u.id != ?`,
    item.team_id,
    item.reporter_id,
  ).map((r) => r.id);
  if (team.length) return team;
  return all<{ id: string }>("select id from users where role != 'employee' and active = 1 and system = 0 and id != ?", item.reporter_id).map((r) => r.id);
}

export function moveItem(itemId: string, to: string, actorId: string | null, opts: { system?: boolean } = {}): Result {
  const item = getItem(itemId);
  if (!item) return { ok: false, error: "That work item doesn't exist." };
  if (item.status === to) return { ok: true };
  const wf = WORKFLOWS[item.category];
  if (!(to in wf.statuses)) return { ok: false, error: `"${to}" isn't a status for this kind of work.` };
  if (!opts.system && !nextStatuses(item.category, item.status, item.change_type).includes(to)) {
    return { ok: false, error: `${item.key} can't go from ${item.status} to ${to}.` };
  }
  const t = now();
  tx(() => {
    const wasDone = isDone(item.category, item.status);
    const resolvedAt = isDone(item.category, to) ? (wasDone ? (item.resolved_at ?? t) : t) : null;
    run("update items set status = ?, resolved_at = ?, updated_at = ? where id = ?", to, resolvedAt, t, itemId);
    logHistory(itemId, actorId, "status", item.status, to, t);
    if (item.category === "change" && wf.approval && to === wf.approval.status) {
      if (item.change_type === "emergency") addApprovals(itemId, cabIds(), "any", `CAB review ${round(itemId, "CAB review")}`);
      else addApprovals(itemId, peerIds(item), "any", `Peer review ${round(itemId, "Peer review")}`);
    }
  });
  if (actorId !== item.reporter_id) notify(item.reporter_id, itemId, `${item.key} is now ${to}`, "my_requests");
  runAutomation("status_changed", { itemId });
  return { ok: true };
}

export function decide(approvalId: string, user: User, decision: "approved" | "declined", note: string): Result {
  const a = get<Approval>("select a.*, '' as approver_name from approvals a where a.id = ?", approvalId);
  if (!a || a.approver_id !== user.id) return { ok: false, error: "That approval isn't yours to decide." };
  if (a.decision !== "pending") return { ok: false, error: "That approval has already been decided." };
  const item = getItem(a.item_id);
  const flow = item ? WORKFLOWS[item.category].approval : undefined;
  if (!item || !flow || item.status !== flow.status) return { ok: false, error: "That work item is no longer waiting for approval." };
  tx(() => {
    run("update approvals set decision = ?, note = ?, decided_at = ? where id = ?", decision, note, now(), approvalId);
    logHistory(item.id, user.id, "approval", a.stage, `${decision === "approved" ? "Approved" : "Declined"} by ${user.name}${note ? `: ${note}` : ""}`);
    const skipRest = () => run("update approvals set decision = 'skipped' where item_id = ? and stage = ? and decision = 'pending'", item.id, a.stage);
    if (decision === "declined") {
      skipRest();
      moveItem(item.id, flow.declined, user.id, { system: true });
      return;
    }
    const pending = get<{ n: number }>("select count(*) as n from approvals where item_id = ? and stage = ? and decision = 'pending'", item.id, a.stage)!.n;
    if (a.rule === "all" && pending > 0) return;
    skipRest();
    if (item.category === "change" && a.stage.startsWith("Peer review")) {
      addApprovals(item.id, cabIds(), "all", `CAB review ${round(item.id, "CAB review")}`);
      logHistory(item.id, user.id, "approval", null, "Peer review passed; sent to the CAB");
    } else {
      moveItem(item.id, flow.approved, user.id, { system: true });
    }
  });
  if (note && item.reporter_id !== user.id) notify(item.reporter_id, item.id, `${user.name} ${decision} ${item.key}: ${note}`, "my_requests");
  return { ok: true };
}

export function addComment(itemId: string, author: User, body: string, opts: { internal?: boolean; occurredAt?: number | null } = {}): Result {
  const item = getItem(itemId);
  if (!item) return { ok: false, error: "That work item doesn't exist." };
  const text = body.trim();
  if (!text) return { ok: false, error: "Write something first." };
  const agent = isAgent(author);
  const internal = agent && !!opts.internal;
  const t = now();
  // Back-dated notes are for agents rebuilding an incident timeline; never in the future.
  const occurred = agent && opts.occurredAt && opts.occurredAt < t ? Math.max(opts.occurredAt, item.created_at) : t;
  tx(() => {
    run(
      "insert into comments (id, item_id, author_id, body, internal, occurred_at, created_at) values (?, ?, ?, ?, ?, ?, ?)",
      uid(),
      itemId,
      author.id,
      text,
      internal ? 1 : 0,
      occurred,
      t,
    );
    run("update items set updated_at = ? where id = ?", t, itemId);
    if (agent && !internal && item.first_response_at === null && author.id !== item.reporter_id) {
      run("update items set first_response_at = ? where id = ?", t, itemId);
    }
  });
  // A reply from the requester puts the request back with the team.
  if (!agent && item.category === "service_request" && item.status === "Waiting for customer") moveItem(itemId, "Waiting for support", author.id, { system: true });
  if (agent && !internal && author.id !== item.reporter_id) notify(item.reporter_id, itemId, `${author.name} replied on ${item.key}`, "my_requests");
  else if (!agent) {
    if (item.assignee_id) notify(item.assignee_id, itemId, `${author.name} commented on ${item.key}`, "assigned");
    else notifyTeam(item.team_id, itemId, `${author.name} commented on ${item.key}`);
  }
  runAutomation("comment_added", { itemId });
  return { ok: true };
}

export const EDITABLE = [
  "summary",
  "description",
  "priority",
  "impact",
  "urgency",
  "assignee_id",
  "team_id",
  "is_major",
  "change_type",
  "change_risk",
  "planned_start",
  "planned_end",
  "plan_implementation",
  "plan_backout",
  "plan_test",
  "root_cause",
  "workaround",
  "resolution",
] as const;
export type Editable = (typeof EDITABLE)[number];

export function updateItem(itemId: string, actorId: string | null, patch: Partial<Record<Editable, Param>>): Result {
  const item = getItem(itemId);
  if (!item) return { ok: false, error: "That work item doesn't exist." };
  const changed: Editable[] = [];
  tx(() => {
    for (const field of EDITABLE) {
      if (!(field in patch)) continue;
      const value = patch[field] ?? null;
      const old = (item as unknown as Record<string, Param>)[field] ?? null;
      if (String(old ?? "") === String(value ?? "")) continue;
      // Column names come from EDITABLE, never from input.
      run(`update items set ${field} = ?, updated_at = ? where id = ?`, value, now(), itemId);
      logHistory(itemId, actorId, field, LONG_FIELDS.has(field) ? null : shown(field, old), LONG_FIELDS.has(field) ? "edited" : shown(field, value));
      changed.push(field);
    }
  });
  if (changed.includes("assignee_id") && patch.assignee_id && patch.assignee_id !== actorId) {
    notify(String(patch.assignee_id), itemId, `${item.key} was assigned to you: ${item.summary}`, "assigned");
  }
  if (changed.includes("is_major") && Number(patch.is_major) === 1) {
    for (const p of all<{ user_id: string }>("select user_id from item_people where item_id = ?", itemId)) {
      notify(p.user_id, itemId, `${item.key} is now a major incident`, "alerts");
    }
  }
  return { ok: true };
}

export function comments(itemId: string, withInternal: boolean): Comment[] {
  return all<Comment>(
    `select c.*, u.name as author_name, u.role as author_role from comments c join users u on u.id = c.author_id
      where c.item_id = ? ${withInternal ? "" : "and c.internal = 0"} order by c.occurred_at, c.created_at`,
    itemId,
  );
}

export function history(itemId: string): HistoryRow[] {
  return all<HistoryRow>(
    "select h.*, u.name as actor_name from history h left join users u on u.id = h.actor_id where h.item_id = ? order by h.created_at, h.rowid",
    itemId,
  );
}

export function approvals(itemId: string): Approval[] {
  return all<Approval>(
    "select a.*, u.name as approver_name from approvals a join users u on u.id = a.approver_id where a.item_id = ? order by a.created_at, a.rowid",
    itemId,
  );
}

export const LINK_TYPES: Record<string, { out: string; in: string }> = {
  relates: { out: "relates to", in: "relates to" },
  causes: { out: "causes", in: "is caused by" },
  fixes: { out: "fixes", in: "is fixed by" },
  duplicates: { out: "duplicates", in: "is duplicated by" },
};

export interface LinkRow {
  id: string;
  type: string;
  direction: "out" | "in";
  other_key: string;
  other_summary: string;
  other_status: string;
  other_category: Category;
}

export function links(itemId: string): LinkRow[] {
  return all<LinkRow>(
    `select l.id, l.type, 'out' as direction, o.key as other_key, o.summary as other_summary, o.status as other_status, o.category as other_category
       from links l join items o on o.id = l.to_id where l.from_id = ?
     union all
     select l.id, l.type, 'in', o.key, o.summary, o.status, o.category from links l join items o on o.id = l.from_id where l.to_id = ?`,
    itemId,
    itemId,
  );
}

export function addLink(fromId: string, toKey: string, type: string, actorId: string): Result {
  const to = getItemByKey(toKey.trim());
  const from = getItem(fromId);
  if (!to || !from) return { ok: false, error: `There's no work item ${toKey}.` };
  if (to.id === fromId) return { ok: false, error: "A work item can't link to itself." };
  if (!(type in LINK_TYPES)) return { ok: false, error: "Pick a link type." };
  run("insert or ignore into links (id, from_id, to_id, type, created_at) values (?, ?, ?, ?, ?)", uid(), fromId, to.id, type, now());
  logHistory(fromId, actorId, "link", null, `${LINK_TYPES[type].out} ${to.key}`);
  logHistory(to.id, actorId, "link", null, `${LINK_TYPES[type].in} ${from.key}`);
  return { ok: true };
}

// A duplicate folds into the item that stays: its conversation, people, services and assets move
// across, its requester can follow the one that stays, and the duplicate closes with a link.
export function mergeItem(fromId: string, intoKey: string, actor: User): Result {
  const from = getItem(fromId);
  const into = getItemByKey(intoKey.trim());
  if (!from || !into) return { ok: false, error: `There's no work item ${intoKey}.` };
  if (from.id === into.id) return { ok: false, error: "An item can't merge into itself." };
  if (from.category !== into.category) return { ok: false, error: `Only the same kind of work can merge: ${from.key} and ${into.key} differ.` };
  if (isDone(into.category, into.status)) return { ok: false, error: `${into.key} is already finished; merge into one that's open.` };
  const closed = WORKFLOWS[from.category].statuses.Closed === "done" ? "Closed" : "Canceled";
  tx(() => {
    run("update comments set item_id = ? where item_id = ?", into.id, from.id);
    for (const t of ["item_services", "item_assets"]) {
      run(`insert or ignore into ${t} select ?, ${t === "item_services" ? "service_id" : "asset_id"} from ${t} where item_id = ?`, into.id, from.id);
    }
    run("insert or ignore into item_people (item_id, user_id, kind, created_at) select ?, user_id, kind, created_at from item_people where item_id = ?", into.id, from.id);
    if (from.reporter_id !== into.reporter_id) {
      run("insert or ignore into item_people (item_id, user_id, kind, created_at) values (?, ?, 'stakeholder', ?)", into.id, from.reporter_id, now());
    }
    run("insert or ignore into links (id, from_id, to_id, type, created_at) values (?, ?, ?, 'duplicates', ?)", uid(), from.id, into.id, now());
    run(
      "insert into comments (id, item_id, author_id, body, internal, occurred_at, created_at) values (?, ?, ?, ?, 1, ?, ?)",
      uid(),
      into.id,
      actor.id,
      `Merged ${from.key} (“${from.summary}”, raised by ${from.reporter_name}) into this one. Its conversation is above.`,
      now(),
      now(),
    );
    logHistory(into.id, actor.id, "link", null, `merged ${from.key} into this`);
    logHistory(from.id, actor.id, "link", null, `merged into ${into.key}`);
    moveItem(from.id, closed, actor.id, { system: true });
  });
  notify(from.reporter_id, into.id, `${from.key} was merged into ${into.key}; updates continue there`, "my_requests");
  return { ok: true };
}
