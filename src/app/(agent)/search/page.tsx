import { redirect } from "next/navigation";
import { ItemTable } from "@/components/work";
import { Card, EmptyState, PageHead } from "@/components/ui";
import { requireAgent } from "@/lib/auth";
import { getItemByKey } from "@/lib/items";
import { listItems } from "@/lib/queues";

export const metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireAgent();
  const q = ((await searchParams).q ?? "").trim();
  // An exact key jumps straight to the work item.
  if (/^sh-\d+$/i.test(q) && getItemByKey(q)) redirect(`/items/${q.toUpperCase()}`);
  const items = q ? listItems({ scope: "all", text: q }, user.id, 200) : [];
  return (
    <>
      <PageHead title="Search" intro={q ? `${items.length} result${items.length === 1 ? "" : "s"} for “${q}”` : "Type a key or some words in the search box."} />
      {q && !items.length ? (
        <Card>
          <EmptyState title="Nothing found">Try a key like SH-12, or fewer words.</EmptyState>
        </Card>
      ) : null}
      {items.length ? <ItemTable items={items} /> : null}
    </>
  );
}
