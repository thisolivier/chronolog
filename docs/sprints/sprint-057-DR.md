# Sprint 057-DR — Design r1 stage 6: weekly time review and inline editing

**Week numbering superseded by sprint 061-DR (ISO 8601 again).**

**Status:** ready for review · branch `design-r1-stage6` (from `design-r1` at 0b01e71) · spec
`docs/design/r1/specs/05-time-review.md` (TR-01..TR-08), DS-02 / DS-04.

## Week numbering (TR-07, O05) and the key decision

**Rule (owner, 2026-11-07):** weeks start on Monday; Week 1 is the Monday-start week that contains
1 January. A week spanning two years belongs to the later one (the year of its Sunday). A year has 52
or 53 weeks. One helper: `src/lib/utils/calendar-week.ts` (UTC arithmetic), used by the week strip,
older-week headings, phone title / Back labels, page title, `/time/YYYY-Www`, `GET /api/me`, the
weekly-status API and the CLI (`cli/lib/dates.mjs`, the same rule in plain JS; the CLI ships without
the app's modules).

| Date | New rule | ISO 8601 (old label) |
| --- | --- | --- |
| 2026-12-28 (Mon) | **2027 Week 1** (28 Dec 2026 – 3 Jan 2027) | 2026-W53 |
| 2027-01-01 (Fri) | **2027 Week 1**, Monday 28 Dec 2026 | 2026-W53 |
| 2027-01-04 (Mon) | **2027 Week 2** | 2027-W01 |
| 2025-12-29 (Mon) | **2026 Week 1** (29 Dec 2025 – 4 Jan 2026) | 2026-W01 (same) |
| 2024-12-30 (Mon) | **2025 Week 1** (30 Dec 2024 – 5 Jan 2025) | 2025-W01 (same) |

These are unit tests in `calendar-week.test.ts` (plus a round trip of every week 2020–2028, 53-week
2023, DST weeks), `week-labels.test.ts`, `local-calendar.test.ts`, `week-input.test.ts`, the CLI's
`cli-lib.test.mjs`, and a DB-backed `weekly-statuses.test.ts`.

**Key decision (no migration; recorded in `docs/decisions.md`):** the week's identity is its
**Monday date** everywhere. `weekly_statuses.week_start` already existed on every row; reads and writes
now go by it. `YYYY-Www` keys stay in `/time/…`, the API (`GET ?weeks=2027-W01`, `POST { year,
weekNumber }` or new `{ weekStart }`) and the CLI, numbered by the new rule. The two numberings agree for
every week of 2024–2026, so existing bookmarks and stored rows keep their meaning; they first differ on
28 Dec 2026. An ISO-only key (week 53 of a 52-week year, e.g. `/time/2026-W53`) still opens the same
Monday's week. `year` / `week_number` remain stored labels under the unique key; before a write, any
ISO-numbered row of the user is renumbered (two passes, so the unique key never collides). `GET /api/me`
returns `week`; `isoWeek` stays as an alias of the same value for older CLIs. The route matcher is now
`[[week=week]]` (`src/params/week.ts`).

**Installed CLIs must be updated before 28 Dec 2026.** An older CLI reads `isoWeek` and computes
ranges with ISO rules, so from 28 Dec 2026 to 3 Jan 2027 it shows the wrong week and posts statuses
for a different week (and every `2027-Wnn` argument means another week to it). `git pull` on each
machine; the drift notice prompts it. Recorded in `cli/CHANGELOG.md`.

**Review fixes (after the first report):**
- Legacy duplicate Mondays: the old validation let `2025-W53` roll over to 2025-12-29, which may also
  be stored as 2026 Week 1, so a renumber could hit the unique key and block every later status write.
  A write now first keeps the most recently updated row per Monday, deletes (and logs) the others,
  then renumbers, all in the write's transaction; reads take the newest row for a Monday. DB-backed
  test seeds that case (`weekly-statuses.test.ts`).
- One fixture file of worked examples, `src/lib/utils/calendar-week.fixtures.json`, read by both
  `calendar-week.test.ts` and the CLI's `cli-lib.test.mjs`, so the two copies of the rule cannot
  drift (it caught a wrong expectation of mine: 2028 has 53 weeks).
- Week URLs only for years 2000–2099 (`/time/0026-W45` is a 404; `Date.UTC` reads 0026 as 1926).

Also fixed: the ‹ › labels wrapped at 52 (`WeekStrip.svelte:42-43`); they now come from the helper
(2026 Week 52 → Week 1 → Week 2; 2023 Week 52 → Week 53). The Submitted hint reads "Marked as submitted
(a record only; nothing is sent)". A failed status save shows "Couldn't save “Draft ready”. Try again."
under the status (`week-status-error`) and the status stays as it was.

## What changed

- **Week overview (TR-01)** `WeekStrip.svelte`: ‹ "Week 45 · 2–8 Nov 2026" › and Today on the left,
  total and status on the right (phone: total and status under the days). Day cells "Mon 2" on one line,
  duration beneath, a thin segmented client-colour bar (`flex-grow` by actual minutes, 1px gaps), open
  dividers between days. A cell scrolls to the heading: `day-jump.ts` replaces the fixed 8px offset
  (the week controls are outside the scroller; anything pinned inside it would be declared as its
  `scroll-padding-top`).
- **Sticky day headings (TR-02)** `TimeEntriesPanel.svelte`: bark-600 bar with date, "+ Add entry"
  (same `data-add-entry` and accessible name) and day total; `position: sticky` inside its own day
  section, so the next heading replaces it at the boundary; square ends. Empty days get a quieter
  bark-100 bar. Today: ochre edge marker and "Today" tag; the amber tint across the day is gone.
- **Rows (TR-03..TR-05)** `TimeEntryCard.svelte`: grid of identity (ContractMark `sm`, contract name,
  client smaller beneath; `--size-entry-identity: 11rem`), description with classification beneath,
  right-aligned duration and range, actions. Chronology unchanged. Long descriptions wrap (Show more
  after three lines). Duration-only entries show no range. No background wash. Missing detail:
  "Add deliverable" whenever the contract has deliverables and none is set; "Add work type" whenever
  the deliverable has work types and none is set (`missing-detail.ts`); the cue opens the pickers.
- **Separator token (TR-04, O04):** `--spacing-entry-rule-start: calc(0.75rem + var(--size-mark-sm) +
  var(--spacing-mark-gap))` in `tokens.css`: rules start at the contract name's left edge (row inset +
  small mark + mark gap) and run to the right edge, open at the left, so rows of one contract line up.
  Change that one token after the owner's layout review.
