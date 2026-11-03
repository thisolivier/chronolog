# Sprint 025 — CL: Timesheet and entry-form rough edges

**Status:** signed-off (2026-11-03)
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

**Status:** signed-off (2026-11-03)
**Branch:** `sprint-025-CL/timesheet-rough-edges`, rebased on `main` at `03e055e` (023 included; `description` encryption in `queries/time-entries.ts` untouched). Not merged.
**Worktree:** `.claude/worktrees/sprint-025-CL` (left for merge).
**Boundaries:** no notes component, `WikiLinkRenderer`, admin, `AppShell`, `ContractsSidebar`, hooks or env file touched. Outside the owned list but needed: additive changes in `src/lib/services/` (`startTimer(contractId, localStart?)` now requires a contract; `stopTimer` sends the local end time; `SaveTimerInput` and `TimerEntry` gained optional fields), `queries/time-entries.ts` (`startTimer`/`stopTimer` take the local clock; server fallback uses the local date, not UTC), the QA driver selectors and two API e2e files. No migration.

### Per task

1. **One duration parser [8]: done.** `src/lib/utils/duration.ts` (`parseDuration`, `formatMinutes`, `formatMinutesCompact`, `formatTimeRange`, `formatDurationInput`, `validateDurationMinutes`) accepts `1.5`, `.5`, `1,5`, `1.5h`, `2 hrs`, `1:30`, `90`, `90m`, `90 min`, `2h30m`, `2h 30`, `09:00-11:15`, `9-10:30` and en-dash ranges. It rejects zero, over 24 h, end-before-start and malformed input with a message, and warns above 12 h. `time-parse.ts` and the dead `CascadingSelects.svelte` are deleted. A shared `timer/DurationField.svelte` shows "= 1h 30m", the warning or the error, and is used by NewEntryRow, TimeEntryCard, AddTimeEntryModal and TimerCompletionForm (where the measured time can now be adjusted before saving). `POST/PUT /api/time-entries` and `/api/timer/save` reject durations that are not whole minutes or are over 24 h (400). UI: every format saved inline, and `25h` was rejected (`t1-*`).
2. **Visible validation and errors [9]: done.** "Pick a contract", the parser hint and "Couldn't save: …" (`timer/save-error.ts`, which keeps the server's own message or says there is no connection) appear under the field or beside the buttons in all four forms. Save is disabled only while saving; after a failure it reads "Retry". Verified empty-save, invalid-time and offline-save messages, and Retry after reconnecting (`t2-*`).
3. **Escape cancels, Enter saves [12]: done.** Card description: Escape no longer saves (the delayed blur is guarded, and the 1 s autosave is gone). Time: Enter saves, Escape cancels, and blur on invalid text keeps the editor open with its message. The contract select autofocuses; Escape, Enter or focus leaving closes it. The deliverable editor closes on Enter or Escape. NewEntryRow and the modal follow the same rule (`t3-*`).
4. **Future days [13]: done.** The selected week always shows all seven days, so you can log ahead inline or through the modal (entries on Fri 6 and Sat 7 Nov). Future weeks show seven empty days; the "No days to display" message is gone. Strip clicks scroll to any day (`t4-*`).
5. **Week status [14]: done.** New `weekly/WeekStatusMenu.svelte`: the pill opens a three-option menu (check mark, one-line hints, arrow keys, Escape and click-outside close it). The choice persists across a reload (`t5-*`, desktop, phone and WebKit).
6. **Delete affordance [15]: done.** The × shows on hover, `focus-visible`, `group-focus-within` and `pointer-coarse` (always on touch, with a larger target). Computed opacity: 0 at rest on desktop, 1 when keyboard-focused, 1 on touch in Chromium and WebKit. It no longer overlaps the duration (`t6-*`).
7. **Mobile [16, 44]: partly done.** On phone, `TimeEntriesPanel` renders a footer `TimerWidget` (Start Timer and Add Entry, opening on the selected day) whenever no sidebar widget is mounted (`timer/timer-widget-registry.svelte.ts`), so it adapts to 026's breakpoint change without code here. The new-entry row puts Contract on its own row (298 px) with Deliverable and Time beside each other (143 px each). The "Time Entries" title bar is removed, saving about 60 px, and the strip, which no longer overflows, fits 390 px. **Deferred:** the home screen still highlights "Time Entries" with nothing open. That highlight lives in `ContractsSidebar` (026's boundary) and needs the navigation-state rules of 027.
8. **Load older weeks [22]: done.** "Show the week before" appends each earlier week under a "WEEK 44 · OCT 26 - NOV 1" heading with its total and the days that have entries; it resets when the selected week changes (`t8-older-weeks-shown`).
9. **Consistency [26, 27, 28]: done.** Hours are h/m everywhere (`formatMinutes`): day headers, week total and cards. The strip uses `2h15`. "0h" appears only for a true zero, and an empty day shows "–". A sub-minute range shows "12:31", never "12:31-12:31". Contract labels everywhere read "Client / Contract" (`timer/contract-label.ts`, including the timer indicator). All three forms use the order Description, Contract, Deliverable, Work type, Time (the modal puts Date first), the buttons [Cancel/Discard] [Save] on the right, and the same placeholders ("What did you work on?", "Select a contract…", "1h30m or 9:00-10:30").
10. **Polish: done.**
    - "Add deliverable…" is always shown only when the contract has deliverables (`timer/deliverable-cache.ts`); otherwise it appears on hover or focus [34].
    - There is no month divider inside a week [35].
    - The sidebar timer buttons no longer wrap, and the collapsed sidebar shows the running timer or a "▶ Timer" or "Timer stopped: save entry" pill that reopens it [36].
    - Descriptions clamp to three lines with Show more/Show less [45].
    - The first Tab now lands on the sidebar toggle and then the sidebar, instead of today's "+" [41]. Root cause: Chromium's `scrollIntoView` moved the sequential-focus starting point, so the panel now sets `scrollTop` instead.
    - `WikiLinkInput` focuses through an effect instead of the `autofocus` attribute.
