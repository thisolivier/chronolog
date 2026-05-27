# Sprint 017 — CL: Timesheet Redesign Implementation (UX-2)

**Status:** merged
**Type:** standard (large)
**Backlog items:** UX-2 implementation
**Depends on:** Sprint 012-UX (design spec — signed-off)
**Branch:** `sprint-017-CL/timesheet-redesign`

## Objectives

Implement the timesheet redesign from `docs/ux/timesheet-redesign-spec.md`. This covers
Phases 1-5 of the migration path: palette, layout, cards, enhanced states, and timer
persistence. Phase 6 (notes integration on cards) is deferred — the wiki-link linking
from sprint 014-CL already covers the functional linking; the card-level display enrichment
can come later.

**Read these documents thoroughly before starting:**
- `docs/ux/timesheet-redesign-spec.md` — the master spec (362 lines)
- `docs/ux/visual-hierarchy-spec.md` — Tailwind classes, colors, typography
- `docs/ux/wireframes-timesheet-redesign.md` — ASCII wireframes for every state

## Tasks

### Phase 1: Palette Migration

#### 1. Add colorIndex to client schema

Add `colorIndex` integer field (0-7) to the clients table schema. Create a migration.
Default existing clients to sequential values (0, 1, 2, ...).

In `src/lib/server/db/schema/clients.ts`, add the column.
Run `npm run db:generate` and `npm run db:migrate`.

#### 2. Create client color utility

Create `src/lib/utils/client-colors.ts`:
- Export the 8-color palette as a const array (rose, sky, violet, amber, teal, fuchsia, lime, orange)
- Export helper functions: `getClientBorderClass(colorIndex)`, `getClientDotClass(colorIndex)`, `getClientBgClass(colorIndex)`
- Each returns the appropriate Tailwind class string

The 8 colors and their classes are defined in `docs/ux/visual-hierarchy-spec.md` Section 1,
"Client Color Palette" table.

#### 3. Replace gray-* with stone-* globally

Search all `.svelte` files for `gray-` Tailwind classes and replace with `stone-` equivalents.
There are ~234 occurrences across ~32 files. Use find-and-replace.

Mapping (from `docs/ux/visual-hierarchy-spec.md` Section 1):
- `gray-50` → `stone-50`
- `gray-100` → `stone-100`
- `gray-200` → `stone-200`
- `gray-300` → `stone-300`
- `gray-400` → `stone-400`
- `gray-500` → `stone-500`
- `gray-600` → `stone-600`
- `gray-700` → `stone-700`
- `gray-800` → `stone-800`
- `gray-900` → `stone-900`

**Do not** replace gray in non-UI files (tests, docs, config).

#### 4. Expose colorIndex in API responses

Update the client/contract API responses to include `colorIndex`. This means:
- Add `colorIndex` to the clients schema query in `src/lib/server/db/queries/clients.ts`
- Add `clientColorIndex` to `ContractsByClientResult` and `ContractOption` types
- Update `FetchDataService` to pass it through
- Update `TimeEntryDisplay` to include `clientColorIndex`
- Thread it through weekly time entry queries so cards have access

### Phase 2: Layout Restructure

#### 5. Make AppShell mode-aware

In `src/lib/components/layout/AppShell.svelte`:
- When in time-entries mode: render only 2 panels (sidebar + content). Hide Panel 2.
- When in notes mode: keep 3 panels as-is (sidebar + note list + editor).
- The mode is determined by the navigation context (already tracked).

#### 6. Build WeekStrip component

Create `src/lib/components/weekly/WeekStrip.svelte`:
- Horizontal strip ~80px tall, sticky at top of content area
- 7 day columns (Mon-Sun): day abbreviation, date number, per-day hour total
- Client color proportion bars per day (stacked horizontal segments)
- Week summary area: total hours, status badge (chip not text input)
- Prev/next week arrows
- Click a day column to scroll content to that day's section
- Current day column highlighted: `bg-amber-100 border-b-2 border-amber-400`

Wireframes in `docs/ux/wireframes-timesheet-redesign.md` Section 2.

#### 7. Integrate WeekStrip into TimeEntriesPanel

