import Link from "next/link";
import { decideAction } from "@/app/actions/items";
import { Status } from "@/components/work";
import { Banners, Card, EmptyState, Lozenge, PageHead, PriorityMark } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { requireAgent } from "@/lib/auth";
import { all } from "@/lib/db";
import { ago, dateTime } from "@/lib/format";
import { CATEGORY_LABEL, type Category } from "@/lib/workflows";

export const metadata = { title: "Approvals" };

interface Row {
  id: string;
  stage: string;
  decision: string;
  note: string;
  created_at: number;
  decided_at: number | null;
  key: string;
  summary: string;
  category: Category;
  status: string;
  priority: number;
  reporter: string;
  planned_start: number | null;
  change_risk: string | null;
}

export default async function Approvals({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireAgent();
  const sp = await searchParams;
  const rows = all<Row>(
    `select a.id, a.stage, a.decision, a.note, a.created_at, a.decided_at, i.key, i.summary, i.category, i.status, i.priority,
            r.name as reporter, i.planned_start, i.change_risk
       from approvals a join items i on i.id = a.item_id join users r on r.id = i.reporter_id
      where a.approver_id = ? order by a.decision = 'pending' desc, coalesce(a.decided_at, a.created_at) desc limit 100`,
    user.id,
  );
  const waiting = rows.filter((r) => r.decision === "pending");
  const decided = rows.filter((r) => r.decision !== "pending");
  return (
    <>
      <Banners sp={sp} />
      <PageHead title="Approvals" intro="Requests and changes waiting for your decision." />
      <div className="space-y-3">
        {waiting.length ? null : (
          <Card>
            <EmptyState title="Nothing waiting for you" />
          </Card>
        )}
        {waiting.map((r) => (
          <Card key={r.id} className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-sm text-muted">
                <Link href={`/items/${r.key}`} className="font-mono">
                  {r.key}
                </Link>{" "}
                · {CATEGORY_LABEL[r.category]} · {r.stage} · asked {ago(r.created_at)}
              </p>
              <Link href={`/items/${r.key}`} className="block text-lg font-semibold text-fg">
                {r.summary}
              </Link>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Status category={r.category} status={r.status} />
                <PriorityMark value={r.priority} />
                <span className="text-muted">Raised by {r.reporter}</span>
                {r.planned_start ? <span className="text-muted">Window {dateTime(r.planned_start)}</span> : null}
                {r.change_risk ? <span className="text-muted">{r.change_risk} risk</span> : null}
              </div>
            </div>
            <form action={decideAction} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="approvalId" value={r.id} />
              <input type="hidden" name="returnTo" value="/approvals" />
              <label htmlFor={`n-${r.id}`} className="sr-only">
                Note
              </label>
              <input id={`n-${r.id}`} name="note" placeholder="Note (optional)" className="control w-48" />
              <SubmitButton name="decision" value="approved">
                Approve
              </SubmitButton>
              <SubmitButton variant="danger" name="decision" value="declined">
                Decline
              </SubmitButton>
            </form>
          </Card>
        ))}
        {decided.length ? (
          <>
            <h2 className="pt-4 text-lg">Already decided</h2>
            <Table>
              <thead>
                <tr>
                  <Th>Key</Th>
                  <Th>Summary</Th>
                  <Th>Stage</Th>
                  <Th>You said</Th>
                  <Th>When</Th>
                </tr>
              </thead>
              <tbody>
                {decided.map((r) => (
                  <Tr key={r.id}>
                    <Td className="whitespace-nowrap font-mono text-sm">
                      <Link href={`/items/${r.key}`}>{r.key}</Link>
                    </Td>
                    <Td>{r.summary}</Td>
                    <Td className="text-sm">{r.stage}</Td>
                    <Td title={r.note || undefined}>
                      <Lozenge tone={r.decision === "approved" ? "done" : r.decision === "declined" ? "bad" : "todo"}>{r.decision}</Lozenge>
                    </Td>
                    <Td className="text-sm text-muted">{ago(r.decided_at ?? r.created_at)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </>
        ) : null}
      </div>
    </>
  );
}
