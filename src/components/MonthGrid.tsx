import Link from "next/link";
import { cx } from "./ui";

export interface CalEvent {
  key: string;
  href: string;
  label: string;
  start: number;
  end: number;
  tone: "accent" | "warning" | "danger";
  title: string;
}

const DAY = 86_400_000;
const TONE = { accent: "bg-accent-soft text-accent", warning: "bg-warning-soft text-warning", danger: "bg-danger-soft text-danger" };

// Month view, weeks start on Monday. `month` is 0-11.
export function MonthGrid({ year, month, events, label }: { year: number; month: number; events: CalEvent[]; label: string }) {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - ((first.getDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  const today = new Date().toDateString();
  return (
    <div role="grid" aria-label={label} className="grid grid-cols-7 overflow-hidden rounded-lg border border-line">
      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
        <div key={d} role="columnheader" className="border-b border-line bg-surface px-2 py-1.5 text-xs font-semibold text-muted">
          {d}
        </div>
      ))}
      {days.map((d, i) => {
        const from = d.getTime();
        const here = events.filter((e) => e.start < from + DAY && Math.max(e.end, e.start + 1) > from);
        return (
          <div key={from} role="gridcell" className={cx("min-h-24 border-b border-line p-1.5 text-xs", i % 7 !== 6 && "border-r", d.getMonth() !== month && "bg-surface text-muted")}>
            <span className={cx("inline-block px-1.5", d.toDateString() === today && "rounded-full bg-accent text-on-accent")}>{d.getDate()}</span>
            {here.map((e) => (
              <Link key={e.key} href={e.href} title={e.title} className={cx("mt-1 block truncate rounded-sm px-1.5 py-0.5 font-semibold no-underline hover:no-underline", TONE[e.tone])}>
                {e.label}
              </Link>
            ))}
          </div>
        );
      })}
    </div>
  );
}
