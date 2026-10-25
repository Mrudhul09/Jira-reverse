import {
  BarChart3,
  BellRing,
  BookOpen,
  Boxes,
  CalendarRange,
  CheckSquare,
  GitPullRequest,
  Inbox,
  Network,
  PhoneCall,
  Plus,
  Search,
  Settings,
  Siren,
  Workflow,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Menus } from "@/components/shell/Menus";
import { NavLink } from "@/components/shell/NavLink";
import { isAdmin } from "@/lib/access";
import { requireAgent } from "@/lib/auth";
import { get } from "@/lib/db";
import { queuesFor, showCount } from "@/lib/queues";

function Count({ n, alert = false }: { n: number; alert?: boolean }) {
  if (!n) return null;
  return <span className={alert ? "rounded-full bg-danger px-1.5 text-xs font-bold text-on-accent" : "text-xs opacity-80"}>{showCount(n)}</span>;
}

const icon = "size-[18px] flex-none opacity-90";

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAgent();
  const starred = queuesFor(user.id).filter((q) => q.starred);
  const myApprovals = get<{ n: number }>("select count(*) as n from approvals where approver_id = ? and decision = 'pending'", user.id)?.n ?? 0;
  const openAlerts = get<{ n: number }>("select count(*) as n from alerts where status = 'open'")?.n ?? 0;
  const majors = get<{ n: number }>("select count(*) as n from items where category = 'incident' and is_major = 1 and resolved_at is null")?.n ?? 0;
  const group = "mb-4 space-y-0.5";
  const label = "px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider opacity-70";
  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="bg-nav px-2.5 py-4 text-nav-fg md:sticky md:top-0 md:h-screen md:overflow-y-auto" aria-label="Main">
        <Link href="/queues" className="mb-4 flex items-center gap-2 px-2 text-lg font-bold text-nav-fg no-underline hover:no-underline">
          <Logo />
        </Link>
        <nav className="grid grid-cols-2 gap-x-2 md:block">
          <div className={group}>
            <div className={label}>Work</div>
            <NavLink href="/queues">
              <span className="flex items-center gap-2">
                <Inbox aria-hidden="true" className={icon} /> Queues
              </span>
            </NavLink>
            {starred.map((q) => (
              <NavLink key={q.id} href={`/queues/${q.id}`} exact>
                <span className="truncate pl-6">{q.name}</span>
                <Count n={q.count} />
              </NavLink>
            ))}
            <NavLink href="/approvals">
              <span className="flex items-center gap-2">
                <CheckSquare aria-hidden="true" className={icon} /> Approvals
              </span>
              <Count n={myApprovals} alert />
            </NavLink>
            <NavLink href="/items/new">
              <span className="flex items-center gap-2">
                <Plus aria-hidden="true" className={icon} /> Raise work
              </span>
            </NavLink>
          </div>
          <div className={group}>
            <div className={label}>Service management</div>
            <NavLink href="/incidents">
              <span className="flex items-center gap-2">
                <Siren aria-hidden="true" className={icon} /> Incidents
              </span>
              <Count n={majors} alert />
            </NavLink>
            <NavLink href="/problems">
              <span className="flex items-center gap-2">
                <Wrench aria-hidden="true" className={icon} /> Problems
              </span>
            </NavLink>
            <NavLink href="/changes" exact>
              <span className="flex items-center gap-2">
                <GitPullRequest aria-hidden="true" className={icon} /> Changes
              </span>
            </NavLink>
            <NavLink href="/changes/calendar">
              <span className="flex items-center gap-2">
                <CalendarRange aria-hidden="true" className={icon} /> Change calendar
              </span>
            </NavLink>
          </div>
          <div className={group}>
            <div className={label}>Operations</div>
            <NavLink href="/alerts">
              <span className="flex items-center gap-2">
                <BellRing aria-hidden="true" className={icon} /> Alerts
              </span>
              <Count n={openAlerts} alert />
            </NavLink>
            <NavLink href="/oncall">
              <span className="flex items-center gap-2">
                <PhoneCall aria-hidden="true" className={icon} /> On call
              </span>
            </NavLink>
            <NavLink href="/services">
              <span className="flex items-center gap-2">
                <Network aria-hidden="true" className={icon} /> Services
              </span>
            </NavLink>
            <NavLink href="/assets">
              <span className="flex items-center gap-2">
                <Boxes aria-hidden="true" className={icon} /> Assets
              </span>
            </NavLink>
          </div>
          <div className={group}>
            <div className={label}>Knowledge and insight</div>
            <NavLink href="/kb">
              <span className="flex items-center gap-2">
                <BookOpen aria-hidden="true" className={icon} /> Knowledge base
              </span>
            </NavLink>
            <NavLink href="/reports">
              <span className="flex items-center gap-2">
                <BarChart3 aria-hidden="true" className={icon} /> Reports
              </span>
            </NavLink>
            <NavLink href="/automation">
              <span className="flex items-center gap-2">
                <Workflow aria-hidden="true" className={icon} /> Automation
              </span>
            </NavLink>
            {isAdmin(user) ? (
              <NavLink href="/settings">
                <span className="flex items-center gap-2">
                  <Settings aria-hidden="true" className={icon} /> Settings
                </span>
              </NavLink>
            ) : null}
          </div>
        </nav>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-canvas px-4 py-2 md:px-6">
          <form action="/search" role="search" className="relative w-full max-w-md">
            <label htmlFor="global-q" className="sr-only">
              Search work
            </label>
            <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted" />
            <input id="global-q" name="q" type="search" placeholder="Search by key or words" className="control pl-8" />
          </form>
          <Menus user={user} />
        </header>
        <main className="px-4 pb-12 pt-5 md:px-6">{children}</main>
      </div>
    </div>
  );
}
