"use server";

import { redirect } from "next/navigation";
import { canEditItem, canMoveItem, canRaise, canViewItem, isAgent } from "@/lib/access";
import { requireAgent, requireUser } from "@/lib/auth";
import { get, now, parseJson, run, uid, type Param } from "@/lib/db";
import { back, bool, dateTime, id, ids, num, oneOf, safePath, str } from "@/lib/form";
import { addComment, addLink, createItem, decide, getItem, getItemByKey, logHistory, moveItem, updateItem, type Editable } from "@/lib/items";
import { notify } from "@/lib/notify";
import { asLevel, asPriority, priorityFrom } from "@/lib/priority";
import type { FieldDef, RequestType, User } from "@/lib/types";
import { isCategory, isDone } from "@/lib/workflows";

function readFields(fd: FormData, defs: FieldDef[]): { values: Record<string, string>; missing: string[] } {
  const values: Record<string, string> = {};
  const missing: string[] = [];
  for (const f of defs) {
    let v = str(fd, `f_${f.key}`, 4000);
    if (f.type === "select" && v && !f.options?.includes(v)) v = "";
    if (f.type === "date" && v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) v = "";
    if (v) values[f.key] = v;
    else if (f.required) missing.push(f.label);
  }
  return { values, missing };
}

function visibleItem(fd: FormData, user: User) {
  const itemId = id(fd, "itemId");
  const item = itemId ? getItem(itemId) : undefined;
  if (!item || !canViewItem(user, item)) back("/", { error: "That work item doesn't exist or isn't yours to see." });
  return item;
}

const here = (fd: FormData, fallback: string) => safePath(str(fd, "returnTo", 500), fallback);

export async function raiseRequestAction(fd: FormData): Promise<void> {
  const user = await requireUser();
  const typeId = id(fd, "typeId");
  const rt = typeId ? get<RequestType>("select * from request_types where id = ?", typeId) : undefined;
  if (!rt || !canRaise(user, rt)) back("/portal", { error: "Pick something from the help center." });
  const page = `/portal/new/${rt.id}`;
  const summary = str(fd, "summary", 200);
  const { values, missing } = readFields(fd, parseJson<FieldDef[]>(rt.fields_json, []));
  if (!summary) missing.unshift("Summary");
  if (missing.length) back(page, { error: `Please fill in: ${missing.join(", ")}.` });
  const item = createItem({
    category: rt.category,
    requestType: rt,
    summary,
    description: str(fd, "description", 10_000),
    reporterId: user.id,
    actorId: user.id,
    fields: values,
    impact: rt.category === "incident" ? 3 : null,
    urgency: rt.category === "incident" ? 3 : null,
  });
  redirect(`/portal/requests/${item.key}?ok=${encodeURIComponent("Sent. You'll see every update here.")}`);
}

export async function createWorkAction(fd: FormData): Promise<void> {
  const user = await requireAgent();
  const category = str(fd, "category", 40);
  if (!isCategory(category)) back("/items/new", { error: "Pick a kind of work." });
  const page = `/items/new?category=${category}`;
  const typeId = id(fd, "typeId");
  const rt = typeId ? get<RequestType>("select * from request_types where id = ? and category = ?", typeId, category) : undefined;
  const summary = str(fd, "summary", 200);
  const { values, missing } = readFields(fd, rt ? parseJson<FieldDef[]>(rt.fields_json, []) : []);
  if (!summary) missing.unshift("Summary");
  if (missing.length) back(page, { error: `Please fill in: ${missing.join(", ")}.` });
  let reporterId = user.id;
  const onBehalf = str(fd, "reporterEmail", 200);
  if (onBehalf) {
    const r = get<{ id: string }>("select id from users where email = ? and active = 1 and system = 0", onBehalf);
    if (!r) back(page, { error: `Nobody active has the email ${onBehalf}.` });
    reporterId = r.id;
  }
  const impact = asLevel(num(fd, "impact"));
  const urgency = asLevel(num(fd, "urgency"));
  const chosen = num(fd, "priority");
  const plannedStart = dateTime(fd, "plannedStart");
  const plannedEnd = dateTime(fd, "plannedEnd");
  if (plannedStart && plannedEnd && plannedEnd <= plannedStart) back(page, { error: "The change window has to end after it starts." });
  const item = createItem({
    category,
    requestType: rt ?? null,
    summary,
    description: str(fd, "description", 10_000),
    reporterId,
    actorId: user.id,
    impact,
    urgency,
    priority: chosen ? asPriority(chosen) : impact && urgency ? priorityFrom(impact, urgency) : 3,
    teamId: id(fd, "teamId"),
    assigneeId: id(fd, "assigneeId"),
    fields: values,
    isMajor: category === "incident" && bool(fd, "isMajor"),
    changeType: oneOf(str(fd, "changeType"), ["standard", "normal", "emergency"] as const, "normal"),
    changeRisk: oneOf(str(fd, "changeRisk"), ["low", "medium", "high", "critical"] as const, "low"),
    plannedStart,
    plannedEnd,
    planImplementation: str(fd, "planImplementation", 10_000),
    planBackout: str(fd, "planBackout", 10_000),
    planTest: str(fd, "planTest", 10_000),
    serviceIds: ids(fd, "serviceIds"),
    assetIds: ids(fd, "assetIds"),
  });
  const linkFrom = str(fd, "linkFrom", 20);
  const linkType = str(fd, "linkType", 20);
  if (linkFrom && linkType) addLink(item.id, linkFrom, linkType, user.id);
  redirect(`/items/${item.key}?ok=Created`);
}

