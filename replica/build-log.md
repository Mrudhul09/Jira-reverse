# Build log

All screens checked at 1440px and 390px wide with no console errors and no
sideways scrolling (`node scripts/screens.cjs`); screenshots in
`replica/clone-screens/`. No reference screenshots exist, so screens follow the
recon map for layout and hierarchy, not measured pixels.

| ID | date | state | missing | harder than expected |
| --- | --- | --- | --- | --- |
| S01 sign in | 2026-10-25 | done | rate limiting comes with /replica-backend | |
| S02 help center | 2026-10-25 | done | | |
| S03 raise a request | 2026-10-25 | done | | article suggestions as you type needed a small search API |
| S04 my requests | 2026-10-25 | done | | |
| S05 request (employee) | 2026-10-25 | done | | keeping internal notes out is enforced in the query, not the page |
| S06 help article | 2026-10-25 | done | | |
| S07 queues | 2026-10-25 | done | calendar view shows the current month only | counts cap at 999+ so big queues stay fast |
| S08 work item | 2026-10-25 | done | | the busiest screen: 9 panels, each with its own small form |
| S09 raise work | 2026-10-25 | done | | |
| S10 incidents | 2026-10-25 | done | | |
| S11 incident extras | 2026-10-25 | done | | back-dated timeline notes: clamp to after the incident started and not in the future |
| S12 post-incident review | 2026-10-25 | done | | |
| S13 problems | 2026-10-25 | done | | |
| S14 changes | 2026-10-25 | done | | approvals in two stages (one teammate, then every CAB member) |
| S15 change calendar | 2026-10-25 | done | | |
| S16 approvals | 2026-10-25 | done | | |
| S17 knowledge base | 2026-10-25 | done | | |
| S18 services | 2026-10-25 | done | | |
| S19 assets | 2026-10-25 | done | | attribute types incl. links between objects, and CSV import that resolves links by name |
| S20 alerts | 2026-10-25 | done | | |
| S21 on call | 2026-10-25 | done | escalation timer added in /replica-backend | |
| S22 automation | 2026-10-25 | done | | rules must not trigger each other; a guard stops loops |
| S23 reports | 2026-10-25 | done | | |
| S24 settings | 2026-10-25 | done | | |

Found while checking: on phones, screen-reader-only labels inside scrolling
tables escaped their box and made pages scroll sideways; the table wrapper is
now a positioning context.

## 2026-10-27: closing the parity gaps (replica-build)

| ID | Date | State | Missing | Harder than expected |
| --- | --- | --- | --- | --- |
| BUG-007 | 2026-10-27 | done | - | React resets forms after an action, so typed values are put back just after that reset |
| Email intake (/api/inbound-email) | 2026-10-27 | done | needs the mail provider's inbound webhook pointed at it, owner action at deploy | quoted earlier text is cut off replies with simple rules; unusual mail clients may leave some in |
| Settings > Workflows | 2026-10-27 | partial | transitions can't be drawn by hand; built-in statuses can't be deleted | statuses were constants used everywhere; now one cached overlay (`workflow()`), cleared when an admin saves |

Tests: F06-E5 extended, F10-H1, F10-N1, F11-H1, F11-E1 added. Full suite 63 / 63. The F06 approval helper
now waits for its own result (it had been satisfied early by an unrelated "Overlaps" notice).
Outgoing emails now carry `[KEY]` in the subject so replies thread back.

## 2026-10-27: AWS CloudWatch alarms (owner's automation scenario)

| ID | Date | State | Missing | Harder than expected |
| --- | --- | --- | --- | --- |
| /api/aws/sns | 2026-10-27 | done | needs a public HTTPS address before AWS can reach it | SNS signature check written by hand (token + topic list + signature); certificates only from sns.*.amazonaws.com |
| CMDB from alarms | 2026-10-27 | done | other AWS resource types (RDS, ELB) are recorded on the alert, not in Assets | EC2 details need the server's IAM role; works without it, with fewer details |
| Metric rules | 2026-10-27 | done | - | alert rules could only open incidents; now later steps act on the incident opened |

Tests: F12-U1, F12-H1, F12-E1, F12-N1. Full suite 67 / 67. Setup guide: replica/aws-setup.md.
