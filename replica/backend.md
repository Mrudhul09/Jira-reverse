# Backend

Date: 2026-10-25. Checked with `node scripts/backend-check.cjs` (14 of 14) and
`node scripts/screens.cjs` (48 of 48) against a fresh database.

## Auth

- Email + password, scrypt hashes; sessions in the database (only token hashes stored), http-only cookie, `secure` in production, 7 days.
- No self sign-up: an internal tool, so admins add people (Settings > People). A real install starts with one admin from `INITIAL_ADMIN_*` (`SEED_DEMO=0`).
- Password reset by email: 30-minute single-use link, token stored hashed, same answer whether or not the account exists, all sessions ended after a reset.
- Change password (signs out other devices), sign out everywhere, email updates on/off: `/portal/account`.
- Roles employee / agent / admin plus teams; one authorisation module, `src/lib/access.ts`, called by every page and server action.
- Leaving: an admin removes a person's name and email ("anonymise") and their sessions, notifications and personal queues; the work they did stays so history adds up. Full deletion isn't offered on purpose (audit trail of an ITSM tool).
- Magic links, Google/Microsoft sign-in: not in the recon map; can be added later with the company's own identity provider.

## Database

- Migrations in `migrations/` (001 schema, 002 resets and jobs), run by `npm run migrate` and on every start; each runs once in a transaction.
- Access rules: data-layer checks (architecture choice). Tested with a second user: an employee is sent away from agent pages, gets 404 on someone else's request, can't see IT-only articles in search, and a tampered form can't change someone else's request.
- Seed: invented demo data by default; `SEED_DEMO=0` gives a clean install with defaults only.
- Backups: `npm run backup` takes a consistent copy while running (`VACUUM INTO`), keeps 14. **Owner action:** schedule it daily in Windows Task Scheduler and copy `backups/` off the server.

## Payments

None: internal tool, nobody pays.

## Email and jobs

- Email through Resend's public API with our own key and verified domain (`RESEND_API_KEY`, `MAIL_FROM`). Every email goes through the `outbox` table first; until the key exists they are **held** and shown in Settings > Email and jobs, with a button to send them later.
- Retries: up to 5 tries with an idempotency key so nothing is sent twice, then `failed` (the dead-letter list in Settings).
- Worker (`src/instrumentation.ts` → `src/lib/jobs.ts`), every minute, each run logged in `job_runs`:
  - `sla-watch`: one notice when an SLA has under 25% left, one when it's missed (assignee, else the team)
  - `escalate`: an alert still unacknowledged after the schedule's limit goes to its escalation person, once
  - `mail`: sends the outbox
  - `cleanup`: expired sessions, old sign-in records (30 days), used resets, old job logs, old read notifications, sent mail after 90 days
- Times stored in UTC; shown in the server's time zone; SLA calendars carry their own offset.
- Verified: an aged P1 got exactly one "breached" notice per SLA; a 30-minute-old open alert escalated once.

## Integrations

| integration | official way | keys / scopes | notes |
| --- | --- | --- | --- |
| Resend (email) | REST API `POST /emails` | API key with sending access only | IT verifies the sending domain (SPF/DKIM) in Resend first |
| Monitoring tools | our `POST /api/alerts` with `x-alert-token` | shared secret in `ALERT_TOKEN` | 60 alerts a minute, repeats grouped by `alias` |

No Google/Microsoft scopes are used, so no OAuth verification is needed.

## Security checklist

- [x] secrets only in env vars, `.env*` in `.gitignore`, nothing in client bundles (no secret names in client components)
- [x] input validated on the server on every route (typed readers in `src/lib/form.ts`: lengths, ids, enums, dates; whitelisted columns; parameterised SQL everywhere)
- [x] authorisation checked on every read and write, tested with a second user
- [x] rate limits: sign-in 10 failures per email / 30 per address per 15 min; reset emails 3 per account / 5 per address per hour; alert API 60 a minute
- [x] webhooks verify signatures: the alert API checks its token in constant time
- [x] uploads: none in this app
- [x] no user data in URLs or logs: emails and names removed from redirect messages; nothing personal is logged
- [x] dependencies audited: `npm audit` found critical Next.js advisories in 16.3.2 (remote code execution on Windows servers, among others); upgraded to 16.4.2, now **0 vulnerabilities**
- [x] privacy notice lists every processor: `/privacy` (our server; Resend once email is on)
- [x] extra: security headers (no framing, nosniff, referrer policy, permissions policy), no `x-powered-by`, server actions check the request origin (Next.js)

## For the owner (things only you can do)

1. Create a Resend account and API key, verify the sending domain, put `RESEND_API_KEY` and `MAIL_FROM` in `.env.local`.
2. Choose `ALERT_TOKEN` and give it to the monitoring tools.
3. Schedule `npm run backup` daily.
