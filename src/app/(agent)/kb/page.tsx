import Link from "next/link";
import { Banners, Card, EmptyState, LinkButton, Lozenge, PageHead } from "@/components/ui";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { requireAgent } from "@/lib/auth";
import { all } from "@/lib/db";
import { date } from "@/lib/format";
import { searchArticles, type Article } from "@/lib/kb";

export const metadata = { title: "Knowledge base" };

export default async function Knowledge({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAgent();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const articles = q ? searchArticles(q, { everyone: false, limit: 100 }) : all<Article>("select * from articles order by category, title");
  return (
    <>
      <Banners sp={sp} />
      <PageHead
        title="Knowledge base"
        intro="Answers for the IT team, and for everyone when shown in the help center."
        actions={
          <>
            <form role="search" className="flex">
              <label htmlFor="kq" className="sr-only">
                Search articles
              </label>
              <input id="kq" name="q" type="search" defaultValue={q} placeholder="Search articles" className="control w-56" />
            </form>
            <LinkButton href="/kb/new" variant="primary">
              New article
            </LinkButton>
          </>
        }
      />
      {articles.length ? (
        <Table>
          <thead>
            <tr>
              <Th>Title</Th>
              <Th>Topic</Th>
              <Th>Who sees it</Th>
              <Th>Reads</Th>
              <Th>Helped</Th>
              <Th>Updated</Th>
            </tr>
          </thead>
          <tbody>
            {articles.map((a) => {
              const votes = a.helpful + a.not_helpful;
              return (
                <Tr key={a.id}>
                  <Td>
                    <Link href={`/kb/${a.id}`} className="font-medium text-fg">
                      {a.title}
                    </Link>
                  </Td>
                  <Td className="text-sm">{a.category}</Td>
                  <Td>
                    <Lozenge tone={a.portal_visible ? "accent" : "todo"}>{a.portal_visible ? "Everyone" : "IT team"}</Lozenge>
                  </Td>
                  <Td className="text-sm">{a.views}</Td>
                  <Td className="text-sm">{votes ? `${Math.round((a.helpful / votes) * 100)}% of ${votes}` : "-"}</Td>
                  <Td className="text-sm text-muted">{date(a.updated_at)}</Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      ) : (
        <Card>
          <EmptyState title={q ? "No articles match" : "No articles yet"}>
            <Link href="/kb/new">Write the first one</Link>
          </EmptyState>
        </Card>
      )}
    </>
  );
}
