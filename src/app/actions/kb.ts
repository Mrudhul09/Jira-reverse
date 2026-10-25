"use server";

import { requireAgent, requireUser } from "@/lib/auth";
import { get, now, run, uid } from "@/lib/db";
import { back, bool, id, str } from "@/lib/form";

export async function saveArticleAction(fd: FormData): Promise<void> {
  const user = await requireAgent();
  const articleId = id(fd, "id");
  const title = str(fd, "title", 200);
  const body = str(fd, "body", 50_000);
  const category = str(fd, "category", 60) || "General";
  const everyone = bool(fd, "everyone") ? 1 : 0;
  if (!title || !body) back(articleId ? `/kb/${articleId}/edit` : "/kb/new", { error: "An article needs a title and some text." });
  if (articleId) {
    run("update articles set title = ?, body = ?, category = ?, portal_visible = ?, updated_at = ? where id = ?", title, body, category, everyone, now(), articleId);
    back(`/kb/${articleId}`, { ok: "Saved." });
  }
  const newId = uid();
  run(
    "insert into articles (id, title, body, category, portal_visible, author_id, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?)",
    newId,
    title,
    body,
    category,
    everyone,
    user.id,
    now(),
    now(),
  );
  back(`/kb/${newId}`, { ok: "Published." });
}

export async function deleteArticleAction(fd: FormData): Promise<void> {
  await requireAgent();
  const articleId = id(fd, "id");
  if (articleId) run("delete from articles where id = ?", articleId);
  back("/kb", { ok: "Article deleted." });
}

// One vote per person per article.
export async function voteAction(fd: FormData): Promise<void> {
  const user = await requireUser();
  const articleId = id(fd, "articleId");
  if (!articleId || !get("select 1 from articles where id = ?", articleId)) back("/portal");
  const helpful = str(fd, "vote") === "yes" ? 1 : 0;
  const added = run("insert or ignore into article_votes (article_id, user_id, helpful, created_at) values (?, ?, ?, ?)", articleId, user.id, helpful, now());
  if (added) run(helpful ? "update articles set helpful = helpful + 1 where id = ?" : "update articles set not_helpful = not_helpful + 1 where id = ?", articleId);
  back(`/portal/kb/${articleId}`, { ok: helpful ? "Glad it helped." : "Sorry it didn't. Ask us and we'll sort it with you." });
}