- **Inline editing (TR-06):** semantics kept (click to edit, Enter saves, Escape cancels, blur saves
  description / time, selects save on pick, focus returns). The description editor is a textarea that
  grows to its text (`WikiLinkInput multiline`). The row keeps its height: classification line `min-h-6`
  with 1.5rem compact selects + Done inside it; time column `min-h-10` with a 1.5rem input and the
  preview / error line positioned in that reserved space; the contract-change notice is one truncated
  line (full text in `title` and for screen readers). Opening the pickers focuses them (Escape works at
  once). A failed description or time save reopens the editor with the typed value. NewEntryRow keeps
  its Save / Cancel form.
- **Phone (TR-08):** rows reflow by a container query on the day list (the panel width): identity and
  time (and the touch actions) on line 1, description and classification full width beneath. Footer
  timer bar removed: a running / stopped capture is in the 053 header pill; with no capture the week
  controls show **Start timer** (opens the capture screen) and **Add Entry** (the Add Entry modal). No
  Split on phones (none added).

## Tests (verbatim)

- `npm run check`: `svelte-check found 0 errors and 0 warnings`
- `npm run lint`: clean (exit 0)
- `npm test`: `Test Files 131 passed (131)` · `Tests 1236 passed (1236)`
- `E2E_BASE_URL=http://localhost:5187 npm run test:e2e`: `Test Files 24 passed (24)` · `Tests 151 passed (151)` (new: year-boundary status test)
- `PLAYWRIGHT_BASE_URL=http://localhost:5187 npx playwright test --project=chromium`: `7 skipped` · `115 passed (1.0m)`
- iPhone projects (`iphone-se`, `iphone-15`, `iphone-15-pro-max`): `2 skipped` · `23 passed (21.6s)`
- New spec `e2e-playwright/time-review.spec.ts`: rows / chronology / marks / aligned names / cues /
  duration-only / bar shares; sticky heading pinned then replaced; day jump not covered; inline edit
  keeps height (description, time preview + error, classification); failed save keeps text; Submitted
  changes only the status, failed save shown; year-boundary labels and the legacy `2026-W53` URL; phone
  reflow, no footer timer, capture access.
- Updated specs: `timesheet-polish` (contract shown as name + client: checked through the contract
  button's name), `attach-note-sidebar` (textarea; phone timer test starts from home),
  `navigation-journeys` J8 (waits for the week URL), `iphone-journeys` (textarea; timer via Start timer).
- Earlier attempt: a `+page.ts` 308 redirect for legacy keys made week paging an async load and made
  `timer-start-today` "Today…" flaky (two quick ‹ clicks raced); replaced by mapping the legacy key in
  `parseWorkspacePath`; three reruns pass.

## Screenshots (`docs/review/screenshots/sprint-057/`)

`01-desktop-week.png` (Amplitude: Hungryroot, Rank Group, Daily Pay; CCX; EasyJet), `02-desktop-sticky-heading.png`,
`03-desktop-inline-edit.png` (time editor with the error line), `iphone-*-04-week.png`, `iphone-*-05-day.png`.

## Follow-ups

- Adopt stage 4's shared ontology cascade (`src/lib/components/timer/`) in the row's contract /
  deliverable / work-type pickers and NewEntryRow once it is merged (this sprint keeps the existing selects).
- O04: owner layout review of the separator start (`--spacing-entry-rule-start`) and identity width.
- No online conflict handling for inline edits (unchanged).
- The phone week controls take ~265px on an iPhone SE when Start timer / Add Entry show; consider
  icon-only capture buttons after review.
- The phone's Start timer (no capture) opens the sidebar capture widget (`navigateMobile(0)`), while
  stage 4's header pill opens its new capture screen; stage 5/8 should unify the two.
- The CLI's `chronolog` version is unchanged; the CHANGELOG has an Unreleased entry.
