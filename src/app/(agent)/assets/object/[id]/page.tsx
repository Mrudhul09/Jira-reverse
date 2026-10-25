import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteObjectAction, saveObjectAction } from "@/app/actions/assets";
import { AssetFields } from "@/components/AssetFields";
import { ItemTable } from "@/components/work";
import { Banners, Card, EmptyState, Kv, PageHead, Panel } from "@/components/ui";
import { TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit";
import { getType, labels, type AssetObject, type Attr } from "@/lib/assets";
import { requireAgent } from "@/lib/auth";
import { all, get, parseJson } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { ITEM_SELECT } from "@/lib/items";
import type { ItemRow } from "@/lib/types";

export const metadata = { title: "Asset" };

export default async function AssetPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAgent();
  const obj = get<AssetObject>("select * from asset_objects where id = ?", (await params).id);
  if (!obj) notFound();
  const type = getType(obj.type_id)!;
  const values = parseJson<Record<string, string>>(obj.attrs_json, {});
  const names = labels(type.attrs.filter((a) => a.type === "reference" && values[a.key]).map((a) => values[a.key]));
  // Objects whose link attributes point at this one.
  const pointing = all<AssetObject & { type: string; attributes_json: string }>(
    "select o.*, t.name as type, t.attributes_json from asset_objects o join asset_types t on t.id = o.type_id where o.attrs_json like ?",
    `%${obj.id}%`,
  ).filter((o) => {
    const v = parseJson<Record<string, string>>(o.attrs_json, {});
    return parseJson<Attr[]>(o.attributes_json, []).some((a) => a.type === "reference" && v[a.key] === obj.id);
  });
  const items = all<ItemRow>(`${ITEM_SELECT} where i.id in (select item_id from item_assets where asset_id = ?) order by i.created_at desc`, obj.id);
  return (
    <>
      <Banners sp={await searchParams} />
      <p className="mb-1.5 text-sm text-muted">
        <Link href={`/assets?type=${type.id}`}>Assets / {type.name}</Link>
      </p>
      <PageHead
        title={obj.label}
        intro={`${type.name} · updated ${dateTime(obj.updated_at)}`}
        actions={
          <form action={deleteObjectAction}>
            <input type="hidden" name="id" value={obj.id} />
            <SubmitButton variant="danger">Delete</SubmitButton>
          </form>
        }
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <Card>
            <Kv
              rows={type.attrs.map((a) => [
                a.label,
                a.type === "reference" && values[a.key] ? (
                  <Link key={a.key} href={`/assets/object/${values[a.key]}`}>
                    {names.get(values[a.key]) ?? "?"}
                  </Link>
                ) : (
                  values[a.key] || <span className="text-muted">-</span>
                ),
              ])}
            />
          </Card>
          <Card className="space-y-1.5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Linked from</h2>
            {pointing.length ? (
              pointing.map((o) => (
                <Link key={o.id} href={`/assets/object/${o.id}`} className="block">
                  {o.type}: {o.label}
                </Link>
              ))
            ) : (
              <p className="text-muted">Nothing points at this.</p>
            )}
          </Card>
          <h2 className="text-lg">Work involving it</h2>
          {items.length ? (
            <ItemTable items={items} />
          ) : (
            <Card>
              <EmptyState title="No work items mention this asset" />
            </Card>
          )}
        </div>
        <Panel title="Edit">
          <form action={saveObjectAction} className="space-y-3">
            <input type="hidden" name="id" value={obj.id} />
            <input type="hidden" name="typeId" value={type.id} />
            <TextField id="label" name="label" label="Name" required defaultValue={obj.label} />
            <AssetFields attrs={type.attrs} values={values} prefix="edit" />
            <SubmitButton size="sm">Save</SubmitButton>
          </form>
        </Panel>
      </div>
    </>
  );
}
