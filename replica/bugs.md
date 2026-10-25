# Bugs

Found by `/replica-test` (Playwright, Chromium, production build, 1440px and 390px) and by `/replica-backend`'s audit.
Every fix has a test that failed before it and passes after.

| ID | severity | title | status |
| --- | --- | --- | --- |
| BUG-001 | S1 | Next.js 16.3.2 has critical advisories, incl. remote code execution on Windows servers | fixed (upgrade to 16.4.2) |
| BUG-002 | S2 | Post-incident review: refused "Publish" throws away everything typed | fixed |
| BUG-003 | S3 | Links in text rely on colour alone | fixed |
| BUG-004 | S3 | A long unbroken summary makes the page scroll sideways | fixed |
| BUG-005 | S3 | Request page sometimes has no page title for screen readers | fixed |
| BUG-006 | S3 | Calendars use grid roles without rows (screen readers mis-read them) | fixed |
| BUG-007 | S3 | Other forms lose what was typed when the server refuses them | open |

### BUG-001: Next.js 16.3.2 has critical security advisories

- Severity: S1
- Flow / case: all
- Screen: all
- Build: 2c09b95 (before)  Browser / device: n/a (server)

Steps
1. `npm audit --omit=dev`

Expected: no known vulnerabilities
Actual: 1 critical: GHSA-p293-qw3h-jr36 (unauthenticated RCE on Windows-hosted servers), GHSA-2464-fhr4-w9xw, GHSA-673q-mjm6-r5xr (RCE), plus 10 more.
Evidence: npm audit output in replica/backend.md
Status: fixed in 2c09b95 (next 16.4.2; `npm audit` reports 0). Note: the earlier ServiceHub app in C:\AI Project\Jira still uses 16.3.2.

### BUG-002: Refused "Publish" on a post-incident review throws away the text

- Severity: S2 (data loss of long text the user wrote)
- Flow / case: F04 / F04-H3
- Screen: S12
- Build: test run 4  Browser / device: Chrome, 1440px

Steps
1. Resolve an incident, open "Write the post-incident review".
2. Write "What happened", leave "Why it happened" empty, press Publish.

Expected: told what's missing, text still there.
Actual: error shown and the form reloads empty; the review was never saved.
Evidence: F04-H3 failed ("Published." never appeared, the second Publish hit the same error).
Suspected cause: validation redirected before saving; the page reloads from the database.
Status: fixed: an incomplete review is saved as a draft first, then the message explains what's missing. F04-H3 now also checks the text is still there.

### BUG-003: Links in text rely on colour alone

- Severity: S3 (WCAG 1.4.1)
- Flow / case: F01-H2, F04-H3, F05-H1, F06-H1 (axe `link-in-text-block`)
- Screen: S06, S08, S12 (breadcrumbs and links inside sentences)
- Build: test run 3  Browser / device: Chrome, 1440px

Steps
1. Open any work item; look at the "Incidents / SH-12" breadcrumb.

Expected: links distinguishable without colour.
Actual: same weight and no underline as the text around them.
Evidence: axe violation `link-in-text-block` on /portal/kb/…, /items/SH-17, /pir/SH-32.
Status: fixed: links are underlined by default; navigation, cards and buttons opt out.

### BUG-004: A long unbroken summary makes the page scroll sideways

- Severity: S3
- Flow / case: F01 / F01-E2
- Screen: S05
- Build: test run 3  Browser / device: Chrome, 1440px

Steps
1. Raise a request whose summary is 200 characters with no spaces.

Expected: the heading wraps.
Actual: the page scrolls sideways by 993px.
Evidence: F01-E2 (`scrollWidth - clientWidth` = 993).
Status: fixed: headings, table cells and detail values wrap long words.

### BUG-005: Request page sometimes has no page title

- Severity: S3 (WCAG 2.4.2)
- Flow / case: F01 / F01-E6
- Screen: S05
- Build: test run 4  Browser / device: Chrome, 390px

Steps
1. On a phone-sized screen, raise a request; you land on the request page.

Expected: the page has a title.
Actual: axe `document-title`: no `<title>` at the moment the page is shown.
Evidence: F01-E6.
Suspected cause: the page had no title of its own, and Next.js 16 streams titles in after the page starts.
Status: fixed: the page sets "Request SH-n", and titles are sent in the head straight away (`htmlLimitedBots`).

### BUG-006: Calendars use grid roles without rows

- Severity: S3 (WCAG 1.3.1)
- Flow / case: F06 / F06-H1 (axe `aria-required-children`, `aria-required-parent`)
- Screen: S15, S07 calendar view
- Build: test run 4  Browser / device: Chrome, 1440px

Steps
1. Open the change calendar.

Expected: valid structure for assistive technology.
Actual: `role=grid` with `columnheader`/`gridcell` children but no `row`s.
Status: fixed: a labelled section; each day reads its full date and how many items it has.

### BUG-007: Other forms lose what was typed when the server refuses them

- Severity: S3 (annoying, workaround: the browser checks required fields first, so this only happens on rarer server-side checks)
- Flow / case: F01-E1, F06-E5
- Screen: S03, S09
- Build: test run 7  Browser / device: Chrome, 1440px

Steps
1. Raise work with a change window that ends before it starts.

Expected: error, with the summary and plans still filled in.
Actual: error shown, the form comes back empty.
Evidence: F06-E5 page snapshot (only the error is shown; fields are blank).
Suspected cause: errors are passed by redirect; fixing needs the long forms to keep their values on the server side of the round trip.
Status: open. Next step: move the raise-request and raise-work forms to `useActionState` so a refused submit returns the values.

## Problems found in the tests themselves (fixed, not app bugs)

- Next.js adds a hidden route announcer with `role="alert"`; tests now look for messages inside `<main>`.
- Required labels end in " *"; tests match the label with or without it.
- A leftover wait in the sign-in helper held every later click for 20 s (45-minute runs); now one wait.
- Playwright's trace recorder stopped Next.js following redirects after form posts; tracing is off.
- Some text matched hidden dropdown options; tests now match visible text, cells or headings.

## To check (not reproduced)

- Emails actually arriving (needs a Resend key): manual case M1.
- A full screen-reader pass with NVDA: manual case M2.
