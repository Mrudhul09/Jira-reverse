import Link from "next/link";
import { ruleAction, saveRuleAction } from "@/app/actions/admin";
import { Banners, Card, EmptyState, PageHead, Panel } from "@/components/ui";
import { Checkbox, SelectField, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { isAdmin } from "@/lib/access";
import { requireAgent } from "@/lib/auth";
import { TRIGGERS, type Action, type Conditions, type Rule } from "@/lib/automation";
import { all, parseJson } from "@/lib/db";
import { ago } from "@/lib/format";
import { ALL_STATUSES, CATEGORIES, CATEGORY_LABEL } from "@/lib/workflows";

export const metadata = { title: "Automation" };

const STEP_LABELS: [string, string][] = [
  ["assign_team", "Give it to a team"],
  ["assign_user", "Give it to a person"],
  ["set_priority", "Set the priority"],
  ["comment", "Add a message"],
  ["move", "Move it to a status"],
  ["mark_major", "Make it a major incident"],
  ["notify_user", "Tell a person"],
  ["page_oncall", "Tell whoever is on call"],
  ["open_incident", "Open an incident (alerts only)"],
];

export default async function Automation({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireAgent();
  const rules = all<Rule>("select * from automation_rules order by position, created_at");
  const log = all<{ id: string; rule: string; item_key: string | null; ok: number; result: string; created_at: number }>(
    "select l.id, r.name as rule, i.key as item_key, l.ok, l.result, l.created_at from automation_log l join automation_rules r on r.id = l.rule_id left join items i on i.id = l.item_id order by l.created_at desc limit 30",
  );
  const teams = all<{ id: string; name: string }>("select id, name from teams order by name");
  const people = all<{ id: string; name: string }>("select id, name from users where active = 1 and system = 0 order by name");
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const personName = new Map(people.map((p) => [p.id, p.name]));
  const when = (c: Conditions) =>
    [
      c.categories?.map((x) => CATEGORY_LABEL[x]).join(" or "),
      c.priorities?.length ? c.priorities.map((p) => `P${p}`).join("/") : "",
      c.status ? `status is ${c.status}` : "",
      c.textContains ? `mentions “${c.textContains}”` : "",
      c.noTeam ? "no team yet" : "",
    ]
      .filter(Boolean)
      .join(", ") || "every time";
  const step = (a: Action) => {
    switch (a.type) {
      case "assign_team":
        return `give to ${teamName.get(a.teamId) ?? "a deleted team"}`;
      case "assign_user":
        return `give to ${personName.get(a.userId) ?? "someone who left"}`;
      case "set_priority":
        return `set P${a.priority}`;
      case "comment":
        return a.internal ? "add an internal note" : "reply to the requester";
      case "move":
        return `move to ${a.status}`;
      case "mark_major":
        return "make it major";
      case "notify_user":
        return `tell ${personName.get(a.userId) ?? "someone who left"}`;
      case "page_oncall":
        return "tell whoever is on call";
      case "open_incident":
        return "open an incident";
    }
  };
  return (
    <>
      <Banners sp={await searchParams} />
      <PageHead title="Automation" intro="When something happens and it matches, do these steps. Rules run in order and never set each other off." />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-5">
          {rules.length ? (
            <Table>
              <thead>
                <tr>
                  <Th>Rule</Th>
                  <Th>When</Th>
                  <Th>If</Th>
                  <Th>Then</Th>
                  <Th>Ran</Th>
                  {isAdmin(user) ? (
                    <Th>
                      <span className="sr-only">Actions</span>
                    </Th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <Tr key={r.id} className={r.enabled ? undefined : "opacity-60"}>
                    <Td>
                      <strong>{r.name}</strong>
                      {r.enabled ? null : <span className="block text-xs text-muted">Switched off</span>}
                    </Td>
                    <Td className="text-sm">{TRIGGERS[r.trigger]}</Td>
                    <Td className="text-sm">{when(parseJson<Conditions>(r.conditions_json, {}))}</Td>
                    <Td className="text-sm">{parseJson<Action[]>(r.actions_json, []).map(step).join(", then ")}</Td>
                    <Td className="text-sm">{r.runs}×</Td>
                    {isAdmin(user) ? (
                      <Td>
                        <form action={ruleAction} className="flex gap-1.5">
                          <input type="hidden" name="id" value={r.id} />
                          <SubmitButton size="sm" variant="secondary" name="op" value="toggle">
                            {r.enabled ? "Switch off" : "Switch on"}
                          </SubmitButton>
                          <SubmitButton size="sm" variant="subtle" name="op" value="delete">
                            Delete
                          </SubmitButton>
                        </form>
                      </Td>
                    ) : null}
                  </Tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <Card>
              <EmptyState title="No rules yet" />
            </Card>
          )}
          <h2 className="text-lg">What the rules did</h2>
          {log.length ? (
            <Table>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Rule</Th>
                  <Th>Work</Th>
                  <Th>Result</Th>
                </tr>
              </thead>
              <tbody>
                {log.map((l) => (
                  <Tr key={l.id}>
                    <Td className="whitespace-nowrap text-sm text-muted">{ago(l.created_at)}</Td>
                    <Td className="text-sm">{l.rule}</Td>
                    <Td className="whitespace-nowrap font-mono text-sm">{l.item_key ? <Link href={`/items/${l.item_key}`}>{l.item_key}</Link> : "-"}</Td>
                    <Td className={l.ok ? "text-sm text-muted" : "text-sm text-danger"}>{l.result}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <p className="text-muted">No rule has run yet.</p>
          )}
        </div>
        {isAdmin(user) ? (
          <Panel title="New rule">
            <form action={saveRuleAction} className="space-y-3">
              <TextField id="rname" name="name" label="Name" required maxLength={120} />
              <SelectField id="trigger" name="trigger" label="When" options={Object.entries(TRIGGERS).map(([v, l]) => ({ value: v, label: l }))} />
              <fieldset className="space-y-2 rounded-lg border border-line p-3">
                <legend className="px-1 text-sm font-semibold">If (all must match)</legend>
                <div className="flex flex-wrap gap-3">
                  {CATEGORIES.map((c) => (
                    <Checkbox key={c} name="categories" value={c} label={CATEGORY_LABEL[c]} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-3">
                  {[1, 2, 3, 4, 5].map((p) => (
                    <Checkbox key={p} name="priorities" value={p} label={`P${p}`} />
                  ))}
                </div>
                <SelectField id="rstatus" name="status" label="Status is (for status changes)" placeholder="Any" options={ALL_STATUSES.map((s) => ({ value: s, label: s }))} />
                <TextField id="rtext" name="textContains" label="Mentions" placeholder="e.g. password" />
                <Checkbox name="noTeam" label="No team set yet" />
              </fieldset>
              {[1, 2, 3].map((n) => (
                <fieldset key={n} className="space-y-2 rounded-lg border border-line p-3">
                  <legend className="px-1 text-sm font-semibold">Then, step {n}</legend>
                  <SelectField id={`a${n}`} name={`a${n}`} label="Do" placeholder={n === 1 ? undefined : "Nothing"} defaultValue={n === 1 ? "assign_team" : ""} options={STEP_LABELS.map(([v, l]) => ({ value: v, label: l }))} />
                  <div className="grid grid-cols-2 gap-2">
                    <SelectField id={`a${n}_team`} name={`a${n}_team`} label="Team" placeholder="-" options={teams.map((t) => ({ value: t.id, label: t.name }))} />
                    <SelectField id={`a${n}_user`} name={`a${n}_user`} label="Person" placeholder="-" options={people.map((p) => ({ value: p.id, label: p.name }))} />
                    <SelectField id={`a${n}_priority`} name={`a${n}_priority`} label="Priority" placeholder="-" options={[1, 2, 3, 4, 5].map((p) => ({ value: p, label: `P${p}` }))} />
                    <SelectField id={`a${n}_status`} name={`a${n}_status`} label="Status" placeholder="-" options={ALL_STATUSES.map((s) => ({ value: s, label: s }))} />
                  </div>
                  <TextField id={`a${n}_text`} name={`a${n}_text`} label="Message" />
                  <Checkbox name={`a${n}_internal`} label="Internal note, not a reply" />
                </fieldset>
              ))}
              <p className="text-xs text-muted">Only fill in what the chosen step needs.</p>
              <SubmitButton>Add rule</SubmitButton>
            </form>
          </Panel>
        ) : (
          <Card sunken className="text-sm text-muted">
            Only admins can change rules.
          </Card>
        )}
      </div>
    </>
  );
}
