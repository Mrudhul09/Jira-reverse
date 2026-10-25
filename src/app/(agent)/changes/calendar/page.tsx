import { ChevronLeft, ChevronRight } from "lucide-react";
import { MonthGrid } from "@/components/MonthGrid";
import { LinkButton, PageHead } from "@/components/ui";
import { requireAgent } from "@/lib/auth";
import { all } from "@/lib/db";

export const metadata = { title: "Change calendar" };

const DAY = 86_400_000;

export default async function ChangeCalendar({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAgent();
  const m = /^(\d{4})-(\d{2})$/.exec((await searchParams).month ?? "");
  const today = new Date();
  const year = m ? Number(m[1]) : today.getFullYear();
  const month = m ? Number(m[2]) - 1 : today.getMonth();
  const from = new Date(year, month, 1).getTime() - 7 * DAY;
  const to = new Date(year, month + 1, 1).getTime() + 14 * DAY;
  const changes = all<{ key: string; summary: string; status: string; change_type: string; change_risk: string; planned_start: number; planned_end: number | null }>(
    `select key, summary, status, change_type, change_risk, planned_start, planned_end from items
      where category = 'change' and planned_start is not null and planned_start < ? and coalesce(planned_end, planned_start) >= ?
        and status not in ('Canceled', 'Declined') order by planned_start`,
    to,
    from,
  );
  const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const time = (t: number) => new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return (
    <>
      <PageHead
        title="Change calendar"
        intro="Every planned change window. Red is high or critical risk, amber is medium."
        actions={
          <>
            <LinkButton href={`/changes/calendar?month=${ym(new Date(year, month - 1, 1))}`} aria-label="Previous month">
              <ChevronLeft aria-hidden="true" className="size-4" />
            </LinkButton>
            <strong className="min-w-36 text-center">{new Date(year, month, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</strong>
            <LinkButton href={`/changes/calendar?month=${ym(new Date(year, month + 1, 1))}`} aria-label="Next month">
              <ChevronRight aria-hidden="true" className="size-4" />
            </LinkButton>
            <LinkButton href="/changes/calendar">This month</LinkButton>
            <LinkButton href="/items/new?category=change" variant="primary">
              New change
            </LinkButton>
          </>
        }
      />
      <MonthGrid
        year={year}
        month={month}
        label="Change windows"
        events={changes.map((c) => ({
          key: c.key,
          href: `/items/${c.key}`,
          label: `${time(c.planned_start)} ${c.key} ${c.summary}`,
          start: c.planned_start,
          end: c.planned_end ?? c.planned_start,
          tone: c.change_risk === "high" || c.change_risk === "critical" ? "danger" : c.change_risk === "medium" ? "warning" : "accent",
          title: `${c.key} ${c.summary} · ${c.status} · ${c.change_type}, ${c.change_risk} risk`,
        }))}
      />
    </>
  );
}
