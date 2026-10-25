import { anonymiseAction, releaseHeldAction, saveCalendarAction, saveCannedAction, saveGoalsAction, saveTeamAction, saveTypeAction, saveUserAction } from "@/app/actions/admin";
import { ICON_NAMES } from "@/components/RequestTypeIcon";
import { Banners, Card, Lozenge, PageHead, Panel, TabLinks } from "@/components/ui";
import { Checkbox, SelectField, TextArea, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth";
import { all, parseJson } from "@/lib/db";
import { ago, dateTime } from "@/lib/format";
import { MAX_ATTEMPTS, mailConfigured } from "@/lib/mail";
import { PRIORITY_LABEL } from "@/lib/priority";
import type { Sla, SlaCalendar, SlaGoal } from "@/lib/sla";
import type { FieldDef, RequestType, User } from "@/lib/types";
import { CATEGORIES, CATEGORY_LABEL } from "@/lib/workflows";

export const metadata = { title: "Settings" };

type Team = { id: string; name: string; members: number };
const TABS = [
  ["people", "People"],
  ["teams", "Teams"],
  ["types", "What people can ask for"],
  ["slas", "Service levels"],
  ["replies", "Saved replies"],
  ["email", "Email and jobs"],
] as const;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const KIND_WORD: Record<FieldDef["type"], string> = { text: "text", textarea: "long text", select: "list", date: "date" };

export default async function Settings({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const tab = TABS.find(([k]) => k === sp.tab)?.[0] ?? "people";
  const teams = all<Team>("select t.id, t.name, (select count(*) from team_members m where m.team_id = t.id) as members from teams t order by t.name");
  return (
    <>
      <Banners sp={sp} />
      <PageHead title="Settings" intro="People and teams, what can be asked for, and the service levels we promise." />
      <TabLinks label="Settings" current={tab} tabs={TABS.map(([k, l]) => ({ key: k, label: l, href: `/settings?tab=${k}` }))} />
      {tab === "people" ? <People teams={teams} me={me} /> : null}
      {tab === "teams" ? <Teams teams={teams} /> : null}
      {tab === "types" ? <Types teams={teams} /> : null}
      {tab === "slas" ? <Slas /> : null}
      {tab === "replies" ? <Replies /> : null}
      {tab === "email" ? <EmailAndJobs /> : null}
    </>
  );
}

function PersonForm({ u, teams, memberOf = [] }: { u?: User; teams: Team[]; memberOf?: string[] }) {
  const p = u ? `u-${u.id.slice(0, 8)}` : "u-new";
  return (
    <form action={saveUserAction} className="space-y-3">
      {u ? <input type="hidden" name="id" value={u.id} /> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <TextField id={`${p}-name`} name="name" label="Name" required defaultValue={u?.name} />
        <TextField id={`${p}-email`} name="email" type="email" label="Email" required defaultValue={u?.email} />
        <SelectField
          id={`${p}-role`}
          name="role"
          label="Role"
          defaultValue={u?.role ?? "employee"}
          options={[
            { value: "employee", label: "Employee: help center only" },
            { value: "agent", label: "Agent: works on requests" },
            { value: "admin", label: "Admin: agent plus settings" },
          ]}
        />
        <TextField id={`${p}-pw`} name="password" type="password" minLength={12} autoComplete="new-password" label={u ? "New password (optional)" : "First password"} required={!u} hint="At least 12 characters." />
      </div>
      <div className="flex flex-col">
        <label htmlFor={`${p}-teams`} className="mb-1 text-sm font-semibold">
          Teams
        </label>
        <select id={`${p}-teams`} name="teams" multiple size={Math.min(5, Math.max(2, teams.length))} defaultValue={memberOf} className="control">
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      {u ? <Checkbox name="active" defaultChecked={!!u.active} label="Can sign in" /> : null}
      <SubmitButton size="sm">{u ? "Save" : "Add person"}</SubmitButton>
    </form>
  );
}

function People({ teams, me }: { teams: Team[]; me: User }) {
  const users = all<User & { team_ids: string | null }>(
    "select u.id, u.name, u.email, u.role, u.active, (select group_concat(team_id) from team_members m where m.user_id = u.id) as team_ids from users u where u.system = 0 order by u.active desc, u.role desc, u.name",
  );
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <Table>
        <thead>
          <tr>
            <Th>Person</Th>
            <Th>Role</Th>
            <Th>Teams</Th>
            <Th>Access</Th>
            <Th>
              <span className="sr-only">Edit</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const ids = (u.team_ids ?? "").split(",").filter(Boolean);
            return (
              <Tr key={u.id}>
                <Td>
                  {u.name}
                  {u.id === me.id ? <span className="text-muted"> (you)</span> : null}
                  <span className="block text-sm text-muted">{u.email}</span>
                </Td>
                <Td className="text-sm">{u.role}</Td>
                <Td className="text-sm">{ids.map((i) => teamName.get(i)).join(", ") || "-"}</Td>
                <Td>
                  <Lozenge tone={u.active ? "done" : "todo"}>{u.active ? "Can sign in" : "Switched off"}</Lozenge>
                </Td>
                <Td>
                  <details>
                    <summary className="cursor-pointer text-sm text-accent">Edit</summary>
                    <Card className="mt-2 min-w-[22rem] space-y-4">
                      <PersonForm u={u} teams={teams} memberOf={ids} />
                      {u.id !== me.id ? (
                        <form action={anonymiseAction} className="space-y-2 border-t border-line pt-3">
                          <input type="hidden" name="id" value={u.id} />
                          <p className="text-sm text-muted">Leaving for good? Replace their name and email everywhere; the work they did stays.</p>
                          <Checkbox name="confirm" label="Yes, remove their personal details" />
                          <SubmitButton size="sm" variant="danger">
                            Remove personal details
                          </SubmitButton>
                        </form>
                      ) : null}
                    </Card>
                  </details>
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
      <Panel title="Add a person">
        <PersonForm teams={teams} />
      </Panel>
    </div>
  );
}

function Teams({ teams }: { teams: Team[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Table>
        <thead>
          <tr>
            <Th>Team</Th>
            <Th>Members</Th>
            <Th>Note</Th>
          </tr>
        </thead>
        <tbody>
          {teams.map((t) => (
            <Tr key={t.id}>
              <Td>
                <form action={saveTeamAction} className="flex gap-2">
                  <input type="hidden" name="id" value={t.id} />
                  <label htmlFor={`t-${t.id}`} className="sr-only">
                    Team name
                  </label>
                  <input id={`t-${t.id}`} name="name" defaultValue={t.name} required className="control w-48" />
                  <SubmitButton size="sm" variant="secondary">
                    Rename
                  </SubmitButton>
                  <SubmitButton size="sm" variant="subtle" name="op" value="delete">
                    Delete
                  </SubmitButton>
                </form>
              </Td>
              <Td className="text-sm">{t.members}</Td>
              <Td className="text-sm text-muted">{t.name === "CAB" ? "Approves normal and emergency changes" : ""}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <Panel title="Add a team">
        <form action={saveTeamAction} className="space-y-3">
          <TextField id="team-new" name="name" label="Name" required />
          <p className="text-xs text-muted">Members of the team named “CAB” approve changes. Put people in teams from the People tab.</p>
          <SubmitButton size="sm">Add team</SubmitButton>
        </form>
      </Panel>
    </div>
  );
}

function TypeForm({ rt, teams, people }: { rt?: RequestType; teams: Team[]; people: { id: string; name: string }[] }) {
  const p = rt ? `rt-${rt.id.slice(0, 8)}` : "rt-new";
  const lines = rt
    ? parseJson<FieldDef[]>(rt.fields_json, [])
        .map((f) => [f.label, KIND_WORD[f.type], f.required ? "required" : "", (f.options ?? []).join(", ")].join(" | ").replace(/( \| )+$/, ""))
        .join("\n")
    : "";
  const teamOpts = teams.map((t) => ({ value: t.id, label: t.name }));
  return (
    <form action={saveTypeAction} className="space-y-3">
      {rt ? <input type="hidden" name="id" value={rt.id} /> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <TextField id={`${p}-name`} name="name" label="Name" required defaultValue={rt?.name} />
        <SelectField id={`${p}-cat`} name="category" label="Becomes a" defaultValue={rt?.category ?? "service_request"} options={CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))} />
        <TextField id={`${p}-group`} name="group" label="Help center group" defaultValue={rt?.group_name ?? "General"} />
        <SelectField id={`${p}-icon`} name="icon" label="Icon" defaultValue={rt?.icon ?? "help"} options={ICON_NAMES.map((n) => ({ value: n, label: n }))} />
        <SelectField id={`${p}-team`} name="teamId" label="Goes to team" placeholder="None" defaultValue={rt?.team_id ?? ""} options={teamOpts} />
        <SelectField id={`${p}-appr`} name="approverId" label="Approved by (requests)" placeholder="No approval" defaultValue={rt?.approver_id ?? ""} options={people.map((x) => ({ value: x.id, label: x.name }))} />
        <SelectField id={`${p}-only`} name="restrictedTeamId" label="Only these people can ask" placeholder="Everyone" defaultValue={rt?.restricted_team_id ?? ""} options={teamOpts} />
      </div>
      <TextField id={`${p}-desc`} name="description" label="One-line description" defaultValue={rt?.description} />
      <TextArea
        id={`${p}-fields`}
        name="fields"
        label="Extra questions"
        defaultValue={lines}
        placeholder={"What do you need? | list | required | Laptop, Screen\nWhat is it for? | long text | required\nFirst day | date"}
        hint="One per line: question | text, long text, list or date | required | choices for a list."
        className="[&_textarea]:font-mono [&_textarea]:text-sm"
      />
      <Checkbox name="portal" defaultChecked={rt ? !!rt.portal_visible : true} label="Show in the help center" />
      <div className="flex gap-2">
        <SubmitButton size="sm">{rt ? "Save" : "Add"}</SubmitButton>
        {rt ? (
          <SubmitButton size="sm" variant="subtle" name="op" value="delete">
            Remove
          </SubmitButton>
        ) : null}
      </div>
    </form>
  );
}

function Types({ teams }: { teams: Team[] }) {
  const types = all<RequestType>("select * from request_types order by position");
  const people = all<{ id: string; name: string }>("select id, name from users where active = 1 and system = 0 order by name");
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
      <div className="space-y-3">
        {types.map((rt) => (
          <details key={rt.id} className="rounded-lg border border-line bg-canvas p-4">
            <summary className="cursor-pointer">
              <strong>{rt.name}</strong>{" "}
              <span className="text-sm text-muted">
                · {CATEGORY_LABEL[rt.category]} · {rt.group_name}
                {rt.portal_visible ? "" : " · IT team only"}
                {rt.approver_id ? " · needs approval" : ""}
                {rt.restricted_team_id ? " · restricted" : ""}
              </span>
            </summary>
            <div className="mt-4">
              <TypeForm rt={rt} teams={teams} people={people} />
            </div>
          </details>
        ))}
      </div>
      <Panel title="Add something people can ask for">
        <TypeForm teams={teams} people={people} />
      </Panel>
    </div>
  );
}

function Slas() {
  const slas = all<Sla>("select * from slas order by position");
  const cals = all<SlaCalendar>("select * from sla_calendars order by always_on desc, name");
  return (
    <div className="space-y-6">
      {slas.map((sla) => {
        const goals = parseJson<SlaGoal[]>(sla.goals_json, []);
        const rows = [...goals, { category: null, priority: null, minutes: 0, calendar_id: cals[0]?.id ?? "" }];
        return (
          <form key={sla.id} action={saveGoalsAction}>
            <input type="hidden" name="slaId" value={sla.id} />
            <input type="hidden" name="rows" value={rows.length} />
            <Panel
              title={sla.name}
              actions={
                <div className="flex items-center gap-3">
                  <Checkbox name="enabled" defaultChecked={!!sla.enabled} label="On" />
                  <SubmitButton size="sm">Save goals</SubmitButton>
                </div>
              }
            >
              <TextField id={`sla-name-${sla.id.slice(0, 8)}`} name="name" label="Name" required maxLength={80} defaultValue={sla.name} className="mb-3 max-w-sm" />
              <p className="mb-3 text-sm text-muted">
                {sla.metric === "first_response"
                  ? "Starts when work is raised; stops at the first reply from the IT team the requester can see, or when it's done."
                  : "Starts when work is raised; pauses while waiting on the requester, an approval or someone outside; stops when it's done."}
              </p>
              <Table>
                <thead>
                  <tr>
                    <Th>Kind of work</Th>
                    <Th>Priority</Th>
                    <Th>Goal (minutes)</Th>
                    <Th>Counted on</Th>
                    <Th>Remove</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((g, n) => (
                    <Tr key={n}>
                      <Td>
                        <select name={`g${n}_category`} aria-label="Kind of work" defaultValue={g.category ?? ""} className="control">
                          <option value="">Any</option>
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {CATEGORY_LABEL[c]}
                            </option>
                          ))}
                        </select>
                      </Td>
                      <Td>
                        <select name={`g${n}_priority`} aria-label="Priority" defaultValue={g.priority ?? ""} className="control">
                          <option value="">Any</option>
                          {[1, 2, 3, 4, 5].map((p) => (
                            <option key={p} value={p}>
                              {PRIORITY_LABEL[p]}
                            </option>
                          ))}
                        </select>
                      </Td>
                      <Td>
                        <input name={`g${n}_minutes`} type="number" min={1} aria-label="Goal in minutes" defaultValue={g.minutes || ""} placeholder={n === goals.length ? "Add a goal" : undefined} className="control w-32" />
                      </Td>
                      <Td>
                        <select name={`g${n}_calendar`} aria-label="Calendar" defaultValue={g.calendar_id} className="control">
                          {cals.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </Td>
                      <Td>{n < goals.length ? <input type="checkbox" name={`g${n}_drop`} aria-label="Remove this goal" className="size-4 accent-[var(--accent)]" /> : null}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
              <p className="mt-2 text-xs text-muted">Checked from the top; the first goal that matches the kind of work and priority applies.</p>
            </Panel>
          </form>
        );
      })}
      <h2 className="text-lg">Calendars</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        {cals.map((c) =>
          c.always_on ? (
            <Card key={c.id}>
              <strong>{c.name}</strong>
              <p className="text-sm text-muted">Every hour of every day counts.</p>
            </Card>
          ) : (
            <form key={c.id} action={saveCalendarAction}>
              <input type="hidden" name="id" value={c.id} />
              <Panel title={c.name} actions={<SubmitButton size="sm">Save</SubmitButton>}>
                <div className="space-y-3">
                  <fieldset className="flex flex-wrap gap-3">
                    <legend className="mb-1 text-sm font-semibold">Working days</legend>
                    {DAYS.map((d, n) => (
                      <Checkbox key={d} name="days" value={n} defaultChecked={parseJson<number[]>(c.days_json, []).includes(n)} label={d} />
                    ))}
                  </fieldset>
                  <div className="grid grid-cols-3 gap-2">
                    <TextField id={`cs-${c.id}`} name="start" label="From" pattern="\d{1,2}:\d{2}" defaultValue={hhmm(c.start_minute)} />
                    <TextField id={`ce-${c.id}`} name="end" label="Until" pattern="\d{1,2}:\d{2}" defaultValue={hhmm(c.end_minute)} />
                    <TextField id={`co-${c.id}`} name="offset" type="number" label="UTC offset (min)" defaultValue={c.utc_offset_minutes} hint="Change it when the clocks change." />
                  </div>
                  <TextArea id={`ch-${c.id}`} name="holidays" label="Holidays (YYYY-MM-DD, one per line or comma separated)" defaultValue={parseJson<string[]>(c.holidays_json, []).join("\n")} />
                </div>
              </Panel>
            </form>
          ),
        )}
      </div>
    </div>
  );
}

function Replies() {
  const replies = all<{ id: string; title: string; body: string }>("select id, title, body from canned_responses order by title");
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {replies.map((r) => (
        <form key={r.id} action={saveCannedAction}>
          <input type="hidden" name="id" value={r.id} />
          <Card className="space-y-3">
            <TextField id={`rt-${r.id}`} name="title" label="Title" required defaultValue={r.title} />
            <TextArea id={`rb-${r.id}`} name="body" label="Text" required defaultValue={r.body} />
            <div className="flex gap-2">
              <SubmitButton size="sm">Save</SubmitButton>
              <SubmitButton size="sm" variant="subtle" name="op" value="delete">
                Delete
              </SubmitButton>
            </div>
          </Card>
        </form>
      ))}
      <form action={saveCannedAction}>
        <Card className="space-y-3">
          <strong>New saved reply</strong>
          <TextField id="rt-new" name="title" label="Title" required />
          <TextArea id="rb-new" name="body" label="Text" required />
          <SubmitButton size="sm">Add</SubmitButton>
        </Card>
      </form>
    </div>
  );
}

function EmailAndJobs() {
  const mail = all<{ id: string; to_email: string; subject: string; status: string; attempts: number; last_error: string; created_at: number }>(
    "select id, to_email, subject, status, attempts, last_error, created_at from outbox where status != 'sent' order by created_at desc limit 50",
  );
  const counts = all<{ status: string; n: number }>("select status, count(*) as n from outbox group by status");
  const runs = all<{ job: string; ok: number; detail: string; started_at: number }>(
    "select job, ok, detail, max(started_at) as started_at from job_runs group by job order by job",
  );
  const held = counts.find((c) => c.status === "held")?.n ?? 0;
  return (
    <div className="space-y-6">
      <Panel title="Email">
        <div className="space-y-3 text-sm">
          <p>
            {mailConfigured()
              ? "Sending through Resend from the address in MAIL_FROM."
              : "Not set up: emails are kept here instead of sent. Add RESEND_API_KEY and MAIL_FROM to .env.local and restart."}
          </p>
          <p className="text-muted">{counts.map((c) => `${c.n} ${c.status}`).join(" · ") || "No emails yet."}</p>
          {held && mailConfigured() ? (
            <form action={releaseHeldAction}>
              <SubmitButton size="sm" variant="secondary">
                Send the {held} held email{held === 1 ? "" : "s"} now
              </SubmitButton>
            </form>
          ) : null}
        </div>
      </Panel>
      {mail.length ? (
        <Table>
          <thead>
            <tr>
              <Th>To</Th>
              <Th>Subject</Th>
              <Th>State</Th>
              <Th>Tries</Th>
              <Th>Queued</Th>
            </tr>
          </thead>
          <tbody>
            {mail.map((m) => (
              <Tr key={m.id}>
                <Td className="text-sm">{m.to_email}</Td>
                <Td className="text-sm">{m.subject}</Td>
                <Td>
                  <Lozenge tone={m.status === "failed" ? "bad" : m.status === "held" ? "warning" : "todo"}>{m.status}</Lozenge>
                  {m.last_error ? <span className="block text-xs text-danger">{m.last_error}</span> : null}
                </Td>
                <Td className="text-sm">
                  {m.attempts} of {MAX_ATTEMPTS}
                </Td>
                <Td className="whitespace-nowrap text-sm text-muted">{ago(m.created_at)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      ) : null}
      <Panel title="Background jobs">
        <p className="mb-3 text-sm text-muted">Run every minute: SLA warnings, alert escalation, email, and tidying old records.</p>
        {runs.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Job</Th>
                <Th>Last run</Th>
                <Th>Result</Th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <Tr key={r.job}>
                  <Td className="font-mono text-sm">{r.job}</Td>
                  <Td className="text-sm" title={dateTime(r.started_at)}>
                    {ago(r.started_at)}
                  </Td>
                  <Td className={r.ok ? "text-sm" : "text-sm text-danger"}>{r.detail}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className="text-sm text-danger">No job has run yet. The worker starts a few seconds after the app does.</p>
        )}
      </Panel>
    </div>
  );
}
