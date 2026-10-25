import { cx } from "./index";

export interface SlaView {
  name: string;
  goalMs: number;
  remainingMs: number;
  state: "running" | "paused" | "met" | "breached";
  warning: boolean;
  calendar: string;
}

export function duration(ms: number): string {
  const neg = ms < 0;
  let m = Math.round(Math.abs(ms) / 60_000);
  const d = Math.floor(m / 1440);
  m -= d * 1440;
  const h = Math.floor(m / 60);
  m -= h * 60;
  const parts = d ? [`${d}d`, h ? `${h}h` : ""] : h ? [`${h}h`, m ? `${m}m` : ""] : [`${m}m`];
  return (neg ? "-" : "") + parts.filter(Boolean).join(" ");
}

export function SlaBadge({ sla, named = false }: { sla: SlaView; named?: boolean }) {
  const tone =
    sla.state === "breached"
      ? "bg-danger-soft text-danger border-transparent"
      : sla.state === "met"
        ? "bg-success-soft text-success border-transparent"
        : sla.state === "paused"
          ? "bg-canvas text-muted border-line"
          : sla.warning
            ? "bg-warning-soft text-warning border-transparent"
            : "bg-sunken text-fg border-transparent";
  const text =
    sla.state === "met" ? "Met" : sla.state === "breached" ? `Breached ${duration(sla.remainingMs)}` : sla.state === "paused" ? `${duration(sla.remainingMs)} paused` : duration(sla.remainingMs);
  return (
    <span
      className={cx("inline-flex items-center whitespace-nowrap rounded-full border px-2 py-px text-xs font-semibold", tone)}
      title={`${sla.name}: goal ${duration(sla.goalMs)} on ${sla.calendar} (${sla.state}${sla.warning ? ", under 25% left" : ""})`}
    >
      {named ? `${sla.name}: ` : ""}
      {text}
    </span>
  );
}
