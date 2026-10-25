import { X } from "lucide-react";
import Link from "next/link";
import { addAttrAction, dropAttrAction, importAction, newSchemaAction, newTypeAction, saveObjectAction } from "@/app/actions/assets";
import { AssetFields } from "@/components/AssetFields";
import { Banners, Card, EmptyState, PageHead, Panel, cx } from "@/components/ui";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { getType, labels, type AssetObject } from "@/lib/assets";
import { requireAgent } from "@/lib/auth";
import { all, parseJson } from "@/lib/db";

export const metadata = { title: "Assets" };

export default async function Assets({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAgent();
  const sp = await searchParams;
  const schemas = all<{ id: string; name: string }>("select id, name from asset_schemas order by name");
  const types = all<{ id: string; schema_id: string; name: string; n: number }>(
    "select t.id, t.schema_id, t.name, (select count(*) from asset_objects o where o.type_id = t.id) as n from asset_types t order by t.name",
  );
  const type = getType(sp.type ?? types[0]?.id);
  const q = (sp.q ?? "").trim().toLowerCase();
  const objects = type ? all<AssetObject>("select * from asset_objects where type_id = ? order by label", type.id).filter((o) => !q || `${o.label} ${o.attrs_json}`.toLowerCase().includes(q)) : [];
  const names = labels(
    type
      ? objects.flatMap((o) => {
          const v = parseJson<Record<string, string>>(o.attrs_json, {});
          return type.attrs.filter((a) => a.type === "reference" && v[a.key]).map((a) => v[a.key]);
        })
      : [],
  );
  const typeName = new Map(types.map((t) => [t.id, t.name]));
  return (
    <>
      <Banners sp={sp} />
      <PageHead title="Assets" intro="Everything we look after and how it connects. Link assets to incidents, problems and changes." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <nav aria-label="Object types" className="rounded-lg border border-line bg-canvas">
            {schemas.map((s) => (
              <div key={s.id} className="border-b border-line last:border-b-0">
                <h2 className="px-3 pb-1 pt-2.5 text-sm font-semibold">{s.name}</h2>
                <ul className="px-1.5 pb-2">
                  {types
                    .filter((t) => t.schema_id === s.id)
                    .map((t) => (
                      <li key={t.id}>
                        <Link
                          href={`/assets?type=${t.id}`}
                          aria-current={t.id === type?.id ? "page" : undefined}
                          className={cx("flex justify-between rounded-md px-2.5 py-1.5 text-fg no-underline hover:bg-surface hover:no-underline", t.id === type?.id && "bg-accent-soft font-semibold")}
                        >
                          <span>{t.name}</span>
                          <span className="text-sm text-muted">{t.n}</span>
                        </Link>
                      </li>
                    ))}
                </ul>
                <details className="px-3 pb-2.5">
                  <summary className="cursor-pointer text-sm text-accent">New type</summary>
                  <form action={newTypeAction} className="mt-2 flex gap-2">
                    <input type="hidden" name="schemaId" value={s.id} />
                    <label htmlFor={`nt-${s.id}`} className="sr-only">
                      Type name
                    </label>
                    <input id={`nt-${s.id}`} name="name" required placeholder="e.g. Printer" className="control" />
                    <SubmitButton size="md" variant="secondary">
                      Add
                    </SubmitButton>
                  </form>
                </details>
              </div>
            ))}
          </nav>
          <details className="rounded-lg bg-surface p-3">
            <summary className="cursor-pointer text-sm text-accent">New schema</summary>
            <form action={newSchemaAction} className="mt-2 space-y-2">
              <TextField id="sname" name="name" label="Name" required />
              <TextField id="sdesc" name="description" label="What's in it" />
              <SubmitButton size="sm" variant="secondary">
                Create schema
              </SubmitButton>
            </form>
          </details>
        </aside>

        {type ? (
          <section className="min-w-0 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2>
                {type.name} <span className="text-base text-muted">({objects.length})</span>
              </h2>
              <form role="search" className="flex">
                <input type="hidden" name="type" value={type.id} />
                <label htmlFor="aq" className="sr-only">
                  Filter
                </label>
                <input id="aq" name="q" type="search" defaultValue={sp.q ?? ""} placeholder={`Filter ${type.name.toLowerCase()}s`} className="control w-56" />
              </form>
            </div>
            {objects.length ? (
              <Table>
                <thead>
                  <tr>
                    <Th>Name</Th>
                    {type.attrs.map((a) => (
                      <Th key={a.key}>{a.label}</Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {objects.map((o) => {
                    const v = parseJson<Record<string, string>>(o.attrs_json, {});
                    return (
                      <Tr key={o.id}>
                        <Td>
                          <Link href={`/assets/object/${o.id}`} className="font-medium text-fg">
                            {o.label}
                          </Link>
                        </Td>
                        {type.attrs.map((a) => (
                          <Td key={a.key} className="text-sm">
                            {a.type === "reference" && v[a.key] ? <Link href={`/assets/object/${v[a.key]}`}>{names.get(v[a.key]) ?? "?"}</Link> : v[a.key] || <span className="text-muted">-</span>}
                          </Td>
                        ))}
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            ) : (
              <Card>
                <EmptyState title={q ? "Nothing matches" : `No ${type.name.toLowerCase()}s yet`}>Add one below, or import a spreadsheet.</EmptyState>
              </Card>
            )}
            <div className="grid gap-4 xl:grid-cols-2">
              <Panel title={`Add a ${type.name.toLowerCase()}`}>
                <form action={saveObjectAction} className="space-y-3">
                  <input type="hidden" name="typeId" value={type.id} />
                  <TextField id="new-label" name="label" label="Name" required />
                  <AssetFields attrs={type.attrs} prefix="new" />
                  <SubmitButton size="sm">Add</SubmitButton>
                </form>
              </Panel>
              <div className="space-y-4">
                <Panel title="Attributes">
                  <ul className="mb-3 space-y-1 text-sm">
                    {type.attrs.length ? null : <li className="text-muted">None yet.</li>}
                    {type.attrs.map((a) => (
                      <li key={a.key}>
                        <form action={dropAttrAction} className="flex items-center justify-between gap-2">
                          <input type="hidden" name="typeId" value={type.id} />
                          <input type="hidden" name="key" value={a.key} />
                          <span>
                            {a.label}{" "}
                            <span className="text-muted">
                              · {a.type}
                              {a.type === "reference" ? ` → ${typeName.get(a.refTypeId ?? "") ?? "?"}` : ""}
                              {a.options ? ` (${a.options.join(", ")})` : ""}
                            </span>
                          </span>
                          <button aria-label={`Remove ${a.label}`} className="rounded p-1 text-muted hover:bg-sunken hover:text-fg">
                            <X aria-hidden="true" className="size-3.5" />
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                  <form action={addAttrAction} className="space-y-2 border-t border-line pt-3">
                    <input type="hidden" name="typeId" value={type.id} />
                    <div className="grid grid-cols-2 gap-2">
                      <TextField id="al" name="label" label="Label" required />
                      <SelectField
                        id="ak"
                        name="kind"
                        label="Kind"
                        defaultValue="text"
                        options={[
                          { value: "text", label: "Text" },
                          { value: "number", label: "Number" },
                          { value: "date", label: "Date" },
                          { value: "select", label: "Pick from a list" },
                          { value: "reference", label: "Link to another object" },
                        ]}
                      />
                    </div>
                    <TextField id="ao" name="options" label="Choices (for a list, comma separated)" />
                    <SelectField id="ar" name="refTypeId" label="Points at (for a link)" placeholder="-" options={types.map((t) => ({ value: t.id, label: t.name }))} />
                    <SubmitButton size="sm" variant="secondary">
                      Add attribute
                    </SubmitButton>
                  </form>
                </Panel>
                <Panel title="Import from a spreadsheet">
                  <form action={importAction} className="space-y-2">
                    <input type="hidden" name="typeId" value={type.id} />
                    <TextArea
                      id="csv"
                      name="csv"
                      label="Paste CSV"
                      hint={`Header row: name,${type.attrs.map((a) => a.key).join(",")}. Same name updates; links can use the other object's name.`}
                      className="[&_textarea]:font-mono [&_textarea]:text-sm"
                    />
                    <SubmitButton size="sm" variant="secondary">
                      Import
                    </SubmitButton>
                  </form>
                </Panel>
              </div>
            </div>
          </section>
        ) : (
          <Card>
            <EmptyState title="No object types yet">Create a schema, then add a type to it.</EmptyState>
          </Card>
        )}
      </div>
    </>
  );
}
