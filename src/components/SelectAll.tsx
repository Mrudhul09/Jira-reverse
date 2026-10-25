"use client";

export function SelectAll({ formId }: { formId: string }) {
  return (
    <input
      type="checkbox"
      aria-label="Select all"
      className="size-4 accent-[var(--accent)]"
      onChange={(e) => {
        const on = e.currentTarget.checked;
        document.querySelectorAll<HTMLInputElement>(`input[name="ids"][form="${formId}"]`).forEach((box) => {
          box.checked = on;
        });
      }}
    />
  );
}
