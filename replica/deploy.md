# Deploy checklist: Glasswork

Date: 2026-10-25  Commit: afcc349  Go from user: **not yet**

## Preflight (all must pass)

- [x] e2e suite green: 58 / 58 (full run at 10ac417; launch commit adds 1 test, passed). One flaky failure seen once during the brand step, not reproduced on re-run
- [x] no open S1 or S2 bugs (bugs.md: 6 fixed, 1 open S3)
- [x] parity: all must-haves done (30/30), feature score 94.9
- [x] rebrand sweep clean (`sweep.py` exit 0)
- [-] store listing: not applicable (no mobile app)
- [x] production build passes (Next.js 16.4.2, `npm audit`: 0 vulnerabilities)
- [x] privacy page live (/privacy), every processor listed (our server; Resend once email is on). Terms: internal tool, covered by company IT policy, so no separate page
- [x] cookie banner not needed: one essential sign-in cookie, no analytics or tracking cookies
- [x] account removal works (Settings > People > Remove personal details; tested F08-E1)
- [x] favicon and titles are ours ("· Glasswork", own mark). OG image: not made (internal links only)

## Production (owner actions marked ★)

Hosting choice: this Windows Server, internal network (architecture.md). Not Vercel: the app stores data in a local SQLite file.

- [ ] Fresh production database: a new folder, `SEED_DEMO=0`, migrations run on start
- [ ] ★ `.env.local` on the server (names from `.env.example`): `APP_URL`, `SEED_DEMO=0`, `INITIAL_ADMIN_NAME/EMAIL/PASSWORD`, `ALERT_TOKEN`, `INBOUND_TOKEN`, `RESEND_API_KEY`, `MAIL_FROM`, `DATABASE_PATH`
- [ ] ★ Resend account; sending domain verified (SPF, DKIM, DMARC below)
- [ ] ★ Email intake: a support address (e.g. help@yourcompany.com) whose provider posts incoming mail to `https://<host>/api/inbound-email` with the `x-inbound-token` header (Resend inbound, Postmark inbound or a forwarder)
- [ ] Run as a Windows service so it restarts with the server (Task Scheduler "at startup" running `npm start`, or a service wrapper)
- [ ] ★ Daily `npm run backup` in Task Scheduler; copy `backups/` off the server
- [-] Stripe, OAuth: not used

## Domain (★ IT/network owner)

Internal hostname, e.g. `help.yourcompany.com`:

| record | name | value |
| --- | --- | --- |
| A (internal DNS) | help | this server's IP |
| TXT | (from Resend) | SPF value Resend shows |
| TXT/CNAME | (from Resend) | DKIM values Resend shows |
| TXT | _dmarc | `v=DMARC1; p=none; rua=mailto:it@yourcompany.com` (tighten to `quarantine` once reports are clean) |

HTTPS: put IIS (with URL Rewrite + ARR) or Caddy in front of port 3000 with the company certificate; the session cookie is `secure` in production, so plain http won't sign in.

## Watch (first week)

- [ ] Uptime check on `/api/health` (returns `{"ok":true}`) from existing monitoring
- [ ] Settings > Email and jobs: worker ran in the last minute; no failed emails
- [ ] Core flow on the live site: raise a request on a phone, reply as an agent, resolve, rate
- [ ] Error log: the service's stdout/stderr kept in a log file

Live URL: not deployed yet.
