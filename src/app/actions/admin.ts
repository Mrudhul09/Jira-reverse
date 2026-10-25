"use server";

import { ICON_NAMES } from "@/components/RequestTypeIcon";
import { requireAdmin } from "@/lib/auth";
import { ACTION_TYPES, type Action, type Conditions, type Trigger } from "@/lib/automation";
import { get, now, run, tx, uid } from "@/lib/db";
import { back, bool, id, ids, num, oneOf, str } from "@/lib/form";
import { hashPassword } from "@/lib/password";
import type { SlaGoal } from "@/lib/sla";
import type { FieldDef } from "@/lib/types";
import { ALL_STATUSES, CATEGORIES, type Category } from "@/lib/workflows";

// Automation

export async function saveRuleAction(fd: FormData): Promise<void> {
  await requireAdmin();
  const name = str(fd, "name", 120);
  if (!name) back("/automation", { error: "A rule needs a name." });
  const trigger = oneOf<Trigger>(str(fd, "trigger"), ["item_created", "status_changed", "comment_added", "alert_created"], "item_created");
  const c: Conditions = {};
  const cats = fd.getAll("categories").filter((x): x is Category => CATEGORIES.includes(x as Category));
  if (cats.length) c.categories = cats;
  const prios = fd.getAll("priorities").map(Number).filter((p) => p >= 1 && p <= 5);
  if (prios.length) c.priorities = prios;
  const status = str(fd, "status", 60);
  if (status) {
    if (!ALL_STATUSES.includes(status)) back("/automation", { error: `"${status}" isn't a status. Pick one from the list.` });
    c.status = status;
  }
  const text = str(fd, "textContains", 100);
  if (text) c.textContains = text;
  if (bool(fd, "noTeam")) c.noTeam = true;
  const actions: Action[] = [];
  for (const n of [1, 2, 3]) {
    const type = str(fd, `a${n}`);
    if (!type) continue;
    const t = oneOf(type, ACTION_TYPES, "page_oncall");
    const need = (what: string): never => back("/automation", { error: `Step ${n} needs ${what}.` });
    if (t === "assign_team") actions.push({ type: t, teamId: id(fd, `a${n}_team`) ?? need("a team") });
    else if (t === "assign_user" || t === "notify_user") actions.push({ type: t, userId: id(fd, `a${n}_user`) ?? need("a person") });
    else if (t === "set_priority") {
      const p = num(fd, `a${n}_priority`);
      actions.push({ type: t, priority: p && p >= 1 && p <= 5 ? p : need("a priority") });
    } else if (t === "comment") actions.push({ type: t, body: str(fd, `a${n}_text`, 2000) || need("the message"), internal: bool(fd, `a${n}_internal`) });
    else if (t === "move") {
      const to = str(fd, `a${n}_status`, 60);
      actions.push({ type: t, status: ALL_STATUSES.includes(to) ? to : need("a status") });
    } else actions.push({ type: t });
  }
  if (!actions.length) back("/automation", { error: "Add at least one step." });
  const alertOk = new Set(["open_incident", "page_oncall", "notify_user"]);
  if (trigger === "alert_created" && actions.some((a) => !alertOk.has(a.type))) back("/automation", { error: "For alerts, steps can only open an incident or tell people." });
  if (trigger !== "alert_created" && actions.some((a) => a.type === "open_incident")) back("/automation", { error: "“Open an incident” only works for alerts." });
  const position = get<{ n: number }>("select count(*) as n from automation_rules")?.n ?? 0;
  run(
    "insert into automation_rules (id, name, trigger, conditions_json, actions_json, position, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?)",
    uid(),
    name,
    trigger,
    JSON.stringify(c),
    JSON.stringify(actions),
    position,
    now(),
    now(),
  );
  back("/automation", { ok: "Rule added. It runs from now on." });
}

export async function ruleAction(fd: FormData): Promise<void> {
  await requireAdmin();
  const ruleId = id(fd, "id");
  if (!ruleId) back("/automation");
  if (str(fd, "op") === "delete") run("delete from automation_rules where id = ?", ruleId);
  else run("update automation_rules set enabled = 1 - enabled, updated_at = ? where id = ?", now(), ruleId);
  back("/automation");
}

// People

