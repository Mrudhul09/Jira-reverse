# Rollout plan (internal launch)

1. Before: create real accounts (Settings > People), switch the demo data off (`SEED_DEMO=0` on a fresh database), set request types and teams, verify the Resend sending domain, set ALERT_TOKEN in monitoring, schedule `npm run backup`.
2. Pilot (2 weeks): the IT team plus one friendly department. Watch Settings > Email and jobs and the error log daily.
3. Cutover: announce with the /welcome link; the old desk takes no new requests; IT re-raises any still-open tickets by hand.
4. Measure: Reports (raised vs finished, SLA met, satisfaction) weekly for the first month.
5. Talk to 10 people by hand in week one: 5 employees who raised something, 3 agents, 2 approvers. Ask what they couldn't find and what they expected to happen.
6. Next builds (from parity.md): requests by email, editable statuses, keep form input on errors (BUG-007).

Not applicable: waitlist, Product Hunt or Hacker News posts, communities of the original's unhappy users (this isn't sold).
