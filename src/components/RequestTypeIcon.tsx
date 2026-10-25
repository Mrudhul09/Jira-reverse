import { AlertTriangle, CircleHelp, GitPullRequest, KeyRound, Laptop, Lock, Search, ShieldAlert, UserPlus, Wrench, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  help: CircleHelp,
  key: KeyRound,
  laptop: Laptop,
  lock: Lock,
  "user-plus": UserPlus,
  alert: AlertTriangle,
  shield: ShieldAlert,
  search: Search,
  git: GitPullRequest,
};

export const ICON_NAMES = Object.keys(ICONS);

export function RequestTypeIcon({ name }: { name: string }) {
  const Icon = ICONS[name] ?? Wrench;
  return (
    <span aria-hidden="true" className="grid size-9 flex-none place-items-center rounded-md bg-accent-soft text-accent">
      <Icon className="size-5" />
    </span>
  );
}
