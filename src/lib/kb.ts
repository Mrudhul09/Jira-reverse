import { all } from "./db";

export interface Article {
  id: string;
  title: string;
  body: string;
  category: string;
  portal_visible: number;
  views: number;
  helpful: number;
  not_helpful: number;
  author_id: string | null;
  source_item_id: string | null;
  created_at: number;
  updated_at: number;
}

const STOP = new Set(["the", "a", "an", "to", "my", "i", "is", "it", "of", "and", "for", "on", "in", "cant", "can't", "not", "with", "me", "how", "do", "does", "work", "working"]);

// Ranks by query words found, title hits worth three.
export function searchArticles(q: string, opts: { everyone: boolean; limit?: number }): Article[] {
  const words = q.toLowerCase().split(/[^a-z0-9-]+/).filter((w) => w.length > 1 && !STOP.has(w));
  if (!words.length) return [];
  return all<Article>(`select * from articles ${opts.everyone ? "where portal_visible = 1" : ""}`)
    .map((a) => {
      const title = a.title.toLowerCase();
      const body = a.body.toLowerCase();
      const score = words.reduce((s, w) => s + (title.includes(w) ? 3 : 0) + (body.includes(w) ? 1 : 0), 0);
      return { a, score };
    })
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score || y.a.views - x.a.views)
    .slice(0, opts.limit ?? 5)
    .map((x) => x.a);
}
