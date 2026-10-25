import { WorkList } from "@/components/WorkList";
import { requireAgent } from "@/lib/auth";
import { all } from "@/lib/db";

export const metadata = { title: "Problems" };

export default async function Problems({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireAgent();
  const incidents = new Map(
    all<{ id: string; n: number }>(
      `select p.id, count(*) as n from items p
         join links l on l.from_id = p.id or l.to_id = p.id
         join items o on o.id = case when l.from_id = p.id then l.to_id else l.from_id end
        where p.category = 'problem' and o.category = 'incident' group by p.id`,
    ).map((r) => [r.id, r.n]),
  );
  return (
    <WorkList
      category="problem"
      title="Problems"
      intro="The causes behind incidents: record a workaround, find the root cause, fix it with a change."
      userId={user.id}
      sp={await searchParams}
      views={[
        { key: "open", label: "Open", filter: { scope: "open" } },
        { key: "known", label: "Known errors", filter: { scope: "open", statuses: ["Known error"] } },
        { key: "done", label: "Done", filter: { scope: "done" } },
        { key: "all", label: "All", filter: { scope: "all" } },
      ]}
      extra={{ header: "Incidents", cell: (i) => incidents.get(i.id) ?? 0 }}
    />
  );
}
