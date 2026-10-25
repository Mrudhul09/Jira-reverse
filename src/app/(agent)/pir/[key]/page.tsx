import Link from "next/link";
import { notFound } from "next/navigation";
import { savePirAction } from "@/app/actions/pir";
import { Banners, Card, PageHead } from "@/components/ui";
import { TextArea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit";
import { requireAgent } from "@/lib/auth";
import { get } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { comments, getItemByKey, history } from "@/lib/items";

export const metadata = { title: "Post-incident review" };

interface Pir {
  summary: string;
  impact: string;
  root_cause: string;
  timeline: string;
  actions: string;
  status: string;
  updated_at: number;
}

export default async function PirPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAgent();
  const item = getItemByKey((await params).key);
  if (!item || item.category !== "incident") notFound();
  const pir = get<Pir>("select * from pirs where incident_id = ?", item.id);
  // First draft of the timeline, from the incident's own record.
  const draft = [
    ...history(item.id).map((h) => ({ at: h.created_at, text: `${h.actor_name ?? "Someone"}: ${h.field === "created" ? "incident raised" : `${h.field} ${h.old_value ? `${h.old_value} → ` : ""}${h.new_value ?? ""}`}` })),
    ...comments(item.id, true).map((c) => ({ at: c.occurred_at, text: `${c.author_name}${c.internal ? " (note)" : ""}: ${c.body.split("\n")[0].slice(0, 160)}` })),
  ]
    .sort((a, b) => a.at - b.at)
    .map((e) => `${dateTime(e.at)}  ${e.text}`)
    .join("\n");
  const minutes = item.resolved_at ? Math.round((item.resolved_at - item.created_at) / 60_000) : null;
  return (
    <div className="max-w-4xl">
      <Banners sp={await searchParams} />
      <p className="mb-1.5 text-sm text-muted">
        <Link href={`/items/${item.key}`}>{item.key}</Link> / Post-incident review
      </p>
      <PageHead
        title={`Review: ${item.summary}`}
        intro={`${pir ? `${pir.status === "published" ? "Published" : "Draft"}, saved ${dateTime(pir.updated_at)}` : "Not started"} · raised ${dateTime(item.created_at)} · ${
          minutes !== null ? `fixed after ${Math.floor(minutes / 60)}h ${minutes % 60}m` : "still open"
        }`}
      />
      <Card>
        <form action={savePirAction} className="space-y-4">
          <input type="hidden" name="incidentId" value={item.id} />
          <TextArea id="summary" name="summary" label="What happened" defaultValue={pir?.summary ?? item.description} />
          <TextArea id="impact" name="impact" label="Who was affected, how badly, for how long" defaultValue={pir?.impact} />
          <TextArea id="root_cause" name="root_cause" label="Why it happened" hint="Describe the conditions that allowed it, not who to blame." defaultValue={pir?.root_cause} />
          <TextArea id="timeline" name="timeline" label="Timeline" defaultValue={pir?.timeline || draft} className="[&_textarea]:min-h-60 [&_textarea]:font-mono [&_textarea]:text-sm" />
          <TextArea id="actions" name="actions" label="What we'll do so it doesn't happen again (who, by when)" defaultValue={pir?.actions} />
          <div className="flex gap-2">
            <SubmitButton variant="secondary" name="op" value="draft">
              Save draft
            </SubmitButton>
            <SubmitButton name="op" value="publish">
              {pir?.status === "published" ? "Update the published review" : "Publish"}
            </SubmitButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
