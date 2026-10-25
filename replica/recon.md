# Recon map: Jira Service Management (web)

Scope: full ITSM for one organisation: help center and service requests,
agent queues, SLAs, approvals, incidents (incl. major incidents and
post-incident reviews), problems, changes and change calendar, knowledge
base, services, assets/CMDB, alerts and on-call, automation, reports.
For: our internal IT team. Employees are the customers.
Date: 2026-10-25

Method: public sources only. No Atlassian account, so no "own account"
walkthrough, and the terms question does not arise. No app code, bundles or
network calls were read. No screenshots were provided, so `replica/screens/`
is empty and layouts will be designed fresh, not measured.

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | help center index | https://support.atlassian.com/jira-service-management-cloud/resources/ | full list of feature areas |
| 2 | main features overview | https://support.atlassian.com/jira-service-management-cloud/docs/get-to-know-the-main-jira-service-management-features/ | work categories, agent work, alerting, Assets |
| 3 | What are queues? | https://support.atlassian.com/jira-service-management-cloud/docs/what-are-queues/ | name + filter + columns; sorted by SLA; priority groups; list/board/calendar views; filters for request type, status, assignee; counts cap at 999+ |
| 4 | Queues (agent) | https://support.atlassian.com/jira-service-management-cloud/docs/triage-customer-requests-for-your-agents-with-queues/ | star queues, sort, assign, bulk comment/assign/transition |
| 5 | What are SLAs? | https://support.atlassian.com/jira-service-management-cloud/docs/what-are-slas/ | goals per request type, start/pause/stop conditions, calendars incl. holidays |
| 6 | SLA setup (server docs) | https://confluence.atlassian.com/servicemanagementserver/setting-up-slas-939926373.html | default metrics: first response, resolution, plus approve/close |
| 7 | What are approvals? | https://support.atlassian.com/jira-service-management-cloud/docs/what-are-approvals/ | approval step on a status; approvers can be plain customers; approve/decline in help center or email; requester told of approver comments |
| 8 | What are request types? | https://support.atlassian.com/jira-service-management-cloud/docs/what-are-request-types/ | request types, portal groups, per-type fields, per-type workflow, restrict who can raise |
| 9 | What is a knowledge base? | https://support.atlassian.com/jira-service-management-cloud/docs/what-is-a-knowledge-base/ | help-center search; agents share articles; agents create an article from a request |
| 10 | What are incidents? | https://support.atlassian.com/jira-service-management-cloud/docs/what-are-incidents/ | definition; escalate to major |
| 11 | What are major incidents? | https://support.atlassian.com/jira-service-management-cloud/docs/what-are-major-incidents/ | marking major sets it apart; dedicated "Major incident" queue |
| 12 | Incident timeline | https://support.atlassian.com/jira-service-management-cloud/docs/what-is-the-incident-timeline/ | full real-time history; stakeholder updates, alert changes, edits, comments; filterable; notes can be added "to a past time" |
| 13 | Incidents index | https://support.atlassian.com/jira-service-management-cloud/docs/manage-your-incidents/ | responders, stakeholders and groups, PIRs, conference calls |
| 14 | What are problems? | https://support.atlassian.com/jira-service-management-cloud/docs/what-are-problems/ | problems cause incidents; raised after major or repeated incidents or proactively; workaround |
| 15 | Problem mgmt (older cloud docs) | https://confluence.atlassian.com/servicedeskcloud/managing-problems-with-your-it-service-desk-817562149.html | investigation, workaround, known error |
| 16 | What are changes? | https://support.atlassian.com/jira-service-management-cloud/docs/what-are-changes/ | standard (pre-approved), normal (assessed and reviewed), emergency (fast-tracked) |
| 17 | Change mgmt index | https://support.atlassian.com/jira-service-management-cloud/docs/what-is-change-management/ | CAB approval, enforce approval, reminders, risk, change calendar and windows, deployment tracking |
| 18 | Change mgmt (older cloud docs) | https://confluence.atlassian.com/servicedeskcloud/managing-changes-with-your-it-service-desk-817562147.html | peer review then CAB review |
| 19 | ITSM features page | https://www.atlassian.com/software/jira/service-management/features/itsm | request, incident, problem, change, asset, config, knowledge capabilities |
| 20 | Assets features page | https://www.atlassian.com/software/jira/service-management/features/asset-and-configuration-management | schemas, object types, relationships, link to work, imports |
| 21 | Statuses and priorities | https://support.atlassian.com/jira-cloud-administration/docs/what-are-issue-statuses-priorities-and-resolutions/ | default status names |
| 22 | pricing page | https://www.atlassian.com/software/jira/service-management/pricing | plan table not readable without scripts; source 11/17 say major incidents, PIRs and some change features moved to Premium (Oct 2024) |

Not reachable: the "What is Assets?" and on-call articles returned 404; the
Assets and on-call rows below rely on sources 2, 19 and 20.

## Core loop

