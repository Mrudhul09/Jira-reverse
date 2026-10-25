import { Search } from "lucide-react";
import Link from "next/link";
import { RequestTypeIcon } from "@/components/RequestTypeIcon";
import { Banners, Card, EmptyState } from "@/components/ui";
import { canRaise } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { searchArticles, type Article } from "@/lib/kb";
import type { RequestType } from "@/lib/types";

export const metadata = { title: "Help center" };

export default async function HelpCenter({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const types = all<RequestType>("select * from request_types where portal_visible = 1 order by position").filter((t) => canRaise(user, t));
  const groups = Array.from(new Set(types.map((t) => t.group_name)));
  const typeHits = q ? types.filter((t) => `${t.name} ${t.description}`.toLowerCase().includes(q.toLowerCase())) : [];
  const articleHits = q ? searchArticles(q, { everyone: true, limit: 6 }) : [];
  const popular = all<Article>("select * from articles where portal_visible = 1 order by views desc limit 5");
  return (
    <>
      <section className="bg-nav px-4 pb-10 pt-8 text-center text-nav-fg">
        <h1 className="mb-4">Hi {user.name.split(" ")[0]}, what do you need?</h1>
        <form action="/portal" role="search" className="relative mx-auto max-w-xl">
          <label htmlFor="hq" className="sr-only">
            Search the help center
          </label>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 size-5 text-muted" />
          <input id="hq" name="q" type="search" defaultValue={q} placeholder="Search for answers or things to ask for" className="control min-h-12 border-0 pl-10 text-lg" />
        </form>
      </section>
      <main className="mx-auto max-w-5xl space-y-7 px-4 py-6 md:px-6">
        <Banners sp={sp} />
        {q ? (
          <Card className="space-y-4">
            <h2>Results for “{q}”</h2>
            {!typeHits.length && !articleHits.length ? <EmptyState title="No matches">Try other words, or pick from the list below.</EmptyState> : null}
            {articleHits.length ? (
              <div className="space-y-1">
                <h3 className="text-sm uppercase tracking-wide text-muted">Answers</h3>
                {articleHits.map((a) => (
                  <Link key={a.id} href={`/portal/kb/${a.id}`} className="block">
                    {a.title}
                  </Link>
                ))}
              </div>
            ) : null}
            {typeHits.length ? (
              <div className="space-y-1">
                <h3 className="text-sm uppercase tracking-wide text-muted">Ask for</h3>
                {typeHits.map((t) => (
                  <Link key={t.id} href={`/portal/new/${t.id}`} className="block">
                    {t.name}
                  </Link>
                ))}
              </div>
            ) : null}
          </Card>
        ) : null}
        {groups.map((g) => (
          <section key={g} className="space-y-2.5">
            <h2 className="text-lg">{g}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {types
                .filter((t) => t.group_name === g)
                .map((t) => (
                  <Link key={t.id} href={`/portal/new/${t.id}`} className="flex gap-3 rounded-lg border border-line bg-canvas p-3.5 text-fg no-underline shadow-card hover:border-accent hover:no-underline">
                    <RequestTypeIcon name={t.icon} />
                    <span>
                      <strong className="block">{t.name}</strong>
                      <span className="text-sm text-muted">{t.description}</span>
                    </span>
                  </Link>
                ))}
            </div>
          </section>
        ))}
        <Card className="space-y-1.5">
          <h2 className="text-lg">Most read answers</h2>
          {popular.length ? (
            popular.map((a) => (
              <Link key={a.id} href={`/portal/kb/${a.id}`} className="block">
                {a.title}
              </Link>
            ))
          ) : (
            <p className="text-muted">No answers written yet.</p>
          )}
        </Card>
      </main>
    </>
  );
}