export async function saveUserAction(fd: FormData): Promise<void> {
  const admin = await requireAdmin();
  const userId = id(fd, "id");
  const page = "/settings?tab=people";
  const name = str(fd, "name", 120);
  const email = str(fd, "email", 200).toLowerCase();
  const role = oneOf(str(fd, "role"), ["employee", "agent", "admin"] as const, "employee");
  const password = str(fd, "password", 200);
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) back(page, { error: "Enter a name and a real email address." });
  const clash = get<{ id: string }>("select id from users where email = ?", email);
  if (clash && clash.id !== userId) back(page, { error: `${email} already belongs to someone.` });
  if (password && password.length < 12) back(page, { error: "Passwords need at least 12 characters." });
  if (userId === admin.id && role !== "admin") back(page, { error: "You can't take away your own admin role." });
  const active = userId === admin.id || bool(fd, "active");
  tx(() => {
    const uidToSave = userId ?? uid();
    if (userId) {
      run("update users set name = ?, email = ?, role = ?, active = ?, updated_at = ? where id = ? and system = 0", name, email, role, active ? 1 : 0, now(), userId);
      if (password) run("update users set password_hash = ? where id = ?", hashPassword(password), userId);
      if (!active || password) run("delete from sessions where user_id = ?", userId);
    } else {
      if (!password) back(page, { error: "Set a first password for the new person." });
      run("insert into users (id, name, email, role, password_hash, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)", uidToSave, name, email, role, hashPassword(password), now(), now());
    }
    run("delete from team_members where user_id = ?", uidToSave);
    for (const t of ids(fd, "teams")) run("insert or ignore into team_members (team_id, user_id) values (?, ?)", t, uidToSave);
  });
  back(page, { ok: userId ? "Saved." : `${name} can now sign in.` });
}

export async function saveTeamAction(fd: FormData): Promise<void> {
  await requireAdmin();
  const teamId = id(fd, "id");
  const page = "/settings?tab=teams";
  if (str(fd, "op") === "delete" && teamId) {
    run("delete from teams where id = ?", teamId);
    back(page, { ok: "Team deleted. Its work keeps its history but has no team now." });
  }
  const name = str(fd, "name", 80);
  if (!name) back(page, { error: "A team needs a name." });
  const clash = get<{ id: string }>("select id from teams where name = ?", name);
  if (clash && clash.id !== teamId) back(page, { error: "There's already a team with that name." });
  if (teamId) run("update teams set name = ?, updated_at = ? where id = ?", name, now(), teamId);
  else run("insert into teams (id, name, created_at, updated_at) values (?, ?, ?, ?)", uid(), name, now(), now());
  back(page, { ok: "Team saved." });
}

// Request types. Fields: one per line, "Label | text/long text/list/date | required | choice, choice"

function parseFields(text: string): { fields: FieldDef[]; error?: string } {
  const fields: FieldDef[] = [];
  const kinds: Record<string, FieldDef["type"]> = { text: "text", "long text": "textarea", textarea: "textarea", list: "select", select: "select", date: "date" };
  for (const [n, raw] of text.split(/\r?\n/).entries()) {
    if (!raw.trim()) continue;
    const [label, kind = "text", req = "", opts = ""] = raw.split("|").map((p) => p.trim());
    if (!label) return { fields, error: `Line ${n + 1} has no label.` };
    const type = kinds[kind.toLowerCase()];
    if (!type) return { fields, error: `Line ${n + 1}: "${kind}" isn't a field kind. Use text, long text, list or date.` };
    const f: FieldDef = { key: label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || `field_${n + 1}`, label, type, required: /^(required|yes|y|\*)$/i.test(req) };
    if (type === "select") {
      f.options = opts.split(",").map((o) => o.trim()).filter(Boolean);
      if (!f.options.length) return { fields, error: `${label}: list the choices after the third |.` };
    }
    if (fields.some((x) => x.key === f.key)) return { fields, error: `Two fields are called ${label}.` };
    fields.push(f);
  }
  return { fields };
}

