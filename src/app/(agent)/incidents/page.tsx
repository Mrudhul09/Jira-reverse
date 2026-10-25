import { WorkList } from "@/components/WorkList";
import { requireAgent } from "@/lib/auth";
import { all } from "@/lib/db";

export const metadata = { title: "Incidents" };

export default async function Incidents({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireAgent();
  const services = new Map<string, string[]>();
  for (const r of all<{ item_id: string; name: string }>(
    "select x.item_id, s.name from item_services x join services s on s.id = x.service_id join items i on i.id = x.item_id where i.category = 'incident' order by s.name",
  )) {
    services.set(r.item_id, [...(services.get(r.item_id) ?? []), r.name]);
  }
  return (
    <WorkList
      category="incident"
      title="Incidents"
      intro="Things that stopped working. Major incidents first, then by priority."
      userId={user.id}
      sp={await searchParams}
      views={[
        { key: "open", label: "Open", filter: { scope: "open" } },
        { key: "major", label: "Major", filter: { scope: "open", major: true } },
        { key: "mine", label: "Mine", filter: { scope: "open", assignee: "me" } },
        { key: "done", label: "Resolved", filter: { scope: "done" } },
        { key: "all", label: "All", filter: { scope: "all" } },
      ]}
      extra={{ header: "Services", cell: (i) => services.get(i.id)?.join(", ") ?? "-" }}
    />
  );
}
