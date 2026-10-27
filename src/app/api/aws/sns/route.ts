import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { raiseAlert, setAlertStatus } from "@/lib/alerts";
import { describeInstance, openAlertFor, parseAlarm, upsertInstance } from "@/lib/aws";
import { isSnsUrl, verifySns, type SnsMessage } from "@/lib/sns";
import { robot } from "@/lib/automation";
import { get } from "@/lib/db";
import { addComment, getItem } from "@/lib/items";
import { alertIntakeBlocked } from "@/lib/limits";
import { isDone } from "@/lib/workflows";

function tokenMatches(given: string | null): boolean {
  const expected = process.env.SNS_TOKEN;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const topicAllowed = (arn: string) => {
  const list = (process.env.SNS_TOPIC_ARNS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return list.length === 0 || list.includes(arn);
};

// Amazon SNS HTTPS subscription: https://<host>/api/aws/sns?token=<SNS_TOKEN>
// Three checks before anything is stored: the token in the URL, the topic (SNS_TOPIC_ARNS), and AWS's signature.
export async function POST(req: Request) {
  if (!process.env.SNS_TOKEN) return NextResponse.json({ error: "AWS intake is switched off. Set SNS_TOKEN to turn it on." }, { status: 503 });
  if (!tokenMatches(new URL(req.url).searchParams.get("token"))) return NextResponse.json({ error: "Missing or wrong token." }, { status: 401 });
  if (alertIntakeBlocked()) return NextResponse.json({ error: "Too many alerts this minute." }, { status: 429, headers: { "retry-after": "60" } });
  let m: SnsMessage;
  try {
    m = JSON.parse(await req.text()) as SnsMessage;
  } catch {
    return NextResponse.json({ error: "Send the SNS message as JSON." }, { status: 400 });
  }
  if (typeof m?.Type !== "string" || typeof m.TopicArn !== "string" || typeof m.Message !== "string") return NextResponse.json({ error: "That isn't an SNS message." }, { status: 400 });
  if (!topicAllowed(m.TopicArn)) return NextResponse.json({ error: "That topic isn't allowed here." }, { status: 403 });
  if (process.env.SNS_VERIFY === "off") console.warn("SNS_VERIFY=off: accepting an SNS message without checking its signature. Test setups only.");
  else if (!(await verifySns(m).catch(() => false))) return NextResponse.json({ error: "Signature check failed." }, { status: 403 });

  if (m.Type === "SubscriptionConfirmation") {
    if (!isSnsUrl(m.SubscribeURL)) return NextResponse.json({ error: "Unexpected confirmation link." }, { status: 400 });
    const res = await fetch(m.SubscribeURL!, { signal: AbortSignal.timeout(5000) }).catch(() => null);
    return NextResponse.json({ confirmed: !!res?.ok }, { status: res?.ok ? 200 : 502 });
  }
  if (m.Type !== "Notification") return NextResponse.json({ ignored: m.Type });

  const alarm = parseAlarm(m.Message);
  if (!alarm) {
    // Anything else on the topic becomes a plain alert.
    const { alert, repeat } = raiseAlert({ message: (m.Subject || m.Message).slice(0, 300), description: m.Message.slice(0, 4000), source: "aws-sns", alias: null });
    return NextResponse.json({ alert: alert.number, repeat }, { status: 201 });
  }
  const alias = alarm.arn || `cloudwatch:${alarm.name}`;

  if (alarm.state === "OK") {
    const bot = robot();
    const open = openAlertFor(alias);
    for (const a of open) {
      setAlertStatus(a.id, "closed", bot.id);
      const item = a.incident_id ? getItem(a.incident_id) : undefined;
      if (item && !isDone(item.category, item.status)) addComment(item.id, bot, `CloudWatch: ${alarm.name} is back to OK.\n${alarm.reason}`, { internal: true });
    }
    return NextResponse.json({ closed: open.length });
  }
  if (alarm.state !== "ALARM") return NextResponse.json({ ignored: alarm.state });

  // The server's record in the CMDB, with live details from EC2 when the role allows it.
  const lookup = alarm.instanceId ? await describeInstance(alarm.region, alarm.instanceId) : { details: null };
  const assetId = upsertInstance(alarm, lookup.details);
  const name = lookup.details?.name;
  const what = alarm.metric ? `${alarm.metric}${alarm.value !== null ? ` ${alarm.value}` : ""}` : "alarm";
  const where = alarm.resource ? ` on ${name ? `${name} (${alarm.resource})` : alarm.resource}` : "";
  const details = [
    alarm.description,
    alarm.reason,
    alarm.threshold !== null ? `Threshold: ${alarm.operator ?? ""} ${alarm.threshold}` : "",
    `Alarm: ${alarm.name} · ${alarm.namespace ?? ""} · ${alarm.region} · account ${alarm.account}`,
    lookup.details ? "" : alarm.instanceId ? `EC2 details not available (${"error" in lookup ? lookup.error : "no lookup"}).` : "",
  ];
  const { alert, repeat } = raiseAlert({
    message: `${alarm.name}: ${what}${where}`.slice(0, 300),
    description: details.filter(Boolean).join("\n"),
    source: "cloudwatch",
    priority: 3,
    alias,
    metric: alarm.metric,
    metricValue: alarm.value,
    resource: alarm.resource,
    assetId,
  });
  const incident = alert.incident_id ? get<{ key: string }>("select key from items where id = ?", alert.incident_id)?.key : null;
  return NextResponse.json({ alert: alert.number, repeat, incident, asset: !!assetId }, { status: repeat ? 200 : 201 });
}
