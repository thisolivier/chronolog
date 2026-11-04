# Sprint 030 — CL: Timesheet polish

**Status:** merged
**Branch:** `sprint-030-CL/timesheet-polish` · **Worktree:** `.claude/worktrees/sprint-030-CL` · **Port:** 5208
**Sources:** `docs/backlog.md` (Timesheet / timer, Navigation), `docs/review/2026-11-03-ux-journeys.md` (P-01, P-02, P-05, A-11), sprint 025 and 027 sign-offs.

## Objective

Fix the visible rough edges left on the timesheet and timer after sprints 025 and 027. Every change is verified in the real UI with Playwright screenshots, not just unit tests.

## Tasks

1. **Today's inset (P-01).** Today's section is inset 12 px, so its cards do not line up with other days. Align them; keep whatever marks today as today.
2. **Timer pill (P-02).** With no contract the pill shows the pink Internal colour; use a neutral colour. The pill shows `0:00:01` while the widget shows `00:00:01`; use one format in both.
3. **Timer past midnight.** `calculateElapsedFromStartTime` ignores the date, so a timer started yesterday under-reports. Use the full timestamp. Unit test with a start at 23:50 and now at 00:10.
4. **Changing contract drops deliverable (P-05).** When an entry's contract changes in the edit form, the deliverable is silently dropped. Clear the deliverable and work type visibly (reset the pickers to "none" and show a one-line notice in the form), and make sure the saved entry matches what the form showed.
5. **"Formerly" line.** Time cards collapse the newline so "Formerly: ..." reads inline with the description. Give it its own muted line.
6. **Keyboard focus (A-11).** After saving an entry and after following a wiki-link, focus lands on `<body>`. After save, focus the saved entry's card (or the "add entry" control if the card is not rendered); after a wiki-link, focus the editor of the opened note. Playwright test asserting `document.activeElement`.
7. **Timer display timezone check.** Confirm the timer and the week header agree on "today" for a user in Europe/London at 23:30 UTC+0 (no code change expected; record the result).

## Boundaries

Owns `src/lib/components/timesheet/**`, the timer widget and store, the entry edit and create forms, and focus handling in the navigation layer. Sprint 029 runs in parallel and owns `src/routes/api/**`, `cli/`, the server query modules, and a first-run empty-state component; do not edit those. If 029's empty state needs a mount point in a timesheet page, 029 will add a one-line mount; rebase onto main before sign-off and resolve any overlap.

## Working rules

- Work only in the worktree. Dev server on port 5208 with `BETTER_AUTH_URL=http://localhost:5208` and `ALLOW_REGISTRATION=true` exported; the shared dev Postgres is on 127.0.0.1:5432 (name any QA users `qa-030-*`).
- `npm run check` with 0 errors, `npm test` green, `npm run lint` clean before sign-off.
- Rebase onto `main` before sign-off.

## Verification

Before/after screenshots for tasks 1, 2, 4 and 5 in `docs/review/screenshots/sprint-030/` taken with Playwright against the real dev server at desktop width and at 390 px; Playwright assertions for tasks 4 and 6; unit test for task 3. Write the sign-off at the bottom of this file with what was done, what was left, and the test counts. Do not merge; leave the branch for review.

## Sign-off

**Status:** merged

**Boundaries:** changes are in `components/weekly/**`, `components/timer/**`, `layout/TimeEntriesPanel.svelte` (the timesheet), `stores/navigation.svelte.ts` and `layout/NoteEditorPanel.svelte` (focus handling). One line outside that list: `notes/NoteEditor.svelte`'s `autofocus` prop now also accepts `'start'` (true still means the end). No API, CLI, server query or migration change.

### Per task

