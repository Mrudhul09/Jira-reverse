# Fixes: what Jira Service Management's users dislike, and what we do about it

Sample: **86 items from 3 sources**, collected 2026-10-25 through official public feeds only:

- **App Store** (Apple's customer-reviews feed for Atlassian's "Jira Cloud" app, which carries JSM): 500 newest reviews read, **17** kept because their own words are about service management. Rated reviews.
- **Hacker News** (Algolia API): 122 comments naming the product; **29** kept by hand as real opinions (job posts, status-page quotes and competitors' sales pitches left out).
- **Atlassian's public feature-request tracker** (project JSDCLOUD): the **40** most-voted open suggestions, with vote counts. 4,682 suggestions are open in total.

Not reached: G2, Capterra, Trustpilot and Reddit. They have no official feed we can read verbatim, and their terms forbid automated collection; the skill says to read them by hand in a browser, which this session can't do word for word. **86 is under the skill's 100 target**, so treat the complaint ranking as a direction, not a precise order. The vote counts are strong evidence on their own.

Ranked by `reviews.py` with ITSM themes (`replica/themes-itsm.json`); full output in `feedback.md`. The lists below were checked by hand, because keyword themes are noisy (for example, "Assign ticket to group" landed under "support" only because it contains the word "ticket").

## 1. What they hate

1. **Alerting and on-call got worse after Opsgenie was folded into JSM.** 13 items, 2 sources, average 1.0★.
   - "forced to use this app over opsgenie but the critical alert functionality does not actually alert like opsgenie, i keep missing pages in the middle of night and even day" (App Store, 1★) https://itunes.apple.com/us/rss/customerreviews/page=2/id=1006972087/sortBy=mostRecent/json
   - "The app is lacking almost everything that was present in OpsGenie and is so basic it’s not worth using." (App Store, 1★, same page)
2. **Too complex to set up and to change.** 10 items, 2 sources.
   - "You get a few projects in JIRA…and you’re stuck." https://news.ycombinator.com/item?id=31815073
   - "- have you tried to set up even a slightly customized Jira Service Desk?" https://news.ycombinator.com/item?id=23714239
3. **Notifications: too many of the wrong ones, missing the right ones, and no way to choose.** 9 items, 3 sources.
   - "There needs to be a way of filtering notifications based on what's important." (App Store, 3★) https://itunes.apple.com/us/rss/customerreviews/page=9/id=1006972087/sortBy=mostRecent/json
   - "We aren’t subscribed to OpsGenie but Jira sends OpsGenie notifications all the time and it’s impossible to unsubscribe, because you need to cancel OpsGenie which we don’t have." https://news.ycombinator.com/item?id=43283386
4. **Outages and crashes.** 4 items, 2 sources (thin).
5. **Price.** 7 items, 2 sources, mixed: some say it's expensive, others that the bundle is cheap. Not relevant to an internal tool; for `/replica-launch` only.

## 2. What is missing (asked for by name, with Atlassian's own vote counts)

| request | votes | open since | do we have it? |
| --- | --- | --- | --- |
| Requesters see read-only fields in the help center ([JSDCLOUD-4328](https://jira.atlassian.com/browse/JSDCLOUD-4328)) | 1,726 | 2016 | **yes**: the request page shows every answer from the form |
| Log of outgoing emails ([JSDCLOUD-4698](https://jira.atlassian.com/browse/JSDCLOUD-4698)) | 1,515 | 2017 | partly: admins see the outbox; **not per work item** |
| Field values in customer emails ([JSDCLOUD-4642](https://jira.atlassian.com/browse/JSDCLOUD-4642)) | 1,289 | 2017 | no: our emails are one line |
| Merge duplicate tickets ([JSDCLOUD-4685](https://jira.atlassian.com/browse/JSDCLOUD-4685)) | 1,239 | 2017 | no: we can link "duplicates" but not merge |
| Saved replies on the resolve step ([JSDCLOUD-12765](https://jira.atlassian.com/browse/JSDCLOUD-12765)) | 1,160 | 2023 | no: saved replies only in the comment box |
| Requester sees who's on it ([JSDCLOUD-328](https://jira.atlassian.com/browse/JSDCLOUD-328)) | 888 | 2014 | **yes**: "Looked after by …" |
| Requester sees linked work ([JSDCLOUD-4636](https://jira.atlassian.com/browse/JSDCLOUD-4636)) | 857 | 2017 | no |
| Reason screen on approve / decline ([JSDCLOUD-6989](https://jira.atlassian.com/browse/JSDCLOUD-6989)) | 739 | 2018 | **yes**: a note on every decision, sent to the requester |
| Requester sees the SLA ([JSDCLOUD-325](https://jira.atlassian.com/browse/JSDCLOUD-325)) | 655 | 2014 | no |
| Export Assets data ([JSDCLOUD-9967](https://jira.atlassian.com/browse/JSDCLOUD-9967)) | 585 | 2021 | no: import only |
| Assign to a group ([JSDCLOUD-106](https://jira.atlassian.com/browse/JSDCLOUD-106)) | 549 | 2013 | **yes**: every item has a team |
| Rename an SLA ([JSDCLOUD-119](https://jira.atlassian.com/browse/JSDCLOUD-119)) | 435 | 2013 | no |
| Sort queues (App Store, 2 reviews, thin) | - | - | no: fixed order |

## 3. What is unsolved (becomes positioning)

1. **Requesters are kept in the dark.** The four most-voted "let the requester see …" requests have waited 8–12 years (fields, assignee, linked work, SLA): 4,126 votes between them, one source but a very large one.
2. **Small IT teams get an enterprise configuration project.** Complexity theme, 10 items, 2 sources.
3. **On-call for teams that just want to be woken up reliably** after the Opsgenie fold-in. 13 items, 2 sources. We can't fix the paging part without a paid phone/SMS provider, so we don't claim it.

## 4. Fix plan

Ordered by evidence × how cheap it is for us. All are additions the original doesn't have (`original = no` in `features.csv`).

| # | change | size | evidence | done by |
| --- | --- | --- | --- | --- |
| 1 | Requester sees **when to expect a reply** (the SLA in plain words) and the **status of linked work** (e.g. a major incident behind their request) | S | 857 + 655 votes, open since 2014/2017 | /replica-build |
| 2 | **Emails sent** panel on every work item (who, when, what, delivered or not) | S | 1,515 votes | /replica-build |
| 3 | **Merge** a duplicate into another item: comments and watchers move, the duplicate closes with a link | M | 1,239 votes | /replica-build |
| 4 | **Resolve with a note**: choose a saved reply and write what fixed it in one step | S | 1,160 votes | /replica-build |
| 5 | **Choose which emails you get** (assigned to me, my requests, approvals, alerts) | S | notifications theme, 9 items, 3 sources | /replica-build |
| 6 | **Sort queues** by priority, SLA, age or update | S | 2 App Store reviews (thin) | /replica-build |
| 7 | **Export assets** to CSV, and rename SLAs | S | 585 + 435 votes | /replica-build |
| 8 | Field answers in requester emails | S | 1,289 votes | /replica-build |

Already ahead: read-only fields for requesters (1,726 votes), who is on it (888), assign to a team (549), a reason on approve/decline (739).
Not fixed, honestly: reliable phone/SMS paging (needs a paid provider).

## 5. The angle

Three options, each from a top theme:

```
A. For employees who never know what's happening with their request,
   IT Help shows who's on it, when to expect a reply, and what it's waiting on.
   Evidence: "requester kept in the dark", 4,126 votes on 4 requests, open 8-12 years.

B. For small IT teams who don't want a months-long ITSM project,
   IT Help comes ready to run: requests, incidents, changes and assets on day one.
   Evidence: complexity theme, 10 items across 2 sources.

C. For on-call engineers tired of noisy or missed alerts,
   IT Help groups repeats, escalates what nobody acknowledged, and lets you pick what reaches your inbox.
   Evidence: alerting + notifications themes, 22 items across 3 sources.
```

**Recommended: A.** It has by far the strongest evidence (vote counts in the thousands, on Atlassian's own board, unsolved for years), we already do half of it, and it's what employees feel every day. For an internal tool, "positioning" means what we tell colleagues the new help desk does better. It drives the name and voice in `/replica-brand`.

Rules kept: no reviewer quote goes on any landing page; the original's name stays out of our app's name.
