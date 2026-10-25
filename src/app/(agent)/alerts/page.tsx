import Link from "next/link";
import { alertAction, raiseAlertAction } from "@/app/actions/ops";
import { Banners, Card, EmptyState, Lozenge, PageHead, Panel, PriorityMark, TabLinks } from "@/components/ui";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import type { Alert } from "@/lib/alerts";
import { requireAgent } from "@/lib/auth";
import { all } from "@/lib/db";
import { ago, dateTime } from "@/lib/format";
import { PRIORITY_LABEL } from "@/lib/priority";

export const metadata = { title: "Alerts" };

export default async function Alerts({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAgent();
  const sp = await searchParams;
  const view = sp.view === "closed" || sp.view === "all" ? sp.view : "active";
  const filter = view === "active" ? "where a.status != 'closed'" : view === "closed" ? "where a.status = 'closed'" : "";
  const alerts = all<Alert & { team: string | null; acker: string | null; incident_key: string | null }>(
    `select a.*, t.name as team, u.name as acker, i.key as incident_key from alerts a
       left join teams t on t.id = a.team_id left join users u on u.id = a.acked_by left join items i on i.id = a.incident_id
     ${filter} order by a.status = 'open' desc, a.priority, a.updated_at desc limit 300`,
  );
  const teams = all<{ id: string; name: string }>("select id, name from teams order by name");
  return (
    <>
      <Banners sp={sp} />
      <PageHead
        title="Alerts"
        intro={
          <>
            Signals from monitoring tools. They post to <code className="font-mono">/api/alerts</code>; repeats with the same alias are counted, not re-paged.
          </>
        }
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <TabLinks
            label="Alert views"
            current={view}
            tabs={[
              { key: "active", label: "Active", href: "/alerts" },
              { key: "closed", label: "Closed", href: "/alerts?view=closed" },
              { key: "all", label: "All", href: "/alerts?view=all" },
            ]}
          />
          {alerts.length ? (
            <Table>
              <thead>
                <tr>
                  <Th>Priority</Th>
                  <Th>Alert</Th>
                  <Th>State</Th>
                  <Th>Team</Th>
                  <Th>Seen</Th>
                  <Th>Incident</Th>
                  <Th>Last</Th>
                  <Th>
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a) => (
                  <Tr key={a.id}>
                    <Td>
                      <PriorityMark value={a.priority} short />
                    </Td>
                    <Td className="min-w-56">
                      <strong>{a.message}</strong>
                      <span className="block text-sm text-muted">
                        #{a.number} · {a.source}
                        {a.alias ? ` · ${a.alias}` : ""}
                        {a.description ? ` · ${a.description}` : ""}
                      </span>
                    </Td>
                    <Td>
                      <Lozenge tone={a.status === "open" ? "bad" : a.status === "acked" ? "warning" : "done"}>{a.status === "acked" ? "acknowledged" : a.status}</Lozenge>
                      {a.acker ? <span className="block text-xs text-muted">by {a.acker}</span> : null}
                    </Td>
                    <Td className="text-sm">{a.team ?? "-"}</Td>
                    <Td className="text-sm">{a.count}×</Td>
                    <Td className="whitespace-nowrap font-mono text-sm">{a.incident_key ? <Link href={`/items/${a.incident_key}`}>{a.incident_key}</Link> : "-"}</Td>
                    <Td className="whitespace-nowrap text-sm text-muted" title={dateTime(a.updated_at)}>
                      {ago(a.updated_at)}
                    </Td>
                    <Td>
                      <form action={alertAction} className="flex gap-1.5">
                        <input type="hidden" name="alertId" value={a.id} />
                        {a.status === "open" ? (
                          <SubmitButton size="sm" variant="secondary" name="op" value="ack">
                            Acknowledge
                          </SubmitButton>
                        ) : null}
                        {!a.incident_key && a.status !== "closed" ? (
                          <SubmitButton size="sm" variant="secondary" name="op" value="incident">
                            Open incident
                          </SubmitButton>
                        ) : null}
                        {a.status !== "closed" ? (
                          <SubmitButton size="sm" variant="subtle" name="op" value="close">
                            Close
                          </SubmitButton>
                        ) : null}
                      </form>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <Card>
              <EmptyState title="All quiet" />
            </Card>
          )}
        </div>
        <Panel title="Raise an alert by hand">
          <form action={raiseAlertAction} className="space-y-3">
            <TextField id="message" name="message" label="What's wrong" required maxLength={300} />
            <TextArea id="adesc" name="description" label="Details" />
            <div className="grid grid-cols-2 gap-2">
              <SelectField id="apri" name="priority" label="Priority" defaultValue={3} options={[1, 2, 3, 4, 5].map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))} />
              <SelectField id="ateam" name="teamId" label="Team" placeholder="None" options={teams.map((t) => ({ value: t.id, label: t.name }))} />
            </div>
            <TextField id="alias" name="alias" label="Alias" hint="Repeats with the same alias are counted against the open alert." maxLength={200} />
            <p className="text-xs text-muted">By default, P1 and P2 alerts open an incident (see Automation).</p>
            <SubmitButton>Raise alert</SubmitButton>
          </form>
        </Panel>
      </div>
    </>
  );
}
