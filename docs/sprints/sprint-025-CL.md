# Sprint 025 — CL: Timesheet and entry-form rough edges

**Status:** active
**Branch:** `sprint-025-CL/timesheet-rough-edges` · **Worktree:** `.claude/worktrees/sprint-025-CL` · **Port:** 5202
**Sources:** `docs/review/2026-11-03-ux-friction.md` (finding numbers below), sprint 019 sign-off follow-ups.

## Tasks

1. **One duration parser [8].** `src/lib/utils/duration.ts` accepting `1.5`, `1.5h`, `1:30`, `90`, `90m`, `2h30m`, `2h 30`, `09:00-11:15`; rejects > 24h; unit-tested; used by `NewEntryRow`, `TimeEntryCard`, `AddTimeEntryModal`, `TimerCompletionForm`.
2. **Visible validation and errors [9].** Inline message under the field for missing contract, bad time, server error; buttons never silently disabled.
3. **Escape cancels, Enter saves [12]** in every inline editor on cards; Escape closes the contract select.
4. **Future days [13].** Allow logging on any day of the current week and navigating to future weeks with empty day sections.
5. **Week status [14].** Replace blind cycling with a small menu of the three states.
6. **Delete affordance [15].** Visible on touch and keyboard focus, not hover-only.
7. **Mobile [16, 44].** Start Timer and Add Entry reachable from the timesheet screen; selects not squashed; home does not highlight "Time Entries" when nothing is open.
8. **Load older weeks [22]** actually shows the loaded weeks.
9. **Consistency [26, 27, 28].** One hours format (h/m everywhere, "0 hrs" only when truly zero, no "08:03-08:03"), one contract label format ("Client / Contract"), same field order, button order and placeholders across the three entry forms.
10. **Polish:** "Add deliverable…" only on hover or when deliverables exist [34], month divider does not split a week [35], sidebar timer buttons do not wrap and the collapsed sidebar still shows the timer indicator [36], clamp long descriptions to three lines with expand [45 cards], first Tab lands in the sidebar [41].
11. Sprint 019 follow-ups: timer uses local date not UTC; pause is real (server stores paused seconds) or the pause button goes.

## Boundaries
Owns `src/lib/components/weekly/**`, `timer/**`, `TimeEntriesPanel.svelte`, `api/time-entries/**`, `api/timer/**`, `queries/time-entries.ts`, `queries/weekly-statuses.ts`, new `utils/duration.ts`. Do not touch notes components, `WikiLinkRenderer`, admin, `AppShell`, `ContractsSidebar`, hooks, env. Sprint 023 is encrypting `time_entries.description` in `queries/time-entries.ts` in parallel: keep your changes there minimal and rebase onto main when 023 lands.

## Verification
check 0 errors, tests green (parser table-tested), lint clean; real UI on port 5202 at desktop and 390px with screenshots in `docs/review/screenshots/sprint-025/`; do not regress "inline time entry with ranges" from the friction report's works-well list.

## Sign-off
_Fill in._