An employee raises a request in the help center; it lands in the right agent
queue with an SLA clock running; an agent works it, replies and resolves it;
the employee is kept informed and can rate it.

## Screens

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Sign in | /login | sign in as employee, agent or admin | form | error |
| S02 | Help center home | /portal | search, pick a request type by group | search, request-type cards, popular articles | empty, search results |
| S03 | Raise a request | /portal/new/:type | request-type form | per-type fields, article suggestions | validation error, needs approval note |
| S04 | My requests | /portal/requests | own requests, approvals waiting on me | table, tabs open/closed/approvals | empty |
| S05 | Request (employee view) | /portal/requests/:key | status, public comments, approve/decline, cancel, confirm fixed, rate | timeline, comment box, approval panel, rating | waiting for you, resolved, declined |
| S06 | Article (help center) | /portal/kb/:id | read article, helpful vote | article body, vote | agents-only (not found) |
| S07 | Agent queues | /queues/:id | list of work per queue | queue list with counts, filters, SLA badges, bulk actions, star | empty, 999+ |
| S08 | Work item view | /items/:key | work one item | status transitions, fields panel, reply vs internal note, SLAs, approvals, links, services, assets, activity | breached, major, approval pending |
| S09 | Create work item | /items/new | agent raises any work type | type tabs, per-type form, impact/urgency | validation error |
| S10 | Incidents list | /incidents | incidents, major first | tabs open/major/mine/resolved | none open |
| S11 | Incident extras on S08 | /items/:key | responders, stakeholders, timeline incl. back-dated notes, linked alerts | people list, timeline | major |
| S12 | Post-incident review | /pir/:key | write and publish the review | sections, pre-filled timeline | draft, published |
| S13 | Problems list | /problems | problems with incident counts | tabs open/known errors/done | empty |
| S14 | Changes list | /changes | changes by window, type, risk | tabs open/awaiting approval/scheduled/done | empty |
| S15 | Change calendar | /changes/calendar | changes on a month grid | month grid, risk colours, prev/next | empty month |
| S16 | Approvals | /approvals | everything waiting on me | cards with approve/decline | none waiting |
| S17 | Knowledge base (agent) | /kb, /kb/:id, /kb/new | list, read, write articles | table, editor, visibility toggle | empty |
| S18 | Services | /services, /services/:id | service registry, dependencies, impact | table, depends on / used by, linked work | empty |
| S19 | Assets | /assets, /assets/object/:id | schemas, types, attributes, objects, references, import | type tree, object table, attribute editor, CSV import | empty type |
| S20 | Alerts | /alerts | acknowledge, close, create incident | table, priority, counts | all quiet |
| S21 | On-call | /oncall | who is on call, rotations, escalation | schedule cards, upcoming shifts | no schedule |
| S22 | Automation | /automation | when / if / then rules, audit log | rule table, builder, log | none |
| S23 | Reports | /reports | volumes, SLA success, CSAT, problems | stat tiles, bars | no data |
| S24 | Settings | /settings | users, teams, request types and fields, SLAs and calendars, canned responses | tabs, forms | |

## Flows

```
F01 Employee raises a service request
    S02 -> S03 (article suggestions while typing) -> S05
    happy path clicks: 3 (pick type, fill, send)
    edge: required field empty, article solves it (no request), type needs approval

F02 Agent works the queue
    S07 -> S08 -> reply (stops first-response SLA) -> In progress -> Resolved
    happy path clicks: 4
    edge: waiting for customer pauses the SLA, customer reply resumes it,
          internal note never visible to the employee, bulk assign

F03 Approval
    S05 or S16 -> approve / decline (+ note) -> request continues or ends Declined
    edge: approver is a plain employee, decided twice, item no longer waiting

F04 Incident, incl. major
    S09 (or S20) -> S08 -> impact x urgency -> priority -> responders
    -> mark major (major queue) -> stakeholders notified -> resolve -> S12
    edge: P1 goal near breach, back-dated timeline note, linked to a problem

F05 Problem
    S08 incident -> create problem (linked) -> investigate -> workaround -> known error -> fixed by a change
    edge: many incidents linked, no root cause yet

F06 Change
    S09 change (type, risk, plans, window) -> peer review -> CAB approval (S16)
    -> awaiting implementation -> implementing -> completed or failed; on S15
    edge: standard skips approval, emergency fast-track, declined, overlapping window

F07 Alert to incident
    monitoring -> alert intake -> S20 -> on-call notified -> acknowledge -> incident -> F04
    edge: duplicate alert (same alias), P1/P2 auto-opens an incident

F08 Admin
    S24 request types and fields, SLA goals and calendars, users and teams; S22 rules
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Button | primary, secondary, subtle, danger, small | default, hover, focus, disabled, loading | all |
| Status lozenge | to do, in progress, done, failed/declined | | S04-S16 |
| Priority mark | P1-P5 | | lists, S08 |
| SLA badge | running, near breach, paused, met, breached | tooltip with goal and calendar | S07, S08 |
| Data table | selectable rows, sortable | empty, loading | lists |
| Queue list | counts, starred | 999+ | S07 |
| Tabs | page tabs, view tabs | selected | S04, S08, S10-S14, S24 |
| Fields panel | text, select, person, team, date-time, checkbox | read, edit | S08 |
| Comment box | reply, internal note, canned response | | S05, S08 |
| Activity / timeline | comments, field changes, approvals | filter all/comments/history | S05, S08, S11 |
| Approval panel | approve, decline, note | pending, decided | S05, S08, S16 |
| Request-type card | icon, name, description | hover | S02 |
| Month calendar | events by risk | today, other month | S15 |
| Banner / toast | error, success, info | | all |
| Notifications menu | unread count | empty | all |

## Inferred data model

```
User        id, name, email, role (employee | agent | admin), active
            evidence: src 7 (approvers are customers), 1. confidence: high
