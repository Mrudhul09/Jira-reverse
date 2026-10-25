# Brand: Glasswork

Angle (from fixes.md): requesters always see where their request is at.
Name is one setting (`APP_NAME`, default "Glasswork"), so it can change without code.

## Name

20 candidates: Openline, Clearview Desk, Askpoint, Fixpath, Tellwell, Followup, Glasswork, Waypost, Orvo, Tidra, Vela, Keel, Lantern, Beacon, Northlight, Clarion, Lumen, Sorted, Ask, Follow.
Shortlist: Lantern, Glasswork, Waypost, Sorted, Orvo. **Chosen: Glasswork** ("you can see through it").

Checks run 2026-10-25 (screening only, not legal clearance):

| check | Glasswork | Lantern | Waypost | Sorted | Orvo |
| --- | --- | --- | --- | --- | --- |
| .com (Verisign RDAP) | registered | registered | registered | registered | registered |
| App Store exact name | 0 apps | 14 | 5 | 24 | 5 |
| GitHub handle | taken | taken | taken | taken | taken |
| web: "name + help desk/ITSM" | no product found | **conflict: Lantern support ticketing (lanternhq.app), integrates with Jira** | none found | not run | none found |
| US (USPTO, classes 9/42) | to run | to run | to run | to run | to run |
| EU (EUIPO/TMview) | to run | to run | to run | to run | to run |
| Canada (CIPO) | to run | to run | to run | to run | to run |
| WIPO Global Brand DB | to run | to run | to run | to run | to run |
| X / Instagram / TikTok | to run | to run | to run | to run | to run |

Internal tool on the company's own domain (e.g. help.yourcompany.com), so the .com doesn't matter. Before using the name outside the company, have the trademark checks run.

## Palette

Sea-glass teal accent `#0a6670` (hue ~186), different family from the original's blue (~216). Nav `#10292d`. All other roles unchanged. Contrast: 22 pairs, 0 AA failures (`contrast.py`).

## Logo brief

- Idea: four window panes, one lit: you can always see in.
- Type: symbol + wordmark; symbol alone as favicon/app icon. A simple version is in `src/components/Logo.tsx` and `src/app/icon.svg`.
- Must work at 16px and 1024px. Deliverables: SVG, 1024×1024 icon (no transparency), favicon set, 1200×630 social image.
- Must not resemble the original's marks: no chevrons, no blue, no "A" or "J" letterforms. Checked.

## Voice

Plain, warm, honest.
- Plain, not curt: short words, but full sentences.
- Warm, not chummy: "Sorry" when we miss, no exclamation marks.
- Honest, not alarming: say what happens next and when.

Do / don't: "Sent. You'll see every update here." / "Ticket created successfully!"; "We missed our 8h goal, sorry." / "SLA breached"; "Nothing is waiting." / "No results found"; "Only the IT team can change that." / "Permission denied"; "That link has expired or was already used." / "Invalid token".

Most-seen strings (all written fresh): sign-in subtitle "Ask for help, and always see where it's at."; portal hero "Hi Theo, what do you need?"; send button "Send"; confirmation "Sent. You'll see every update here."; empty queue "All clear / Nothing is waiting in this queue."; "Where it's at"; "What to expect"; "Sorted, close it"; "I don't need this any more"; sign-in error "That email and password don't match an active account."

## Sweep

`sweep.py . --config replica/brand.json`: **clean** (exit 0) after removing the generated test report. Titles show "· Glasswork", favicon is our own mark, emails say "Reset your Glasswork password".
