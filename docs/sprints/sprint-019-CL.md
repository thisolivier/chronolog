# Sprint 019 — CL: Stabilise the timesheet

**Status:** active
**Type:** Client — bug fixes
**Depends on:** nothing (merges after 021-CL; rebase onto main when 021 lands)
**Branch:** `sprint-019-CL/timesheet-bugs`
**Worktree:** `.claude/worktrees/sprint-019-CL`
**Source of truth for each bug:** `docs/review/2026-11-03-qa-state.md` §4 and `docs/review/2026-11-03-code-state.md` §7

## Objective

Make the time-entries view safe for daily use. Every item below was confirmed live in the QA review;
fix each at its root, add a unit test where the fix is logic, and verify the fix in the real UI.

## Tasks

1. **WeekStrip crash (QA bug 1).** `WeekStrip.svelte` keys colour segments by `colorClass + percentage`;
   two same-length entries in a day throw `each_key_duplicate` and the whole panel sticks on "Loading
   weeks…". Aggregate segments per client (one segment per client per day) and key by client id. Test:
   two entries, same contract, same duration, same day → strip renders.
2. **Timesheet refresh after timer save and Add Entry modal (QA bug 4).** `TimerWidget.handleSave()` and
   `handleAddEntryCreated()` never tell `TimeEntriesPanel` to refresh. Use the existing window event
   pattern (`note-saved` / `note-moved` precedent) or lift a callback; new entries must appear without
   reload.
3. **Client colour border on cards and new-entry row (QA bug 5).** `border-stone-200` outranks
   `border-rose-400`. Emit left-border-only classes (`border-l-rose-400` etc., listed so Tailwind's
   scanner sees them) or set the colour via inline style.
4. **Client colour is settable (QA bug 6).** Every client has `color_index 0`. Add a colour selector to
   the admin client row (reuse the palette in `client-colors`), persist via `PATCH /api/clients/:id`.
   Seed distinct indices for the seeded clients.
5. **Deliverable / work type on manual entries (QA bug 7, CL-6 regression).** Restore `DeliverableSelect`
   in `NewEntryRow`, add it to `AddTimeEntryModal`, allow inline edit on `TimeEntryCard`, and stop
   `PUT /api/time-entries/:id` dropping `deliverableId` / `workTypeId`. Do not delete
   `DeliverableSelect.svelte` (another sprint is pruning dead code and has been told to leave it).
6. **Wiki-link click on a time card (QA bug 8).** `TimeEntriesPanel` mounts `TimeEntryCard` without
   `onNoteLinkClick`; wire it to switch to notes mode and open the note via the navigation context.
7. **Timer completion form (QA bug 9).** After Stop → reload the recovered form loses its contract even
   though the server draft has `contract_id`; restore it. Sub-minute timers save `0m`: round up to one
   minute, or store seconds, your call, but no zero-duration entries from a timer.
8. **Work types 400 not 500 (QA bug 11).** `GET /api/work-types?deliverableId=<non-uuid>` must validate
   and return 400.
9. **Lint:** fix `TimeEntriesPanel.svelte` `svelte/prefer-svelte-reactivity` errors.
10. Update `src/lib/components/weekly/readme.md`, `timer/readme.md`, `admin` readme for anything you
    changed.

## Boundaries

Do NOT touch: `src/routes/+page.svelte`, `src/routes/+layout.svelte`, `src/hooks.server.ts`,
`AppShell.svelte`, `WeekListPanel.svelte`, anything under `src/lib/storage`, `src/lib/powersync`,
`src/routes/spike`, `timer-api.ts`, or the notes editor / wiki-link extension files (owned by 020-CL
and 021-CL). If a fix truly needs one of these, write it in the sign-off as a follow-up instead.

## Verification

- `npm run check` (0 errors), `npm run lint` (no new errors in files you touched), `npm test` green
  (Postgres is running on localhost:5432).
- Real UI: run `npm run dev -- --port 5191` in the worktree and drive the fixed flows with Playwright
  (`e2e-playwright/manual-checklist/qa-driver.mjs`, base URL overridable, or targeted probes). Screenshots
  into `docs/review/screenshots/sprint-019/`. A fix is not done until the UI shows it.

## Sign-off

_Team PM fills in: what changed, test counts, screenshots, follow-ups._
