import Link from "next/link";
import { ServiceForm } from "@/components/ServiceForm";
import { Banners, Card, EmptyState, Lozenge, PageHead, Panel } from "@/components/ui";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { requireAgent } from "@/lib/auth";
import { all } from "@/lib/db";

export const metadata = { title: "Services" };

export default async function Services({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAgent();
  const rows = all<{ id: string; name: string; description: string; tier: number; team: string | null; incidents: number; changes: number; deps: string | null }>(
    `select s.id, s.name, s.description, s.tier, t.name as team,
       (select count(*) from item_services x join items i on i.id = x.item_id where x.service_id = s.id and i.category = 'incident' and i.resolved_at is null) as incidents,
       (select count(*) from item_services x join items i on i.id = x.item_id where x.service_id = s.id and i.category = 'change' and i.resolved_at is null) as changes,
       (select group_concat(d.name, ', ') from service_dependencies sd join services d on d.id = sd.depends_on_id where sd.service_id = s.id) as deps
     from services s left join teams t on t.id = s.owner_team_id order by s.tier, s.name`,
  );
  const teams = all<{ id: string; name: string }>("select id, name from teams order by name");
  return (
    <>
      <Banners sp={await searchParams} />
      <PageHead title="Services" intro="What we run, who owns it, and what it relies on. Incidents and changes point at these." />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        {rows.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Service</Th>
                <Th>Tier</Th>
                <Th>Owner</Th>
                <Th>Relies on</Th>
                <Th>Open incidents</Th>
                <Th>Open changes</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <Tr key={s.id}>
                  <Td>
                    <Link href={`/services/${s.id}`} className="font-medium text-fg">
                      {s.name}
                    </Link>
                    <span className="block text-sm text-muted">{s.description}</span>
                  </Td>
                  <Td>
                    <Lozenge tone={s.tier === 1 ? "bad" : s.tier === 2 ? "warning" : "todo"}>Tier {s.tier}</Lozenge>
                  </Td>
                  <Td className="text-sm">{s.team ?? "-"}</Td>
                  <Td className="text-sm">{s.deps ?? "-"}</Td>
                  <Td>{s.incidents ? <Lozenge tone="bad">{s.incidents}</Lozenge> : <span className="text-muted">0</span>}</Td>
                  <Td className="text-sm">{s.changes}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Card>
            <EmptyState title="No services yet">Add the first one on the right.</EmptyState>
          </Card>
        )}
        <Panel title="Add a service">
          <ServiceForm teams={teams} services={rows} />
        </Panel>
      </div>
    </>
  );
}
