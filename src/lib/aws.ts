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
  dimension: string | null;
  instanceId: string | null;
}

// Other AWS resources go into the CMDB under a type per service, keyed by the alarm's main dimension.
const KINDS: Record<string, { type: string; dimension: string }> = {
  "AWS/RDS": { type: "RDS database", dimension: "DBInstanceIdentifier" },
  "AWS/ApplicationELB": { type: "Load balancer", dimension: "LoadBalancer" },
  "AWS/NetworkELB": { type: "Load balancer", dimension: "LoadBalancer" },
  "AWS/ELB": { type: "Load balancer", dimension: "LoadBalancerName" },
  "AWS/Lambda": { type: "Lambda function", dimension: "FunctionName" },
  "AWS/EBS": { type: "EBS volume", dimension: "VolumeId" },
  "AWS/S3": { type: "S3 bucket", dimension: "BucketName" },
  "AWS/DynamoDB": { type: "DynamoDB table", dimension: "TableName" },
  "AWS/ECS": { type: "ECS service", dimension: "ServiceName" },
  "AWS/SQS": { type: "SQS queue", dimension: "QueueName" },
};

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
  const namespace = typeof t.Namespace === "string" ? t.Namespace : null;
  const main = dims.find((d) => d.name === "InstanceId") ?? dims.find((d) => d.name === KINDS[namespace ?? ""]?.dimension) ?? dims[0];
  return {
    name: m.AlarmName,
    description: typeof m.AlarmDescription === "string" ? m.AlarmDescription : "",
    state: (["ALARM", "OK", "INSUFFICIENT_DATA"].includes(m.NewStateValue) ? m.NewStateValue : "INSUFFICIENT_DATA") as Alarm["state"],
    reason,
    arn,
    account: typeof m.AWSAccountId === "string" ? m.AWSAccountId : (arn.split(":")[4] ?? ""),
    region: arn.split(":")[3] ?? "",
    metric: typeof t.MetricName === "string" ? t.MetricName : null,
    namespace,
    value: seen ? Number(seen[1]) : null,
    threshold: num(t.Threshold),
    operator: typeof t.ComparisonOperator === "string" ? t.ComparisonOperator : null,
    resource: main?.value ?? null,
    dimension: main?.name ?? null,
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

const RESOURCE_ATTRS = [
  ["resource_id", "Resource"],
  ["kind", "Service"],
  ["dimension", "Identified by"],
  ["region", "Region"],
  ["account", "AWS account"],
  ["last_alarm", "Last alarm"],
  ["last_alarm_at", "Last alarm at"],
] as const;

// The "AWS" schema and a type in it, made the first time an alarm needs them.
function typeId(name: string, fields: readonly (readonly [string, string])[]): string {
  const t = now();
  let schema = get<{ id: string }>("select id from asset_schemas where name = 'AWS'")?.id;
  if (!schema) {
    schema = uid();
    run("insert into asset_schemas (id, name, description, created_at, updated_at) values (?, 'AWS', 'Filled in from CloudWatch alarms and EC2.', ?, ?)", schema, t, t);
  }
  const type = get<{ id: string }>("select id from asset_types where schema_id = ? and name = ?", schema, name)?.id;
  if (type) return type;
  const id = uid();
  const attrs = fields.map(([key, label]) => ({ key, label, type: "text" }));
  run("insert into asset_types (id, schema_id, name, attributes_json, created_at, updated_at) values (?, ?, ?, ?, ?, ?)", id, schema, name, JSON.stringify(attrs), t, t);
  return id;
}

// Creates or updates the resource's CMDB record: EC2 servers with their details, anything else by its main dimension.
export function upsertResource(a: Alarm, d: Ec2Details | null): string | null {
  if (!a.resource) return null;
  const ec2 = !!a.instanceId;
  const type = ec2 ? typeId("EC2 instance", EC2_ATTRS) : typeId(KINDS[a.namespace ?? ""]?.type ?? "AWS resource", RESOURCE_ATTRS);
  const key = ec2 ? "instance_id" : "resource_id";
  const found = get<{ id: string; attrs_json: string }>(
    `select id, attrs_json from asset_objects where type_id = ? and json_extract(attrs_json, '$.${key}') = ?`,
    type,
    a.resource,
  );
  const old = found ? (JSON.parse(found.attrs_json) as Record<string, string>) : {};
  const fresh: Record<string, string | undefined> = {
    ...(ec2 ? d : { kind: a.namespace ?? undefined, dimension: a.dimension ?? undefined }),
    [key]: a.resource,
    region: a.region,
    account: a.account,
    last_alarm: `${a.name}${a.metric ? ` (${a.metric}${a.value !== null ? ` ${a.value}` : ""})` : ""}`,
    last_alarm_at: new Date().toISOString(),
  };
  const attrs = { ...old, ...Object.fromEntries(Object.entries(fresh).filter(([, v]) => v !== undefined && v !== "")) };
  const name = attrs.name ? `${attrs.name} (${a.resource})` : a.resource;
  const label = get("select 1 from asset_objects where type_id = ? and label = ? and id <> ?", type, name, found?.id ?? "") ? a.resource : name;
  const t = now();
  if (found) {
    run("update asset_objects set label = ?, attrs_json = ?, updated_at = ? where id = ?", label, JSON.stringify(attrs), t, found.id);
    return found.id;
  }
  const id = uid();
  run("insert into asset_objects (id, type_id, label, attrs_json, created_at, updated_at) values (?, ?, ?, ?, ?, ?)", id, type, label, JSON.stringify(attrs), t, t);
  return id;
}

export const openAlertFor = (alias: string) =>
  all<{ id: string; incident_id: string | null }>("select id, incident_id from alerts where alias = ? and status <> 'closed'", alias);
