import Link from "next/link";
import { ago } from "@/lib/format";
import { headlineSla, slaStatesFor } from "@/lib/sla";
import type { ItemRow } from "@/lib/types";
import { CATEGORY_LABEL, statusLabel, tone, type Category } from "@/lib/workflows";
import { SelectAll } from "./SelectAll";
import { Lozenge, Person, PriorityMark } from "./ui";
import { SlaBadge } from "./ui/sla-badge";
import { Table, Td, Th, Tr } from "./ui/table";

export function Status({ category, status }: { category: Category; status: string }) {
  const t = status === "Declined" || status === "Failed" ? "bad" : tone(category, status);
  return <Lozenge tone={t}>{statusLabel(category, status)}</Lozenge>;
}

export function MajorTag() {
  return <span className="ml-1 inline-block rounded-sm bg-danger px-1.5 text-xs font-bold uppercase text-on-accent">Major</span>;
}

export function ItemTable({
  items,
  formId,
  showType = true,
  extra,
}: {
  items: ItemRow[];
  formId?: string;
  showType?: boolean;
  extra?: { header: string; cell: (i: ItemRow) => React.ReactNode };
}) {
  const slas = slaStatesFor(items);
  return (
    <Table>
      <thead>
        <tr>
          {formId ? (
            <Th className="w-8">
              <SelectAll formId={formId} />
            </Th>
          ) : null}
          <Th>Key</Th>
          {showType ? <Th>Type</Th> : null}
          <Th>Summary</Th>
          <Th>Raised by</Th>
          <Th>Assignee</Th>
          <Th>Status</Th>
          <Th>Priority</Th>
          <Th>SLA</Th>
          {extra ? <Th>{extra.header}</Th> : null}
          <Th>Raised</Th>
        </tr>
      </thead>
      <tbody>
        {items.map((i) => {
          const sla = headlineSla(slas.get(i.id) ?? []);
          return (
            <Tr key={i.id}>
              {formId ? (
                <Td>
                  <input type="checkbox" name="ids" value={i.id} form={formId} aria-label={`Select ${i.key}`} className="size-4 accent-[var(--accent)]" />
                </Td>
              ) : null}
              <Td className="whitespace-nowrap font-mono text-sm">
                <Link href={`/items/${i.key}`}>{i.key}</Link>
              </Td>
              {showType ? <Td className="text-sm">{i.request_type_name ?? CATEGORY_LABEL[i.category]}</Td> : null}
              <Td className="min-w-56 max-w-md">
                <Link href={`/items/${i.key}`} className="font-medium text-fg">
                  {i.summary}
                </Link>
                {i.is_major ? <MajorTag /> : null}
              </Td>
              <Td className="text-sm">{i.reporter_name}</Td>
              <Td className="text-sm">
                <Person name={i.assignee_name} />
              </Td>
              <Td>
                <Status category={i.category} status={i.status} />
              </Td>
              <Td>
                <PriorityMark value={i.priority} short />
              </Td>
              <Td>{sla ? <SlaBadge sla={sla} /> : <span className="text-muted">-</span>}</Td>
              {extra ? <Td className="text-sm">{extra.cell(i)}</Td> : null}
              <Td className="whitespace-nowrap text-sm text-muted" title={new Date(i.created_at).toISOString()}>
                {ago(i.created_at)}
              </Td>
            </Tr>
          );
        })}
      </tbody>
    </Table>
  );
}
