import { APP_NAME } from "@/lib/brand";

// Four window panes, one lit: you can always see in. Our own mark; see replica/brand.md.
export function Mark({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <rect x="2" y="2" width="28" height="28" rx="7" fill="currentColor" opacity="0.18" />
      <rect x="6" y="6" width="9" height="9" rx="2" fill="currentColor" opacity="0.55" />
      <rect x="17" y="6" width="9" height="9" rx="2" fill="currentColor" />
      <rect x="6" y="17" width="9" height="9" rx="2" fill="currentColor" opacity="0.55" />
      <rect x="17" y="17" width="9" height="9" rx="2" fill="currentColor" opacity="0.55" />
    </svg>
  );
}

export function Logo({ markClass }: { markClass?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-lg font-bold">
      <Mark className={markClass} /> {APP_NAME}
    </span>
  );
}
