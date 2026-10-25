import { Banners, Card, EmptyState, LinkButton, PageHead, TabLinks } from "@/components/ui";
import { listItems, type Filter } from "@/lib/queues";
import type { ItemRow } from "@/lib/types";
import { CATEGORY_LABEL, CATEGORY_PATH, type Category } from "@/lib/workflows";
import { ItemTable } from "./work";

// The list page shared by incidents, problems and changes.
export function WorkList({
  category,
  title,
  intro,
  userId,
  sp,
  views,
  extra,
  actions,
}: {
  category: Category;
  title: string;
  intro: string;
  userId: string;
  sp: Record<string, string | undefined>;
  views: { key: string; label: string; filter: Filter }[];
  extra?: { header: string; cell: (i: ItemRow) => React.ReactNode };
  actions?: React.ReactNode;
}) {
  const view = views.find((v) => v.key === sp.view) ?? views[0];
  const items = listItems({ ...view.filter, categories: [category], text: sp.q }, userId);
  const base = CATEGORY_PATH[category];
  const noun = CATEGORY_LABEL[category].toLowerCase();
  return (
    <>
      <Banners sp={sp} />
      <PageHead
        title={title}
        intro={intro}
        actions={
          <>
            <form action={base} role="search" className="flex gap-2">
              <input type="hidden" name="view" value={view.key} />
              <label htmlFor="wq" className="sr-only">
                Filter
              </label>
              <input id="wq" name="q" type="search" defaultValue={sp.q ?? ""} placeholder="Filter" className="control w-48" />
            </form>
            {actions}
            <LinkButton href={`/items/new?category=${category}`} variant="primary">
              New {noun}
            </LinkButton>
          </>
        }
      />
      <TabLinks label="Views" current={view.key} tabs={views.map((v) => ({ key: v.key, label: v.label, href: `${base}?view=${v.key}` }))} />
      {items.length ? (
        <ItemTable items={items} showType={false} extra={extra} />
      ) : (
        <Card>
          <EmptyState title={`No ${noun}s here`} />
        </Card>
      )}
    </>
  );
}