Team        id, name, members. evidence: src 2 operations teams, 18 CAB. confidence: high
RequestType id, name, description, icon, group, work category, fields[], approver,
            routes-to team, visible in help center
            evidence: src 8, 7. confidence: high
WorkItem    id, key, category (service_request | incident | problem | change), request_type,
            summary, description, status, priority, impact, urgency, reporter, assignee, team,
            is_major, change_type, change_risk, planned_start/end, plans (implementation,
            backout, test), root_cause, workaround, resolution, field values,
            first_response_at, resolved_at, created/updated
            evidence: src 10-18. confidence: high (fields), medium (exact names)
Comment     item, author, body, internal, created_at (+ occurred_at for back-dated timeline notes)
            evidence: src 12. confidence: high
History     item, actor, field, old, new, at. evidence: src 12. confidence: high
Approval    item, approver, stage, rule (all | any), decision, note, decided_at
            evidence: src 7, 17, 18. confidence: high
Link        from item, to item, type (relates | causes | fixes | duplicates)
            evidence: src 14, 19. confidence: high
ItemPerson  item, user, kind (responder | stakeholder). evidence: src 13. confidence: high
SLA         name, metric, goals [{category?, priority?, minutes, calendar}], enabled
SlaCalendar name, 24/7 or days + hours + UTC offset + holidays
            evidence: src 5, 6. confidence: high
Queue       name, filter, owner (shared or personal), stars. evidence: src 3, 4. confidence: high
Article     title, body, category, visible in help center, views, helpful votes
            evidence: src 9. confidence: high (votes: guess)
Service     name, description, tier, owner team, depends on[]. evidence: src 1, 2. confidence: high
AssetSchema / AssetType (attributes incl. references) / AssetObject
            evidence: src 20. confidence: medium (attribute details are a guess)
Alert       alias, source, message, priority P1-P5, status, team, count, incident
            evidence: src 2. confidence: high
Schedule    team, rotation, shift length, start, escalation (after, to)
            evidence: src 2. confidence: medium
Rule        trigger, conditions, actions, enabled, run log. evidence: src 1. confidence: high
Notification, Csat (item, score, comment), PIR (incident, sections, status). confidence: high
```

Relationships: Team n-n User; RequestType 1-n WorkItem; WorkItem 1-n Comment,
History, Approval; WorkItem n-n WorkItem (Link), Service, AssetObject, User
(ItemPerson); Alert n-1 WorkItem; Incident 1-1 PIR; Team 1-n Schedule.

Default workflows (medium confidence, names partly third-party):
- Service request: (Waiting for approval) -> Waiting for support -> In progress <-> Waiting for customer -> Resolved -> Closed; Declined; Canceled
- Incident: Open -> Work in progress <-> Pending -> Resolved -> Closed; Canceled
- Problem: Open -> Under investigation <-> Known error -> Completed; Canceled
- Change: Review -> Planning -> Awaiting approval -> Awaiting implementation -> Implementing -> Completed | Failed; Declined; Canceled

## Feature matrix

See `features.csv`. Must: 30, should: 25, could: 9, skip: 6 (70 rows).
Baseline from `parity.py`: 0.0 / 100, 0 of 30 must-haves.

## Out of scope (cannot or should not be cloned)

- Rovo / AI features, Opsgenie infrastructure, Statuspage, Confluence editor, Compass, Marketplace apps (Atlassian platform)
- Network discovery agent for assets (CSV import instead)
- SMS, voice and push paging (paid telephony; in-app instead)
- Slack / Teams two-way chat, approve from email (need our own app and mail setup; later)
- The "Jira" name, Atlassian logos, icons, copy and the Atlaskit component library

## Size

Screens 24, flows 8, entities ~20. Hardest parts: SLA clocks on calendars with
pauses; configurable workflows with approval stages (peer review then CAB); the
automation engine; the assets attribute and reference model.
Size: XL as a whole, so it is built in three phases, each one usable:
1. Core service desk (M): S01-S09, S16, S24 basics; F01-F03.
2. ITIL (M): S10-S15; F04-F06.
3. Operations and insight (L): S17-S23; F07-F08.
