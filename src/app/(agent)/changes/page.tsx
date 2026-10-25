import { CalendarRange } from "lucide-react";
import { WorkList } from "@/components/WorkList";
import { LinkButton } from "@/components/ui";
import { requireAgent } from "@/lib/auth";
import { dateTime } from "@/lib/format";

export const metadata = { title: "Changes" };

export default async function Changes({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireAgent();
  return (
    <WorkList
      category="change"
      title="Changes"
      intro="Planned changes to live systems. Normal changes get a teammate's review, then the CAB's; standard ones are pre-approved."
      userId={user.id}
      sp={await searchParams}
      actions={
        <LinkButton href="/changes/calendar">
          <CalendarRange aria-hidden="true" className="size-4" /> Calendar
        </LinkButton>
      }
      views={[
        { key: "open", label: "Open", filter: { scope: "open" } },
        { key: "approval", label: "Waiting for approval", filter: { scope: "open", statuses: ["Awaiting approval"] } },
        { key: "scheduled", label: "Scheduled", filter: { scope: "open", statuses: ["Awaiting implementation", "Implementing"] } },
        { key: "done", label: "Done", filter: { scope: "done" } },
      ]}
      extra={{
        header: "Window · type · risk",
        cell: (i) => (
          <>
            {i.planned_start ? dateTime(i.planned_start) : "Not scheduled"}
            <span className="block text-muted">
              {i.change_type} · {i.change_risk} risk
            </span>
          </>
        ),
      }}
    />
  );
}
