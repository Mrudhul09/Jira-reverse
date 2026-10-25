import { notFound } from "next/navigation";
import { ArticleForm } from "@/components/ArticleForm";
import { Banners, Card, PageHead } from "@/components/ui";
import { requireAgent } from "@/lib/auth";
import { get } from "@/lib/db";
import type { Article } from "@/lib/kb";

export const metadata = { title: "Edit article" };

export default async function EditArticle({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAgent();
  const a = get<Article>("select * from articles where id = ?", (await params).id);
  if (!a) notFound();
  return (
    <div className="max-w-3xl">
      <Banners sp={await searchParams} />
      <PageHead title="Edit article" />
      <Card>
        <ArticleForm article={a} />
      </Card>
    </div>
  );
}
