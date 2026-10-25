import { Star } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { bulkAction } from "@/app/actions/items";
import { deleteQueueAction, starAction } from "@/app/actions/queues";
import { Board } from "@/components/Board";
import { MonthGrid } from "@/components/MonthGrid";
import { ItemTable } from "@/components/work";
import { Banners, Button, Card, EmptyState, LinkButton, PageHead, TabLinks, cx } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit";
import { isAdmin } from "@/lib/access";
import { requireAgent } from "@/lib/auth";
import { all } from "@/lib/db";
import { listItems, queuesFor, showCount } from "@/lib/queues";
import { ALL_STATUSES } from "@/lib/workflows";

type Sp = Record<string, string | undefined>;

export const metadata = { title: "Queues" };

export default async function QueuePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Sp> }) {
  const user = await requireAgent();
  const { id } = await params;
  const sp = await searchParams;
  const queues = queuesFor(user.id);
  const queue = queues.find((q) => q.id === id);
  if (!queue) notFound();
  const view = sp.view === "board" || sp.view === "calendar" ? sp.view : "list";
  const filter = {
    ...queue.filter,
    text: sp.q || queue.filter.text,
    requestTypeId: sp.type || queue.filter.requestTypeId,
    statuses: sp.status ? [sp.status] : queue.filter.statuses,
    assignee: sp.assignee || queue.filter.assignee,
  };
  const items = listItems(filter, user.id);
  const agents = all<{ id: string; name: string }>("select id, name from users where role != 'employee' and active = 1 and system = 0 order by name");
  const types = all<{ id: string; name: string }>("select id, name from request_types order by position");
  const path = `/queues/${queue.id}`;
  const keep = (extra: Sp) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: sp.q, type: sp.type, status: sp.status, assignee: sp.assignee, view: sp.view, ...extra })) if (v) p.set(k, v);
    return `${path}${p.size ? `?${p}` : ""}`;
  };
  const filtered = !!(sp.q || sp.type || sp.status || sp.assignee);
  const now = new Date();

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <nav aria-label="Queues" className="self-start rounded-lg border border-line bg-canvas">
        <div className="flex items-center justify-between border-b border-line px-3 py-2">
          <h2 className="text-base">Queues</h2>
          <LinkButton href="/queues/new" size="sm">
            New
          </LinkButton>
        </div>
        <ul className="p-1.5">
          {queues.map((q) => (
            <li key={q.id}>
              <Link
                href={`/queues/${q.id}`}
                aria-current={q.id === queue.id ? "page" : undefined}
                className={cx("flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-fg no-underline hover:bg-surface hover:no-underline", q.id === queue.id && "bg-accent-soft font-semibold")}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  {q.starred ? <Star aria-label="starred" className="size-3.5 flex-none fill-current text-accent" /> : null}
                  <span className="truncate">{q.name}</span>
                </span>
                <span className="text-sm text-muted">{showCount(q.count)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section className="min-w-0">
        <Banners sp={sp} />
        <PageHead
          title={queue.name}
          intro={`${items.length} work item${items.length === 1 ? "" : "s"}${filtered ? " match your filters" : ""} · ${queue.owner_id ? "only you see this queue" : "shared with every agent"}`}
          actions={
            <>
              <form action={starAction}>
                <input type="hidden" name="queueId" value={queue.id} />
                <Button aria-pressed={queue.starred}>
                  <Star aria-hidden="true" className={cx("size-4", queue.starred && "fill-current text-accent")} /> {queue.starred ? "Starred" : "Star"}
                </Button>
              </form>
              {queue.owner_id === user.id || isAdmin(user) ? (
                <form action={deleteQueueAction}>
                  <input type="hidden" name="queueId" value={queue.id} />
                  <Button variant="subtle">Delete</Button>
                </form>
              ) : null}
            </>
          }
        />
        <form action={path} className="mb-3 flex flex-wrap items-end gap-2" role="search" aria-label="Filter this queue">
          {view !== "list" ? <input type="hidden" name="view" value={view} /> : null}
          <label className="sr-only" htmlFor="fq">
            Words
          </label>
          <input id="fq" name="q" type="search" defaultValue={sp.q ?? ""} placeholder="Words or key" className="control w-48" />
          <label className="sr-only" htmlFor="ft">
            Request type
          </label>
          <select id="ft" name="type" defaultValue={sp.type ?? ""} className="control w-48">
            <option value="">Any request type</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="fs">
            Status
          </label>
          <select id="fs" name="status" defaultValue={sp.status ?? ""} className="control w-44">
            <option value="">Any status</option>
            {ALL_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <label className="sr-only" htmlFor="fa">
            Assignee
          </label>
          <select id="fa" name="assignee" defaultValue={sp.assignee ?? ""} className="control w-44">
            <option value="">Anyone</option>
            <option value="me">Me</option>
            <option value="unassigned">Nobody</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <Button type="submit">Filter</Button>
          {filtered ? (
            <LinkButton href={keep({ q: "", type: "", status: "", assignee: "" })} variant="subtle">
              Clear
            </LinkButton>
          ) : null}
        </form>
        <TabLinks
          label="Queue view"
          current={view}
          tabs={[
            { key: "list", label: "List", href: keep({ view: "" }) },
            { key: "board", label: "Board", href: keep({ view: "board" }) },
            { key: "calendar", label: "Calendar", href: keep({ view: "calendar" }) },
          ]}
        />
        {!items.length ? (
          <Card>
            <EmptyState title={filtered ? "Nothing matches" : "All clear"}>{filtered ? "Loosen the filters to see more." : "Nothing is waiting in this queue."}</EmptyState>
          </Card>
        ) : view === "board" ? (
          <Board items={items} />
        ) : view === "calendar" ? (
          <MonthGrid
            year={now.getFullYear()}
            month={now.getMonth()}
            label="Work by date raised"
            events={items.map((i) => ({
              key: i.id,
              href: `/items/${i.key}`,
              label: `${i.key} ${i.summary}`,
              start: i.planned_start ?? i.created_at,
              end: i.planned_end ?? i.created_at,
              tone: i.priority <= 1 || i.is_major ? "danger" : i.priority === 2 ? "warning" : "accent",
              title: `${i.key} ${i.summary} (${i.status})`,
            }))}
          />
        ) : (
          <>
            <form id="bulk" action={bulkAction} className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-surface p-2.5">
              <input type="hidden" name="returnTo" value={keep({})} />
              <strong className="text-sm">With the ticked ones:</strong>
              <label className="sr-only" htmlFor="b-who">
                Assign to
              </label>
              <select id="b-who" name="assigneeId" className="control w-44">
                <option value="">Nobody</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <SubmitButton size="sm" variant="secondary" name="op" value="assign">
                Assign
              </SubmitButton>
              <span className="text-muted">or</span>
              <label className="sr-only" htmlFor="b-to">
                Move to
              </label>
              <select id="b-to" name="to" className="control w-48">
                {ALL_STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <SubmitButton size="sm" variant="secondary" name="op" value="move">
                Move
              </SubmitButton>
            </form>
            <ItemTable items={items} formId="bulk" />
          </>
        )}
      </section>
    </div>
  );
}
