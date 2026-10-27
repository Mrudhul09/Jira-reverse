# Handover: where we are (updated 2026-10-27)

Read this first when you come back. Say "continue the Glasswork project" to Claude.

## What this is

**Glasswork**: our own IT service desk, built by reverse engineering **Jira Service Management** with the
Replica skills (all 11 ran: recon, architect, design, build, backend, test, diff, entrepreneur, brand, launch, deploy).
Clean room: no Jira code, copy or branding. Parity score **96.8 / 100**, 30/30 must-haves, **68/68 tests** pass.

| | |
| --- | --- |
| Code | `C:\AI Project\ITSM` → GitHub https://github.com/Mrudhul09/Jira-reverse (branch main, all pushed) |
| Demo (fake data) | http://localhost:3000 · demo accounts, password `demo-itsm-2026` (admin@example.org, omar@, lena@, theo@, ravi@). Only runs while Claude/VS Code started it: ask Claude to "start the demo" |
| Production (real) | http://localhost:3100 · admin **mrudhul555@gmail.com** (your password) · folder `C:\Glasswork` |
| Production running | Scheduled task "Glasswork" starts it at boot; "Glasswork backup" runs daily 02:00 into `C:\Glasswork\backups` |
| Update production | backup, stop task, `git pull`, `npm ci`, `npm run build` in `C:\Glasswork\app`, start task (ask Claude) |

## Done on 2026-10-27

1. Closed parity gaps: requests by email (`/api/inbound-email`), Settings → Workflows (rename/add statuses), BUG-007 (forms keep typed text).
2. Went live on this server (stage 1, localhost only). Fixed a first-start bug (password with `#` needs quotes in `.env.local`).
3. Security check: 0 known vulnerabilities, no SQL injection or XSS found, passwords hashed, secrets not in GitHub.
4. **AWS automation (your scenario)**: CloudWatch alarm → SNS → Glasswork alert → CMDB record (Assets → AWS;
   EC2 with live details, RDS/ELB/Lambda/etc. by name) → automation rule (e.g. CPUUtilization above 80 →
   open incident, P1, Infrastructure team). Alarm back to OK closes the alert and notes the incident.
   Installed in production but **off** until you add `SNS_TOKEN` and `SNS_TOPIC_ARNS`. Steps: `replica/aws-setup.md`.

## Your to-do list (owner actions)

- [ ] Delete the `INITIAL_ADMIN_PASSWORD` line from `C:\Glasswork\app\.env.local` (only needed on first start)
- [ ] In production: add your IT people (Settings → People), teams, request types, SLAs
- [ ] Pick a hostname + HTTPS so others (and AWS SNS) can reach it (deploy.md)
- [ ] AWS: IAM role with `ec2:DescribeInstances`, SNS topic + HTTPS subscription, alarm notifications (aws-setup.md)
- [ ] Email: Resend account + domain DNS, then `RESEND_API_KEY`, `MAIL_FROM` (deploy.md)
- [ ] Copy `C:\Glasswork\backups` off this server now and then

## Ideas not built yet

Auto-resolve the incident when an alarm returns to OK · assign to the on-call engineer · customer
organisations / departments · CI/CD tracking on changes · hand-drawn workflow transitions · query-language search.

## Where the details are

`replica/deploy.md` (go-live checklist) · `replica/aws-setup.md` (AWS steps) · `replica/parity.md` (vs Jira) ·
`replica/build-log.md` (what was built) · `replica/bugs.md` · `replica/features.csv`.
