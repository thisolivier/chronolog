# Sprint 019 — CL: Stabilise the timesheet

**Status:** signed-off
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

**Status:** signed-off (2026-11-03)
**Branch:** `sprint-019-CL/timesheet-bugs` (6 commits on top of `e3fabb9`, not merged; rebase onto main after 021-CL lands)
**Worktree:** `.claude/worktrees/sprint-019-CL`
**Boundaries:** no file from the Boundaries list was touched (`git diff --stat main..HEAD` confirms). Shared files also edited by 021-CL's scope: `queries/time-entries.ts` (only the select and `stopTimer`), `weekly/readme.md`, `timer/readme.md`, `src/lib/services/types.ts` (additive).

### Per task

1. **WeekStrip crash — fixed.** New pure helper `weekly/week-strip-segments.ts` aggregates minutes per client (one segment per client per day, keyed by `clientId`); `WeekStrip` uses it. `TimeEntriesPanel` passes `clientId` (falls back to `clientShortCode` for the PowerSync mapping that lacks it). Reproduced before the fix: two 30 m entries → `each_key_duplicate … bg-rose-40050` and "Loading weeks…" (`t1-before-crash.png`); after: strip and both cards render, no console errors (`t1-after-fix.png`). 6 unit tests.
2. **Timesheet refresh after timer / modal save — fixed.** `weekly/time-entry-events.ts` defines the `time-entry-saved` window event (same pattern as `note-saved`); `TimerWidget` dispatches it after `saveTimer` and after the modal's `onCreated`; `TimeEntriesPanel` listens (registered/removed in `onMount`), refreshes loaded weeks and loads the entry's week if needed. 3 unit tests (jsdom). Evidence `t2-01…t2-04` (cards appear with no navigation).
3. **Client colour left border — fixed.** `client-colors.ts` now emits `border-l-*` classes (literals stay in the file for Tailwind v4's scanner; no component change needed). Computed `border-left-color` went from stone-200 `oklch(0.923 …)` to rose-400 `oklch(0.712 0.194 13.428)` on cards and on the new-entry row after choosing a contract (`t3-before-*`, `t3-after-*`). `TimerIndicator` benefits too.
4. **Client colour settable — done.** Colour select (new clients default to the first palette colour no existing client uses) (palette names + dot) in the admin client create form and inline edit row, "Colour" column, validated 0..7 in the form actions; new `PATCH /api/clients/:id` (400 invalid index / malformed id / empty body, 404 unknown, 401 unauthenticated); `GET /api/clients` returns `colorIndex`; seed gives Big Cheese index 1. Evidence `t4-admin-*`, `t4-time-view-teal.png` (sidebar dot, card border, new-entry row and WeekStrip all teal after the change). 9 e2e tests (was 1).
5. **Deliverable / work type on manual entries — restored.** `NewEntryRow` and `AddTimeEntryModal` get `DeliverableSelect` + new `WorkTypeSelect`; `TimeEntryCard` row 3 is always clickable and edits inline (each pick saves; "No deliverable" sends nulls; a contract change clears the chain); `POST`/`PUT /api/time-entries` carry `deliverableId`/`workTypeId`. `DeliverableSelect.svelte` kept and extended (`alwaysRender`, `id`, `onChange`). Evidence `t5-*` (row, modal, card "Phase 1 > Design", inline clear/reselect, after reload). +4 e2e tests.
6. **Wiki-link click on a card — fixed.** `TimeEntriesPanel.handleNoteLinkClick` resolves the note's contract (`getNoteById` + `getContracts`) and calls new `navigation.openNote(noteId, contractId, clientId)`; passed as `onNoteLinkClick`. Evidence `t6-01`, `t6-02` (notes mode with the note open). +2 navigation unit tests.
7. **Timer completion form — fixed.** `checkExistingTimer` restores `contractId`/`description` from the server draft (both running and stopped recovery); `handleStop` shows the server's times/duration. `stopTimer` now uses `queries/timer-duration.ts`: full-second maths, rounded up, minimum 1 minute, midnight-safe (5 unit tests). Evidence `t7-00…t7-04` (contract preselected after reload, 3 s timer saved as `1m`, deliverable chosen after reload persists). +1 e2e test.
8. **Work types 400 — fixed.** `GET /api/work-types?deliverableId=` and `GET /api/deliverables?contractId=` validate a UUID and return 400 (`t8-work-types-400-curl.txt`). +4 e2e tests.
9. **Lint — fixed.** `TimeEntriesPanel` week navigation uses `SvelteDate`; `npx eslint` on the file: 0 errors.
10. **Readmes — updated:** `weekly/readme.md`, `timer/readme.md`, `components/admin/README.md`, `routes/admin/README.md`, `src/e2e/readme.md`.

### Verification

| Check | Before | After |
|---|---|---|
| `npm run check` | 0 errors, 23 warnings | 0 errors, 26 warnings (3 new `a11y_label_has_associated_control` on the new selects, same kind as the pre-existing ones) |
| `npm run lint` (repo) | 11 errors | 9 errors (the 2 `TimeEntriesPanel` errors fixed; the 9 left are the unused `NoteTimeEntryLink` imports etc. that 021-CL removes) |
| `npm test` (unit) | 23 files / 335 | 26 files / 352 |
| `npm run test:e2e` (API, against the 5191 dev server) | 45 tests | 11 files / 62 tests, all green |
| QA driver (`e2e-playwright/manual-checklist/qa-driver.mjs`, `QA_BASE_URL=http://localhost:5191`) | 2026-11-03 review run | **46 pass / 10 fail** (two runs; the first, 38/18, failed on a strict-mode `select` locator once the new-entry row gained a deliverable select, so a scratchpad copy of the driver with `.first()` on that locator was used). Every timesheet step passes (A3 day total/bar, A4 card hierarchy + colours + deliverable on card, A5 row layout + border on contract select, A10 distinct sidebar colours, E1 create/edit/timer stop-save/delete). The 10 failures are 020-CL's editor bugs (raw toggle, backlinks, editor wiki-link click, the four C2 cascades) and two driver limitations already listed in its README (contract `<option>` read before load; `[[INTL.` prefix autocomplete picking the newest note, which cascades to `A4-wiki-link-rendering-in-card`). 1 page error = NoteEditor raw-mode `querySelectorAll` (020-CL); console "errors" are tiptap duplicate-extension warnings. Driver screenshots copied as `driver-*.png` |

Screenshots: `docs/review/screenshots/sprint-019/` (29 PNG + `t8-work-types-400-curl.txt`), prefixed `t<task>-`. Probe scripts stayed in the session scratchpad (`sprint-019/t1-t3-probe.mjs`, `t4-probe.mjs`, `t5-probe.mjs`, `t2-t6-t7-probe.mjs`, `t7-deliverable-probe.mjs`).

### Follow-ups deferred (not in this sprint's files)

- `src/lib/server/auth.ts` (021-CL scope): Vite does not export `.env` into `process.env`, so a dev server on any port but 5173 needs `BETTER_AUTH_URL` exported in the shell or browser sign-up/login fails with `INVALID_ORIGIN`; `trustedOrigins` should come from env (021 task 6 already plans this).
- `TimeEntryDisplay.clientId` / `deliverableId` / `workTypeId` are optional only because `src/lib/powersync/powersync-data-service.ts` (boundary, deleted by 021-CL) does not map them — make them required once 021 lands.
- `AddTimeEntryModal.onCreated` could pass the created entry (id + date) so the panel can load a not-yet-loaded week; today the modal path refreshes loaded weeks only.
- `ensureAppUser()` in `hooks.server.ts` (boundary) still creates the Internal client with colour index 0; fine, but new users' first client is always rose.
- Timer entries are dated with the server's UTC date (`startTimer`) while the refresh event uses the browser's local date (code-state risk 3, pause is still cosmetic) — out of scope here.
- The modal still accepts only `H:MM` durations (QA §4.11); `/login` does not redirect an authenticated user (020-CL task 6).
- `e2e-playwright/manual-checklist/README.md` "known driver limitations" are now partly stale (the `border-l-` regex items and the refresh-cascade items are fixed); update after the next review run.