export async function saveTypeAction(fd: FormData): Promise<void> {
  await requireAdmin();
  const typeId = id(fd, "id");
  const page = "/settings?tab=types";
  if (str(fd, "op") === "delete" && typeId) {
    run("delete from request_types where id = ?", typeId);
    back(page, { ok: "Removed. Work raised with it keeps its answers." });
  }
  const name = str(fd, "name", 100);
  if (!name) back(page, { error: "Give it a name." });
  const { fields, error } = parseFields(str(fd, "fields", 5000));
  if (error) back(page, { error });
  const values = [
    name,
    str(fd, "description", 300),
    oneOf(str(fd, "icon"), ICON_NAMES as unknown as readonly string[], "help"),
    str(fd, "group", 60) || "General",
    oneOf(str(fd, "category"), CATEGORIES, "service_request"),
    id(fd, "approverId"),
    id(fd, "teamId"),
    id(fd, "restrictedTeamId"),
    JSON.stringify(fields),
    bool(fd, "portal") ? 1 : 0,
  ] as const;
  if (typeId) {
    run(
      "update request_types set name = ?, description = ?, icon = ?, group_name = ?, category = ?, approver_id = ?, team_id = ?, restricted_team_id = ?, fields_json = ?, portal_visible = ?, updated_at = ? where id = ?",
      ...values,
      now(),
      typeId,
    );
  } else {
    const position = get<{ n: number }>("select count(*) as n from request_types")?.n ?? 0;
    run(
      "insert into request_types (id, name, description, icon, group_name, category, approver_id, team_id, restricted_team_id, fields_json, portal_visible, position, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      uid(),
      ...values,
      position,
      now(),
      now(),
    );
  }
  back(page, { ok: "Saved." });
}

// Service levels

export async function saveGoalsAction(fd: FormData): Promise<void> {
  await requireAdmin();
  const slaId = id(fd, "slaId");
  const page = "/settings?tab=slas";
  if (!slaId || !get("select 1 from slas where id = ?", slaId)) back(page, { error: "That SLA doesn't exist." });
  const goals: SlaGoal[] = [];
  for (let n = 0; n < (num(fd, "rows") ?? 0); n++) {
    const minutes = num(fd, `g${n}_minutes`);
    const calendar = id(fd, `g${n}_calendar`);
    if (bool(fd, `g${n}_drop`) || !minutes || minutes <= 0 || !calendar) continue;
    const cat = str(fd, `g${n}_category`);
    const p = num(fd, `g${n}_priority`);
    goals.push({ category: CATEGORIES.includes(cat as Category) ? cat : null, priority: p && p >= 1 && p <= 5 ? p : null, minutes, calendar_id: calendar });
  }
  run("update slas set goals_json = ?, enabled = ?, updated_at = ? where id = ?", JSON.stringify(goals), bool(fd, "enabled") ? 1 : 0, now(), slaId);
  back(page, { ok: "Goals saved. They're checked top to bottom and the first match counts." });
}

export async function saveCalendarAction(fd: FormData): Promise<void> {
  await requireAdmin();
  const calId = id(fd, "id");
  const page = "/settings?tab=slas";
  const minutes = (v: string) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(v);
    return m && Number(m[1]) <= 24 && Number(m[2]) < 60 ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  const start = minutes(str(fd, "start", 5));
  const end = minutes(str(fd, "end", 5));
  if (start === null || end === null || end <= start) back(page, { error: "Working hours need a start before the end, like 09:00 and 17:30." });
  const days = fd.getAll("days").map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  if (!days.length) back(page, { error: "Tick at least one working day." });
  const offset = num(fd, "offset") ?? 0;
  if (Math.abs(offset) > 840) back(page, { error: "The UTC offset is in minutes, between -840 and 840." });
  const holidays = str(fd, "holidays", 5000).split(/[\s,]+/).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  run(
    "update sla_calendars set days_json = ?, start_minute = ?, end_minute = ?, utc_offset_minutes = ?, holidays_json = ?, updated_at = ? where id = ? and always_on = 0",
    JSON.stringify(Array.from(new Set(days)).sort()),
    start,
    end,
    offset,
    JSON.stringify(Array.from(new Set(holidays)).sort()),
    now(),
    calId,
  );
  back(page, { ok: "Calendar saved." });
}

// Saved replies

export async function saveCannedAction(fd: FormData): Promise<void> {
  await requireAdmin();
  const cannedId = id(fd, "id");
  const page = "/settings?tab=replies";
  if (str(fd, "op") === "delete" && cannedId) {
    run("delete from canned_responses where id = ?", cannedId);
    back(page, { ok: "Deleted." });
  }
  const title = str(fd, "title", 100);
  const body = str(fd, "body", 5000);
  if (!title || !body) back(page, { error: "A saved reply needs a title and some text." });
  if (cannedId) run("update canned_responses set title = ?, body = ?, updated_at = ? where id = ?", title, body, now(), cannedId);
  else run("insert into canned_responses (id, title, body, created_at, updated_at) values (?, ?, ?, ?, ?)", uid(), title, body, now(), now());
  back(page, { ok: "Saved." });
}
