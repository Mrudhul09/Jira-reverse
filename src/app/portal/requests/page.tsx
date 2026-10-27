import Link from "next/link";
import { Status } from "@/components/work";
import { Banners, Card, EmptyState, LinkButton, PageHead, TabLinks } from "@/components/ui";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { requireUser } from "@/lib/auth";
import { all, marks } from "@/lib/db";
import { ago } from "@/lib/format";
import { ITEM_SELECT } from "@/lib/items";
import type { ItemRow } from "@/lib/types";
import { doneStatuses } from "@/lib/workflows";

export const metadata = { title: "My requests" };

export default async function MyRequests({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const view = sp.view === "closed" || sp.view === "approvals" ? sp.view : "open";
  const items =
    view === "approvals"
      ? all<ItemRow>(`${ITEM_SELECT} where i.id in (select item_id from approvals where approver_id = ?) order by i.updated_at desc limit 200`, user.id)
      : all<ItemRow>(
          `${ITEM_SELECT} where i.reporter_id = ? and i.status ${view === "open" ? "not in" : "in"} (${marks(doneStatuses().length)}) order by i.updated_at desc limit 200`,
          user.id,
          ...doneStatuses(),
        );
  return (
    <main className="mx-auto max-w-5xl px-4 py-6 md:px-6">
      <Banners sp={sp} />
      <PageHead
        title="My requests"
        intro="What you've asked for, and anything waiting for your approval."
        actions={
          <LinkButton href="/portal" variant="primary">
            Ask for something
          </LinkButton>
        }
      />
      <TabLinks
        label="Request views"
        current={view}
        tabs={[
          { key: "open", label: "Open", href: "/portal/requests" },
          { key: "closed", label: "Done", href: "/portal/requests?view=closed" },
          { key: "approvals", label: "To approve", href: "/portal/requests?view=approvals" },
        ]}
      />
      {items.length ? (
        <Table>
          <thead>
            <tr>
              <Th>Reference</Th>
              <Th>Summary</Th>
              <Th>Type</Th>
              <Th>Status</Th>
              <Th>Last update</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <Tr key={i.id}>
                <Td className="whitespace-nowrap font-mono text-sm">
                  <Link href={`/portal/requests/${i.key}`}>{i.key}</Link>
                </Td>
                <Td>
                  <Link href={`/portal/requests/${i.key}`} className="font-medium text-fg">
                    {i.summary}
                  </Link>
                </Td>
                <Td className="text-sm">{i.request_type_name ?? "-"}</Td>
                <Td>
                  <Status category={i.category} status={i.status} />
                </Td>
                <Td className="text-sm text-muted">{ago(i.updated_at)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <Card>
          <EmptyState title={view === "approvals" ? "Nothing waiting for you" : view === "open" ? "Nothing open" : "Nothing finished yet"}>
            {view === "open" ? <Link href="/portal">Ask for something</Link> : null}
          </EmptyState>
        </Card>
      )}
    </main>
  );
}
