import Link from "next/link";
import { notFound } from "next/navigation";
import { raiseRequestAction } from "@/app/actions/items";
import { ArticleHints } from "@/components/ArticleHints";
import { CustomFields } from "@/components/CustomFields";
import { RequestTypeIcon } from "@/components/RequestTypeIcon";
import { Banners, Card, LinkButton } from "@/components/ui";
import { TextArea, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit";
import { canRaise } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { get, parseJson } from "@/lib/db";
import type { FieldDef, RequestType } from "@/lib/types";

export const metadata = { title: "Ask for help" };

export default async function Raise({ params, searchParams }: { params: Promise<{ type: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const rt = get<RequestType>("select * from request_types where id = ?", (await params).type);
  if (!rt || !canRaise(user, rt)) notFound();
  const sp = await searchParams;
  return (
    <main className="mx-auto max-w-2xl px-4 py-6 md:px-6">
      <Banners sp={sp} />
      <p className="mb-2 text-sm text-muted">
        <Link href="/portal">Help center</Link> / {rt.group_name}
      </p>
      <Card className="space-y-5">
        <div className="flex gap-3">
          <RequestTypeIcon name={rt.icon} />
          <div>
            <h1 className="text-xl">{rt.name}</h1>
            <p className="text-muted">{rt.description}</p>
            {rt.approver_id ? <p className="mt-1 text-sm text-muted">Someone approves this before we start.</p> : null}
          </div>
        </div>
        <form action={raiseRequestAction} className="space-y-4">
          <input type="hidden" name="typeId" value={rt.id} />
          <TextField id="summary" name="summary" label="Summary" required maxLength={200} autoComplete="off" placeholder="In a few words" />
          <ArticleHints inputId="summary" />
          <TextArea id="description" name="description" label="Anything else we should know?" hint="What you tried, error messages, when it started." />
          <CustomFields fields={parseJson<FieldDef[]>(rt.fields_json, [])} />
          <div className="flex gap-2">
            <SubmitButton>Send</SubmitButton>
            <LinkButton href="/portal" variant="subtle">
              Cancel
            </LinkButton>
          </div>
        </form>
      </Card>
    </main>
  );
}
