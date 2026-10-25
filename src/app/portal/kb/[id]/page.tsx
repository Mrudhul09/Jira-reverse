import Link from "next/link";
import { notFound } from "next/navigation";
import { voteAction } from "@/app/actions/kb";
import { Banners, Card } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit";
import { isAgent } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { get, run } from "@/lib/db";
import { date } from "@/lib/format";
import type { Article } from "@/lib/kb";

export const metadata = { title: "Answer" };

export default async function Answer({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const a = get<Article>("select * from articles where id = ?", (await params).id);
  if (!a || (!a.portal_visible && !isAgent(user))) notFound();
  run("update articles set views = views + 1 where id = ?", a.id);
  const voted = get<{ helpful: number }>("select helpful from article_votes where article_id = ? and user_id = ?", a.id, user.id);
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 md:px-6">
      <Banners sp={await searchParams} />
      <p className="mb-2 text-sm text-muted">
        <Link href="/portal">Help center</Link> / {a.category}
      </p>
      <Card className="space-y-4">
        <h1 className="text-xl">{a.title}</h1>
        <p className="text-sm text-muted">Updated {date(a.updated_at)}</p>
        <div className="prose-plain leading-6">{a.body}</div>
        <form action={voteAction} className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <input type="hidden" name="articleId" value={a.id} />
          <span>{voted ? `Thanks, we've noted that this ${voted.helpful ? "helped" : "didn't help"}.` : "Did this help?"}</span>
          {voted ? null : (
            <>
              <SubmitButton size="sm" variant="secondary" name="vote" value="yes">
                Yes
              </SubmitButton>
              <SubmitButton size="sm" variant="secondary" name="vote" value="no">
                No
              </SubmitButton>
            </>
          )}
          <span className="flex-1" />
          <Link href="/portal">Still stuck? Ask us</Link>
        </form>
      </Card>
    </main>
  );
}
