import { now, run, uid } from "./db";
import { hashPassword } from "./password";

// A real install: sensible defaults and one admin from the environment, no demo people or work.
export function seedBase(): void {
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD ?? "";
  if (!email || password.length < 12) {
    throw new Error("First start with SEED_DEMO=0 needs INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD (12+ characters) in .env.local.");
  }
  const t = now();
  const team = (name: string) => {
    const id = uid();
    run("insert into teams (id, name, created_at, updated_at) values (?, ?, ?, ?)", id, name, t, t);
    return id;
  };
  const desk = team("Service Desk");
  const cab = team("CAB");
  const admin = uid();
  run(
    "insert into users (id, name, email, role, password_hash, created_at, updated_at) values (?, ?, ?, 'admin', ?, ?, ?)",
    admin,
    process.env.INITIAL_ADMIN_NAME?.trim() || "IT admin",
    email,
    hashPassword(password),
    t,
    t,
  );
  for (const tm of [desk, cab]) run("insert into team_members (team_id, user_id) values (?, ?)", tm, admin);
  run("insert into users (id, name, email, role, password_hash, system, active, created_at, updated_at) values (?, 'Rules robot', 'robot@itsm.local', 'agent', ?, 1, 0, ?, ?)", uid(), hashPassword(uid() + uid()), t, t);

  const cal = (name: string, alwaysOn: number) => {
    const id = uid();
    run("insert into sla_calendars (id, name, always_on, utc_offset_minutes, created_at, updated_at) values (?, ?, ?, ?, ?, ?)", id, name, alwaysOn, -new Date().getTimezoneOffset(), t, t);
    return id;
  };
  const allDay = cal("Around the clock", 1);
  const office = cal("Office hours", 0);
  const g = (category: string | null, priority: number | null, minutes: number, calendar_id: string) => ({ category, priority, minutes, calendar_id });
  run("insert into slas (id, name, metric, goals_json, position, created_at, updated_at) values (?, 'Time to first response', 'first_response', ?, 0, ?, ?)", uid(), JSON.stringify([
    g("incident", 1, 15, allDay), g("incident", 2, 60, allDay), g("incident", null, 240, office), g("service_request", 1, 60, office), g("service_request", null, 480, office),
  ]), t, t);
  run("insert into slas (id, name, metric, goals_json, position, created_at, updated_at) values (?, 'Time to resolution', 'resolution', ?, 1, ?, ?)", uid(), JSON.stringify([
    g("incident", 1, 240, allDay), g("incident", 2, 480, allDay), g("incident", 3, 1440, office), g("incident", null, 2880, office),
    g("service_request", 1, 480, office), g("service_request", 2, 960, office), g("service_request", null, 2400, office),
  ]), t, t);

  let pos = 0;
  const queue = (name: string, filter: object) => run("insert into queues (id, name, filter_json, position, created_at, updated_at) values (?, ?, ?, ?, ?, ?)", uid(), name, JSON.stringify(filter), pos++, t, t);
  queue("All open work", { scope: "open" });
  queue("Mine", { scope: "open", assignee: "me" });
  queue("Nobody's on it", { scope: "open", assignee: "unassigned" });
  queue("Requests", { scope: "open", categories: ["service_request"] });
  queue("Incidents", { scope: "open", categories: ["incident"] });
  queue("Major incidents", { scope: "open", categories: ["incident"], major: true });
  queue("Problems", { scope: "open", categories: ["problem"] });
  queue("Changes", { scope: "open", categories: ["change"] });
  queue("Waiting on someone else", { scope: "open", statuses: ["Waiting for customer", "Waiting for approval", "Pending", "Awaiting approval"] });
  queue("Done this week", { scope: "done" });

  let tpos = 0;
  const rt = (name: string, description: string, icon: string, group: string, category: string, portal: number, fields: object[] = []) =>
    run(
      "insert into request_types (id, name, description, icon, group_name, category, team_id, fields_json, portal_visible, position, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      uid(), name, description, icon, group, category, desk, JSON.stringify(fields), portal, tpos++, t, t,
    );
  rt("Ask IT a question", "Not sure where else to go? Start here.", "help", "Everyday help", "service_request", 1);
  rt("Something stopped working", "An app, device or service that worked before and now doesn't.", "alert", "Report a problem", "incident", 1, [{ key: "what", label: "What stopped working?", type: "text", required: true }]);
  rt("Problem investigation", "Find and fix the cause of repeat incidents.", "search", "Agents", "problem", 0);
  rt("Change to production", "Any change to systems people depend on.", "git", "Agents", "change", 0);

  let rpos = 0;
  const rule = (name: string, trigger: string, conditions: object, actions: object[]) =>
    run("insert into automation_rules (id, name, trigger, conditions_json, actions_json, position, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?)", uid(), name, trigger, JSON.stringify(conditions), JSON.stringify(actions), rpos++, t, t);
  rule("Incidents with no team go to the Service Desk", "item_created", { categories: ["incident"], noTeam: true }, [{ type: "assign_team", teamId: desk }]);
  rule("P1 incidents become major and page on-call", "item_created", { categories: ["incident"], priorities: [1] }, [
    { type: "mark_major" },
    { type: "page_oncall" },
    { type: "comment", body: "Made major automatically because it is P1. Whoever is on call has been paged.", internal: true },
  ]);
  rule("P1 and P2 alerts open an incident", "alert_created", { priorities: [1, 2] }, [{ type: "open_incident" }]);
  rule("Let the requester know when it's resolved", "status_changed", { categories: ["service_request"], status: "Resolved" }, [
    { type: "comment", body: "We've marked this as resolved. If it isn't sorted, reply here and it comes straight back to us. A quick rating helps too.", internal: false },
  ]);
}
