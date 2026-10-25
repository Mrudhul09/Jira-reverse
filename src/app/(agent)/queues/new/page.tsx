import { saveQueueAction } from "@/app/actions/queues";
import { Banners, Card, PageHead } from "@/components/ui";
import { Checkbox, SelectField, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit";
import { isAdmin } from "@/lib/access";
import { requireAgent } from "@/lib/auth";
import { all } from "@/lib/db";
import { PRIORITY_LABEL } from "@/lib/priority";
import { CATEGORIES, CATEGORY_LABEL } from "@/lib/workflows";

export const metadata = { title: "New queue" };

export default async function NewQueue({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireAgent();
  const teams = all<{ id: string; name: string }>("select id, name from teams order by name");
  return (
    <div className="max-w-2xl">
      <Banners sp={await searchParams} />
      <PageHead title="New queue" intro="A saved view over all work. It updates as work moves." />
      <Card>
        <form action={saveQueueAction} className="space-y-4">
          <TextField id="name" name="name" label="Name" required maxLength={80} />
          <fieldset>
            <legend className="mb-1 text-sm font-semibold">Kinds of work (none ticked means all)</legend>
            <div className="flex flex-wrap gap-4">
              {CATEGORIES.map((c) => (
                <Checkbox key={c} name="categories" value={c} label={CATEGORY_LABEL[c]} />
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField id="scope" name="scope" label="Status" defaultValue="open" options={[{ value: "open", label: "Open" }, { value: "done", label: "Done" }, { value: "all", label: "Any" }]} />
            <SelectField id="assignee" name="assignee" label="Assignee" defaultValue="any" options={[{ value: "any", label: "Anyone" }, { value: "me", label: "Me" }, { value: "unassigned", label: "Nobody" }]} />
            <SelectField id="teamId" name="teamId" label="Team" placeholder="Any team" options={teams.map((t) => ({ value: t.id, label: t.name }))} />
            <TextField id="text" name="text" label="Words in summary or description" maxLength={100} />
          </div>
          <fieldset>
            <legend className="mb-1 text-sm font-semibold">Priorities (none ticked means all)</legend>
            <div className="flex flex-wrap gap-4">
              {[1, 2, 3, 4, 5].map((p) => (
                <Checkbox key={p} name="priorities" value={p} label={PRIORITY_LABEL[p]} />
              ))}
            </div>
          </fieldset>
          <Checkbox name="major" label="Major incidents only" />
          {isAdmin(user) ? <Checkbox name="shared" label="Share with every agent" /> : null}
          <SubmitButton>Save queue</SubmitButton>
        </form>
      </Card>
    </div>
  );
}
