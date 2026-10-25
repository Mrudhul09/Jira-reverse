import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "subtle" | "danger";
type Size = "sm" | "md";

const VARIANT: Record<Variant, string> = {
  primary: "bg-accent text-on-accent border-accent hover:bg-accent-hover",
  secondary: "bg-canvas text-fg border-line hover:bg-surface",
  subtle: "bg-transparent text-fg border-transparent hover:bg-sunken",
  danger: "bg-canvas text-danger border-danger hover:bg-danger-soft",
};
const SIZE: Record<Size, string> = { sm: "h-7 px-2 text-xs", md: "h-9 px-3 text-base" };

export function buttonClass(variant: Variant = "secondary", size: Size = "md"): string {
  return cx(
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md border font-semibold no-underline transition-colors duration-100 hover:no-underline disabled:cursor-not-allowed disabled:opacity-55 aria-busy:cursor-progress",
    VARIANT[variant],
    SIZE[size],
  );
}

export function Button({ variant, size, className, ...rest }: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={cx(buttonClass(variant, size), className)} {...rest} />;
}

export function LinkButton({ variant, size, className, ...rest }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={cx(buttonClass(variant, size), className)} {...rest} />;
}

export type Tone = "todo" | "inprogress" | "done" | "bad" | "warning" | "accent";
const TONE: Record<Tone, string> = {
  todo: "bg-sunken text-fg",
  inprogress: "bg-info-soft text-info",
  done: "bg-success-soft text-success",
  bad: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
  accent: "bg-accent-soft text-accent",
};

export function Lozenge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={cx("inline-block whitespace-nowrap rounded-sm px-1.5 py-px text-xs font-bold uppercase tracking-wide", TONE[tone])}>{children}</span>;
}

const PRIORITY_NAME: Record<number, string> = { 1: "Highest", 2: "High", 3: "Medium", 4: "Low", 5: "Lowest" };
const PRIORITY_BG: Record<number, string> = { 1: "bg-p1", 2: "bg-p2", 3: "bg-p3", 4: "bg-p4", 5: "bg-p5" };

export function PriorityMark({ value, short = false }: { value: number; short?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm" title={`P${value} ${PRIORITY_NAME[value] ?? ""}`}>
      <span aria-hidden="true" className={cx("inline-block size-2.5 rounded-[2px]", PRIORITY_BG[value])} />
      {short ? `P${value}` : `P${value} ${PRIORITY_NAME[value] ?? ""}`}
    </span>
  );
}

export function Card({ className, sunken = false, ...rest }: ComponentProps<"div"> & { sunken?: boolean }) {
  return <div className={cx("rounded-lg border border-line p-4", sunken ? "bg-surface" : "bg-canvas", className)} {...rest} />;
}

export function Panel({ title, actions, children, className }: { title: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-lg border border-line bg-canvas", className)}>
      <header className="flex items-center justify-between gap-2 border-b border-line px-3.5 py-2.5">
        <h3 className="text-base font-semibold">{title}</h3>
        {actions}
      </header>
      <div className="px-3.5 py-3">{children}</div>
    </section>
  );
}

export function Banners({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const error = typeof sp.error === "string" ? sp.error : null;
  const ok = typeof sp.ok === "string" ? sp.ok : null;
  return (
    <>
      {error ? <Banner tone="error">{error}</Banner> : null}
      {ok ? <Banner tone="ok">{ok}</Banner> : null}
    </>
  );
}

export function Banner({ tone, children }: { tone: "error" | "ok" | "info"; children: ReactNode }) {
  const cls = { error: "bg-danger-soft text-danger border-danger/30", ok: "bg-success-soft text-success border-success/30", info: "bg-info-soft text-info border-info/30" }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("mb-4 rounded-md border px-3.5 py-2.5", cls)}>
      {children}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-4 py-10 text-center text-muted">
      <p className="mb-1 text-lg text-fg">{title}</p>
      {children}
    </div>
  );
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function Avatar({ name }: { name: string | null | undefined }) {
  return (
    <span aria-hidden="true" title={name ?? undefined} className="inline-grid size-6 flex-none place-items-center rounded-full bg-accent-soft text-[11px] font-bold text-accent">
      {name ? initials(name) : "?"}
    </span>
  );
}

export function Person({ name, empty = "Unassigned" }: { name: string | null | undefined; empty?: string }) {
  if (!name) return <span className="text-muted">{empty}</span>;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <Avatar name={name} />
      {name}
    </span>
  );
}

export function PageHead({ title, intro, actions }: { title: ReactNode; intro?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1>{title}</h1>
        {intro ? <p className="mt-1 text-muted">{intro}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function TabLinks({ tabs, current, label }: { tabs: { href: string; label: ReactNode; key: string }[]; current: string; label: string }) {
  return (
    <nav aria-label={label} className="mb-3 flex gap-0.5 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === current ? "page" : undefined}
          className={cx(
            "-mb-px whitespace-nowrap border-b-2 px-3 py-2 no-underline hover:no-underline",
            t.key === current ? "border-accent font-semibold text-accent" : "border-transparent text-muted hover:text-fg",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export function Kv({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[130px_1fr] items-center gap-x-3 gap-y-2">
      {rows.map(([k, v], i) => (
        <div key={i} className="contents">
          <dt className="text-sm text-muted">{k}</dt>
          <dd className="min-w-0">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
