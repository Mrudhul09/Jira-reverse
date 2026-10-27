import { createSign, generateKeyPairSync } from "node:crypto";
import type { Page } from "@playwright/test";
import { stringToSign, verifySns, type SnsMessage } from "../src/lib/sns";
import { ADMIN, AGENT, a11y, expect, field, one, stamp, test } from "./fixtures";

const TOPIC = "arn:aws:sns:us-east-1:111122223333:glasswork-alarms";

function alarmMessage(name: string, state: "ALARM" | "OK", value: number, instance = "i-0abc1234def567890") {
  return JSON.stringify({
    AlarmName: name,
    AlarmDescription: "CPU on the web server",
    AWSAccountId: "111122223333",
    NewStateValue: state,
    NewStateReason: `Threshold Crossed: 1 datapoint [${value} (27/10/26 10:00:00)] was ${state === "ALARM" ? "greater" : "not greater"} than the threshold (80.0).`,
    StateChangeTime: "2026-10-27T10:00:00.000+0000",
    AlarmArn: `arn:aws:cloudwatch:us-east-1:111122223333:alarm:${name}`,
    Trigger: { MetricName: "CPUUtilization", Namespace: "AWS/EC2", Threshold: 80, ComparisonOperator: "GreaterThanThreshold", Dimensions: [{ name: "InstanceId", value: instance }] },
  });
}

const sns = (page: Page, message: string, { token = "e2e-sns", topic = TOPIC } = {}) =>
  page.request.post(`/api/aws/sns?token=${token}`, {
    headers: { "content-type": "text/plain; charset=UTF-8", "x-amz-sns-message-type": "Notification" },
    data: JSON.stringify({ Type: "Notification", MessageId: stamp(), TopicArn: topic, Subject: "ALARM", Message: message, Timestamp: new Date().toISOString(), SignatureVersion: "1", Signature: "x", SigningCertURL: "https://sns.us-east-1.amazonaws.com/x.pem" }),
  });

