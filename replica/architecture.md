# Architecture: our ITSM app (a rebuild of Jira Service Management's ITSM features)

Working name until /replica-brand: "the app".

## Stack

| layer | choice | why |
| --- | --- | --- |
| web | Next.js 16.4.2 (App Router; 16.3.2 had critical advisories, see backend.md) + TypeScript 5.9 + React 19.3 | the pack default; one codebase for pages and server actions |
| styling | Tailwind 4.3, themed from replica-design's tokens | the pack default; components use roles (`bg-surface`), never raw hex |
| mobile | none | internal web tool; responsive layout covers phones |
| database | SQLite, through Node 24's built-in `node:sqlite` | swap from Postgres: internal tool on our own Windows server, no cloud accounts, nothing to install or run. One file, backed up by copying |
| ORM | raw SQL in a small data layer | swap: no ORM supports `node:sqlite` well yet; SQL stays portable to Postgres |
| auth | our own: email + password (scrypt), sessions in the database, http-only cookie | swap from Auth.js/Supabase: one organisation, no external identity provider yet; SSO can be added later |
| payments | none | internal tool, nobody pays |
| email | adapter: Resend API when `RESEND_API_KEY` is set, otherwise SMTP-less "outbox" shown to admins | the pack default with a fallback, so it works before IT creates a mail key |
| jobs | an in-process worker started from `instrumentation.ts`, every minute | swap from Vercel Cron: we host it ourselves; jobs are idempotent so a restart is harmless |
| files | none in v1 | no attachments in the feature matrix |
| hosting | this Windows Server: `next start` as a Windows service behind IIS or directly on port 3000 | internal network only |

One database, one process, no microservices.

## Schema

36 tables (copy in `replica/schema.sql`), in `migrations/001_init.sql` (run by `npm run migrate`, and
automatically on start). Rules applied to every table:

- `id text primary key` holding a UUID from `crypto.randomUUID()` (SQLite has no uuid type)
- `created_at` / `updated_at` as UTC epoch milliseconds (`integer`); SQLite has no timestamptz, so UTC is enforced in the data layer
- foreign keys on, every `on delete` chosen: `cascade` for children of a work item, `set null` for people and teams so history survives
- an index on every foreign key and every filtered or sorted column
- `check` constraints on every status, role and type column
- no money columns
- **access rules: one authorisation function in the data layer**, `can(user, action, record)` in `src/lib/access.ts`, called by every server action and page. Employees see only work they raised or must approve, and never internal notes.

Hard constraints the recon found, enforced in the database:
- one decision per approver per stage: `unique (item_id, approver_id, stage)`
- work item keys are unique and sequential: `counters` table, incremented in the same transaction
- an open alert alias is unique: partial unique index `where status != 'closed'`
- a change window ends after it starts: `check (planned_end > planned_start)`
- one SLA warning and one breach notice per item and SLA: `unique (item_id, sla_id, kind)`

## API

Server actions (all in `src/app/actions/`), by flow:

| action | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| signIn / signOut | session start/end, rate limited | anyone | email, password | redirect | all |
| raiseRequest | create from a request type | employee, agent | type, summary, fields | item key | F01 |
| createItem | create any work type | agent | type, fields, links | item key | F04-F06 |
| transition | move status if the workflow allows | agent; employee may cancel or close own | item, to | redirect | F02, F04-F06 |
| comment | reply, internal note, back-dated timeline note | agent; employee public only | item, body, internal, occurred_at | redirect | F02, F04 |
| updateFields | assignee, team, priority, impact, urgency, major, change fields, text sections | agent | item, fields | redirect | F02, F04-F06 |
| decideApproval | approve or decline with note | the named approver | approval, decision, note | redirect | F03, F06 |
| link / unlink, people, services, assets on an item | relations | agent | ids | redirect | F04-F06 |
| bulk | assign or transition many | agent | ids, op | redirect | F02 |
| rate | CSAT 1-5 | the requester, when done | score, comment | redirect | F01 |
| queues: create, delete, star | personal and shared queues | agent (shared: admin) | filter | redirect | F02 |
| articles: save, delete, vote, fromItem | knowledge base | agent; vote: anyone signed in | article | redirect | F01 |
| services, assets (schema, type, attribute, object, import) | registry and CMDB | agent | forms, CSV | redirect | F04 |
| alerts: raise, ack, close, toIncident | alert handling | agent | alert | redirect | F07 |
| schedules: save, delete | on-call | agent | rotation | redirect | F07 |
| rules: save, toggle, delete | automation | admin | when/if/then | redirect | F08 |
| settings: users, teams, request types, SLA goals, calendars, canned responses, outbox | admin | admin | forms | redirect | F08 |

Route handlers:

| method path | does | who |
| --- | --- | --- |
| POST /api/alerts | monitoring intake, dedupe by alias | holder of `ALERT_TOKEN` |
| GET /api/kb/search?q= | article suggestions while raising a request | signed in |
| GET /api/health | liveness for monitoring | anyone |

Webhooks out: none. Jobs (every minute, idempotent):
- `sla-watch`: notify the assignee (or team) once when an SLA is under 25% left, once when breached
- `escalate`: alert unacknowledged past the schedule's limit → notify the escalation person once
- `mail`: send queued emails, retry up to 5 times, then mark failed

## The parts that bite

- time zones: all stored in UTC; SLA calendars carry their own UTC offset; daylight saving shifts the offset, so admins edit it twice a year (noted in Settings)
- idempotency: jobs record what they sent (`sla_notices`, `alerts.escalated_at`, `outbox.status`); alert intake dedupes by alias
- races: SQLite serialises writes; key counter and approvals in one transaction
- rate limits: sign-in 10 attempts per 15 minutes per email and per IP; alert intake 60 per minute
- search: `like` queries; fine for thousands of items, swap to FTS5 later
- realtime: none; pages render fresh on every request
- email deliverability: Resend from our own domain once IT verifies SPF/DKIM; outbox until then
- multi-tenancy: none, one organisation
- deletion: users are deactivated, not deleted, so history keeps its author; an admin can anonymise a user (name and email replaced)

## Build order

1. **Vertical slice** (S01, S02, S03, S05, S07, S08): sign in, raise a request, see it in a queue, reply, resolve, employee sees it. Tables: users, sessions, request_types, items, comments, history, counters.
2. **Must-haves**: SLAs and badges (slas, sla_calendars); approvals (approvals, S16); workflows for all four types; incidents with major queue (S10); problems (S13); changes with peer review and CAB (S14); links; KB (S17); assets (S19); admin request types, users, teams (S24).
3. **Should-haves**: queue filters, stars, bulk; responders, stakeholders, timeline with back-dated notes; PIR (S12); change calendar (S15); services (S18); alerts and on-call (S20, S21); automation (S22); reports (S23); notifications in-app and email; SLA goal editing.
4. **Could-haves**: queue board and calendar views, canned responses, article from request, votes, alert API, escalation, CSAT, audit log, restricted request types.
5. **Fixes from replica-entrepreneur.**
