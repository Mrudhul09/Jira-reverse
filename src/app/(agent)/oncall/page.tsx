import { deleteScheduleAction, saveScheduleAction } from "@/app/actions/ops";
import { Banners, Card, EmptyState, PageHead, Panel, Person } from "@/components/ui";
import { SelectField, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { requireAgent } from "@/lib/auth";
import { all, parseJson } from "@/lib/db";
import { dateTime, localInput } from "@/lib/format";
import { shiftAt, upcoming, type Schedule } from "@/lib/oncall";

export const metadata = { title: "On call" };

function ScheduleForm({ s, teams, agents }: { s?: Schedule; teams: { id: string; name: string }[]; agents: { id: string; name: string }[] }) {
  const p = s ? s.id.slice(0, 8) : "new";
  return (
    <form action={saveScheduleAction} className="space-y-3">
      {s ? <input type="hidden" name="id" value={s.id} /> : null}
      <div className="grid grid-cols-2 gap-2">
        <TextField id={`${p}-name`} name="name" label="Name" required defaultValue={s?.name} />
        <SelectField id={`${p}-team`} name="teamId" label="Team" required placeholder="Pick a team" defaultValue={s?.team_id ?? ""} options={teams.map((t) => ({ value: t.id, label: t.name }))} />
      </div>
      <div className="flex flex-col">
        <label htmlFor={`${p}-rot`} className="mb-1 text-sm font-semibold">
          Who takes turns
        </label>
        <select id={`${p}-rot`} name="rotation" multiple required size={5} defaultValue={s ? parseJson<string[]>(s.rotation_json, []) : []} className="control" aria-describedby={`${p}-rot-hint`}>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <span id={`${p}-rot-hint`} className="mt-1 text-xs text-muted">
          They take turns in the order shown. Ctrl or Cmd to pick several.
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <TextField id={`${p}-h`} name="shiftHours" type="number" min={1} max={672} label="Shift length (hours)" defaultValue={s?.shift_hours ?? 168} />
        <TextField id={`${p}-start`} name="startsAt" type="datetime-local" label="First shift starts" defaultValue={localInput(s?.starts_at ?? Date.now())} />
        <TextField id={`${p}-after`} name="escalateAfter" type="number" min={1} label="Escalate after (minutes)" defaultValue={s?.escalate_after_minutes ?? 15} />
        <SelectField id={`${p}-to`} name="escalateTo" label="Escalate to" placeholder="Nobody" defaultValue={s?.escalate_to_id ?? ""} options={agents.map((a) => ({ value: a.id, label: a.name }))} />
      </div>
      <SubmitButton size="sm">{s ? "Save" : "Add schedule"}</SubmitButton>
    </form>
  );
}

export default async function OnCall({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAgent();
  const schedules = all<Schedule & { team: string }>("select s.*, t.name as team from oncall_schedules s join teams t on t.id = s.team_id order by t.name, s.name");
  const teams = all<{ id: string; name: string }>("select id, name from teams order by name");
  const agents = all<{ id: string; name: string }>("select id, name from users where role != 'employee' and active = 1 and system = 0 order by name");
  const name = new Map(agents.map((a) => [a.id, a.name]));
  const now = Date.now();
  return (
    <>
      <Banners sp={await searchParams} />
      <PageHead title="On call" intro="Who gets the call for each team right now. New alerts and P1 incidents go to them first; unacknowledged alerts escalate." />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {schedules.length ? null : (
            <Card>
              <EmptyState title="No schedules yet" />
            </Card>
          )}
          {schedules.map((s) => {
            const current = shiftAt(s, now);
            return (
              <Panel
                key={s.id}
                title={`${s.name} · ${s.team}`}
                actions={
                  <form action={deleteScheduleAction}>
                    <input type="hidden" name="id" value={s.id} />
                    <SubmitButton size="sm" variant="subtle">
                      Delete
                    </SubmitButton>
                  </form>
                }
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <p className="text-sm text-muted">On call now</p>
                      <p className="text-lg font-semibold">
                        <Person name={current ? name.get(current.userId) : null} empty="Nobody" />
                      </p>
                    </div>
                    <p className="text-sm text-muted">
                      {current ? `until ${dateTime(current.end)} · ` : ""}
                      {s.shift_hours}h shifts · escalates to {s.escalate_to_id ? name.get(s.escalate_to_id) : "nobody"} after {s.escalate_after_minutes} min
                    </p>
                  </div>
                  <Table>
                    <thead>
                      <tr>
                        <Th>Next up</Th>
                        <Th>From</Th>
                        <Th>Until</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {upcoming(s, current?.end ?? now, 5).map((sh) => (
                        <Tr key={sh.start}>
                          <Td>{name.get(sh.userId) ?? "Someone who left"}</Td>
                          <Td className="text-sm">{dateTime(sh.start)}</Td>
                          <Td className="text-sm">{dateTime(sh.end)}</Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                  <details>
                    <summary className="cursor-pointer text-sm text-accent">Change this schedule</summary>
                    <div className="mt-3">
                      <ScheduleForm s={s} teams={teams} agents={agents} />
                    </div>
                  </details>
                </div>
              </Panel>
            );
          })}
        </div>
        <Panel title="New schedule">
          <ScheduleForm teams={teams} agents={agents} />
        </Panel>
      </div>
    </>
  );
}
