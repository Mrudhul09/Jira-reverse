import { ArticleForm } from "@/components/ArticleForm";
import { Banners, Card, PageHead } from "@/components/ui";
import { requireAgent } from "@/lib/auth";

export const metadata = { title: "New article" };

export default async function NewArticle({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAgent();
  return (
    <div className="max-w-3xl">
      <Banners sp={await searchParams} />
      <PageHead title="New article" />
      <Card>
        <ArticleForm />
      </Card>
    </div>
  );
}
