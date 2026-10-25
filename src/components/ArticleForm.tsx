import { saveArticleAction } from "@/app/actions/kb";
import type { Article } from "@/lib/kb";
import { Checkbox, TextArea, TextField } from "./ui/field";
import { SubmitButton } from "./ui/submit";

export function ArticleForm({ article }: { article?: Article }) {
  return (
    <form action={saveArticleAction} className="space-y-4">
      {article ? <input type="hidden" name="id" value={article.id} /> : null}
      <TextField id="title" name="title" label="Title" required maxLength={200} defaultValue={article?.title} />
      <TextField id="category" name="category" label="Topic" maxLength={60} defaultValue={article?.category ?? "General"} />
      <TextArea id="body" name="body" label="Article" required defaultValue={article?.body} hint="Plain text. Leave a blank line between paragraphs; number the steps." className="[&_textarea]:min-h-72" />
      <Checkbox name="everyone" defaultChecked={article ? !!article.portal_visible : true} label="Show in the help center (otherwise IT team only)" />
      <SubmitButton>{article ? "Save" : "Publish"}</SubmitButton>
    </form>
  );
}
