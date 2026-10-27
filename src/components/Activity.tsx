import { ago, dateTime } from "@/lib/format";
import type { Comment, HistoryRow } from "@/lib/types";
import { statusLabel } from "@/lib/workflows";
import { Avatar, Lozenge, cx } from "./ui";

const FIELD: Record<string, string> = {
  assignee_id: "assignee",
  team_id: "team",
  is_major: "major flag",
  change_type: "change type",
  change_risk: "risk",
  planned_start: "window start",
  planned_end: "window end",
  plan_implementation: "implementation plan",
  plan_backout: "backout plan",
  plan_test: "test plan",
  root_cause: "root cause",
};

function say(h: HistoryRow): string {
  if (h.field === "created") return `raised this (${h.new_value})`;
  if (h.field === "status") return `moved it from ${statusLabel(null, h.old_value ?? "")} to ${statusLabel(null, h.new_value ?? "")}`;
  if (h.field === "channel") return `sent it by ${h.new_value}`;
  if (h.field === "approval") return h.new_value ?? "";
  if (["link", "responder", "stakeholder", "asset", "service", "alert", "article", "pir"].includes(h.field)) {
    return h.new_value === "removed" ? `removed ${h.field} ${h.old_value}` : `${h.field}: ${h.new_value ?? h.old_value ?? ""}`;
  }
  const label = FIELD[h.field] ?? h.field;
  if (h.new_value === "edited") return `edited the ${label}`;
  return `changed the ${label}${h.old_value ? ` from ${h.old_value}` : ""} to ${h.new_value ?? "nothing"}`;
}

export function Activity({ comments, history, show }: { comments: Comment[]; history: HistoryRow[]; show: "comments" | "all" | "history" }) {
  const rows: { at: number; key: string; node: React.ReactNode }[] = [];
  if (show !== "history") {
    for (const c of comments) {
      const late = c.created_at - c.occurred_at > 60_000;
      rows.push({
        at: c.occurred_at,
        key: c.id,
        node: (
          <div className="flex gap-2.5">
            <Avatar name={c.author_name} />
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                <strong className="text-sm text-fg">{c.author_name}</strong>
                {c.internal ? <Lozenge tone="warning">Internal</Lozenge> : null}
                <span title={dateTime(c.occurred_at)}>{ago(c.occurred_at)}</span>
                {late ? <span>(added {ago(c.created_at)})</span> : null}
              </div>
              <div className={cx("prose-plain rounded-md px-3 py-2", c.internal ? "bg-warning-soft" : "bg-surface")}>{c.body}</div>
            </div>
          </div>
        ),
      });
    }
  }
  if (show !== "comments") {
    for (const h of history) {
      rows.push({
        at: h.created_at,
        key: h.id,
        node: (
          <p className="pl-8 text-xs text-muted">
            <strong className="text-fg">{h.actor_name ?? "Someone"}</strong> {say(h)} · <span title={dateTime(h.created_at)}>{ago(h.created_at)}</span>
          </p>
        ),
      });
    }
  }
  rows.sort((a, b) => a.at - b.at);
  if (!rows.length) return <p className="text-muted">Nothing here yet.</p>;
  return (
    <ol className="space-y-3.5">
      {rows.map((r) => (
        <li key={r.key}>{r.node}</li>
      ))}
    </ol>
  );
}
