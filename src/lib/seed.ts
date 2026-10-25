import { get, nextNumber, run, tx, uid } from "./db";
import { hashPassword } from "./password";
import type { FieldDef } from "./types";
import { WORKFLOWS, type Category } from "./workflows";

export const DEMO_PASSWORD = "demo-itsm-2026";

const HOUR = 3_600_000;

// Demo data so every screen has something real to show. Every name is invented.
export function seedIfEmpty(): void {
  if ((get<{ n: number }>("select count(*) as n from users")?.n ?? 0) > 0) return;
  const t0 = Date.now();
  const at = (hoursAgo: number) => t0 - Math.round(hoursAgo * HOUR);

  tx(() => {
    const team = (name: string) => {
      const id = uid();
      run("insert into teams (id, name, created_at, updated_at) values (?, ?, ?, ?)", id, name, at(720), at(720));
      return id;
    };
    const desk = team("Service Desk");
    const infra = team("Infrastructure");
    const network = team("Network");
    const apps = team("Business Apps");
    const cab = team("CAB");

    const person = (name: string, email: string, role: string, teams: string[] = [], system = 0) => {
      const id = uid();
      run(
        "insert into users (id, name, email, role, password_hash, system, active, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        id,
        name,
        email,
        role,
        hashPassword(system ? uid() + uid() : DEMO_PASSWORD),
        system,
        system ? 0 : 1,
        at(720),
        at(720),
      );
      for (const t of teams) run("insert into team_members (team_id, user_id) values (?, ?)", t, id);
      return id;
    };
    const dana = person("Dana Whitfield", "admin@example.org", "admin", [desk, cab]);
    const omar = person("Omar Haddad", "omar@example.org", "agent", [desk, infra]);
    const lena = person("Lena Fischer", "lena@example.org", "agent", [desk, network]);
    const kofi = person("Kofi Mensah", "kofi@example.org", "agent", [infra, cab]);
    const ines = person("Ines Duarte", "ines@example.org", "agent", [apps, desk]);
    const theo = person("Theo Grant", "theo@example.org", "employee");
    const maya = person("Maya Lindqvist", "maya@example.org", "employee");
    const ravi = person("Ravi Shah", "ravi@example.org", "employee");
    person("Rules robot", "robot@itsm.local", "agent", [], 1);

    let pos = 0;
    const rtype = (o: {
      name: string;
      description: string;
      icon: string;
      group: string;
      category: Category;
      team: string;
      fields?: FieldDef[];
      approver?: string;
      portal?: boolean;
      restricted?: string;
    }) => {
      const id = uid();
      run(
        `insert into request_types (id, name, description, icon, group_name, category, approver_id, team_id, restricted_team_id, fields_json, portal_visible, position, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        o.name,
        o.description,
        o.icon,
        o.group,
        o.category,
        o.approver ?? null,
        o.team,
        o.restricted ?? null,
        JSON.stringify(o.fields ?? []),
        o.portal === false ? 0 : 1,
        pos++,
        at(720),
        at(720),
      );
      return id;
    };
    const rtAsk = rtype({ name: "Ask IT a question", description: "Not sure where else to go? Start here.", icon: "help", group: "Everyday help", category: "service_request", team: desk });
    rtype({
      name: "Unlock or reset an account",
      description: "Locked out, forgot a password, or need MFA reset.",
      icon: "key",
      group: "Everyday help",
      category: "service_request",
      team: desk,
      fields: [{ key: "account", label: "Which account?", type: "select", required: true, options: ["Email", "VPN", "Payroll", "Laptop sign-in", "Something else"] }],
    });
    const rtKit = rtype({
      name: "Order equipment",
      description: "Laptops, screens, headsets and phones. Your manager approves it first.",
      icon: "laptop",
      group: "Equipment and access",
      category: "service_request",
      team: desk,
      approver: ravi,
      fields: [
        { key: "item", label: "What do you need?", type: "select", required: true, options: ["Laptop", "Screen", "Headset", "Keyboard and mouse", "Phone"] },
        { key: "reason", label: "What is it for?", type: "textarea", required: true },
      ],
    });
    rtype({
      name: "Get access to an app",
      description: "Access or a licence for a business application. Your manager approves it first.",
      icon: "lock",
      group: "Equipment and access",
      category: "service_request",
      team: apps,
      approver: ravi,
      fields: [
        { key: "app", label: "Which app?", type: "text", required: true },
        { key: "level", label: "Access level", type: "select", options: ["View only", "Normal", "Administrator"] },
      ],
    });
    rtype({
      name: "Set up a new starter",
      description: "Accounts, equipment and access ready for day one. For people managers.",
      icon: "user-plus",
      group: "People",
      category: "service_request",
      team: desk,
      restricted: desk,
      fields: [
        { key: "starter", label: "New starter's full name", type: "text", required: true },
        { key: "first_day", label: "First day", type: "date", required: true },
        { key: "role", label: "Job title", type: "text" },
      ],
    });
    const rtBroken = rtype({
      name: "Something stopped working",
      description: "An app, device or service that worked before and now doesn't.",
      icon: "alert",
      group: "Report a problem",
      category: "incident",
      team: desk,
      fields: [{ key: "what", label: "What stopped working?", type: "text", required: true }],
    });
    rtype({ name: "Report a security worry", description: "A suspicious email, a lost device, or odd account activity.", icon: "shield", group: "Report a problem", category: "incident", team: infra });
    const rtProblem = rtype({ name: "Problem investigation", description: "Find and fix the cause of repeat incidents.", icon: "search", group: "Agents", category: "problem", team: infra, portal: false });
    const rtChange = rtype({ name: "Change to production", description: "Any change to systems people depend on.", icon: "git", group: "Agents", category: "change", team: infra, portal: false });

    // SLAs
    const cal = (name: string, alwaysOn: number) => {
      const id = uid();
      run(
        "insert into sla_calendars (id, name, always_on, utc_offset_minutes, created_at, updated_at) values (?, ?, ?, ?, ?, ?)",
        id,
        name,
        alwaysOn,
        -new Date().getTimezoneOffset(),
        at(720),
        at(720),
      );
      return id;
    };
    const allDay = cal("Around the clock", 1);
    const office = cal("Office hours", 0);
    const goal = (category: Category | null, priority: number | null, minutes: number, calendar_id: string) => ({ category, priority, minutes, calendar_id });
    const sla = (name: string, metric: string, goals: object[], position: number) =>
      run("insert into slas (id, name, metric, goals_json, position, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)", uid(), name, metric, JSON.stringify(goals), position, at(720), at(720));
    sla(
      "Time to first response",
      "first_response",
      [
        goal("incident", 1, 15, allDay),
        goal("incident", 2, 60, allDay),
        goal("incident", null, 240, office),
        goal("service_request", 1, 60, office),
        goal("service_request", null, 480, office),
      ],
      0,
    );
    sla(
      "Time to resolution",
      "resolution",
      [
        goal("incident", 1, 240, allDay),
        goal("incident", 2, 480, allDay),
        goal("incident", 3, 1440, office),
        goal("incident", null, 2880, office),
        goal("service_request", 1, 480, office),
        goal("service_request", 2, 960, office),
        goal("service_request", null, 2400, office),
      ],
      1,
    );

    // Shared queues
    let qpos = 0;
    const queue = (name: string, filter: object) =>
      run("insert into queues (id, name, filter_json, position, created_at, updated_at) values (?, ?, ?, ?, ?, ?)", uid(), name, JSON.stringify(filter), qpos++, at(720), at(720));
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

    // Services
    const service = (name: string, description: string, tier: number, owner: string) => {
      const id = uid();
      run("insert into services (id, name, description, tier, owner_team_id, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)", id, name, description, tier, owner, at(1440), at(1440));
      return id;
    };
    const sDb = service("Core database", "Shared database for internal apps.", 1, infra);
    const sMail = service("Email and calendar", "Mailboxes, shared calendars and meeting rooms.", 1, infra);
    const sVpn = service("Remote access", "VPN for working away from the office.", 1, network);
    const sWifi = service("Office Wi-Fi", "Wireless in every office.", 2, network);
    const sPay = service("Payroll", "Payslips, expenses and holiday.", 2, apps);
    const sWiki = service("Team wiki", "Internal pages and how-tos.", 3, apps);
    const dep = (a: string, b: string) => run("insert into service_dependencies (service_id, depends_on_id) values (?, ?)", a, b);
    dep(sPay, sDb);
    dep(sWiki, sDb);
    dep(sPay, sVpn);

    // Assets
    const schema = uid();
    run("insert into asset_schemas (id, name, description, created_at, updated_at) values (?, ?, ?, ?, ?)", schema, "IT estate", "Hardware, servers, licences and sites.", at(1440), at(1440));
    const atype = (name: string, attrs: object[]) => {
      const id = uid();
      run("insert into asset_types (id, schema_id, name, attributes_json, created_at, updated_at) values (?, ?, ?, ?, ?, ?)", id, schema, name, JSON.stringify(attrs), at(1440), at(1440));
      return id;
    };
    const tSite = atype("Site", [{ key: "address", label: "Address", type: "text" }]);
    const tLaptop = atype("Laptop", [
      { key: "serial", label: "Serial", type: "text" },
      { key: "model", label: "Model", type: "text" },
      { key: "user", label: "Used by (email)", type: "text" },
      { key: "state", label: "State", type: "select", options: ["In use", "Spare", "Being fixed", "Retired"] },
      { key: "bought", label: "Bought", type: "date" },
      { key: "site", label: "Site", type: "reference", refTypeId: tSite },
    ]);
    const tServer = atype("Server", [
      { key: "host", label: "Hostname", type: "text" },
      { key: "ip", label: "IP address", type: "text" },
      { key: "os", label: "Operating system", type: "text" },
      { key: "env", label: "Environment", type: "select", options: ["Production", "Test", "Development"] },
      { key: "site", label: "Site", type: "reference", refTypeId: tSite },
    ]);
    atype("Licence", [
      { key: "vendor", label: "Vendor", type: "text" },
      { key: "seats", label: "Seats", type: "number" },
      { key: "renews", label: "Renews", type: "date" },
    ]);
    const obj = (typeId: string, label: string, attrs: Record<string, string>) => {
      const id = uid();
      run("insert into asset_objects (id, type_id, label, attrs_json, created_at, updated_at) values (?, ?, ?, ?, ?, ?)", id, typeId, label, JSON.stringify(attrs), at(2000), at(100));
      return id;
    };
    const hq = obj(tSite, "Main office", { address: "12 Sample Road" });
    const dc = obj(tSite, "Server room B", { address: "Basement, 12 Sample Road" });
    const theoLaptop = obj(tLaptop, "LT-2041", { serial: "SN-7Q2X-0041", model: "14-inch business laptop", user: "theo@example.org", state: "In use", bought: "2025-02-11", site: hq });
    obj(tLaptop, "LT-2042", { serial: "SN-7Q2X-0042", model: "14-inch business laptop", user: "maya@example.org", state: "In use", bought: "2025-02-11", site: hq });
    obj(tLaptop, "LT-2077", { serial: "SN-9K1M-0077", model: "16-inch workstation", user: "", state: "Spare", bought: "2026-04-02", site: hq });
    const db1 = obj(tServer, "sql-01", { host: "sql-01.corp.internal", ip: "10.20.0.11", os: "Linux", env: "Production", site: dc });
    obj(tServer, "sql-02", { host: "sql-02.corp.internal", ip: "10.20.0.12", os: "Linux", env: "Production", site: dc });
    const vpnBox = obj(tServer, "gw-vpn-1", { host: "gw-vpn-1.corp.internal", ip: "10.20.0.2", os: "Appliance", env: "Production", site: dc });

    // Knowledge base
    const article = (title: string, body: string, category: string, everyone: number, views: number) =>
      run(
        "insert into articles (id, title, body, category, portal_visible, views, helpful, author_id, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        uid(),
        title,
        body,
        category,
        everyone,
        views,
        Math.floor(views / 5),
        omar,
        at(900),
        at(200),
      );
    article(
      "Working from home: connect to the VPN",
      "1. Open the VPN app from the Start menu.\n2. Server: vpn.example.org\n3. Sign in with your work email and password, then approve the prompt on your phone.\n\nIt keeps dropping? Move closer to your router or plug in a cable. Still failing after a restart? Tell us with 'Something stopped working'.",
      "Working remotely",
      1,
      211,
    );
    article(
      "Forgotten your password",
      "On the sign-in page choose 'Forgot password' and follow the email. The link lasts 30 minutes.\n\nLocked out after too many tries? Ask for 'Unlock or reset an account' and we'll unlock it.",
      "Accounts",
      1,
      264,
    );
    article("Work email on your phone", "Install the mail app, add a work account with your email address, and accept the security prompt. Calendar comes with it.", "Email", 1, 88);
    article(
      "Printer says offline",
      "Switch it off and on again, then check the paper trays. If the screen shows an error code, note it and the printer name on its sticker, and send both with 'Ask IT a question'.",
      "Office",
      1,
      47,
    );
    article(
      "Runbook: running a major incident",
      "1. Declare it: mark the incident major and set impact and urgency.\n2. Get help: add responders from the owning team and whoever is on call.\n3. Keep people told: add stakeholders; update every 30 minutes.\n4. Fix and confirm with the reporter, then resolve.\n5. Write the post-incident review within five working days.",
      "Runbooks",
      0,
      19,
    );

    // On-call
    const monday = new Date(t0);
    monday.setHours(9, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const schedule = (name: string, teamId: string, rotation: string[], hours: number, after: number, to: string) =>
      run(
        "insert into oncall_schedules (id, name, team_id, rotation_json, shift_hours, starts_at, escalate_after_minutes, escalate_to_id, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        uid(),
        name,
        teamId,
        JSON.stringify(rotation),
        hours,
        monday.getTime(),
        after,
        to,
        at(720),
        at(720),
      );
    schedule("Infrastructure weekly", infra, [omar, kofi], 168, 15, dana);
    schedule("Service Desk daily", desk, [lena, ines, omar], 24, 10, dana);

    // Automation
    let rpos = 0;
    const rule = (name: string, trigger: string, conditions: object, actions: object[]) =>
      run(
        "insert into automation_rules (id, name, trigger, conditions_json, actions_json, position, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?)",
        uid(),
        name,
        trigger,
        JSON.stringify(conditions),
        JSON.stringify(actions),
        rpos++,
        at(500),
        at(500),
      );
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

    const canned = (title: string, body: string) => run("insert into canned_responses (id, title, body, created_at, updated_at) values (?, ?, ?, ?, ?)", uid(), title, body, at(500), at(500));
    canned("On it", "Thanks, I've picked this up and will update you within the hour.");
    canned("Need a screenshot", "Could you send a screenshot of the message and roughly when it happened? That helps us track it down.");
    canned("Please check", "That should be fixed now. Could you try again and let us know?");

    // Work items with backdated history so queues and SLA clocks show real states.
    const item = (o: {
      category: Category;
      rt: string;
      summary: string;
      description: string;
      path: [string, number][];
      priority: number;
      reporter: string;
      assignee?: string;
      team: string;
      impact?: number;
      urgency?: number;
      firstReply?: number;
      major?: boolean;
      change?: { type: string; risk: string; startIn: number; hours: number };
      services?: string[];
      assets?: string[];
      rootCause?: string;
      workaround?: string;
      fields?: Record<string, string>;
    }) => {
      const id = uid();
      const first = o.path[0];
      const last = o.path[o.path.length - 1];
      const done = WORKFLOWS[o.category].statuses[last[0]] === "done";
      run(
        `insert into items (id, key, category, request_type_id, summary, description, status, priority, impact, urgency, reporter_id, assignee_id, team_id, is_major,
           change_type, change_risk, planned_start, planned_end, plan_implementation, plan_backout, plan_test, root_cause, workaround, fields_json,
           first_response_at, resolved_at, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        `SH-${nextNumber("item")}`,
        o.category,
        o.rt,
        o.summary,
        o.description,
        last[0],
        o.priority,
        o.impact ?? null,
        o.urgency ?? null,
        o.reporter,
        o.assignee ?? null,
        o.team,
        o.major ? 1 : 0,
        o.change?.type ?? null,
        o.change?.risk ?? null,
        o.change ? t0 + o.change.startIn * HOUR : null,
        o.change ? t0 + (o.change.startIn + o.change.hours) * HOUR : null,
        o.change ? "1. Announce the window.\n2. Apply the update.\n3. Run the checks below." : "",
        o.change ? "Restore the snapshot taken before step 2." : "",
        o.change ? "Sign in, open the main screen, run one sample transaction." : "",
        o.rootCause ?? "",
        o.workaround ?? "",
        JSON.stringify(o.fields ?? {}),
        o.firstReply !== undefined ? at(o.firstReply) : null,
        done ? at(last[1]) : null,
        at(first[1]),
        at(last[1]),
      );
      run("insert into history (id, item_id, actor_id, field, new_value, created_at) values (?, ?, ?, 'created', ?, ?)", uid(), id, o.reporter, first[0], at(first[1]));
      for (let i = 1; i < o.path.length; i++) {
        run(
          "insert into history (id, item_id, actor_id, field, old_value, new_value, created_at) values (?, ?, ?, 'status', ?, ?, ?)",
          uid(),
          id,
          o.assignee ?? dana,
          o.path[i - 1][0],
          o.path[i][0],
          at(o.path[i][1]),
        );
      }
      for (const s of o.services ?? []) run("insert into item_services (item_id, service_id) values (?, ?)", id, s);
      for (const a of o.assets ?? []) run("insert into item_assets (item_id, asset_id) values (?, ?)", id, a);
      return id;
    };
    const say = (itemId: string, author: string, body: string, hoursAgo: number, internal = 0) =>
      run("insert into comments (id, item_id, author_id, body, internal, occurred_at, created_at) values (?, ?, ?, ?, ?, ?, ?)", uid(), itemId, author, body, internal, at(hoursAgo), at(hoursAgo));

    item({ category: "service_request", rt: rtAsk, summary: "Shared drive asks for a password every morning", description: "Since Monday the S: drive wants my password again each day.", path: [["Waiting for support", 2]], priority: 3, reporter: theo, team: desk });
    const r2 = item({
      category: "service_request",
      rt: rtAsk,
      summary: "Docking station doesn't charge my laptop",
      description: "Screens work through the dock but the battery goes down.",
      path: [["Waiting for support", 30], ["In progress", 29], ["Waiting for customer", 27]],
      priority: 4,
      reporter: maya,
      assignee: lena,
      team: desk,
      firstReply: 29,
      assets: [theoLaptop],
    });
    say(r2, lena, "Could you try the other USB-C port on the laptop and tell me if it charges then?", 27);
    const kit = item({
      category: "service_request",
      rt: rtKit,
      summary: "Second screen for spreadsheets",
      description: "",
      path: [["Waiting for approval", 4]],
      priority: 3,
      reporter: theo,
      team: desk,
      fields: { item: "Screen", reason: "Month-end reports are much faster with two screens." },
    });
    run("insert into approvals (id, item_id, approver_id, stage, rule, created_at) values (?, ?, ?, 'Approval', 'all', ?)", uid(), kit, ravi, at(4));
    const r4 = item({
      category: "service_request",
      rt: rtAsk,
      summary: "Install the diagram editor",
      description: "Need it for process maps.",
      path: [["Waiting for support", 52], ["In progress", 51], ["Resolved", 49]],
      priority: 4,
      reporter: maya,
      assignee: ines,
      team: desk,
      firstReply: 51,
    });
    say(r4, ines, "Installed. You'll find it in the Start menu.", 49);
    run("insert into csat (item_id, score, comment, created_at) values (?, 5, 'Same day, thanks!', ?)", r4, at(48));

    const big = item({
      category: "incident",
      rt: rtBroken,
      summary: "Payroll shows a server error for everyone",
      description: "Since about 09:05 nobody can open payroll.",
      path: [["Open", 1.4], ["Work in progress", 1.2]],
      priority: 1,
      impact: 1,
      urgency: 1,
      reporter: maya,
      assignee: omar,
      team: infra,
      major: true,
      firstReply: 1.3,
      services: [sPay, sDb],
      assets: [db1],
      fields: { what: "Payroll" },
    });
    say(big, omar, "We know payroll is down for everyone and we're working on it. Next update in 30 minutes.", 1.3);
    say(big, omar, "sql-01 data disk is full. Clearing old log files.", 1.1, 1);
    for (const [u, k] of [[omar, "responder"], [kofi, "responder"], [ravi, "stakeholder"]] as const) {
      run("insert into item_people (item_id, user_id, kind, created_at) values (?, ?, ?, ?)", big, u, k, at(1.2));
    }
    const vpn1 = item({
      category: "incident",
      rt: rtBroken,
      summary: "VPN drops every few minutes at home",
      description: "Disconnects every 5-10 minutes since yesterday.",
      path: [["Open", 5]],
      priority: 3,
      impact: 3,
      urgency: 2,
      reporter: theo,
      team: network,
      services: [sVpn],
      assets: [vpnBox],
      fields: { what: "VPN" },
    });
    const vpn2 = item({
      category: "incident",
      rt: rtBroken,
      summary: "Afternoon VPN drop-outs for remote staff",
      description: "Several people lose the VPN after 2pm.",
      path: [["Open", 70], ["Work in progress", 68], ["Resolved", 60]],
      priority: 3,
      impact: 3,
      urgency: 3,
      reporter: maya,
      assignee: lena,
      team: network,
      firstReply: 68,
      services: [sVpn],
      fields: { what: "VPN" },
    });
    item({
      category: "incident",
      rt: rtBroken,
      summary: "Wi-Fi crawls on the second floor",
      description: "Pages take ages to load near the kitchen.",
      path: [["Open", 20], ["Pending", 18]],
      priority: 4,
      impact: 4,
      urgency: 3,
      reporter: theo,
      assignee: lena,
      team: network,
      firstReply: 19,
      services: [sWifi],
      fields: { what: "Wi-Fi" },
    });
    const prob = item({
      category: "problem",
      rt: rtProblem,
      summary: "VPN gateway runs out of sessions at peak",
      description: "Repeat VPN drop-outs. Session limit on gw-vpn-1 suspected.",
      path: [["Open", 58], ["Under investigation", 50], ["Known error", 24]],
      priority: 2,
      reporter: lena,
      assignee: kofi,
      team: network,
      services: [sVpn],
      assets: [vpnBox],
      rootCause: "gw-vpn-1 allows 500 sessions; afternoon peaks go past that.",
      workaround: "Reconnect. Split-tunnel users aren't affected.",
    });
    const link = (from: string, to: string, type: string) => run("insert into links (id, from_id, to_id, type, created_at) values (?, ?, ?, ?, ?)", uid(), from, to, type, at(24));
    link(prob, vpn1, "causes");
    link(prob, vpn2, "causes");
    const chg = item({
      category: "change",
      rt: rtChange,
      summary: "Raise VPN session limit and update gateway firmware",
      description: "Fixes the known error on the VPN gateway.",
      path: [["Review", 20], ["Planning", 18], ["Awaiting approval", 4]],
      priority: 2,
      reporter: kofi,
      assignee: kofi,
      team: network,
      change: { type: "normal", risk: "medium", startIn: 50, hours: 2 },
      services: [sVpn],
      assets: [vpnBox],
    });
    link(chg, prob, "fixes");
    run("insert into approvals (id, item_id, approver_id, stage, rule, decision, decided_at, created_at) values (?, ?, ?, 'Peer review 1', 'any', 'approved', ?, ?)", uid(), chg, lena, at(3.5), at(4));
    run("insert into approvals (id, item_id, approver_id, stage, rule, created_at) values (?, ?, ?, 'CAB review 1', 'all', ?)", uid(), chg, dana, at(3.5));
    run("insert into approvals (id, item_id, approver_id, stage, rule, decision, decided_at, created_at) values (?, ?, ?, 'CAB review 1', 'all', 'approved', ?, ?)", uid(), chg, kofi, at(3), at(3.5));
    item({
      category: "change",
      rt: rtChange,
      summary: "Monthly OS patches on the database servers",
      description: "Standard monthly patching.",
      path: [["Review", 30], ["Planning", 29], ["Awaiting implementation", 28]],
      priority: 3,
      reporter: omar,
      assignee: omar,
      team: infra,
      change: { type: "standard", risk: "low", startIn: 100, hours: 3 },
      services: [sDb],
      assets: [db1],
    });
    item({
      category: "change",
      rt: rtChange,
      summary: "Move the team wiki to the new web server",
      description: "Migration to the new host.",
      path: [["Review", 2]],
      priority: 4,
      reporter: ines,
      team: apps,
      change: { type: "normal", risk: "low", startIn: 24 * 9, hours: 4 },
      services: [sWiki],
    });

    const note = (u: string, itemId: string | null, message: string, hoursAgo: number) =>
      run("insert into notifications (id, user_id, item_id, message, created_at) values (?, ?, ?, ?, ?)", uid(), u, itemId, message, at(hoursAgo));
    note(omar, big, "A P1 incident was assigned to you: Payroll shows a server error for everyone", 1.4);
    note(ravi, kit, "Your approval is needed on a request for a second screen", 4);
    note(dana, chg, "Your approval is needed on a change (CAB review 1)", 3.5);

    const alert = (alias: string, message: string, description: string, priority: number, status: string, teamId: string, incident: string | null, count: number, hoursAgo: number) =>
      run(
        "insert into alerts (id, number, alias, source, message, description, priority, status, team_id, incident_id, count, created_at, updated_at) values (?, ?, ?, 'monitoring', ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        uid(),
        nextNumber("alert"),
        alias,
        message,
        description,
        priority,
        status,
        teamId,
        incident,
        count,
        at(hoursAgo),
        at(Math.max(0, hoursAgo - 0.3)),
      );
    alert("sql-01-disk", "sql-01 data disk above 95%", "Data volume at 99%.", 1, "acked", infra, big, 1, 1.6);
    alert("ap-2f-latency", "Slow responses from access point AP-2F-3", "Average 450 ms for 10 minutes.", 3, "open", network, null, 4, 0.6);
  });
}