export async function moveAction(fd: FormData): Promise<void> {
  const user = await requireUser();
  const item = visibleItem(fd, user);
  const page = here(fd, `/items/${item.key}`);
  const to = str(fd, "to", 60);
  if (!canMoveItem(user, item, to)) back(page, { error: "Only the IT team can change that." });
  const r = moveItem(item.id, to, user.id);
  back(page, r.ok ? undefined : { error: r.error });
}

export async function commentAction(fd: FormData): Promise<void> {
  const user = await requireUser();
  const item = visibleItem(fd, user);
  const page = here(fd, `/items/${item.key}`);
  const r = addComment(item.id, user, str(fd, "body", 20_000), { internal: bool(fd, "internal"), occurredAt: dateTime(fd, "occurredAt") });
  if (!r.ok) back(page, { error: r.error });
  const then = str(fd, "then", 60);
  if (then && isAgent(user)) {
    const m = moveItem(item.id, then, user.id);
    if (!m.ok) back(page, { error: m.error });
  }
  back(page);
}

const TEXT: Editable[] = ["summary", "description", "plan_implementation", "plan_backout", "plan_test", "root_cause", "workaround", "resolution"];

export async function editAction(fd: FormData): Promise<void> {
  const user = await requireAgent();
  const item = visibleItem(fd, user);
  if (!canEditItem(user)) back("/");
  const page = here(fd, `/items/${item.key}`);
  const fields = str(fd, "fields", 400).split(",").map((f) => f.trim()) as Editable[];
  const patch: Partial<Record<Editable, Param>> = {};
  for (const f of fields) {
    if (TEXT.includes(f)) {
      patch[f] = str(fd, f, 20_000);
      if (f === "summary" && !patch[f]) back(page, { error: "The summary can't be empty." });
    } else if (f === "assignee_id" || f === "team_id") patch[f] = id(fd, f);
    else if (f === "priority") patch.priority = asPriority(num(fd, f), item.priority);
    else if (f === "impact" || f === "urgency") patch[f] = asLevel(num(fd, f));
    else if (f === "is_major") patch.is_major = bool(fd, f) ? 1 : 0;
    else if (f === "change_type") patch.change_type = oneOf(str(fd, f), ["standard", "normal", "emergency"] as const, "normal");
    else if (f === "change_risk") patch.change_risk = oneOf(str(fd, f), ["low", "medium", "high", "critical"] as const, "low");
    else if (f === "planned_start" || f === "planned_end") patch[f] = dateTime(fd, f);
  }
  // Impact and urgency set the priority unless the agent changed priority by hand.
  const levelsMoved = ("impact" in patch && patch.impact !== item.impact) || ("urgency" in patch && patch.urgency !== item.urgency);
  if (levelsMoved && (!("priority" in patch) || patch.priority === item.priority)) {
    const i = (patch.impact ?? item.impact) as number | null;
    const u = (patch.urgency ?? item.urgency) as number | null;
    if (i && u) patch.priority = priorityFrom(i, u);
  }
  const start = (patch.planned_start ?? item.planned_start) as number | null;
  const end = (patch.planned_end ?? item.planned_end) as number | null;
  if (start && end && end <= start) back(page, { error: "The change window has to end after it starts." });
  const r = updateItem(item.id, user.id, patch);
  back(page, r.ok ? undefined : { error: r.error });
}

export async function decideAction(fd: FormData): Promise<void> {
  const user = await requireUser();
  const page = here(fd, "/approvals");
  const decision = oneOf(str(fd, "decision"), ["approved", "declined"] as const, "approved");
  const approvalId = id(fd, "approvalId");
  const r = approvalId ? decide(approvalId, user, decision, str(fd, "note", 2000)) : { ok: false, error: "Pick an approval." };
  back(page, r.ok ? { ok: decision === "approved" ? "Approved." : "Declined." } : { error: r.error });
}

export async function linkAction(fd: FormData): Promise<void> {
  const user = await requireAgent();
  const item = visibleItem(fd, user);
  const r = addLink(item.id, str(fd, "key", 30), str(fd, "type", 20), user.id);
  back(`/items/${item.key}`, r.ok ? undefined : { error: r.error });
}

export async function unlinkAction(fd: FormData): Promise<void> {
  const user = await requireAgent();
  const item = visibleItem(fd, user);
  const linkId = id(fd, "linkId");
  if (linkId && run("delete from links where id = ? and (from_id = ? or to_id = ?)", linkId, item.id, item.id)) {
    logHistory(item.id, user.id, "link", "removed a link", null);
  }
  back(`/items/${item.key}`);
}

