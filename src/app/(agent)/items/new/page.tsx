import { createWorkAction } from "@/app/actions/items";
import { CustomFields } from "@/components/CustomFields";
import { Banners, Card, LinkButton, PageHead, TabLinks } from "@/components/ui";
import { Checkbox, SelectField, TextArea, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { requireAgent } from "@/lib/auth";
import { all, parseJson } from "@/lib/db";
import { IMPACT_LABEL, PRIORITY_LABEL, URGENCY_LABEL, priorityFrom } from "@/lib/priority";
import type { FieldDef, RequestType } from "@/lib/types";
import { CATEGORIES, CATEGORY_LABEL, isCategory } from "@/lib/workflows";

export const metadata = { title: "Raise work" };

export default async function RaiseWork({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAgent();
  const sp = await searchParams;
  const category = isCategory(sp.category) ? sp.category : "incident";
  const types = all<RequestType>("select * from request_types where category = ? order by position", category);
  const rt = types.find((t) => t.id === sp.type) ?? types[0];
  const teams = all<{ id: string; name: string }>("select id, name from teams order by name");
  const agents = all<{ id: string; name: string }>("select id, name from users where role != 'employee' and active = 1 and system = 0 order by name");
  const services = all<{ id: string; name: string }>("select id, name from services order by name");
  const assets = all<{ id: string; label: string; type: string }>("select o.id, o.label, t.name as type from asset_objects o join asset_types t on t.id = o.type_id order by t.name, o.label");
  const carry = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    for (const k of ["linkFrom", "linkType", "summary"]) if (sp[k]) p.set(k, sp[k]!);
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    return `/items/new?${p}`;
  };
  const opts = (values: string[]) => values.map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }));
  return (
    <div className="max-w-3xl">
      <Banners sp={sp} />
      <PageHead title="Raise work" intro={sp.linkFrom ? `It will be linked to ${sp.linkFrom}.` : "For someone else, or for the team."} />
      <TabLinks label="Kind of work" current={category} tabs={CATEGORIES.map((c) => ({ key: c, label: CATEGORY_LABEL[c], href: carry({ category: c }) }))} />
      {types.length > 1 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted">Form:</span>
          {types.map((t) => (
            <LinkButton key={t.id} size="sm" variant={t.id === rt?.id ? "primary" : "secondary"} href={carry({ category, type: t.id })}>
              {t.name}
            </LinkButton>
          ))}
        </div>
      ) : null}
      <Card>
        <form action={createWorkAction} className="space-y-4">
          <input type="hidden" name="category" value={category} />
          {rt ? <input type="hidden" name="typeId" value={rt.id} /> : null}
          {sp.linkFrom ? <input type="hidden" name="linkFrom" value={sp.linkFrom} /> : null}
          {sp.linkType ? <input type="hidden" name="linkType" value={sp.linkType} /> : null}
          <TextField id="summary" name="summary" label="Summary" required maxLength={200} defaultValue={sp.summary ?? ""} />
          <TextArea id="description" name="description" label="Description" />
          <CustomFields fields={rt ? parseJson<FieldDef[]>(rt.fields_json, []) : []} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField id="reporterEmail" name="reporterEmail" type="email" label="On behalf of (email)" hint="Leave empty to raise it as yourself." />
            <SelectField id="teamId" name="teamId" label="Team" placeholder="No team" defaultValue={rt?.team_id ?? ""} options={teams.map((t) => ({ value: t.id, label: t.name }))} />
            <SelectField id="assigneeId" name="assigneeId" label="Assignee" placeholder="Nobody yet" options={agents.map((a) => ({ value: a.id, label: a.name }))} />
            <SelectField
              id="priority"
              name="priority"
              label="Priority"
              placeholder={category === "incident" ? "Work it out from impact and urgency" : "P3 Medium"}
              options={[1, 2, 3, 4, 5].map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))}
            />
            {category === "incident" ? (
              <>
                <SelectField id="impact" name="impact" label="Impact" defaultValue="3" options={[1, 2, 3, 4].map((v) => ({ value: v, label: IMPACT_LABEL[v] }))} />
                <SelectField id="urgency" name="urgency" label="Urgency" defaultValue="3" options={[1, 2, 3, 4].map((v) => ({ value: v, label: URGENCY_LABEL[v] }))} />
              </>
            ) : null}
          </div>
          {category === "incident" ? (
            <>
              <details>
                <summary className="cursor-pointer text-sm text-accent">How priority is worked out</summary>
                <div className="mt-2">
                  <Table>
                    <thead>
                      <tr>
                        <Th>Impact ↓ / urgency →</Th>
                        {[1, 2, 3, 4].map((u) => (
                          <Th key={u}>{URGENCY_LABEL[u]}</Th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[1, 2, 3, 4].map((i) => (
                        <Tr key={i}>
                          <Td>{IMPACT_LABEL[i]}</Td>
                          {[1, 2, 3, 4].map((u) => (
                            <Td key={u}>P{priorityFrom(i, u)}</Td>
                          ))}
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </details>
              <Checkbox name="isMajor" label="This is a major incident" />
            </>
          ) : null}
          {category === "change" ? (
            <fieldset className="space-y-4 rounded-lg border border-line p-3">
              <legend className="px-1 text-sm font-semibold">The change</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  id="changeType"
                  name="changeType"
                  label="Type"
                  defaultValue="normal"
                  options={[
                    { value: "standard", label: "Standard: routine, already approved" },
                    { value: "normal", label: "Normal: a teammate, then the CAB" },
                    { value: "emergency", label: "Emergency: fast-tracked, one CAB member" },
                  ]}
                />
                <SelectField id="changeRisk" name="changeRisk" label="Risk" defaultValue="low" options={opts(["low", "medium", "high", "critical"])} />
                <TextField id="plannedStart" name="plannedStart" type="datetime-local" label="Window starts" />
                <TextField id="plannedEnd" name="plannedEnd" type="datetime-local" label="Window ends" />
              </div>
              <TextArea id="planImplementation" name="planImplementation" label="How it will be done" />
              <TextArea id="planBackout" name="planBackout" label="How to undo it" />
              <TextArea id="planTest" name="planTest" label="How we'll know it worked" />
            </fieldset>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col">
              <label htmlFor="serviceIds" className="mb-1 text-sm font-semibold">
                Affected services
              </label>
              <select id="serviceIds" name="serviceIds" multiple size={5} className="control" aria-describedby="multi-hint">
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col">
              <label htmlFor="assetIds" className="mb-1 text-sm font-semibold">
                Assets
              </label>
              <select id="assetIds" name="assetIds" multiple size={5} className="control" aria-describedby="multi-hint">
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.type}: {a.label}
                  </option>
                ))}
              </select>
            </div>
            <p id="multi-hint" className="text-xs text-muted sm:col-span-2">
              Hold Ctrl (Cmd on a Mac) to pick more than one.
            </p>
          </div>
          <SubmitButton>Raise {CATEGORY_LABEL[category].toLowerCase()}</SubmitButton>
        </form>
      </Card>
    </div>
  );
}
