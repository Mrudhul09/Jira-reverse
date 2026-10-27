import Link from "next/link";
import { headlineSla, slaStatesFor } from "@/lib/sla";
import type { ItemRow } from "@/lib/types";
import { statusLabel, workflow } from "@/lib/workflows";
import { PriorityMark } from "./ui";
import { SlaBadge } from "./ui/sla-badge";
import { MajorTag } from "./work";

// One column per status that has work in it, in workflow order.
export function Board({ items }: { items: ItemRow[] }) {
  const order = Array.from(new Set(items.flatMap((i) => Object.keys(workflow(i.category).statuses))));
  const columns = order.filter((s) => items.some((i) => i.status === s));
  const slas = slaStatesFor(items);
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map((s) => {
        const here = items.filter((i) => i.status === s);
        const name = statusLabel(here[0].category, s);
        return (
          <section key={s} aria-label={`${name}, ${here.length}`} className="w-64 flex-none rounded-lg bg-surface p-2">
            <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted">
              {name} · {here.length}
            </h3>
            <ul className="space-y-2">
              {here.map((i) => {
                const sla = headlineSla(slas.get(i.id) ?? []);
                return (
                  <li key={i.id}>
                    <Link href={`/items/${i.key}`} className="block rounded-md border border-line bg-canvas p-2.5 text-fg no-underline shadow-card hover:border-accent hover:no-underline">
                      <span className="font-mono text-xs text-muted">{i.key}</span>
                      {i.is_major ? <MajorTag /> : null}
                      <span className="mt-1 block text-sm font-medium">{i.summary}</span>
                      <span className="mt-2 flex items-center justify-between gap-2">
                        <PriorityMark value={i.priority} short />
                        {sla ? <SlaBadge sla={sla} /> : null}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