export async function peopleAction(fd: FormData): Promise<void> {
  const user = await requireAgent();
  const item = visibleItem(fd, user);
  const page = `/items/${item.key}`;
  const kind = oneOf(str(fd, "kind"), ["responder", "stakeholder"] as const, "responder");
  const personId = id(fd, "userId");
  const person = personId ? get<{ name: string }>("select name from users where id = ? and system = 0", personId) : undefined;
  if (!personId || !person) back(page, { error: "Pick someone first." });
  if (str(fd, "op") === "remove") {
    run("delete from item_people where item_id = ? and user_id = ? and kind = ?", item.id, personId, kind);
    logHistory(item.id, user.id, kind, person.name, "removed");
  } else if (run("insert or ignore into item_people (item_id, user_id, kind, created_at) values (?, ?, ?, ?)", item.id, personId, kind, now())) {
    logHistory(item.id, user.id, kind, null, person.name);
    notify(personId, item.id, kind === "responder" ? `You're a responder on ${item.key}: ${item.summary}` : `You'll get updates on ${item.key}: ${item.summary}`);
  }
  back(page);
}

export async function relateAction(fd: FormData): Promise<void> {
  const user = await requireAgent();
  const item = visibleItem(fd, user);
  const page = `/items/${item.key}`;
  const asset = str(fd, "kind") === "asset";
  const target = id(fd, "targetId");
  const name = target ? get<{ n: string }>(asset ? "select label as n from asset_objects where id = ?" : "select name as n from services where id = ?", target)?.n : undefined;
  if (!target || !name) back(page, { error: "Pick one first." });
  const [table, col] = asset ? ["item_assets", "asset_id"] : ["item_services", "service_id"];
  if (str(fd, "op") === "remove") {
    run(`delete from ${table} where item_id = ? and ${col} = ?`, item.id, target);
    logHistory(item.id, user.id, asset ? "asset" : "service", name, "removed");
  } else if (run(`insert or ignore into ${table} (item_id, ${col}) values (?, ?)`, item.id, target)) {
    logHistory(item.id, user.id, asset ? "asset" : "service", null, name);
  }
  back(page);
}

export async function bulkAction(fd: FormData): Promise<void> {
  const user = await requireAgent();
  const page = here(fd, "/queues");
  const chosen = ids(fd, "ids");
  if (!chosen.length) back(page, { error: "Tick at least one work item first." });
  const op = str(fd, "op");
  let changed = 0;
  const refused: string[] = [];
  for (const itemId of chosen) {
    const item = getItem(itemId);
    if (!item) continue;
    if (op === "assign") {
      updateItem(itemId, user.id, { assignee_id: id(fd, "assigneeId") });
      changed++;
    } else if (op === "move") {
      if (moveItem(itemId, str(fd, "to", 60), user.id).ok) changed++;
      else refused.push(item.key);
    }
  }
  back(page, {
    ok: `Updated ${changed} work item${changed === 1 ? "" : "s"}.`,
    error: refused.length ? `${refused.join(", ")} can't move to that status from where ${refused.length === 1 ? "it is" : "they are"}.` : undefined,
  });
}

export async function rateAction(fd: FormData): Promise<void> {
  const user = await requireUser();
  const item = visibleItem(fd, user);
  const page = `/portal/requests/${item.key}`;
  if (item.reporter_id !== user.id || !isDone(item.category, item.status)) back(page, { error: "You can rate your own requests once they're done." });
  const score = num(fd, "score");
  if (!score || score < 1 || score > 5) back(page, { error: "Pick from 1 to 5 stars." });
  run(
    "insert into csat (item_id, score, comment, created_at) values (?, ?, ?, ?) on conflict(item_id) do update set score = excluded.score, comment = excluded.comment, created_at = excluded.created_at",
    item.id,
    score,
    str(fd, "comment", 2000),
    now(),
  );
  back(page, { ok: "Thanks for telling us." });
}

// Knowledge from a solved request: an agent turns it into a draft article.
export async function articleFromItemAction(fd: FormData): Promise<void> {
  const user = await requireAgent();
  const item = visibleItem(fd, user);
  const articleId = uid();
  const body = [item.description, item.resolution ? `How we fixed it:\n${item.resolution}` : ""].filter(Boolean).join("\n\n") || "Write the steps here.";
  run(
    "insert into articles (id, title, body, category, portal_visible, author_id, source_item_id, created_at, updated_at) values (?, ?, ?, 'From requests', 0, ?, ?, ?, ?)",
    articleId,
    item.summary,
    body,
    user.id,
    item.id,
    now(),
    now(),
  );
  logHistory(item.id, user.id, "article", null, `drafted article "${item.summary}"`);
  redirect(`/kb/${articleId}/edit?ok=${encodeURIComponent("Draft created from the request. It's agents-only until you tick 'Show in the help center'.")}`);
}

export async function findAction(fd: FormData): Promise<void> {
  await requireAgent();
  const key = str(fd, "key", 30);
  const item = key ? getItemByKey(key) : undefined;
  if (item) redirect(`/items/${item.key}`);
  redirect(`/search?q=${encodeURIComponent(key)}`);
}
