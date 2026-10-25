import { all, get, marks, parseJson } from "./db";

export interface Attr {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "reference";
  options?: string[];
  refTypeId?: string;
}

export interface AssetType {
  id: string;
  schema_id: string;
  name: string;
  attributes_json: string;
}

export interface AssetObject {
  id: string;
  type_id: string;
  label: string;
  attrs_json: string;
  created_at: number;
  updated_at: number;
}

export function getType(id: string | null | undefined): (AssetType & { attrs: Attr[] }) | undefined {
  if (!id) return undefined;
  const t = get<AssetType>("select * from asset_types where id = ?", id);
  return t ? { ...t, attrs: parseJson<Attr[]>(t.attributes_json, []) } : undefined;
}

export function labels(ids: string[]): Map<string, string> {
  if (!ids.length) return new Map();
  return new Map(all<{ id: string; label: string }>(`select id, label from asset_objects where id in (${marks(ids.length)})`, ...ids).map((o) => [o.id, o.label]));
}

// Checks submitted values against the type's attributes.
export function cleanAttrs(attrs: Attr[], read: (key: string) => string): { values: Record<string, string>; error?: string } {
  const values: Record<string, string> = {};
  for (const a of attrs) {
    const v = read(a.key).trim();
    if (!v) continue;
    if (a.type === "number" && !Number.isFinite(Number(v))) return { values, error: `${a.label} must be a number.` };
    if (a.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return { values, error: `${a.label} must be a date like 2026-01-31.` };
    if (a.type === "select" && a.options && !a.options.includes(v)) return { values, error: `${a.label} must be one of: ${a.options.join(", ")}.` };
    if (a.type === "reference") {
      const ref = get<{ type_id: string }>("select type_id from asset_objects where id = ?", v);
      if (!ref || (a.refTypeId && ref.type_id !== a.refTypeId)) return { values, error: `${a.label} must point at an existing object.` };
    }
    values[a.key] = v;
  }
  return { values };
}

// RFC 4180 CSV: quoted fields, doubled quotes, commas and line breaks inside quotes.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const endRow = () => {
    row.push(field);
    if (row.some((f) => f.trim())) rows.push(row);
    row = [];
    field = "";
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      endRow();
    } else field += c;
  }
  endRow();
  return rows;
}
