# Test plan: our ITSM app

Build: see git log (test commit)  Date: 2026-10-25  Result: 50 of 50 automated cases pass, twice in a row; 2 manual cases wait on the owner  Env: local `next dev` on port 3200, fresh demo seed in `data/test/`, background jobs off (worker tested in backend-check).
Every automated test fails on a console error or any 5xx response, and runs an axe accessibility scan (WCAG 2.1 A/AA) on each screen it visits.

| case | flow | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- | --- |
| F01-H1 | employee raises a request | happy | help center → Ask IT a question → summary → Send | request page with reference, it's in the agent queue | e2e || pass |
| F01-H2 | | happy: article answers it | type "vpn connect" in summary | VPN article suggested; opening it counts a read | e2e || pass |
| F01-E1 | | edge: empty input | send with the required fields blanked (browser check removed) | server refuses with "Please fill in", nothing created | e2e || pass |
| F01-E2 | | edge: very long input | 1,000-character summary | stored cut to 200 characters, page still lays out | e2e || pass |
| F01-E3 | | edge: emoji and accents | "Café Wi-Fi ☕ ne marche pas — ñ" | shown exactly as typed to employee and agent | e2e || pass |
| F01-E4 | | edge: double click on submit | press Send twice quickly | exactly one request created | e2e || pass |
| F01-E5 | | edge: keyboard only | Tab to a request type, Enter, type, Tab to Send, Enter | request raised without a mouse | e2e || pass |
| F01-E6 | | edge: mobile width 390px | raise a request on a phone-sized screen | works, no sideways scroll | e2e || pass |
| F01-E7 | | edge: restricted request type | employee outside the team opens a restricted type | not listed, direct link is 404 | e2e || pass |
| F01-N1 | | negative: wrong password | sign in with a wrong password | refused, no session | e2e || pass |
| F01-N2 | | negative: second user's data | employee opens another person's request | 404; never in their list | e2e || pass |
| F02-H1 | agent works the queue | happy | queue → item → reply → In progress → Resolved | first response met, requester sees reply and "resolved" message | e2e || pass |
| F02-E1 | | edge: internal note | agent adds a note | employee never sees it | e2e || pass |
| F02-E2 | | edge: waiting pauses the clock | reply and mark waiting for customer | resolution SLA shows "paused"; employee reply puts it back to Waiting for support | e2e || pass |
| F02-E3 | | edge: two tabs at once | tab A resolves; tab B (stale) tries Waiting for customer | clear error, no crash, status stays Resolved | e2e || pass |
| F02-E4 | | edge: bulk with nothing ticked | press Assign with no rows | explains what to do | e2e || pass |
| F02-E5 | | edge: bulk assign | tick two rows, assign to Lena | both assigned | e2e || pass |
| F02-E6 | | edge: queue filters and views | filter by status; switch to board and calendar | correct rows; columns by status | e2e || pass |
| F02-E7 | | edge: expired session | delete the session, then act | sent to sign in, nothing changed | e2e || pass |
| F02-N1 | | negative: permission denied | employee opens /items and /settings | sent to the help center | e2e || pass |
| F03-H1 | approval | happy | employee orders equipment; approver approves in help center | Waiting for support; requester told | e2e || pass |
| F03-H2 | | happy: decline with note | approver declines with a note | Declined; requester sees the decision | e2e || pass |
| F03-E1 | | edge: decided twice | approve in tab A, then tab B approves | "already decided" message | e2e || pass |
| F03-N1 | | negative: not your approval | employee forges an approval id | refused | e2e || pass |
| F04-H1 | incident, incl. major | happy | raise incident impact Extensive + urgency Critical | P1, made major by automation, internal note | e2e || pass |
| F04-H2 | | happy: people and timeline | add responder; add a note at a past time | responder listed; note shown at its time with "(added …)" | e2e || pass |
| F04-E1 | | edge: note in the future | back-date to tomorrow | stored as now, not in the future | e2e || pass |
| F04-E2 | | edge: priority from levels | change urgency to Low, leave priority | priority recalculated | e2e || pass |
| F04-H3 | | happy: review | resolve → write PIR → publish | published; publishing without root cause refused | e2e || pass |
| F05-H1 | problem | happy | from incident, open a problem; move to Known error; raise a change | links "causes" and "fixes" both ways | e2e || pass |
| F06-H1 | change | happy: normal | Review → Planning → Awaiting approval → teammate → every CAB member | Awaiting implementation; on the calendar | e2e || pass |
| F06-E1 | | edge: raiser can't review own change | | no approval for the raiser | e2e || pass |
| F06-E2 | | edge: standard change | Planning offers Awaiting implementation directly | no approvals | e2e || pass |
| F06-E3 | | edge: emergency change | Review → Awaiting approval; one CAB member approves | done after one approval | e2e || pass |
| F06-E4 | | edge: declined | a CAB member declines | Declined; others skipped | e2e || pass |
| F06-E5 | | edge: window ends before it starts | | refused | e2e || pass |
| F06-E6 | | edge: overlapping windows | two changes overlap | warning on both | e2e || pass |
| F07-H1 | alert to incident | happy | POST P2 alert with token | incident opened by automation | e2e || pass |
| F07-E1 | | edge: same alias twice | | counted once, no second incident | e2e || pass |
| F07-E2 | | edge: acknowledge then open incident by hand | | linked incident, alert acknowledged | e2e || pass |
| F07-N1 | | negative: bad token / no message | | 401 / 400 | e2e || pass |
| F08-H1 | admin | happy: new request type with a list field | Settings → add → employee raises it | field shown and stored | e2e || pass |
| F08-H2 | | happy: new person | add person → they sign in | works; short password refused | e2e || pass |
| F08-H3 | | happy: automation rule | rule "mentions printer → team Network" | new request routed to Network | e2e || pass |
| F08-H4 | | happy: SLA goal | change a goal | new goal shown on matching work | e2e || pass |
| F08-E1 | | edge: anonymise | remove someone's details | name gone everywhere, work kept, can't sign in | e2e || pass |
| F08-N1 | | negative: agent opens settings | | sent to queues | e2e || pass |
| SLA-U1 | SLA maths | unit | office calendar across a weekend, holidays, UTC offset, pauses | correct working time | unit (Playwright runner) || pass |
| M1 | emails arrive | manual | needs a Resend key | real email in an inbox | manual: owner, after Resend is set up || waiting on owner |
| M2 | screen reader pass | manual | NVDA through raise a request and work an item | everything announced sensibly | manual: owner || waiting on owner |

Not applicable: card declined (no payments), OAuth providers (none), offline (server-rendered app; a failed request shows the browser's own error), slow network (covered by the busy state on every submit button).
