import { isAgent } from "@/lib/access";
import { getType, labels, type AssetObject } from "@/lib/assets";
import { currentUser } from "@/lib/auth";
import { all, parseJson } from "@/lib/db";

const cell = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

// Same columns the import reads, links written as the other object's name, so a file can go out and back in.
export async function GET(req: Request) {
  const user = await currentUser();
  if (!isAgent(user)) return new Response("Sign in as an agent.", { status: 401 });
  const type = getType(new URL(req.url).searchParams.get("type"));
  if (!type) return new Response("No such object type.", { status: 404 });
  const objects = all<AssetObject>("select * from asset_objects where type_id = ? order by label", type.id);
  const values = objects.map((o) => parseJson<Record<string, string>>(o.attrs_json, {}));
  const names = labels(values.flatMap((v) => type.attrs.filter((a) => a.type === "reference" && v[a.key]).map((a) => v[a.key])));
  const lines = [["name", ...type.attrs.map((a) => a.key)].join(",")];
  objects.forEach((o, i) => {
    lines.push([o.label, ...type.attrs.map((a) => (a.type === "reference" ? (names.get(values[i][a.key]) ?? "") : (values[i][a.key] ?? "")))].map(cell).join(","));
  });
  const file = `${type.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(lines.join("\r\n") + "\r\n", {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${file}"`, "cache-control": "no-store" },
  });
}
