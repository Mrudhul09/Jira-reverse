import type { FieldDef } from "@/lib/types";
import { SelectField, TextArea, TextField } from "./ui/field";

// The extra fields a request type asks for.
export function CustomFields({ fields }: { fields: FieldDef[] }) {
  return (
    <>
      {fields.map((f) =>
        f.type === "select" ? (
          <SelectField key={f.key} id={`f_${f.key}`} name={`f_${f.key}`} label={f.label} required={f.required} placeholder="Choose…" options={(f.options ?? []).map((o) => ({ value: o, label: o }))} defaultValue="" />
        ) : f.type === "textarea" ? (
          <TextArea key={f.key} id={`f_${f.key}`} name={`f_${f.key}`} label={f.label} required={f.required} />
        ) : (
          <TextField key={f.key} id={`f_${f.key}`} name={`f_${f.key}`} label={f.label} required={f.required} type={f.type === "date" ? "date" : "text"} />
        ),
      )}
    </>
  );
}

export function FieldValues({ fields, values }: { fields: FieldDef[]; values: Record<string, string> }) {
  if (!fields.length) return null;
  return (
    <dl className="grid grid-cols-[minmax(120px,auto)_1fr] gap-x-3 gap-y-2">
      {fields.map((f) => (
        <div key={f.key} className="contents">
          <dt className="text-sm text-muted">{f.label}</dt>
          <dd className="prose-plain">{values[f.key] || <span className="text-muted">-</span>}</dd>
        </div>
      ))}
    </dl>
  );
}
