import { all, parseJson } from "./db";

export interface Schedule {
  id: string;
  name: string;
  team_id: string;
  rotation_json: string;
  shift_hours: number;
  starts_at: number;
  escalate_after_minutes: number;
  escalate_to_id: string | null;
}

export interface Shift {
  userId: string;
  start: number;
  end: number;
}

const HOUR = 3_600_000;

export function shiftAt(s: Schedule, t: number): Shift | null {
  const people = parseJson<string[]>(s.rotation_json, []);
  if (!people.length) return null;
  const len = s.shift_hours * HOUR;
  const n = Math.floor((t - s.starts_at) / len);
  const start = s.starts_at + n * len;
  return { userId: people[((n % people.length) + people.length) % people.length], start, end: start + len };
}

export function upcoming(s: Schedule, from: number, count: number): Shift[] {
  const out: Shift[] = [];
  for (let t = from, i = 0; i < count; i++) {
    const sh = shiftAt(s, t);
    if (!sh) break;
    out.push(sh);
    t = sh.end;
  }
  return out;
}

export function onCallFor(teamId: string | null | undefined, t = Date.now()): string[] {
  if (!teamId) return [];
  const ids = all<Schedule>("select * from oncall_schedules where team_id = ?", teamId)
    .map((s) => shiftAt(s, t)?.userId)
    .filter((x): x is string => !!x);
  return Array.from(new Set(ids));
}
