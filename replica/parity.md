## Parity: 94.9 / 100 (features only)

Date: 2026-10-25. Scored with the pack's `parity.py` (must 3, should 2, could 1; partial counts half;
skipped rows and our own additions are not scored).

| | |
| --- | --- |
| Feature score | **94.9** (70 counted) |
| Must-haves | **30 of 30 done** |
| Layout score | **not measured**: no screenshots of the original exist (no account, none supplied), so `imgdiff.py` has nothing to compare against. Our screens follow the recon map's structure; they were not measured against Jira's. |
| Tests | 50 of 50 automated cases pass (twice); 48 of 48 screen checks at 1440px and 390px |
| Open bugs | no S1, no S2; 1 S3 (BUG-007, forms lose typed text on a server-side refusal) |

What the number does and doesn't say: it measures our own feature list, built from Atlassian's public
docs. It says nothing about depth: Jira Service Management is far more configurable than this (workflow
editor, query language, a large integration marketplace). Six features the recon sources mention were
missing from the first matrix; this step found them and added them, which took the score from 100 to 94.9.

## Missing, in build order

- [should] Raise requests by email (an inbox the service desk reads)
- [should] Admins customise workflows and statuses (ours are four fixed workflows in code)
- [could] Deployment tracking and gating from CI/CD on changes
- [could] Customer organisations (group requesters, e.g. by department)
- [could] Search with a query language (ours: form filters, saved as queues)
- [could] Several service projects, each with its own queues and settings

## Left out on purpose (not scored)

Network discovery for assets (CSV import instead), SMS/voice/push paging (in-app and email instead),
AI summaries and virtual agent, a public status page, Slack and Teams sync, approving from email.

## Layout

No comparison possible (see above). The diff tool was used the other way it's meant for, on our own
screens: after the `/replica-test` fixes it caught a regression (table cells breaking words mid-way,
the queue page 63% taller); fixed, screens now 99.5–99.9% identical to before apart from the
intended link underlines. Images: `replica/diffs/*-regression.png`.

## Behaviour, flow by flow

Compared against what Atlassian's public docs describe (recon sources), not against a live account.

| flow | original does | ours does | fix or keep |
| --- | --- | --- | --- |
| F01 raise a request | help center → request type → form → send (3 clicks); suggests articles | same 3 clicks; suggests articles while you type the summary | keep |
| F01 by email | an email to the support address becomes a request | not possible | **build** (top of the list) |
| F02 work the queue | queues from saved query filters; list, board or calendar view | form filters saved as queues; list, board, calendar | keep; query language is a could |
| F02 updates to the requester | emails by default | emails once the owner adds a Resend key; held in the outbox until then | fix at deploy (owner action) |
| F03 approval | in the help center, from the email, or in Slack/Teams | help center or agent view | keep; email approval was skipped on purpose |
| F04 incident | major incidents get their own queue; timeline with notes added later; stakeholders informed | same, plus impact × urgency works out the priority on the form | keep |
| F05 problem | linked incidents, workaround, known error | same | keep |
| F06 change | change types, CAB approval, change calendar, deployment tracking from CI/CD | peer review then every CAB member; calendar with overlap warning; no CI/CD | keep; CI/CD is a could |
| F07 alert | from monitoring tools through integrations; on-call routing and escalation | token-protected intake API, de-duplication by alias, on-call notice, timed escalation | keep |
| F08 admin | request types, fields, workflows, SLAs (goals by query), automation | request types, fields, SLAs (goals by kind and priority), automation; fixed workflows | build workflow editing (should) |

## Verdict

**Shippable** for internal use: every must-have done, feature score 94.9 (80+ needed), no open S1 or S2.

**Better than the original** on the points its users push hardest for (updated after `/replica-entrepreneur`):
all 8 fixes in `fixes.md` are built and tested, including four Atlassian feature requests with 655 to 1,515
votes each that have been open for 2 to 12 years. Still behind it on depth (see the missing list).

## Top five to build next

1. Raise requests by email (should).
2. Let admins rename and add statuses within the four workflows (should).
3. BUG-007: keep what people typed when the server refuses a form (S3).
4. Customer organisations / departments, so reports and queues can group by them (could).
5. CI/CD deployment tracking on changes (could).
