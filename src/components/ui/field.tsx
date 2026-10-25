import type { ComponentProps, ReactNode } from "react";
import { cx } from "./index";

interface FieldProps {
  id: string;
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: string | null;
  className?: string;
}

// Label + control + hint + error, wired with aria-describedby.
function Shell({ id, label, required, hint, error, className, children }: FieldProps & { children: ReactNode }) {
  return (
    <div className={cx("flex flex-col", className)}>
      <label htmlFor={id} className="mb-1 text-sm font-semibold">
        {label}
        {required ? (
          <span className="text-danger" aria-hidden="true">
            {" "}*
          </span>
        ) : null}
      </label>
      {children}
      {hint ? (
        <span id={`${id}-hint`} className="mt-1 text-xs font-normal text-muted">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={`${id}-error`} className="mt-1 text-sm text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}

function describedBy(id: string, hint?: ReactNode, error?: string | null) {
  return [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
}

export function TextField({ id, label, required, hint, error, className, ...input }: FieldProps & Omit<ComponentProps<"input">, "id">) {
  return (
    <Shell id={id} label={label} required={required} hint={hint} error={error} className={className}>
      <input id={id} required={required} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, hint, error)} className="control" type="text" {...input} />
    </Shell>
  );
}

export function TextArea({ id, label, required, hint, error, className, ...input }: FieldProps & Omit<ComponentProps<"textarea">, "id">) {
  return (
    <Shell id={id} label={label} required={required} hint={hint} error={error} className={className}>
      <textarea id={id} required={required} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, hint, error)} className="control" {...input} />
    </Shell>
  );
}

export function SelectField({
  id,
  label,
  required,
  hint,
  error,
  className,
  options,
  placeholder,
  ...select
}: FieldProps & Omit<ComponentProps<"select">, "id"> & { options: { value: string | number; label: ReactNode }[]; placeholder?: string }) {
  return (
    <Shell id={id} label={label} required={required} hint={hint} error={error} className={className}>
      <select id={id} required={required} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, hint, error)} className="control" {...select}>
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={String(o.value)} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Shell>
  );
}

export function Checkbox({ label, className, ...input }: { label: ReactNode } & ComponentProps<"input">) {
  return (
    <label className={cx("inline-flex items-center gap-2 text-base", className)}>
      <input type="checkbox" className="size-4 accent-[var(--accent)]" {...input} />
      {label}
    </label>
  );
}
