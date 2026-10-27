# Deploy checklist: Glasswork

Date: 2026-10-27  Commit: e51cb6d  Go from user: **yes (2026-10-27), this server only for now**

## Preflight (all must pass)

- [x] e2e suite green: 63 / 63 at e51cb6d
- [x] no open S1 or S2 bugs (bugs.md: all 7 fixed)
- [x] parity: all must-haves done (30/30), feature score 96.8
- [x] rebrand sweep clean (`sweep.py` exit 0, after removing the generated playwright-report)
- [-] store listing: not applicable (no mobile app)
- [x] production build passes (Next.js 16.4.2, `npm audit`: 0 vulnerabilities)
- [x] privacy page live (/privacy), every processor listed (our server; Resend once email is on). Terms: internal tool, covered by company IT policy, so no separate page
- [x] cookie banner not needed: one essential sign-in cookie, no analytics or tracking cookies
- [x] account removal works (Settings > People > Remove personal details; tested F08-E1)
- [x] favicon and titles are ours ("· Glasswork", own mark). OG image: not made (internal links only)

## Production (owner actions marked ★)

Hosting choice: this Windows Server (architecture.md). Not Vercel: the app stores data in a local SQLite file.
Stage 1 (now): reachable on this server only, http://localhost:3100. Hostname, HTTPS and email come later.

Layout: `C:\Glassworkpp` (a clone of the repo, built), `data\glasswork.db`, `backups\`, `logs\`, `start.cmd`, `backup.cmd`.
Updating later: `git pull`, `npm ci`, `npm run build` in `C:\Glassworkpp`, then restart the "Glasswork" task.

- [x] Fresh production database: `C:\Glasswork\data`, `SEED_DEMO=0`, migrations run on start
- [ ] ★ `C:\Glassworkpp\.env.local` written (APP_URL, DATABASE_PATH, SEED_DEMO=0, admin mrudhul555@gmail.com, ALLOW_HTTP=1); **owner types INITIAL_ADMIN_PASSWORD**. Later: (names from `.env.example`): `APP_URL`, `SEED_DEMO=0`, `INITIAL_ADMIN_NAME/EMAIL/PASSWORD`, `ALERT_TOKEN`, `INBOUND_TOKEN`, `RESEND_API_KEY`, `MAIL_FROM`, `DATABASE_PATH`
- [ ] ★ Resend account; sending domain verified (SPF, DKIM, DMARC below)
- [ ] ★ Email intake: a support address (e.g. help@yourcompany.com) whose provider posts incoming mail to `https://<host>/api/inbound-email` with the `x-inbound-token` header (Resend inbound, Postmark inbound or a forwarder)
- [x] Starts with the server: scheduled task "Glasswork" (at startup, SYSTEM) runs `start.cmd`, output to `logs\glasswork.log`
- [x] Daily backup: scheduled task "Glasswork backup" at 02:00 runs `backup.cmd`, keeps 14
- [ ] ★ Copy `C:\Glassworkackups` off the server (another disk or share)
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

Live URL: http://localhost:3100 (this server only). Live since 2026-10-27; admin mrudhul555@gmail.com created on first start.

## First start (2026-10-27)

- The first attempt didn't create the admin: the password contained `#`, which the env loader reads as a comment,
  so it arrived too short. The value is now in single quotes; `.env.example` says so.
- The same attempt found a bug: a failed first start left an empty database in use with no retry (the background
  worker swallowed the error). Fixed in c4ae894; a failed first start now logs the error and retries on the next request.
- `/api/health` ok, sign-in page 200, admin present, no demo data, demo logins hidden.
