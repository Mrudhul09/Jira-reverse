import type { SlaView } from "@/components/ui/sla-badge";
import { all, marks, parseJson } from "./db";
import type { Item } from "./types";
import { workflow, isDone } from "./workflows";

export interface SlaCalendar {
  id: string;
  name: string;
  always_on: number;
  days_json: string;
  start_minute: number;
  end_minute: number;
  utc_offset_minutes: number;
  holidays_json: string;
}

export interface SlaGoal {
  category: string | null;
  priority: number | null;
  minutes: number;
  calendar_id: string;
}

export interface Sla {
  id: string;
  name: string;
  metric: "first_response" | "resolution";
  goals_json: string;
  enabled: number;
}

export interface SlaState extends SlaView {
  slaId: string;
  metric: Sla["metric"];
  allDay: boolean;
  elapsedMs: number;
}

interface StatusChange {
  item_id: string;
  old_value: string | null;
  new_value: string | null;
  created_at: number;
}

const MIN = 60_000;
const DAY = 1440 * MIN;

// Working time between two instants on a calendar, in ms.
export function workingMs(start: number, end: number, cal: SlaCalendar): number {
  if (end <= start) return 0;
  if (cal.always_on) return end - start;
  const days = new Set(parseJson<number[]>(cal.days_json, [1, 2, 3, 4, 5]));
  const holidays = new Set(parseJson<string[]>(cal.holidays_json, []));
  const shift = cal.utc_offset_minutes * MIN;
  const from = start + shift;
  const to = end + shift;
  let total = 0;
  for (let d = Math.floor(from / DAY), n = 0; d <= Math.floor(to / DAY) && n < 3660; d++, n++) {
    const dayStart = d * DAY;
    const date = new Date(dayStart);
    if (!days.has(date.getUTCDay()) || holidays.has(date.toISOString().slice(0, 10))) continue;
    total += Math.max(0, Math.min(to, dayStart + cal.end_minute * MIN) - Math.max(from, dayStart + cal.start_minute * MIN));
  }
  return total;
}

export function slaConfig() {
  return {
    slas: all<Sla>("select * from slas where enabled = 1 order by position"),
    calendars: new Map(all<SlaCalendar>("select * from sla_calendars").map((c) => [c.id, c])),
  };
}

export function goalFor(sla: Sla, item: Pick<Item, "category" | "priority">): SlaGoal | null {
  return (
    parseJson<SlaGoal[]>(sla.goals_json, []).find(
      (g) => (g.category === null || g.category === item.category) && (g.priority === null || g.priority === item.priority),
    ) ?? null
  );
}

export function slaStates(item: Item, changes: StatusChange[], config: ReturnType<typeof slaConfig>, at = Date.now()): SlaState[] {
  const out: SlaState[] = [];
  const wf = workflow(item.category);
  const done = isDone(item.category, item.status);
  for (const sla of config.slas) {
    const goal = goalFor(sla, item);
    const cal = goal ? config.calendars.get(goal.calendar_id) : undefined;
    if (!goal || !cal) continue;
    let elapsed = 0;
    let stopped: boolean;
    let paused = false;
    if (sla.metric === "first_response") {
      const stop = item.first_response_at ?? item.resolved_at;
      stopped = stop !== null;
      elapsed = workingMs(item.created_at, stop ?? at, cal);
    } else {
      // Walk the status history; count only time spent in running statuses.
      let status = changes[0]?.old_value ?? item.status;
      let from = item.created_at;
      const spans: [string, number, number][] = [];
      for (const c of changes) {
        spans.push([status, from, c.created_at]);
        status = c.new_value ?? status;
        from = c.created_at;
      }
      spans.push([status, from, at]);
      for (const [s, a, b] of spans) if (!wf.paused.includes(s) && !isDone(item.category, s)) elapsed += workingMs(a, b, cal);
      stopped = done;
      paused = !done && wf.paused.includes(item.status);
    }
    const goalMs = goal.minutes * MIN;
    const remainingMs = goalMs - elapsed;
    const state = remainingMs < 0 ? "breached" : stopped ? "met" : paused ? "paused" : "running";
    out.push({ slaId: sla.id, metric: sla.metric, allDay: !!cal.always_on, name: sla.name, goalMs, elapsedMs: elapsed, remainingMs, state, warning: state === "running" && remainingMs < goalMs * 0.25, calendar: cal.name });
  }
  return out;
}

// SLA states for a list of items with one history query.
export function slaStatesFor(items: Item[], at = Date.now()): Map<string, SlaState[]> {
  const result = new Map<string, SlaState[]>();
  if (!items.length) return result;
  const config = slaConfig();
  const ids = items.map((i) => i.id);
  const byItem = new Map<string, StatusChange[]>();
  for (const c of all<StatusChange>(
    `select item_id, old_value, new_value, created_at from history where field = 'status' and item_id in (${marks(ids.length)}) order by created_at, rowid`,
    ...ids,
  )) {
    byItem.set(c.item_id, [...(byItem.get(c.item_id) ?? []), c]);
  }
  for (const item of items) result.set(item.id, slaStates(item, byItem.get(item.id) ?? [], config, at));
  return result;
}

// The clock to show in a list: the most urgent one still running, else the first.
export function headlineSla(states: SlaState[]): SlaState | undefined {
  return [...states].sort((a, b) => Number(a.state === "met") - Number(b.state === "met") || a.remainingMs - b.remainingMs)[0];
}
