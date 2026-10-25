import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteArticleAction } from "@/app/actions/kb";
import { Banners, Card, LinkButton, PageHead } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit";
import { requireAgent } from "@/lib/auth";
import { get } from "@/lib/db";
import { date } from "@/lib/format";
import type { Article } from "@/lib/kb";

export const metadata = { title: "Article" };

export default async function AgentArticle({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAgent();
  const a = get<Article & { author: string | null; source_key: string | null }>(
    "select a.*, u.name as author, i.key as source_key from articles a left join users u on u.id = a.author_id left join items i on i.id = a.source_item_id where a.id = ?",
    (await params).id,
  );
  if (!a) notFound();
  return (
    <div className="max-w-4xl">
      <Banners sp={await searchParams} />
      <p className="mb-1.5 text-sm text-muted">
        <Link href="/kb">Knowledge base</Link> / {a.category}
      </p>
      <PageHead
        title={a.title}
        intro={`${a.author ?? "Unknown author"} · updated ${date(a.updated_at)} · ${a.views} reads · ${a.helpful} helped, ${a.not_helpful} didn't · ${a.portal_visible ? "everyone can see it" : "IT team only"}`}
        actions={
          <>
            {a.portal_visible ? <LinkButton href={`/portal/kb/${a.id}`}>See it as an employee</LinkButton> : null}
            <LinkButton href={`/kb/${a.id}/edit`} variant="primary">
              Edit
            </LinkButton>
            <form action={deleteArticleAction}>
              <input type="hidden" name="id" value={a.id} />
              <SubmitButton variant="danger">Delete</SubmitButton>
            </form>
          </>
        }
      />
      {a.source_key ? (
        <p className="mb-3 text-sm text-muted">
          Written from <Link href={`/items/${a.source_key}`}>{a.source_key}</Link>.
        </p>
      ) : null}
      <Card className="prose-plain leading-6">{a.body}</Card>
    </div>
  );
}
