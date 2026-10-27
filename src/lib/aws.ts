import { all, get, now, run, uid } from "./db";

// A CloudWatch alarm as SNS delivers it.
export interface Alarm {
  name: string;
  description: string;
  state: "ALARM" | "OK" | "INSUFFICIENT_DATA";
  reason: string;
  arn: string;
  account: string;
  region: string;
  metric: string | null;
  namespace: string | null;
  value: number | null;
  threshold: number | null;
  operator: string | null;
  resource: string | null;
  instanceId: string | null;
}

export function parseAlarm(message: string): Alarm | null {
  let m: Record<string, unknown>;
  try {
    m = JSON.parse(message) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (typeof m.AlarmName !== "string" || typeof m.NewStateValue !== "string") return null;
  const t = (m.Trigger ?? {}) as Record<string, unknown>;
  const dims = (Array.isArray(t.Dimensions) ? t.Dimensions : []) as { name?: string; value?: string }[];
  const arn = typeof m.AlarmArn === "string" ? m.AlarmArn : "";
  const reason = typeof m.NewStateReason === "string" ? m.NewStateReason : "";
  // "Threshold Crossed: 1 datapoint [92.5 (27/10/26 10:00:00)] was greater than ..."
  const seen = reason.match(/\[\s*(-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)/);
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const instanceId = dims.find((d) => d.name === "InstanceId")?.value ?? null;
  return {
    name: m.AlarmName,
    description: typeof m.AlarmDescription === "string" ? m.AlarmDescription : "",
    state: (["ALARM", "OK", "INSUFFICIENT_DATA"].includes(m.NewStateValue) ? m.NewStateValue : "INSUFFICIENT_DATA") as Alarm["state"],
    reason,
    arn,
    account: typeof m.AWSAccountId === "string" ? m.AWSAccountId : (arn.split(":")[4] ?? ""),
    region: arn.split(":")[3] ?? "",
    metric: typeof t.MetricName === "string" ? t.MetricName : null,
    namespace: typeof t.Namespace === "string" ? t.Namespace : null,
    value: seen ? Number(seen[1]) : null,
    threshold: num(t.Threshold),
    operator: typeof t.ComparisonOperator === "string" ? t.ComparisonOperator : null,
    resource: instanceId ?? dims[0]?.value ?? null,
    instanceId,
  };
}

// Server details from EC2, using this server's IAM role (read-only ec2:DescribeInstances).
export interface Ec2Details {
  name?: string;
  instance_type?: string;
  state?: string;
  private_ip?: string;
  public_ip?: string;
  availability_zone?: string;
  platform?: string;
  vpc?: string;
  launched?: string;
}

export async function describeInstance(region: string, instanceId: string): Promise<{ details: Ec2Details | null; error?: string }> {
  if (process.env.EC2_LOOKUP === "off" || !region) return { details: null, error: "EC2 lookup is off" };
  try {
    const { EC2Client, DescribeInstancesCommand } = await import("@aws-sdk/client-ec2");
    const client = new EC2Client({ region, maxAttempts: 2 });
    const out = await client.send(new DescribeInstancesCommand({ InstanceIds: [instanceId] }), { abortSignal: AbortSignal.timeout(5000) });
    const i = out.Reservations?.[0]?.Instances?.[0];
    if (!i) return { details: null, error: "instance not found" };
    return {
      details: {
        name: i.Tags?.find((tag) => tag.Key === "Name")?.Value,
        instance_type: i.InstanceType,
        state: i.State?.Name,
        private_ip: i.PrivateIpAddress,
        public_ip: i.PublicIpAddress,
        availability_zone: i.Placement?.AvailabilityZone,
        platform: i.PlatformDetails ?? i.Platform,
        vpc: i.VpcId,
        launched: i.LaunchTime?.toISOString(),
      },
    };
  } catch (err) {
    return { details: null, error: (err as Error).name || (err as Error).message };
  }
}

const EC2_ATTRS = [
  ["instance_id", "Instance ID"],
  ["name", "Name"],
  ["instance_type", "Instance type"],
  ["state", "State"],
  ["private_ip", "Private IP"],
  ["public_ip", "Public IP"],
  ["availability_zone", "Availability zone"],
  ["platform", "Platform"],
  ["vpc", "VPC"],
  ["region", "Region"],
  ["account", "AWS account"],
  ["launched", "Launched"],
  ["last_alarm", "Last alarm"],
  ["last_alarm_at", "Last alarm at"],
] as const;

// The "AWS" schema and its "EC2 instance" type, made the first time an alarm needs them.
function ec2TypeId(): string {
  const t = now();
  let schema = get<{ id: string }>("select id from asset_schemas where name = 'AWS'")?.id;
  if (!schema) {
    schema = uid();
    run("insert into asset_schemas (id, name, description, created_at, updated_at) values (?, 'AWS', 'Filled in from CloudWatch alarms and EC2.', ?, ?)", schema, t, t);
  }
  const type = get<{ id: string }>("select id from asset_types where schema_id = ? and name = 'EC2 instance'", schema)?.id;
  if (type) return type;
  const id = uid();
  const attrs = EC2_ATTRS.map(([key, label]) => ({ key, label, type: "text" }));
  run("insert into asset_types (id, schema_id, name, attributes_json, created_at, updated_at) values (?, ?, 'EC2 instance', ?, ?, ?)", id, schema, JSON.stringify(attrs), t, t);
  return id;
}

// Creates or updates the server's CMDB record. Returns its id.
export function upsertInstance(a: Alarm, d: Ec2Details | null): string | null {
  if (!a.instanceId) return null;
  const typeId = ec2TypeId();
  const found = get<{ id: string; attrs_json: string }>(
    "select id, attrs_json from asset_objects where type_id = ? and json_extract(attrs_json, '$.instance_id') = ?",
    typeId,
    a.instanceId,
  );
  const old = found ? (JSON.parse(found.attrs_json) as Record<string, string>) : {};
  const fresh: Record<string, string | undefined> = {
    ...d,
    instance_id: a.instanceId,
    region: a.region,
    account: a.account,
    last_alarm: `${a.name}${a.metric ? ` (${a.metric}${a.value !== null ? ` ${a.value}` : ""})` : ""}`,
    last_alarm_at: new Date().toISOString(),
  };
  const attrs = { ...old, ...Object.fromEntries(Object.entries(fresh).filter(([, v]) => v !== undefined && v !== "")) };
  const name = attrs.name ? `${attrs.name} (${a.instanceId})` : a.instanceId;
  const label = get("select 1 from asset_objects where type_id = ? and label = ? and id <> ?", typeId, name, found?.id ?? "") ? a.instanceId : name;
  const t = now();
  if (found) {
    run("update asset_objects set label = ?, attrs_json = ?, updated_at = ? where id = ?", label, JSON.stringify(attrs), t, found.id);
    return found.id;
  }
  const id = uid();
  run("insert into asset_objects (id, type_id, label, attrs_json, created_at, updated_at) values (?, ?, ?, ?, ?, ?)", id, typeId, label, JSON.stringify(attrs), t, t);
  return id;
}

export const openAlertFor = (alias: string) =>
  all<{ id: string; incident_id: string | null }>("select id, incident_id from alerts where alias = ? and status <> 'closed'", alias);
