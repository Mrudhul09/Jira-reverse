"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

export function NavLink({ href, exact = false, children }: { href: string; exact?: boolean; children: React.ReactNode }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-nav-fg no-underline hover:bg-white/10 hover:no-underline",
        active && "bg-white/15 font-semibold",
      )}
    >
      {children}
    </Link>
  );
}
