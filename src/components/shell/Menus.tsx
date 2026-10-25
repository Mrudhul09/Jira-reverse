import { Bell, LogOut } from "lucide-react";
import Link from "next/link";
import { markReadAction, signOutAction } from "@/app/actions/auth";
import { Avatar, buttonClass, cx } from "@/components/ui";
import { isAgent } from "@/lib/access";
import { all, get } from "@/lib/db";
import { ago } from "@/lib/format";
import type { User } from "@/lib/types";

const pop = "absolute right-0 top-[calc(100%+6px)] z-30 rounded-lg border border-line bg-canvas p-1.5 shadow-pop";

export function Menus({ user, dark = false }: { user: User; dark?: boolean }) {
  const notes = all<{ id: string; item_key: string | null; message: string; read: number; created_at: number }>(
    "select n.id, i.key as item_key, n.message, n.read, n.created_at from notifications n left join items i on i.id = n.item_id where n.user_id = ? order by n.created_at desc limit 12",
    user.id,
  );
  const unread = get<{ n: number }>("select count(*) as n from notifications where user_id = ? and read = 0", user.id)?.n ?? 0;
  const itemBase = isAgent(user) ? "/items" : "/portal/requests";
  const trigger = cx(buttonClass("subtle"), "list-none", dark && "text-nav-fg hover:bg-white/10");
  return (
    <div className="flex items-center gap-1">
      <details className="relative">
        <summary className={trigger} aria-label={`Notifications, ${unread} unread`}>
          <Bell aria-hidden="true" className="size-4" />
          {unread ? <span className="rounded-full bg-danger px-1.5 text-xs font-bold text-on-accent">{unread}</span> : null}
        </summary>
        <div className={cx(pop, "w-80")}>
          <div className="flex items-center justify-between px-2.5 pb-2 pt-1">
            <strong className="text-fg">Notifications</strong>
            {unread ? (
              <form action={markReadAction}>
                <button className="text-sm text-accent hover:underline">Mark all read</button>
              </form>
            ) : null}
          </div>
          {notes.length ? null : <p className="px-2.5 py-2 text-sm text-muted">Nothing yet.</p>}
          {notes.map((n) => (
            <Link
              key={n.id}
              href={n.item_key ? `${itemBase}/${n.item_key}` : "/alerts"}
              className={cx("block rounded-md px-2.5 py-2 text-sm text-fg no-underline hover:bg-surface hover:no-underline", !n.read && "font-semibold")}
            >
              {n.message}
              <span className="block text-xs font-normal text-muted">{ago(n.created_at)}</span>
            </Link>
          ))}
        </div>
      </details>
      <details className="relative">
        <summary className={trigger} aria-label="Your account">
          <Avatar name={user.name} />
          <span className="hidden sm:inline">{user.name}</span>
        </summary>
        <div className={cx(pop, "w-60")}>
          <div className="px-2.5 pb-2 pt-1">
            <div className="text-fg">{user.name}</div>
            <div className="text-xs text-muted">
              {user.email} · {user.role}
            </div>
          </div>
          {isAgent(user) ? (
            <Link href="/portal" className="block rounded-md px-2.5 py-2 text-fg no-underline hover:bg-surface hover:no-underline">
              Open the help center
            </Link>
          ) : null}
          <form action={signOutAction}>
            <button className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-fg hover:bg-surface">
              <LogOut aria-hidden="true" className="size-4" /> Sign out
            </button>
          </form>
        </div>
      </details>
    </div>
  );
}
