"use server";

import { cleanAttrs, getType, parseCsv, type Attr } from "@/lib/assets";
import { requireAgent } from "@/lib/auth";
import { get, now, run, tx, uid } from "@/lib/db";
import { back, id, oneOf, str } from "@/lib/form";

export async function newSchemaAction(fd: FormData): Promise<void> {
  await requireAgent();
  const name = str(fd, "name", 100);
  if (!name) back("/assets", { error: "A schema needs a name." });
  if (get("select 1 from asset_schemas where name = ?", name)) back("/assets", { error: "There's already a schema with that name." });
  run("insert into asset_schemas (id, name, description, created_at, updated_at) values (?, ?, ?, ?, ?)", uid(), name, str(fd, "description", 500), now(), now());
  back("/assets", { ok: "Schema created. Add an object type to it." });
}

export async function newTypeAction(fd: FormData): Promise<void> {
  await requireAgent();
  const schemaId = id(fd, "schemaId");
  const name = str(fd, "name", 100);
  if (!schemaId || !name) back("/assets", { error: "An object type needs a name." });
  if (get("select 1 from asset_types where schema_id = ? and name = ?", schemaId, name)) back("/assets", { error: "That schema already has a type with that name." });
  const typeId = uid();
  run("insert into asset_types (id, schema_id, name, attributes_json, created_at, updated_at) values (?, ?, ?, '[]', ?, ?)", typeId, schemaId, name, now(), now());
  back(`/assets?type=${typeId}`, { ok: "Type created. Give it some attributes." });
}

export async function addAttrAction(fd: FormData): Promise<void> {
  await requireAgent();
  const type = getType(id(fd, "typeId"));
  if (!type) back("/assets", { error: "That object type doesn't exist." });
  const page = `/assets?type=${type.id}`;
  const label = str(fd, "label", 80);
  if (!label) back(page, { error: "An attribute needs a label." });
  const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || `field_${type.attrs.length + 1}`;
  if (type.attrs.some((a) => a.key === key)) back(page, { error: `${label} is already an attribute.` });
  const kind = oneOf(str(fd, "kind"), ["text", "number", "date", "select", "reference"] as const, "text");
  const attr: Attr = { key, label, type: kind };
  if (kind === "select") {
    attr.options = str(fd, "options", 1000).split(",").map((o) => o.trim()).filter(Boolean);
    if (!attr.options.length) back(page, { error: "List the choices, separated by commas." });
  }
  if (kind === "reference") {
    attr.refTypeId = id(fd, "refTypeId") ?? undefined;
    if (!getType(attr.refTypeId)) back(page, { error: "Pick the object type it points at." });
  }
  run("update asset_types set attributes_json = ?, updated_at = ? where id = ?", JSON.stringify([...type.attrs, attr]), now(), type.id);
  back(page, { ok: `Added ${label}.` });
}

export async function dropAttrAction(fd: FormData): Promise<void> {
  await requireAgent();
  const type = getType(id(fd, "typeId"));
  if (!type) back("/assets");
  const key = str(fd, "key", 80);
  run("update asset_types set attributes_json = ?, updated_at = ? where id = ?", JSON.stringify(type.attrs.filter((a) => a.key !== key)), now(), type.id);
  back(`/assets?type=${type.id}`, { ok: "Attribute removed. Values already saved are kept but hidden." });
}

export async function saveObjectAction(fd: FormData): Promise<void> {
  await requireAgent();
  const objectId = id(fd, "id");
  const type = getType(id(fd, "typeId"));
  if (!type) back("/assets", { error: "That object type doesn't exist." });
  const page = objectId ? `/assets/object/${objectId}` : `/assets?type=${type.id}`;
  const label = str(fd, "label", 200);
  if (!label) back(page, { error: "Give it a name." });
  const clash = get<{ id: string }>("select id from asset_objects where type_id = ? and label = ?", type.id, label);
  if (clash && clash.id !== objectId) back(page, { error: `There's already a ${type.name.toLowerCase()} called ${label}.` });
  const { values, error } = cleanAttrs(type.attrs, (k) => str(fd, `a_${k}`, 2000));
  if (error) back(page, { error });
  if (objectId) {
    run("update asset_objects set label = ?, attrs_json = ?, updated_at = ? where id = ? and type_id = ?", label, JSON.stringify(values), now(), objectId, type.id);
    back(page, { ok: "Saved." });
  }
  const newId = uid();
  run("insert into asset_objects (id, type_id, label, attrs_json, created_at, updated_at) values (?, ?, ?, ?, ?, ?)", newId, type.id, label, JSON.stringify(values), now(), now());
  back(`/assets/object/${newId}`, { ok: "Added." });
}

export async function deleteObjectAction(fd: FormData): Promise<void> {
  await requireAgent();
  const objectId = id(fd, "id");
  const obj = objectId ? get<{ type_id: string }>("select type_id from asset_objects where id = ?", objectId) : undefined;
  if (!obj) back("/assets");
  run("delete from asset_objects where id = ?", objectId);
  back(`/assets?type=${obj.type_id}`, { ok: "Deleted." });
}

// First row is the header: "name" plus attribute keys or labels. Matching names are updated.
export async function importAction(fd: FormData): Promise<void> {
  await requireAgent();
  const type = getType(id(fd, "typeId"));
  if (!type) back("/assets", { error: "That object type doesn't exist." });
  const page = `/assets?type=${type.id}`;
  const rows = parseCsv(str(fd, "csv", 1_000_000));
  if (rows.length < 2) back(page, { error: "Paste a header row and at least one row of data." });
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const nameCol = head.findIndex((h) => h === "name" || h === "label");
  if (nameCol < 0) back(page, { error: 'The header row needs a "name" column.' });
  const col = new Map<string, number>();
  for (const a of type.attrs) {
    const i = head.findIndex((h) => h === a.key || h === a.label.toLowerCase());
    if (i >= 0) col.set(a.key, i);
  }
  // Reference columns may hold the target's name instead of its id.
  const resolve = (a: Attr, v: string) => (a.type !== "reference" || !v ? v : (get<{ id: string }>("select id from asset_objects where (id = ? or label = ?) and type_id = ?", v, v, a.refTypeId ?? "")?.id ?? v));
  let created = 0;
  let updated = 0;
  const skipped: string[] = [];
  tx(() => {
    rows.slice(1).forEach((r, n) => {
      const label = (r[nameCol] ?? "").trim();
      if (!label) return skipped.push(`row ${n + 2}: no name`);
      const { values, error } = cleanAttrs(type.attrs, (k) => {
        const i = col.get(k);
        return i === undefined ? "" : resolve(type.attrs.find((a) => a.key === k)!, (r[i] ?? "").trim());
      });
      if (error) return skipped.push(`row ${n + 2}: ${error}`);
      const existing = get<{ id: string }>("select id from asset_objects where type_id = ? and label = ?", type.id, label);
      if (existing) {
        run("update asset_objects set attrs_json = ?, updated_at = ? where id = ?", JSON.stringify(values), now(), existing.id);
        updated++;
      } else {
        run("insert into asset_objects (id, type_id, label, attrs_json, created_at, updated_at) values (?, ?, ?, ?, ?, ?)", uid(), type.id, label, JSON.stringify(values), now(), now());
        created++;
      }
    });
  });
  back(page, {
    ok: `Imported: ${created} new, ${updated} updated.`,
    error: skipped.length ? `Skipped ${skipped.length}: ${skipped.slice(0, 4).join("; ")}${skipped.length > 4 ? "…" : ""}` : undefined,
  });
}
