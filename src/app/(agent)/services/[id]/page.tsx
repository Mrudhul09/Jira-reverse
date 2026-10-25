import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteServiceAction } from "@/app/actions/ops";
import { ServiceForm } from "@/components/ServiceForm";
import { ItemTable } from "@/components/work";
import { Banners, Card, EmptyState, PageHead, Panel } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit";
import { requireAgent } from "@/lib/auth";
import { all, get } from "@/lib/db";
import { ITEM_SELECT } from "@/lib/items";
import type { ItemRow } from "@/lib/types";

export const metadata = { title: "Service" };

export default async function Service({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAgent();
  const serviceId = (await params).id;
  const s = get<{ id: string; name: string; description: string; tier: number; owner_team_id: string | null }>("select * from services where id = ?", serviceId);
  if (!s) notFound();
  const reliesOn = all<{ id: string; name: string }>("select d.id, d.name from service_dependencies x join services d on d.id = x.depends_on_id where x.service_id = ? order by d.name", s.id);
  const usedBy = all<{ id: string; name: string }>("select d.id, d.name from service_dependencies x join services d on d.id = x.service_id where x.depends_on_id = ? order by d.name", s.id);
  const items = all<ItemRow>(`${ITEM_SELECT} where i.id in (select item_id from item_services where service_id = ?) order by i.resolved_at is not null, i.created_at desc limit 100`, s.id);
  return (
    <>
      <Banners sp={await searchParams} />
      <p className="mb-1.5 text-sm text-muted">
        <Link href="/services">Services</Link>
      </p>
      <PageHead
        title={s.name}
        intro={`Tier ${s.tier} · ${s.description || "No description"}`}
        actions={
          <form action={deleteServiceAction}>
            <input type="hidden" name="id" value={s.id} />
            <SubmitButton variant="danger">Delete service</SubmitButton>
          </form>
        }
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ["Relies on", reliesOn, "Nothing"],
              ["Hit if this fails", usedBy, "Nothing depends on it"],
            ].map(([title, list, none]) => (
              <Card key={title as string} className="space-y-1.5">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{title as string}</h2>
                {(list as { id: string; name: string }[]).length ? (
                  (list as { id: string; name: string }[]).map((d) => (
                    <Link key={d.id} href={`/services/${d.id}`} className="block">
                      {d.name}
                    </Link>
                  ))
                ) : (
                  <p className="text-muted">{none as string}</p>
                )}
              </Card>
            ))}
          </div>
          <h2 className="text-lg">Work on this service</h2>
          {items.length ? (
            <ItemTable items={items} />
          ) : (
            <Card>
              <EmptyState title="No incidents, problems or changes yet" />
            </Card>
          )}
        </div>
        <Panel title="Edit">
          <ServiceForm service={s} teams={all("select id, name from teams order by name")} services={all("select id, name from services order by name")} dependsOn={reliesOn.map((d) => d.id)} />
        </Panel>
      </div>
    </>
  );
}
