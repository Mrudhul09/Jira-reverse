# AWS CloudWatch → Glasswork: setup

The flow: **CloudWatch alarm → SNS topic → Glasswork** (HTTPS) → alert → the server's record in Assets (CMDB)
→ automation rule (e.g. CPU above 80 → open an incident, P1, Infrastructure team). When the alarm returns to OK,
the alert closes and the incident gets an internal note.

## 1. Before you start

- Glasswork reachable from the internet over **HTTPS** (SNS can't reach `localhost`). See deploy.md: hostname,
  certificate, port 443 open to SNS. Only `/api/aws/sns` needs to be reachable from outside; the rest can stay internal
  (e.g. the reverse proxy allows only that path from the internet).
- Admin access to the AWS account that owns the alarms.

## 2. Settings in `C:\Glasswork\app\.env.local` (you type the values)

| name | value |
| --- | --- |
| `SNS_TOKEN` | a long random secret, e.g. from `node -e "console.log(crypto.randomBytes(24).toString('hex'))"` |
| `SNS_TOPIC_ARNS` | the topic ARN(s) allowed, comma separated, e.g. `arn:aws:sns:ap-south-1:123456789012:glasswork-alarms` |
| `APP_URL` | `https://help.yourcompany.com` |

Never set `SNS_VERIFY=off` or `EC2_LOOKUP=off` on the real server; they exist for the automated tests only.
Restart the "Glasswork" scheduled task after editing.

## 3. Let Glasswork read server details (CMDB)

The EC2 server running Glasswork needs an IAM role (EC2 console → the instance → Security → IAM role; if empty,
Actions → Security → Modify IAM role). Give that role this read-only policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [{ "Effect": "Allow", "Action": "ec2:DescribeInstances", "Resource": "*" }]
}
```

No access keys are stored anywhere; the AWS SDK picks up the role automatically. Without the role, alarms still work
and the CMDB record holds only the instance ID, region and account. Servers in another AWS account are recorded the
same way (no cross-account lookup).

## 4. SNS topic and subscription (AWS console)

1. SNS → Topics → Create topic, Standard, name `glasswork-alarms`.
2. Create subscription → Protocol **HTTPS** → Endpoint `https://help.yourcompany.com/api/aws/sns?token=<SNS_TOKEN>`.
3. Glasswork confirms the subscription by itself (after checking AWS's signature). The subscription shows
   "Confirmed" within a minute.

## 5. CloudWatch alarm

CloudWatch → Alarms → Create alarm → metric EC2 → Per-Instance Metrics → `CPUUtilization` for the server →
threshold e.g. greater than 80 → Notification: **In alarm** → `glasswork-alarms`; add a second notification for
**OK** → `glasswork-alarms` (this closes the alert).

## 6. The rule in Glasswork

Automation → Add rule:
- When: **Alert received** · Alert comes from: **AWS CloudWatch** · Metric is: `CPUUtilization` · Value is: **above** · Than: `80`
- Do 1: **Open an incident** · Do 2: **Set the priority** P1 · Do 3: **Give it to a team** Infrastructure

Add more rules for other metrics (e.g. `StatusCheckFailed` at or above 1 → P1; `CPUUtilization` above 60 → P3).
Rules run top to bottom; a later rule's priority wins.

## 7. Check it

Test without waiting for real load: `aws cloudwatch set-alarm-state --alarm-name <name> --state-value ALARM
--state-reason "Threshold Crossed: 1 datapoint [95.0 (test)] was greater than the threshold (80.0)."`
(the number in brackets is what rules compare). Then Alerts, the new incident, and Assets → AWS → EC2 instance.

## Security

Every SNS message must pass three checks before anything is stored: the secret token in the URL, an allowed topic,
and AWS's signature (the certificate must come from an `sns.<region>.amazonaws.com` address). The endpoint is
rate-limited with the other alert intake (60 a minute).