test.describe("F12 AWS CloudWatch alarms", () => {
  test("F12-U1 SNS signatures: only a genuine one passes", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pem = publicKey.export({ type: "spki", format: "pem" }).toString();
    const m: SnsMessage = { Type: "Notification", MessageId: "1", TopicArn: TOPIC, Message: "hello", Timestamp: "2026-10-27T10:00:00Z", SignatureVersion: "2", Signature: "", SigningCertURL: "https://sns.us-east-1.amazonaws.com/SimpleNotificationService-1.pem" };
    m.Signature = createSign("RSA-SHA256").update(stringToSign(m)).sign(privateKey, "base64");
    expect(await verifySns(m, async () => pem)).toBe(true);
    expect(await verifySns({ ...m, Message: "tampered" }, async () => pem)).toBe(false);
    // A certificate from anywhere but SNS is never fetched.
    let fetched = false;
    expect(await verifySns({ ...m, SigningCertURL: "https://evil.example.com/x.pem" }, async () => ((fetched = true), pem))).toBe(false);
    expect(fetched).toBe(false);
  });

  test("F12-H1 CPU above 80 opens a P1 incident for the team, with the server in the CMDB", async ({ as }) => {
    const dana = await as(ADMIN);
    await dana.goto("/automation");
    const s = stamp();
    await field(dana, "Name").fill(`CPU over 80 is P1 ${s}`);
    await dana.locator("#trigger").selectOption("alert_created");
    await dana.locator("#rsource").selectOption("cloudwatch");
    await dana.getByLabel("Metric is").fill("CPUUtilization");
    await dana.locator("#rop").selectOption(">");
    await dana.getByLabel("Than").fill("80");
    await dana.locator("#a1").selectOption("open_incident");
    await dana.locator("#a2").selectOption("set_priority");
    await dana.locator("#a2_priority").selectOption("1");
    await dana.locator("#a3").selectOption("assign_team");
    await dana.locator("#a3_team").selectOption({ label: "Infrastructure" });
    await dana.getByRole("button", { name: "Add rule" }).click();
    await expect(dana.getByRole("main").getByRole("status")).toContainText("Rule added");
    await expect(dana.getByText("from CloudWatch, metric CPUUtilization, value above 80").first()).toBeVisible();

    const hot = await sns(dana, alarmMessage(`web-cpu-${s}`, "ALARM", 92.5));
    expect(hot.status()).toBe(201);
    const body = (await hot.json()) as { incident: string; asset: boolean };
    expect(body.asset).toBe(true);
    expect(body.incident).toMatch(/SH-\d+/);
    const inc = one<{ priority: number; team: string; category: string }>(
      "select i.priority, i.category, t.name as team from items i join teams t on t.id = i.team_id where i.key = ?",
      body.incident,
    );
    expect(inc).toMatchObject({ priority: 1, team: "Infrastructure", category: "incident" });
    const asset = one<{ label: string; attrs: string }>(
      "select o.label, o.attrs_json as attrs from asset_objects o join item_assets ia on ia.asset_id = o.id join items i on i.id = ia.item_id where i.key = ?",
      body.incident,
    );
    expect(asset.label).toBe("i-0abc1234def567890");
    expect(JSON.parse(asset.attrs)).toMatchObject({ instance_id: "i-0abc1234def567890", region: "us-east-1", account: "111122223333" });

    // The same alarm again counts on the open alert; no second incident.
    expect((await sns(dana, alarmMessage(`web-cpu-${s}`, "ALARM", 95))).status()).toBe(200);
    expect(one<{ n: number }>("select count(*) as n from items where summary like ?", `web-cpu-${s}%`).n).toBe(1);

    const omar = await as(AGENT);
    await omar.goto(`/items/${body.incident}`);
    await expect(omar.getByRole("heading", { name: new RegExp(`web-cpu-${s}: CPUUtilization 92.5`) })).toBeVisible();
    await expect(omar.getByRole("link", { name: "i-0abc1234def567890" })).toBeVisible();
    await a11y(omar);

    // Back to OK: the alert closes and the incident gets a note.
    expect((await sns(dana, alarmMessage(`web-cpu-${s}`, "OK", 40))).status()).toBe(200);
    expect(one<{ status: string }>("select status from alerts where alias like ?", `%:alarm:web-cpu-${s}`).status).toBe("closed");
    await omar.goto(`/items/${body.incident}?show=all`);
    await expect(omar.getByText(`CloudWatch: web-cpu-${s} is back to OK.`)).toBeVisible();
  });

  test("F12-E1 CPU below the rule's value opens no incident", async ({ as }) => {
    const page = await as(null);
    const s = stamp();
    const res = await sns(page, alarmMessage(`batch-cpu-${s}`, "ALARM", 61, "i-0fff0000aaaa11112"));
    expect(res.status()).toBe(201);
    expect(((await res.json()) as { incident: string | null }).incident).toBeNull();
    expect(one<{ n: number }>("select count(*) as n from asset_objects where json_extract(attrs_json, '$.instance_id') = 'i-0fff0000aaaa11112'").n).toBe(1);
  });

  test("F12-N1 wrong token or topic is refused", async ({ as }) => {
    const page = await as(null);
    const before = one<{ n: number }>("select count(*) as n from alerts").n;
    expect((await sns(page, alarmMessage(`x-${stamp()}`, "ALARM", 99), { token: "wrong" })).status()).toBe(401);
    expect((await sns(page, alarmMessage(`x-${stamp()}`, "ALARM", 99), { topic: "arn:aws:sns:us-east-1:999999999999:other" })).status()).toBe(403);
    expect(one<{ n: number }>("select count(*) as n from alerts").n).toBe(before);
  });
});

test("F12-H2 an RDS alarm records the database in the CMDB", async ({ as }) => {
  const page = await as(null);
  const s = stamp();
  const message = JSON.stringify({
    AlarmName: `db-connections-${s}`,
    AWSAccountId: "111122223333",
    NewStateValue: "ALARM",
    NewStateReason: "Threshold Crossed: 1 datapoint [412.0 (27/10/26 10:00:00)] was greater than the threshold (300.0).",
    AlarmArn: `arn:aws:cloudwatch:us-east-1:111122223333:alarm:db-connections-${s}`,
    Trigger: { MetricName: "DatabaseConnections", Namespace: "AWS/RDS", Threshold: 300, Dimensions: [{ name: "DBInstanceIdentifier", value: `orders-db-${s}` }] },
  });
  expect((await sns(page, message)).status()).toBe(201);
  const row = one<{ type: string; attrs: string }>(
    "select t.name as type, o.attrs_json as attrs from asset_objects o join asset_types t on t.id = o.type_id where o.label = ?",
    `orders-db-${s}`,
  );
  expect(row.type).toBe("RDS database");
  expect(JSON.parse(row.attrs)).toMatchObject({ resource_id: `orders-db-${s}`, kind: "AWS/RDS", dimension: "DBInstanceIdentifier", region: "us-east-1" });
  expect(one<{ a: string | null }>("select asset_id as a from alerts where alias like ?", `%:alarm:db-connections-${s}`).a).not.toBeNull();
});
