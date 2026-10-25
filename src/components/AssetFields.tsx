import type { Attr } from "@/lib/assets";
import { all } from "@/lib/db";
import { SelectField, TextField } from "./ui/field";

export function AssetFields({ attrs, values = {}, prefix }: { attrs: Attr[]; values?: Record<string, string>; prefix: string }) {
  return (
    <>
      {attrs.map((a) => {
        const common = { id: `${prefix}-${a.key}`, name: `a_${a.key}`, label: a.label, defaultValue: values[a.key] ?? "" };
        if (a.type === "select") return <SelectField key={a.key} {...common} placeholder="-" options={(a.options ?? []).map((o) => ({ value: o, label: o }))} />;
        if (a.type === "reference") {
          const targets = all<{ id: string; label: string }>("select id, label from asset_objects where type_id = ? order by label", a.refTypeId ?? "");
          return <SelectField key={a.key} {...common} placeholder="-" options={targets.map((t) => ({ value: t.id, label: t.label }))} />;
        }
        return <TextField key={a.key} {...common} type={a.type === "number" ? "number" : a.type === "date" ? "date" : "text"} />;
      })}
    </>
  );
}