11. **Sprint 019 follow-ups: done.**
    - The timer uses the browser's local date and time. A Kiritimati-timezone browser at 20:31 UTC got date `2026-11-04` and start `10:31:05`, and the stop is midnight-safe.
    - Pause is removed: the server cannot store paused time, and adding a column would collide with 026's migration.
    - **Coordinator addition (journey review blocker 3): done.** Start Timer never picks a contract. It uses the contract open in the sidebar (notes mode); otherwise it runs with no contract in the browser (`timer/pending-timer.ts`, so it survives a reload). Choosing a contract creates the server draft with the original start time. The completion form preselects exactly the chosen contract, or none. `FetchDataService.startTimer` no longer falls back to "first active contract". Playwright proof (`t12-timer-contract.mjs`):
      - Started in time mode, the select shows "Select a contract…" and the server holds no draft, also after a reload.
      - After Stop the form shows "Select a contract…", and saving says "Pick a contract".
      - A contract picked mid-run created the draft with local start `12:37:16` equal to the server start.
      - Started while viewing Rocket Build, the timer is preselected to Rocket Build in the widget, in the server draft and in the form (`t11b-*`).

### Verification

| Check | Before | After |
|---|---|---|
| `npm run check` | 0 errors, 23 warnings | 0 errors, 14 warnings (all left in admin rows and `+layout.svelte`, outside this sprint) |
| `npm run lint` | clean | clean |
| `npm test` | 29 files / 335 | 35 files / 399 (duration table 73, save-error 5, contract-label 2, local-date 2, pending-timer 3, timer-api 3, timer local-clock 9; service tests updated) |
| `npm run test:e2e` (API, port 5202) | — | 8 files / 53, all green (+4: local timer clock, malformed date fallback, adjusted save and 24 h cap, time-entry duration validation) |
| QA driver (`qa-driver.mjs`, port 5202) | 54 pass / 6 fail with the old selectors | **58 pass / 2 fail**. The selectors were updated for the new placeholder, h/m totals, status menu, `#timer-deliverable` and an exact "Add Entry" name. The 2 failures are outside this sprint: `AUTH-native-submit-race` (026 task 7) and `A4-wiki-link-autocomplete-in-description` (known driver limitation with the newest-note ordering). |

Real UI at 1440×900 and 390×844 (Chromium, plus WebKit for the phone pass), with no console errors in any probe. "Inline time entry with ranges" from the works-well list still holds: `09:00-11:15` becomes "2h 15m" with the range shown, and card edits refresh the day and week totals.

Screenshots: `docs/review/screenshots/sprint-025/` (44 PNG, prefixed by task `t<n>-`; `wk-` = WebKit phone pass). Probe scripts stay in the session scratchpad `sprint-025/` (`setup.mjs`, `t1-forms.mjs`, `t3-card.mjs`, `t4-weeks-timer.mjs`, `t7-mobile.mjs`, `t9-errors.mjs`, `t11-timer.mjs`, `t12-timer-contract.mjs`). Dev user: `qa-025-3xn6bh@chronolog.test`.

### Follow-ups

- [44] Phone home highlights "Time Entries" with nothing open: `ContractsSidebar` / navigation store (026 or 027).
- Real pause needs a `paused_seconds` (or `paused_at`) column on `time_entries`; add it after 026's migration lands if pause is wanted back.
- A contract-less timer lives only in that browser (localStorage) until a contract is picked; another device will not see it. This is acceptable for a single user, but worth stating in the 027 context rules.
- `calculateElapsedFromStartTime` ignores the date, so a timer left running past midnight under-reports its elapsed display. The server duration is midnight-safe.
- Bare integers are read as minutes (`8` = 8 minutes); the live preview shows this, but revisit if users type hours.
- `e2e-playwright/manual-checklist/README.md` "known driver limitations" should be refreshed after the next full review run.