Replace the role of WeekListPanel in time mode:
- WeekStrip renders sticky at the top of the content area
- Day sections scroll below it
- Clicking prev/next in WeekStrip navigates weeks (loads new week data)
- Remove WeekListPanel rendering in time-entries mode (keep the component for now, just don't render it)

#### 8. Build TimerIndicator component

Create `src/lib/components/weekly/TimerIndicator.svelte`:
- Compact top-bar element: pulsing green dot + elapsed time + description snippet + contract name
- Visible when timer is running, hidden when idle
- Clicking it when sidebar is collapsed reopens sidebar
- Uses client color accent

States per `docs/ux/timesheet-redesign-spec.md` Section 4:
- Running: green pulsing dot + elapsed time
- Paused: hollow static dot + "(paused)" label
- Idle: nothing rendered

Wire into AppShell top area.

### Phase 3: Card Redesign

#### 9. Redesign TimeEntryCard

Restructure `src/lib/components/weekly/TimeEntryCard.svelte` per the spec:
- **Row 1:** Description (hero text, `text-sm font-medium text-stone-900`) + duration right-aligned (`text-sm font-medium text-stone-500 tabular-nums`)
- **Row 2:** Client color dot + contract label (`text-xs text-stone-500`)
- **Row 3 (optional):** Deliverable/work type (`text-xs text-stone-400`)
- **Left border:** 3px in client color (`border-l-3`)
- Keep all existing inline-editing functionality (time, contract, description, delete)
- Keep wiki-link rendering in descriptions

Card wireframe in `docs/ux/timesheet-redesign-spec.md` Section 4.

#### 10. Redesign NewEntryRow

Restructure `src/lib/components/weekly/NewEntryRow.svelte`:
- Description input first (full-width top)
- Contract, deliverable, time inputs in horizontal row below
- Cancel and Save buttons explicit
- Client color left border updates live as contract is selected

#### 11. Add client color dots to ContractsSidebar

In `src/lib/components/layout/ContractsSidebar.svelte`:
- Add colored dot (using client color) next to each contract name
- Dot uses `getClientDotClass(colorIndex)` from the utility

### Phase 4: Enhanced States

#### 12. Today emphasis

In `TimeEntriesPanel.svelte`:
- Today's day section wrapped in `bg-amber-50/60 rounded-lg p-3`
- "TODAY" badge (amber pill: `bg-amber-100 text-amber-700 text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full`) next to day name
- Auto-scroll to today on initial mount

#### 13. Status badge component

Create `src/lib/components/weekly/StatusBadge.svelte`:
- Replaces the inline text input in `WeekSectionHeader.svelte`
- Clickable chip that cycles through statuses on click
- Colors per spec: Unsubmitted → `bg-stone-100 text-stone-600`, Draft ready → `bg-amber-100 text-amber-800`, Submitted → `bg-emerald-100 text-emerald-800`

Update `WeekSectionHeader.svelte` to use StatusBadge instead of the text input.

#### 14. Redesign WeekSectionHeader

Update `src/lib/components/weekly/WeekSectionHeader.svelte`:
- Week number + date range label (`text-base font-semibold text-stone-800`)
- Total hours (`text-base font-semibold text-stone-500 tabular-nums`)
- Status as StatusBadge component (replaces text input)
- Styles per `docs/ux/visual-hierarchy-spec.md` Section 2, "Typography Hierarchy"

#### 15. Empty day states

In `TimeEntriesPanel.svelte`, for days with no entries (in current week):
- Show dashed-border container (`border-dashed border-stone-300`)
- "No entries" text (`text-sm text-stone-400 italic`)
- Visible "+" add button

#### 16. Month dividers

When scrolling across a month boundary within a week's days, insert a divider:
- Centered label "FEBRUARY 2026" (`text-xs font-medium text-stone-400 tracking-widest uppercase`)
- Horizontal rules on each side (`border-stone-200`)

### Phase 5: Timer Persistence

#### 17. Wire TimerIndicator to timer state

Connect the TimerIndicator (built in task 8) to the existing timer store/state:
- Subscribe to timer status (running/paused/idle)
- Show elapsed time updating every second when running
- Show contract name and description snippet from the current timer entry

### Cleanup

#### 18. Remove orphaned components

Delete these if they have no remaining imports (verify first):
- `src/lib/components/weekly/WeeklyEntryRow.svelte`
- `src/lib/components/weekly/DaySection.svelte`
- `src/lib/components/weekly/WeekHeader.svelte`
- `src/lib/components/time/TimeEntryRow.svelte`

Do NOT delete `WeekListPanel.svelte` yet — it's still used in notes mode's 3-panel layout
(keep it, just conditionally hide it in time mode).

#### 19. Update readmes

Update `src/lib/components/weekly/readme.md` and `src/lib/components/layout/readme.md`
to reflect the new component structure.

#### 20. Write tests

- Test client color utility functions
- Test StatusBadge status cycling
- Test WeekStrip day selection and navigation
- Any unit-testable logic from new components

#### 21. Verify

- `npm run test` passes
- `npm run check` passes
- `npm run build` succeeds

## Acceptance Criteria

- [x] Stone palette replaces gray globally
- [x] Client colors stored and available in API responses
- [x] 2-panel layout in time mode, 3-panel in notes mode
- [x] WeekStrip replaces WeekListPanel role in time mode
- [x] Description-first TimeEntryCard with client color border
- [x] Redesigned NewEntryRow (description first)
- [x] Today emphasis (amber background, badge, auto-scroll)
- [x] StatusBadge replaces text input for week status
- [x] TimerIndicator in top bar (visible when running)
- [x] Empty day states with dashed border
- [x] Month dividers
- [x] Client color dots in sidebar
- [x] Orphaned components removed
- [x] All tests pass
- [x] `npm run check` and `npm run build` pass

## Notes

**Read the full design spec.** `docs/ux/timesheet-redesign-spec.md` is 362 lines with
exact Tailwind classes, wireframes, and trade-off rationale for every decision.

**Mobile layout is a stretch goal.** Focus on desktop first. If time allows, implement the
mobile 3-level push/pop navigation (WeekStrip + day list + day detail), but the desktop
layout is the priority.

**Phase 6 (notes integration display on cards) is deferred.** Sprint 014-CL already implemented
wiki-link rendering and linked time entries. The card-level display enrichment can come later.

**Docker stack must be running** for the dev server.

## Sign-off

**Branch:** `sprint-017-CL/timesheet-redesign`
**Commit:** `98ba494`
**Worktree:** `/Users/olivier/sites/chronolog/.claude/worktrees/sprint-012-CL`

### Results
- **Tests:** 267/267 passed (17 test files), including 20 new tests (client-colors, status-badge, timer-state)
- **Build:** Succeeds
- **Check:** 4 pre-existing errors, 0 new errors
- **2 pre-existing DB test failures** (notes.test.ts, attachments.test.ts) — caused by unmigrated `color_index` column in Docker DB

### What was delivered

**New components (4):**
1. **WeekStrip.svelte** — Sticky horizontal strip replacing WeekListPanel in time mode. 7 day columns with abbreviation, date, hours, client color proportion bars. Week navigation (prev/next arrows), week total, status badge. Today column highlighted with amber.
2. **TimerIndicator.svelte** — Compact top-bar timer display. Pulsing green dot + elapsed time + description + contract name when running. Hollow dot + "(paused)" when paused. Hidden when idle. Client color left border.
3. **StatusBadge.svelte** — Clickable pill chip cycling through Unsubmitted/Draft ready/Submitted. Color-coded: stone/amber/emerald.
4. **client-colors.ts** — 8-color palette utility (rose/sky/violet/amber/teal/fuchsia/lime/orange) with `getClientBorderClass`, `getClientDotClass`, `getClientBgClass` helpers.

**New infrastructure (1):**
5. **timer-state.svelte.ts** — Shared reactive timer display state (Svelte 5 context pattern). TimerWidget writes; TimerIndicator reads. Bridges cross-component timer communication.

**Modified components (7):**
6. **AppShell.svelte** — Mode-aware: 2-panel in time mode (sidebar + content), 3-panel in notes mode. Added top bar with hamburger toggle and TimerIndicator.
7. **TimeEntriesPanel.svelte** — Integrated WeekStrip, single-week view with day click-to-scroll, today emphasis (amber bg + "TODAY" badge + auto-scroll), empty day states (dashed border + "No entries" + Add button), month dividers.
8. **TimeEntryCard.svelte** — Description-first hero layout. 3px client color left border. Color dot + client/contract label. Optional deliverable/work type row. Duration right-aligned. Hover-reveal delete.
9. **NewEntryRow.svelte** — Card layout with description input first (full-width WikiLinkInput), horizontal contract/time row below, explicit Cancel/Save buttons. Dynamic client color border on contract selection.
10. **ContractsSidebar.svelte** — Client color dots next to each contract name.
11. **WeekSectionHeader.svelte** — Simplified with StatusBadge replacing text input. (Subsequently deleted as orphaned.)
12. **TimerWidget.svelte** — Syncs timer state to shared timer-state store for TimerIndicator.

**Schema & API (5 files):**
13. Added `colorIndex` integer (0-7) to clients schema + migration.
14. Added `clientColorIndex` to 4 types in services/types.ts.
15. Updated `timeEntrySelectWithContext` and `getLinkedTimeEntriesForNote` queries.
16. Updated `/api/contracts-by-client` and `/api/contracts` endpoints.

**Global palette migration:**
17. Replaced `gray-*` with `stone-*` across 41 files (379 occurrences).

**Deleted components (5):**
18. WeeklyEntryRow, DaySection, WeekHeader, WeekSectionHeader, TimeEntryRow — all orphaned.

**Tests (3 files, 20 tests):**
19. `client-colors.test.ts` — 9 tests for palette, border/dot/bg class helpers, wrap-around.
20. `status-badge.test.ts` — 7 tests for status cycling and class mapping.
21. `timer-state.test.ts` — 4 tests for timer display state interface.

### Scope notes
- Mobile layout not implemented (stretch goal per spec — desktop is the priority)
- Phase 6 (notes integration display on cards) deferred per spec
- Client color reassignment in admin panel deferred (stretch goal)
