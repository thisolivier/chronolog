# Sprint 030 — CL: Timesheet polish

**Status:** in progress
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
