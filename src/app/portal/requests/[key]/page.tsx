import Link from "next/link";
import { notFound } from "next/navigation";
import { decideAction, moveAction, rateAction } from "@/app/actions/items";
import { Activity } from "@/components/Activity";
import { CommentBox } from "@/components/CommentBox";
import { FieldValues } from "@/components/CustomFields";
import { Status } from "@/components/work";
import { Banners, Card, Lozenge, Panel } from "@/components/ui";
import { TextArea, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit";
import { canViewItem, isAgent } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { get, parseJson } from "@/lib/db";
import { ago, dateTime } from "@/lib/format";
import { approvals, comments, getItemByKey } from "@/lib/items";
import type { FieldDef } from "@/lib/types";
import { isDone, nextStatuses } from "@/lib/workflows";

export default async function RequestView({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const item = getItemByKey((await params).key);
  if (!item || !canViewItem(user, item)) notFound();
  const sp = await searchParams;
  const page = `/portal/requests/${item.key}`;
  const mine = item.reporter_id === user.id;
  const done = isDone(item.category, item.status);
  const moves = nextStatuses(item.category, item.status, item.change_type);
  const decisions = approvals(item.id);
  const waitingOnMe = decisions.find((a) => a.approver_id === user.id && a.decision === "pending");
  const fields = item.request_type_id ? parseJson<FieldDef[]>(get<{ f: string }>("select fields_json as f from request_types where id = ?", item.request_type_id)?.f, []) : [];
  const rating = get<{ score: number; comment: string }>("select score, comment from csat where item_id = ?", item.id);
  return (
    <main className="mx-auto max-w-5xl px-4 py-6 md:px-6">
      <Banners sp={sp} />
      <p className="mb-2 text-sm text-muted">
        <Link href="/portal/requests">My requests</Link> / <span className="font-mono">{item.key}</span>
        {isAgent(user) ? (
          <>
            {" · "}
            <Link href={`/items/${item.key}`}>Open as an agent</Link>
          </>
        ) : null}
      </p>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Card className="space-y-3">
            <h1 className="text-xl">{item.summary}</h1>
            <p className="text-sm text-muted">
              {item.reporter_name} asked {ago(item.created_at)} · {item.request_type_name ?? "Request"}
            </p>
            {item.description ? <p className="prose-plain">{item.description}</p> : null}
            <FieldValues fields={fields} values={parseJson(item.fields_json, {})} />
          </Card>
          <section className="space-y-3">
            <h2 className="text-lg">Conversation</h2>
            {!done ? <CommentBox itemId={item.id} returnTo={page} agent={false} /> : <p className="text-sm text-muted">This one is finished. Need more help? Ask again from the help center.</p>}
            <Activity comments={comments(item.id, false)} history={[]} show="comments" />
          </section>
        </div>
        <aside className="space-y-4">
          {waitingOnMe ? (
            <Panel title="Your decision" className="border-accent">
              <form action={decideAction} className="space-y-2.5">
                <input type="hidden" name="approvalId" value={waitingOnMe.id} />
                <input type="hidden" name="returnTo" value={page} />
                <TextArea id="note" name="note" label="Note to the requester (optional)" />
                <div className="flex gap-2">
                  <SubmitButton name="decision" value="approved">
                    Approve
                  </SubmitButton>
                  <SubmitButton variant="danger" name="decision" value="declined">
                    Decline
                  </SubmitButton>
                </div>
              </form>
            </Panel>
          ) : null}
          <Panel title="Where it's at" actions={<Status category={item.category} status={item.status} />}>
            <div className="space-y-2 text-sm">
              <p>
                Reference <span className="font-mono">{item.key}</span>
              </p>
              <p>Looked after by {item.assignee_name ?? item.team_name ?? "the IT team"}</p>
              <p>Updated {dateTime(item.updated_at)}</p>
              {item.resolution ? (
                <div>
                  <strong>What we did</strong>
                  <p className="prose-plain">{item.resolution}</p>
                </div>
              ) : null}
              {decisions.length ? (
                <div className="space-y-1.5">
                  <strong>Approvals</strong>
                  {decisions.map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-2">
                      <span>{a.approver_name}</span>
                      <Lozenge tone={a.decision === "approved" ? "done" : a.decision === "declined" ? "bad" : a.decision === "pending" ? "warning" : "todo"}>{a.decision}</Lozenge>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2 pt-1">
                {mine && moves.includes("Closed") ? (
                  <form action={moveAction}>
                    <input type="hidden" name="itemId" value={item.id} />
                    <input type="hidden" name="to" value="Closed" />
                    <input type="hidden" name="returnTo" value={page} />
                    <SubmitButton size="sm">Sorted, close it</SubmitButton>
                  </form>
                ) : null}
                {mine && moves.includes("Canceled") ? (
                  <form action={moveAction}>
                    <input type="hidden" name="itemId" value={item.id} />
                    <input type="hidden" name="to" value="Canceled" />
                    <input type="hidden" name="returnTo" value={page} />
                    <SubmitButton size="sm" variant="subtle">
                      I don't need this any more
                    </SubmitButton>
                  </form>
                ) : null}
              </div>
            </div>
          </Panel>
          {mine && done ? (
            <Panel title="How did we do?">
              <form action={rateAction} className="space-y-2.5">
                <input type="hidden" name="itemId" value={item.id} />
                <fieldset className="flex gap-3">
                  <legend className="sr-only">Rating out of 5</legend>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <label key={s} className="inline-flex items-center gap-1">
                      <input type="radio" name="score" value={s} defaultChecked={rating?.score === s} required className="accent-[var(--accent)]" /> {s}★
                    </label>
                  ))}
                </fieldset>
                <TextField id="rate-note" name="comment" label="Anything to add?" defaultValue={rating?.comment} />
                <SubmitButton size="sm" variant="secondary">
                  {rating ? "Update rating" : "Send rating"}
                </SubmitButton>
              </form>
            </Panel>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
