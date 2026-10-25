# Components

Tokens: see tokens.json. Icons: Lucide (ISC licence), 16px in text, 18px in nav.
Font: Inter (SIL Open Font Licence) via next/font, system fallback.
Accessible base: native elements (button, a, details/summary, dialog-free
forms, fieldset/legend, table) instead of a component library; every control
is reachable by keyboard and labelled. Built in `src/components/ui/`, shown
together at `/design`.

```
Button
  variants  primary, secondary, subtle, danger
  sizes     sm 28px, md 36px
  states    default, hover, active, focus-visible (2px ring, focus), disabled, loading (SubmitButton: spinner + label kept, aria-busy)
  tokens    primary: bg accent / hover accent-hover, text on-accent; secondary: bg canvas, border line, text fg; radius md, font base/600
  a11y      real <button> (or <a> for LinkButton), visible focus, loading keeps the label for screen readers
  used on   all

Status lozenge
  variants  todo (sunken/fg), inprogress (info-soft/info), done (success-soft/success), bad (danger-soft/danger) for Declined/Failed
  tokens    radius sm, text xs uppercase 600
  a11y      plain text, colour never the only signal (the status name is the text)
  used on   S04, S05, S07, S08, S10, S13, S14, S16

Priority mark
  variants  P1-P5 (p1..p5 square + label; short "P1" or long "P1 Highest")
  a11y      label always shown; square is aria-hidden
  used on   S07, S08, S10, S20

SLA badge
  variants  running (sunken), near breach under 25% left (warning-soft), paused (canvas + line, "paused"), met (success-soft), breached (danger-soft, "Breached -2h")
  states    tooltip (title) with SLA name, goal and calendar
  a11y      text states the condition; not colour alone
  used on   S07, S08

Data table
  variants  plain, selectable (checkbox column + select-all)
  states    empty (EmptyState instead of table), long text wraps, horizontal scroll in its own container on narrow screens
  tokens    header bg surface, text muted xs/600; rows border line; hover surface
  a11y      <table> with <th scope=col>; checkboxes labelled "Select SH-12"
  used on   S04, S07, S10, S13, S14, S17-S24

Queue list
  states    selected (accent-soft), starred (star icon), count, 999+
  a11y      <nav aria-label="Queues">, aria-current on the open queue
  used on   S07

Tabs
  variants  link tabs (page views), button tabs (comment box)
  states    selected (accent text, 2px accent underline), hover, focus
  a11y      link tabs use aria-current="page"; button tabs role=tab + aria-selected
  used on   S04, S07, S08, S10, S13, S14, S20, S24

Field (label + control + hint + error)
  controls  input text/email/password/number/date/datetime-local, select (single, multiple), textarea, checkbox, radio group (fieldset + legend)
  states    default, focus (2px focus ring), invalid (danger border, error text, aria-invalid + aria-describedby), disabled, required (asterisk + required attr)
  tokens    border input, radius md, min height 36px
  used on   S01, S03, S08, S09, S12, S17-S24

Comment box
  variants  reply to requester, internal note (warning-soft background), employee comment
  extras    canned response picker (agents), "send and set Waiting for customer", back-dated note time (incidents)
  a11y      tabs for reply/note, textarea labelled
  used on   S05, S08

Activity / timeline
  variants  comments (avatar + bubble; internal = warning-soft + "Internal" lozenge), history lines (muted xs), back-dated notes marked "added later"
  filter    Comments / All / History tabs
  used on   S05, S08, S11

Approval panel
  states    pending (accent border, approve/decline + note), decided (lozenge per approver), none
  used on   S05, S08, S16

Request-type card
  states    hover (accent border), focus
  parts     icon tile (accent-soft/accent), name, description
  used on   S02

Panel / card
  variants  card (canvas + line), sunken (surface), panel (header row + body)
  used on   all

Banner
  variants  error (role=alert), ok (role=status), info
  used on   all (reads ?error= / ?ok= after a form post)

Empty state
  parts     title, one line, optional action
  used on   every list

Month calendar
  states    today (accent circle), other month (surface, muted), event chip by risk (accent-soft / warning-soft / danger-soft)
  a11y      role=grid, chips are links with full title
  used on   S15, queue calendar view

Board (queue board view)
  parts     one column per status with count; cards with key, summary, priority, SLA
  used on   S07

Notifications menu, account menu
  parts     details/summary popover, unread badge (danger)
  a11y      summary has aria-label with unread count
  used on   all
```
