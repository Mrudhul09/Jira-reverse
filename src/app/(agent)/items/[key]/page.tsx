import { X } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { articleFromItemAction, decideAction, editAction, linkAction, moveAction, peopleAction, relateAction, unlinkAction } from "@/app/actions/items";
import { Activity } from "@/components/Activity";
import { CommentBox } from "@/components/CommentBox";
import { FieldValues } from "@/components/CustomFields";
import { MajorTag, Status } from "@/components/work";
import { Banner, Banners, Button, Kv, LinkButton, Lozenge, Panel, Person, PriorityMark, TabLinks } from "@/components/ui";
import { Checkbox, SelectField, TextArea } from "@/components/ui/field";
import { SlaBadge } from "@/components/ui/sla-badge";
import { SubmitButton } from "@/components/ui/submit";
import { Table, Td, Tr } from "@/components/ui/table";
import { requireAgent } from "@/lib/auth";
import { all, get, parseJson } from "@/lib/db";
import { ago, dateTime, localInput } from "@/lib/format";
import { LINK_TYPES, approvals, comments, getItemByKey, history, links } from "@/lib/items";
import { IMPACT_LABEL, PRIORITY_LABEL, URGENCY_LABEL } from "@/lib/priority";
import { slaStatesFor } from "@/lib/sla";
import type { FieldDef } from "@/lib/types";
import { CATEGORY_LABEL, CATEGORY_PATH, WORKFLOWS, isDone, nextStatuses } from "@/lib/workflows";

type Show = "comments" | "all" | "history";

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }) {
  return { title: (await params).key.toUpperCase() };
}

function Section({ itemId, field, label, value, page, empty }: { itemId: string; field: string; label: string; value: string; page: string; empty?: string }) {
  return (
    <section className="space-y-1.5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{label}</h2>
      {value ? <p className="prose-plain">{value}</p> : <p className="text-muted">{empty ?? "Not written yet."}</p>}
      <details>
        <summary className="cursor-pointer text-sm text-accent">Edit {label.toLowerCase()}</summary>
        <form action={editAction} className="mt-2 space-y-2">
          <input type="hidden" name="itemId" value={itemId} />
          <input type="hidden" name="returnTo" value={page} />
          <input type="hidden" name="fields" value={field} />
          <TextArea id={`${field}-edit`} name={field} label={label} defaultValue={value} className="[&_label]:sr-only" />
          <SubmitButton size="sm">Save</SubmitButton>
        </form>
      </details>
    </section>
  );
}

function RemoveButton({ label }: { label: string }) {
  return (
    <button aria-label={label} className="rounded p-1 text-muted hover:bg-sunken hover:text-fg">
      <X aria-hidden="true" className="size-3.5" />
    </button>
  );
}

