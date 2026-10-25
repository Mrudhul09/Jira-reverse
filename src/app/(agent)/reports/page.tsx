import Link from "next/link";
import { Card, LinkButton, Lozenge, PageHead } from "@/components/ui";
import { duration } from "@/components/ui/sla-badge";
import { requireAgent } from "@/lib/auth";
import { all, get, marks } from "@/lib/db";
import { ITEM_SELECT } from "@/lib/items";
import { PRIORITY_LABEL } from "@/lib/priority";
import { slaStatesFor } from "@/lib/sla";
import type { ItemRow } from "@/lib/types";
import { CATEGORIES, CATEGORY_LABEL, DONE_STATUSES } from "@/lib/workflows";

export const metadata = { title: "Reports" };

const DAY = 86_400_000;

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between gap-2 text-sm">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-sunken" role="img" aria-label={`${label}: ${value}`}>
        <span className="block h-full bg-accent" style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
      </div>
    </div>
  );
}

export default async function Reports({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAgent();
  const days = [7, 14, 30, 90].includes(Number((await searchParams).days)) ? Number((await searchParams).days) : 14;
  const now = Date.now();
  const since = now - days * DAY;
  const open = all<ItemRow>(`${ITEM_SELECT} where i.status not in (${marks(DONE_STATUSES.length)})`, ...DONE_STATUSES);
  const finished = all<ItemRow>(`${ITEM_SELECT} where i.resolved_at >= ?`, since);
  const openSla = slaStatesFor(open, now);
  const breached = open.filter((i) => (openSla.get(i.id) ?? []).some((s) => s.state === "breached")).length;
  const success = new Map<string, { met: number; missed: number }>();
  for (const states of slaStatesFor(finished, now).values()) {
    for (const s of states) {
      const t = success.get(s.name) ?? { met: 0, missed: 0 };
      if (s.state === "met") t.met++;
      if (s.state === "breached") t.missed++;
      success.set(s.name, t);
    }
  }
  const raised = all<{ created_at: number }>("select created_at from items where created_at >= ?", since);
  const buckets = Array.from({ length: days }, (_, n) => {
    const d = new Date(now - (days - 1 - n) * DAY);
    d.setHours(0, 0, 0, 0);
    const s = d.getTime();
    return {
      label: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      raised: raised.filter((r) => r.created_at >= s && r.created_at < s + DAY).length,
      done: finished.filter((f) => f.resolved_at! >= s && f.resolved_at! < s + DAY).length,
    };
  });
  const peak = Math.max(1, ...buckets.map((b) => Math.max(b.raised, b.done)));
  const avg = finished.length ? finished.reduce((t, f) => t + (f.resolved_at! - f.created_at), 0) / finished.length : 0;
  const csat = get<{ avg: number | null; n: number }>("select avg(score) as avg, count(*) as n from csat where created_at >= ?", since)!;
  const byType = CATEGORIES.map((c) => ({ label: CATEGORY_LABEL[c], n: open.filter((i) => i.category === c).length }));
  const byPriority = [1, 2, 3, 4, 5].map((p) => ({ label: PRIORITY_LABEL[p], n: open.filter((i) => i.priority === p).length }));
  const problems = all<{ key: string; summary: string; n: number }>(
    `select p.key, p.summary, count(*) as n from items p join links l on l.from_id = p.id or l.to_id = p.id
       join items o on o.id = case when l.from_id = p.id then l.to_id else l.from_id end
      where p.category = 'problem' and o.category = 'incident' group by p.id order by n desc limit 5`,
  );
  const people = all<{ name: string; n: number }>("select u.name, count(*) as n from items i join users u on u.id = i.assignee_id where i.resolved_at >= ? group by u.id order by n desc limit 8", since);
  const deflect = get<{ v: number; h: number }>("select coalesce(sum(views), 0) as v, coalesce(sum(helpful), 0) as h from articles where portal_visible = 1")!;

  return (
    <>
      <PageHead
        title="Reports"
        intro={`How the last ${days} days went.`}
        actions={[7, 14, 30, 90].map((d) => (
          <LinkButton key={d} href={`/reports?days=${d}`} size="sm" variant={d === days ? "primary" : "secondary"}>
            {d} days
          </LinkButton>
        ))}
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {[
          ["Open now", open.length, `${open.filter((i) => i.is_major).length} major`],
          ["Past an SLA goal", breached, "of the open work"],
          ["Finished", finished.length, `in ${days} days`],
          ["Average time to finish", finished.length ? duration(avg) : "-", "clock time, all kinds"],
          ["Satisfaction", csat.avg ? `${csat.avg.toFixed(1)} / 5` : "-", `${csat.n} rating${csat.n === 1 ? "" : "s"}`],
          ["Help center reads", deflect.v, `${deflect.h} said it helped`],
        ].map(([label, value, sub]) => (
          <Card key={label as string} className="space-y-0.5">
            <p className="text-sm text-muted">{label}</p>
            <p className="text-display font-bold">{value}</p>
            <p className="text-xs text-muted">{sub}</p>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg">Raised and finished per day</h2>
            <p className="flex gap-3 text-xs text-muted">
              <span className="flex items-center gap-1">
                <i className="inline-block size-2.5 rounded-sm bg-p4" /> Raised
              </span>
              <span className="flex items-center gap-1">
                <i className="inline-block size-2.5 rounded-sm bg-accent" /> Finished
              </span>
            </p>
          </div>
          <div className="flex h-40 items-end gap-1" role="img" aria-label={`${raised.length} raised and ${finished.length} finished in ${days} days`}>
            {buckets.map((b, n) => (
              <div key={n} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${b.label}: ${b.raised} raised, ${b.done} finished`}>
                <div className="flex h-full w-full items-end justify-center gap-px">
                  <span className="w-[40%] max-w-3 rounded-t-sm bg-p4" style={{ height: `${(b.raised / peak) * 100}%` }} />
                  <span className="w-[40%] max-w-3 rounded-t-sm bg-accent" style={{ height: `${(b.done / peak) * 100}%` }} />
                </div>
                <span className="text-[10px] text-muted">{days <= 14 || n % Math.ceil(days / 10) === 0 ? b.label : " "}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="space-y-3">
          <h2 className="text-lg">SLA goals met</h2>
          <p className="text-sm text-muted">On work finished in this period.</p>
          {success.size ? null : <p className="text-muted">Nothing finished yet.</p>}
          {Array.from(success).map(([name, t]) => {
            const total = t.met + t.missed;
            return (
              <div key={name} className="space-y-1">
                <Bar label={`${name} · ${total ? Math.round((t.met / total) * 100) : 0}%`} value={t.met} max={total} />
                <p className="text-xs text-muted">
                  {t.met} met, {t.missed} missed
                </p>
              </div>
            );
          })}
        </Card>
        <Card className="space-y-3">
          <h2 className="text-lg">Open work by kind</h2>
          {byType.map((r) => (
            <Bar key={r.label} label={r.label} value={r.n} max={Math.max(1, ...byType.map((x) => x.n))} />
          ))}
        </Card>
        <Card className="space-y-3">
          <h2 className="text-lg">Open work by priority</h2>
          {byPriority.map((r) => (
            <Bar key={r.label} label={r.label} value={r.n} max={Math.max(1, ...byPriority.map((x) => x.n))} />
          ))}
        </Card>
        <Card className="space-y-2">
          <h2 className="text-lg">Problems behind the most incidents</h2>
          {problems.length ? (
            problems.map((p) => (
              <div key={p.key} className="flex items-center justify-between gap-2">
                <Link href={`/items/${p.key}`}>
                  {p.key} {p.summary}
                </Link>
                <Lozenge tone="bad">{p.n}</Lozenge>
              </div>
            ))
          ) : (
            <p className="text-muted">No problems linked to incidents yet.</p>
          )}
        </Card>
        <Card className="space-y-2">
          <h2 className="text-lg">Finished by person</h2>
          {people.length ? people.map((p) => <Bar key={p.name} label={p.name} value={p.n} max={people[0].n} />) : <p className="text-muted">Nothing finished in this period.</p>}
        </Card>
      </div>
    </>
  );
}
