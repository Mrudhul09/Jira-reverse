import { saveServiceAction } from "@/app/actions/ops";
import { SelectField, TextArea, TextField } from "./ui/field";
import { SubmitButton } from "./ui/submit";

export function ServiceForm({
  service,
  teams,
  services,
  dependsOn = [],
}: {
  service?: { id: string; name: string; description: string; tier: number; owner_team_id: string | null };
  teams: { id: string; name: string }[];
  services: { id: string; name: string }[];
  dependsOn?: string[];
}) {
  const others = services.filter((s) => s.id !== service?.id);
  return (
    <form action={saveServiceAction} className="space-y-3">
      {service ? <input type="hidden" name="id" value={service.id} /> : null}
      <TextField id="svc-name" name="name" label="Name" required maxLength={120} defaultValue={service?.name} />
      <TextArea id="svc-desc" name="description" label="What it is" defaultValue={service?.description} />
      <div className="grid grid-cols-2 gap-2">
        <SelectField
          id="svc-tier"
          name="tier"
          label="Tier"
          defaultValue={service?.tier ?? 3}
          options={[
            { value: 1, label: "1 · critical" },
            { value: 2, label: "2 · important" },
            { value: 3, label: "3 · standard" },
            { value: 4, label: "4 · low" },
          ]}
        />
        <SelectField id="svc-owner" name="ownerTeamId" label="Owner" placeholder="No team" defaultValue={service?.owner_team_id ?? ""} options={teams.map((t) => ({ value: t.id, label: t.name }))} />
      </div>
      <div className="flex flex-col">
        <label htmlFor="svc-deps" className="mb-1 text-sm font-semibold">
          Depends on
        </label>
        <select id="svc-deps" name="dependsOn" multiple size={Math.min(6, Math.max(3, others.length))} defaultValue={dependsOn} className="control">
          {others.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <SubmitButton>{service ? "Save" : "Add service"}</SubmitButton>
    </form>
  );
}