export default async function WorkItem({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireAgent();
  const item = getItemByKey((await params).key);
  if (!item) notFound();
  const sp = await searchParams;
  const page = `/items/${item.key}`;
  const show: Show = sp.show === "all" || sp.show === "history" ? sp.show : "comments";
  const flow = WORKFLOWS[item.category];
  const moves = nextStatuses(item.category, item.status, item.change_type);
  const decisions = approvals(item.id);
  const mine = decisions.find((a) => a.approver_id === user.id && a.decision === "pending");
  const slas = slaStatesFor([item]).get(item.id) ?? [];
  const agents = all<{ id: string; name: string }>("select id, name from users where role != 'employee' and active = 1 and system = 0 order by name");
  const people = all<{ id: string; name: string }>("select id, name from users where active = 1 and system = 0 order by name");
  const teams = all<{ id: string; name: string }>("select id, name from teams order by name");
  const canned = all<{ id: string; title: string; body: string }>("select id, title, body from canned_responses order by title");
  const itemServices = all<{ id: string; name: string; tier: number }>("select s.id, s.name, s.tier from item_services x join services s on s.id = x.service_id where x.item_id = ? order by s.name", item.id);
  const allServices = all<{ id: string; name: string }>("select id, name from services order by name");
  const itemAssets = all<{ id: string; label: string; type: string }>(
    "select o.id, o.label, t.name as type from item_assets x join asset_objects o on o.id = x.asset_id join asset_types t on t.id = o.type_id where x.item_id = ? order by o.label",
    item.id,
  );
  const allAssets = all<{ id: string; label: string; type: string }>("select o.id, o.label, t.name as type from asset_objects o join asset_types t on t.id = o.type_id order by t.name, o.label");
  const involved = all<{ user_id: string; name: string; kind: string }>("select p.user_id, u.name, p.kind from item_people p join users u on u.id = p.user_id where p.item_id = ? order by p.kind, u.name", item.id);
  const fields = item.request_type_id ? parseJson<FieldDef[]>(get<{ f: string }>("select fields_json as f from request_types where id = ?", item.request_type_id)?.f, []) : [];
  const pir = item.category === "incident" ? get<{ status: string }>("select status from pirs where incident_id = ?", item.id) : undefined;
  const rating = get<{ score: number; comment: string }>("select score, comment from csat where item_id = ?", item.id);
  const itemAlerts = all<{ number: number; message: string; status: string }>("select number, message, status from alerts where incident_id = ? order by number", item.id);
  const article = get<{ id: string; title: string }>("select id, title from articles where source_item_id = ?", item.id);
  const waitStatus = moves.find((s) => s === "Waiting for customer" || s === "Pending") ?? null;
  const clashes =
    item.category === "change" && item.planned_start && item.planned_end
      ? all<{ key: string }>(
          "select key from items where category = 'change' and id != ? and planned_start < ? and planned_end > ? and status not in ('Completed','Failed','Declined','Canceled')",
          item.id,
          item.planned_end,
          item.planned_start,
        )
      : [];
  const isIncident = item.category === "incident";
  const isChange = item.category === "change";
  const detailFields = ["assignee_id", "team_id", "priority", isIncident || item.impact ? "impact,urgency" : "", isIncident ? "is_major" : "", isChange ? "change_type,change_risk,planned_start,planned_end" : ""]
    .filter(Boolean)
    .join(",");

  return (
    <>
      <Banners sp={sp} />
      <p className="mb-1.5 text-sm text-muted">
        <Link href={CATEGORY_PATH[item.category]}>{CATEGORY_LABEL[item.category]}s</Link> / <span className="font-mono">{item.key}</span>
        {item.request_type_name ? ` · ${item.request_type_name}` : ""}
      </p>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl">
            {item.summary}
            {item.is_major ? <MajorTag /> : null}
          </h1>
          <p className="mt-1 text-muted">
            Raised by {item.reporter_name} {ago(item.created_at)}
            {item.resolved_at ? ` · done ${ago(item.resolved_at)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Status category={item.category} status={item.status} />
          {moves.map((to) => (
            <form key={to} action={moveAction}>
              <input type="hidden" name="itemId" value={item.id} />
              <input type="hidden" name="to" value={to} />
              <SubmitButton size="sm" variant={isDone(item.category, to) && to !== "Canceled" ? "primary" : "secondary"}>
                {to}
              </SubmitButton>
            </form>
          ))}
          {flow.approval && item.status === flow.approval.status ? <span className="text-sm text-muted">Waiting for approvers</span> : null}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Section itemId={item.id} field="description" label="Description" value={item.description} page={page} empty="No description." />
          {fields.length ? (
            <section className="space-y-1.5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Details from the form</h2>
              <FieldValues fields={fields} values={parseJson(item.fields_json, {})} />
            </section>
          ) : null}
          {item.category === "problem" ? (
            <>
              <Section itemId={item.id} field="workaround" label="Workaround" value={item.workaround} page={page} />
              <Section itemId={item.id} field="root_cause" label="Root cause" value={item.root_cause} page={page} />
            </>
          ) : null}
          {isChange ? (
            <>
              <Section itemId={item.id} field="plan_implementation" label="How it will be done" value={item.plan_implementation} page={page} />
              <Section itemId={item.id} field="plan_backout" label="How to undo it" value={item.plan_backout} page={page} />
              <Section itemId={item.id} field="plan_test" label="How we'll know it worked" value={item.plan_test} page={page} />
            </>
          ) : null}
          {item.category === "service_request" || isIncident ? <Section itemId={item.id} field="resolution" label="What fixed it" value={item.resolution} page={page} /> : null}

          <section className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Linked work</h2>
              <div className="flex gap-3 text-sm">
                {isIncident ? <Link href={`/items/new?category=problem&linkFrom=${item.key}&linkType=causes&summary=${encodeURIComponent(item.summary)}`}>Open a problem</Link> : null}
                {isIncident || item.category === "problem" ? (
                  <Link href={`/items/new?category=change&linkFrom=${item.key}&linkType=fixes&summary=${encodeURIComponent(`Fix: ${item.summary}`)}`}>Raise a change</Link>
                ) : null}
              </div>
            </div>
            {links(item.id).length ? (
              <Table>
                <tbody>
                  {links(item.id).map((l) => (
                    <Tr key={`${l.id}${l.direction}`}>
                      <Td className="w-32 text-sm text-muted">{LINK_TYPES[l.type]?.[l.direction] ?? l.type}</Td>
                      <Td className="font-mono text-sm">
                        <Link href={`/items/${l.other_key}`}>{l.other_key}</Link>
                      </Td>
                      <Td>{l.other_summary}</Td>
                      <Td>
                        <Status category={l.other_category} status={l.other_status} />
                      </Td>
                      <Td className="w-10">
                        <form action={unlinkAction}>
                          <input type="hidden" name="itemId" value={item.id} />
                          <input type="hidden" name="linkId" value={l.id} />
                          <RemoveButton label={`Remove link to ${l.other_key}`} />
                        </form>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <p className="text-muted">Nothing linked.</p>
            )}
            <form action={linkAction} className="flex flex-wrap gap-2">
              <input type="hidden" name="itemId" value={item.id} />
              <label htmlFor="link-type" className="sr-only">
                How they relate
              </label>
              <select id="link-type" name="type" className="control w-40" defaultValue="relates">
                {Object.entries(LINK_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.out}
                  </option>
                ))}
              </select>
              <label htmlFor="link-key" className="sr-only">
                Key
              </label>
              <input id="link-key" name="key" required placeholder="SH-12" className="control w-32" />
              <SubmitButton size="md" variant="secondary">
                Link
              </SubmitButton>
            </form>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{isIncident ? "Timeline" : "Activity"}</h2>
            <TabLinks
              label="Show"
              current={show}
              tabs={[
                { key: "comments", label: "Conversation", href: `${page}?show=comments` },
                { key: "all", label: "Everything", href: `${page}?show=all` },
                { key: "history", label: "Changes only", href: `${page}?show=history` },
              ]}
            />
            <CommentBox itemId={item.id} returnTo={`${page}?show=${show}`} agent canned={canned} waitStatus={waitStatus} backdate={isIncident} />
            <Activity comments={comments(item.id, true)} history={history(item.id)} show={show} />
          </section>
        </div>

        <aside className="space-y-4">
          {mine ? (
            <Panel title={`Your decision · ${mine.stage}`} className="border-accent">
              <form action={decideAction} className="space-y-2.5">
                <input type="hidden" name="approvalId" value={mine.id} />
                <input type="hidden" name="returnTo" value={page} />
                <TextArea id="decide-note" name="note" label="Note (optional)" />
                <div className="flex gap-2">
                  <SubmitButton name="decision" value="approved">
                    Approve
                  </SubmitButton>
                  <SubmitButton variant="danger" name="decision" value="declined">
                    Decline
                  </SubmitButton>
                </div>
              </form>
            </Panel>
          ) : null}

          <form action={editAction}>
            <input type="hidden" name="itemId" value={item.id} />
            <input type="hidden" name="returnTo" value={page} />
            <input type="hidden" name="fields" value={detailFields} />
            <Panel title="Details" actions={<SubmitButton size="sm">Save</SubmitButton>}>
              <div className="space-y-3">
                <SelectField id="assignee_id" name="assignee_id" label="Assignee" placeholder="Nobody" defaultValue={item.assignee_id ?? ""} options={agents.map((a) => ({ value: a.id, label: a.id === user.id ? `${a.name} (you)` : a.name }))} />
                <SelectField id="team_id" name="team_id" label="Team" placeholder="No team" defaultValue={item.team_id ?? ""} options={teams.map((t) => ({ value: t.id, label: t.name }))} />
                {isIncident || item.impact ? (
                  <div className="grid grid-cols-2 gap-2">
                    <SelectField id="impact" name="impact" label="Impact" placeholder="-" defaultValue={item.impact ?? ""} options={[1, 2, 3, 4].map((v) => ({ value: v, label: IMPACT_LABEL[v] }))} />
                    <SelectField id="urgency" name="urgency" label="Urgency" placeholder="-" defaultValue={item.urgency ?? ""} options={[1, 2, 3, 4].map((v) => ({ value: v, label: URGENCY_LABEL[v] }))} />
                  </div>
                ) : null}
                <SelectField
                  id="priority"
                  name="priority"
                  label="Priority"
                  defaultValue={item.priority}
                  options={[1, 2, 3, 4, 5].map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))}
                  hint={isIncident ? "Leave it and change impact or urgency to have it worked out for you." : undefined}
                />
                {isIncident ? <Checkbox name="is_major" defaultChecked={!!item.is_major} label="Major incident" /> : null}
                {isChange ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <SelectField id="change_type" name="change_type" label="Type" defaultValue={item.change_type ?? "normal"} options={["standard", "normal", "emergency"].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }))} />
                      <SelectField id="change_risk" name="change_risk" label="Risk" defaultValue={item.change_risk ?? "low"} options={["low", "medium", "high", "critical"].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }))} />
                    </div>
                    <div className="flex flex-col">
                      <label htmlFor="planned_start" className="mb-1 text-sm font-semibold">
                        Window starts
                      </label>
                      <input id="planned_start" name="planned_start" type="datetime-local" defaultValue={localInput(item.planned_start)} className="control" />
                    </div>
                    <div className="flex flex-col">
                      <label htmlFor="planned_end" className="mb-1 text-sm font-semibold">
                        Window ends
                      </label>
                      <input id="planned_end" name="planned_end" type="datetime-local" defaultValue={localInput(item.planned_end)} className="control" />
                    </div>
                    {clashes.length ? <Banner tone="info">Overlaps {clashes.map((c) => c.key).join(", ")} on the change calendar.</Banner> : null}
                  </>
                ) : null}
                <Kv
                  rows={[
                    ["Raised by", <Person key="r" name={item.reporter_name} />],
                    ["Priority now", <PriorityMark key="p" value={item.priority} />],
                    ["Updated", dateTime(item.updated_at)],
                  ]}
                />
              </div>
            </Panel>
          </form>

          {slas.length ? (
            <Panel title="Service levels">
              <ul className="space-y-2">
                {slas.map((s) => (
                  <li key={s.slaId} className="flex items-center justify-between gap-2 text-sm">
                    <span>{s.name}</span>
                    <SlaBadge sla={s} />
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          {decisions.length ? (
            <Panel title="Approvals">
              <ul className="space-y-2 text-sm">
                {decisions.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2" title={a.note || undefined}>
                    <span>
                      {a.approver_name} <span className="text-muted">· {a.stage}</span>
                    </span>
                    <Lozenge tone={a.decision === "approved" ? "done" : a.decision === "declined" ? "bad" : a.decision === "pending" ? "warning" : "todo"}>{a.decision}</Lozenge>
                  </li>
                ))}
              </ul>
              {isChange ? <p className="mt-2 text-xs text-muted">Peer review needs one teammate. The CAB review needs every CAB member. Emergency changes need any one CAB member.</p> : null}
            </Panel>
          ) : null}

          {isIncident ? (
            <Panel title="People">
              <ul className="mb-3 space-y-1.5 text-sm">
                {involved.length ? null : <li className="text-muted">Nobody added yet.</li>}
                {involved.map((p) => (
                  <li key={`${p.user_id}${p.kind}`}>
                    <form action={peopleAction} className="flex items-center justify-between gap-2">
                      <input type="hidden" name="itemId" value={item.id} />
                      <input type="hidden" name="userId" value={p.user_id} />
                      <input type="hidden" name="kind" value={p.kind} />
                      <input type="hidden" name="op" value="remove" />
                      <span>
                        {p.name} <span className="text-muted">· {p.kind}</span>
                      </span>
                      <RemoveButton label={`Remove ${p.name}`} />
                    </form>
                  </li>
                ))}
              </ul>
              <form action={peopleAction} className="flex gap-2">
                <input type="hidden" name="itemId" value={item.id} />
                <label htmlFor="person" className="sr-only">
                  Person
                </label>
                <select id="person" name="userId" required defaultValue="" className="control">
                  <option value="" disabled>
                    Add someone…
                  </option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <label htmlFor="kind" className="sr-only">
                  As
                </label>
                <select id="kind" name="kind" className="control w-32">
                  <option value="responder">Responder</option>
                  <option value="stakeholder">Kept informed</option>
                </select>
                <Button size="md">Add</Button>
              </form>
              {itemAlerts.length ? (
                <p className="mt-3 text-sm">
                  Alerts:{" "}
                  {itemAlerts.map((a) => (
                    <Link key={a.number} href="/alerts" className="mr-2">
                      #{a.number} ({a.status})
                    </Link>
                  ))}
                </p>
              ) : null}
              {isDone(item.category, item.status) || pir ? (
                <LinkButton href={`/pir/${item.key}`} size="sm" className="mt-3">
                  {pir ? `Post-incident review (${pir.status})` : "Write the post-incident review"}
                </LinkButton>
              ) : null}
            </Panel>
          ) : null}

          {[
            { kind: "service", title: "Affected services", rows: itemServices.map((s) => ({ id: s.id, label: s.name, sub: `tier ${s.tier}`, href: `/services/${s.id}` })), all: allServices.map((s) => ({ id: s.id, label: s.name })) },
            { kind: "asset", title: "Assets", rows: itemAssets.map((a) => ({ id: a.id, label: a.label, sub: a.type, href: `/assets/object/${a.id}` })), all: allAssets.map((a) => ({ id: a.id, label: `${a.type}: ${a.label}` })) },
          ].map((box) => (
            <Panel key={box.kind} title={box.title}>
              <ul className="mb-3 space-y-1.5 text-sm">
                {box.rows.length ? null : <li className="text-muted">None yet.</li>}
                {box.rows.map((r) => (
                  <li key={r.id}>
                    <form action={relateAction} className="flex items-center justify-between gap-2">
                      <input type="hidden" name="itemId" value={item.id} />
                      <input type="hidden" name="kind" value={box.kind} />
                      <input type="hidden" name="targetId" value={r.id} />
                      <input type="hidden" name="op" value="remove" />
                      <Link href={r.href}>
                        {r.label} <span className="text-muted">· {r.sub}</span>
                      </Link>
                      <RemoveButton label={`Remove ${r.label}`} />
                    </form>
                  </li>
                ))}
              </ul>
              <form action={relateAction} className="flex gap-2">
                <input type="hidden" name="itemId" value={item.id} />
                <input type="hidden" name="kind" value={box.kind} />
                <label htmlFor={`${box.kind}-pick`} className="sr-only">
                  {box.title}
                </label>
                <select id={`${box.kind}-pick`} name="targetId" required defaultValue="" className="control">
                  <option value="" disabled>
                    Add…
                  </option>
                  {box.all.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <Button size="md">Add</Button>
              </form>
            </Panel>
          ))}

          {item.category === "service_request" || isIncident ? (
            <Panel title="Knowledge">
              {article ? (
                <Link href={`/kb/${article.id}`}>Article: {article.title}</Link>
              ) : (
                <form action={articleFromItemAction} className="space-y-2">
                  <input type="hidden" name="itemId" value={item.id} />
                  <p className="text-sm text-muted">Will others ask this too? Turn it into a help article.</p>
                  <SubmitButton size="sm" variant="secondary">
                    Draft an article from this
                  </SubmitButton>
                </form>
              )}
            </Panel>
          ) : null}

          {rating ? (
            <Panel title="Rating">
              <p className="text-sm">
                {"★".repeat(rating.score)}
                {"☆".repeat(5 - rating.score)} {rating.comment ? <span className="text-muted">“{rating.comment}”</span> : null}
              </p>
            </Panel>
          ) : null}
        </aside>
      </div>
    </>
  );
}
