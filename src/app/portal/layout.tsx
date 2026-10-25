import { LifeBuoy } from "lucide-react";
import Link from "next/link";
import { Menus } from "@/components/shell/Menus";
import { isAgent } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { get } from "@/lib/db";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const waiting = get<{ n: number }>("select count(*) as n from approvals where approver_id = ? and decision = 'pending'", user.id)?.n ?? 0;
  const link = "text-nav-fg no-underline hover:underline";
  return (
    <>
      <header className="bg-nav text-nav-fg">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 md:px-6">
          <Link href="/portal" className="flex items-center gap-2 text-lg font-bold text-nav-fg no-underline hover:no-underline">
            <LifeBuoy aria-hidden="true" className="size-6" /> IT Help
          </Link>
          <nav aria-label="Help center" className="flex items-center gap-4">
            <Link href="/portal/requests" className={link}>
              My requests
            </Link>
            {waiting ? (
              <Link href="/portal/requests?view=approvals" className={link}>
                To approve <span className="rounded-full bg-danger px-1.5 text-xs font-bold text-on-accent">{waiting}</span>
              </Link>
            ) : null}
            {isAgent(user) ? (
              <Link href="/queues" className={link}>
                Agent view
              </Link>
            ) : null}
            <Menus user={user} dark />
          </nav>
        </div>
      </header>
      {children}
    </>
  );
}