| # | Task | Result | What changed |
|---|------|--------|--------------|
| 1 | Today's inset (P-01) | **Done** | Today's wrapper is `-mx-3 px-3 py-3`: the amber tint and the "Today" badge stay, and the tint bleeds 12 px into the gutter instead of pushing the cards in. Card left edges, yesterday vs today: 264/276 → **264/264** at 1280 px, 16/28 → **16/16** at 390 px. |
| 2 | Timer pill (P-02) | **Done** | `formatElapsedClock` in `timer/timer-api.ts` is used by the widget (`TimerDisplay`) and the pill (`TimerIndicator`): both read `00:00:02` (pill was `0:00:02`). With no contract the pill's left edge is `stone-300` (was rose-400, the slot-0 client colour); it takes the client colour once a contract is picked. |
| 3 | Timer past midnight | **Done** | `calculateElapsedFromStartTime(startTime, startDate, now)` builds the local start timestamp from the date, so 23:50 yesterday → 00:10 today is 1200 s. Without a date (older pending timers) a start later than now counts as yesterday instead of 0. Restoring from the server or a pending timer passes the date, and the tick recomputes from the start every second, so a throttled background tab or a sleeping laptop no longer falls behind. 5 unit tests (midnight, multi-day, same day, future start, no date) plus 4 for the clock format. |
| 4 | Contract change drops deliverable (P-05) | **Done** | In `TimeEntryCard` a contract change always sends `deliverableId: null, workTypeId: null` (the server PUT does not clear them by itself). When there was a deliverable or work type, the deliverable pickers open on the **new** contract set to "No deliverable" (or the disabled "No deliverables"), focus moves to them, and a one-line notice reads `Cleared “Data Phase 2 > Build”: it belongs to Acme Corp / Data Platform.` Done, Enter or Escape close the pickers and the notice. The saved entry is checked through `GET /api/time-entries`: contract = new, deliverable and work type null, the same after a reload. The create forms (NewEntryRow, modal, timer completion) already reset their pickers on a contract change and were left as they were. |
| 5 | "Formerly" line | **Done** | `weekly/formerly-lines.ts` (`splitFormerlyLines`, 5 tests) takes the `Formerly: …` lines out of the description, and the card shows them under it as their own `text-xs text-stone-400` line. The stored description is unchanged, and editing the description still edits the whole text. |
| 6 | Keyboard focus (A-11) | **Done** | After a NewEntryRow save, focus goes to the new card (`tabindex=-1`, `role=group`, `data-entry-id`, focus-visible ring), or to the day's "+" (`data-add-entry`) if the card is not rendered (`weekly/entry-focus.ts`, 4 tests). Timer and Add Entry modal saves do the same when the timesheet is mounted, but only when focus is on `<body>` or already in the timesheet. Escape in the new-entry row returns focus to its "+". Card editors closed from the keyboard (description, time, contract, deliverable) give focus back to their control. Following a card's wiki-link calls `openNote(…, { focusEditor: true })`, and NoteEditorPanel focuses the opened note's editor at the top (`navigation.takeEditorFocus`, 2 store tests). |
| 7 | Timezone check | **Confirmed, no change** | With the browser in Europe/London and a fixed clock, at 23:30 GMT on 3 Nov and at 00:30 BST on 15 Jul (23:30 UTC on the 14th), `/time` opens the local week (W45 and W29), the strip highlights the local day, that day has the "Today" badge, the timer shows "Started: 23:30" / "00:30", and the server draft gets the local date and start time. Both the timer and the week header use the browser's local date, and nothing on this path uses UTC. This is now a regression test in `timesheet-polish.spec.ts` (Chromium and WebKit). |

### Left / notes

- On touch screens (`pointer: coarse`) a followed wiki-link does **not** focus the editor, because that would pop up the on-screen keyboard over the note. Desktop keyboard users get focus.
- A timer or modal save made while in notes mode moves to the timesheet. The panel mounts after the save event, so focus is not moved to the card there. It is moved when the timesheet is already open.
- At 390 px the task 4 notice wraps to three lines. It is still one sentence.
- Not in scope and untouched: the sidebar is still about 25 Tabs from the top of the timesheet, and there are no keyboard shortcuts (the rest of A-11).

### Verification

- `npm run check`: **0 errors** (3 warnings, the pre-existing `data.user` captures in `src/routes/+layout.svelte`).
- `npm run lint`: clean.
- `npm test`: **58 files, 626 passed** (606 at branch start; +9 timer-api, +5 formerly-lines, +4 entry-focus, +2 navigation).
- Playwright against the real dev server (`PLAYWRIGHT_BASE_URL=http://localhost:5208 npx playwright test --retries=0`): **68 passed, 5 skipped, 0 failed**. The new `e2e-playwright/timesheet-polish.spec.ts` has 12 tests (6 per browser). They assert task 4 (pickers at none, the notice text, the saved entry, the state after a reload) and task 6 on `document.activeElement` (the new card's `data-entry-id`, the "+" after Escape, and a contenteditable inside `[data-note-editor-content]` after Enter on a card link), plus the task 7 check.
- Screenshots in `docs/review/screenshots/sprint-030/`, before and after at 1280 px (`desktop`) and 390 px (`phone`):
  - `t1-*-today-alignment`
  - `t2-*-timer-no-contract`
  - `t4-*-1-before-change` and `t4-*-2-after-change`
  - `t5-*-formerly-line`

  The "before" images were taken with `main`'s source in the worktree. `shots.mjs before|after` reproduces them. `measurements.txt` records the card edges, the pill text and colour, and the saved entry for both runs.
