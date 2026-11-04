# Sprint 029 — CL: API hardening and quick wins

**Status:** merged
**Branch:** `sprint-029-CL/api-hardening-quick-wins` · **Worktree:** `.claude/worktrees/sprint-029-CL` · **Port:** 5207
**Sources:** `docs/backlog.md` (API / CLI, Admin / shell, Housekeeping), origin branches `fix/json-parse-error-handling`, `fix/time-entry-search-input-validation`, `fix/weekly-status-input-validation` (one commit each, do not merge; they conflict with main).

## Objective

Close the small API, CLI and admin items that the laptop secretary and the first production account will hit first. No new features beyond `chronolog edit` and `chronolog undo`.

## Tasks

1. **Guard every JSON body.** Six routes still call `request.json()` unguarded: `api/timer/{discard,start,save}`, `api/notes`, `api/notes/[noteId]/time-entries`, `api/time-entries/weekly-statuses`. Each returns the standard JSON error shape with 400 on a bad body (see `src/lib/server/api-errors.ts`). Port the weekly-status validation (year 2000–2100, week 1–53, non-empty status) from `origin/fix/weekly-status-input-validation` by hand, and check `origin/fix/time-entry-search-input-validation` for anything main still lacks on `api/notes/search` and `api/time-entries`.
2. **Note ID date.** `getNextNoteId` in `queries/notes.ts` uses the UTC date. Use the user's timezone (the same source `GET /api/me` uses for "today"); the API and the UI both go through this. Test with a fixed clock at 23:30 Europe/London.
3. **Note ID collisions.** `POST /api/notes` retries a collision five times then returns 500. Make the ID allocation safe under concurrency (an advisory lock keyed on the contract, or a sequence table), so eight parallel creates succeed. Test it.
4. **Contract ownership on write.** `POST /api/notes` and `POST /api/time-entries` must check that the contract belongs to the user; 403 otherwise.
5. **CLI edit and undo.** `chronolog edit <entryId> [--duration] [--description] [--date] [--deliverable]` and `chronolog undo` (deletes the last entry this CLI created, recorded in the config directory; refuse if nothing recorded). Add `PATCH /api/time-entries/[id]` and `DELETE /api/time-entries/[id]` if they do not exist, with ownership checks. Update `.claude/skills/chronolog-secretary/SKILL.md` and the CLI readme.
6. **Dead code.** Remove `deleteWorkType` from `queries/work-types.ts` (nothing calls it; `deleteWorkTypeWithNote` is the live path).
7. **First-run empty state.** A new account sees an empty week and a hidden "General" contract. On the timesheet and the notes list, when the user has no clients, show a short empty state that says clients and contracts are created under Settings → Clients, with a link. Test with a fresh registration.
8. **Housekeeping.** After task 1, delete the three `fix/*` branches on origin and note it in the sign-off.

## Boundaries

Owns `src/routes/api/**`, `src/lib/server/db/queries/notes.ts`, `queries/work-types.ts`, `queries/time-entries.ts`, `cli/`, the secretary skill, and the empty-state components you add. Sprint 030 runs in parallel and owns the timesheet components (`src/lib/components/timesheet/**`, `TimerWidget`, entry forms) and navigation focus handling; coordinate by not editing those files. If task 7 needs a timesheet page change, keep it to a new component mounted from the page with a one-line change and say so in the sign-off.

## Working rules

- Work only in the worktree. Dev server on port 5207 with `BETTER_AUTH_URL=http://localhost:5207` and `ALLOW_REGISTRATION=true` exported; the shared dev Postgres is on 127.0.0.1:5432 (name any QA users `qa-029-*`).
- `npm run check` with 0 errors, `npm test` green, `npm run lint` clean before sign-off.
- Rebase onto `main` before sign-off.

## Verification

Unit tests for tasks 1–4; an e2e run in `src/e2e/` for the eight parallel creates and for edit/undo; screenshots in `docs/review/screenshots/sprint-029/` of the first-run empty state and of a CLI edit showing in the UI. Write the sign-off at the bottom of this file with what was done, what was left, and the test counts. Do not merge; leave the branch for review.

## Sign-off

**2026-11-03, implemented on `sprint-029-CL/api-hardening-quick-wins`, rebased onto `main` after the sprint 030 merge (not merged).**

1. **JSON bodies.** I added `src/lib/server/api-request.ts`. `readJsonObject` turns a malformed, empty or non-object body into `400 invalid_json` in the shared shape. It is used by the six named routes and by two more that were also unguarded: `PUT /api/notes/[noteId]` and `PUT /api/time-entries/[id]`. `POST /api/time-entries` now uses it too. From `origin/fix/weekly-status-input-validation` I ported, by hand, into `weekly-statuses/week-input.ts`: year 2000–2100, week 1–53, and a non-empty known status (trimmed). The GET `weeks` keys are validated the same way, with at most 60 per request. From `origin/fix/time-entry-search-input-validation`, main lacked only the 200-character cap on `GET /api/notes/search` (`400 query_too_long`). Main's `validateDurationMinutes` already covered its duration checks.
2. **Note ID date.** `getNextNoteId` and `createNoteForUser` take a clock (`now`, `timezone`). `POST /api/notes` reads the zone the same way `GET /api/me` does (`?tz=` or `X-Timezone`, falling back to the server's zone; both now go through `readRequestTimezone`). The CLI already sent `X-Timezone`. The browser's `postJson` now sends it too, so UI-created notes get the local date. Tested at 23:30 Europe/London in BST and GMT, at 00:30 BST (UTC is still the day before) and at 23:30 Los Angeles.
3. **Collisions.** The ID is allocated and inserted in one transaction holding `pg_advisory_xact_lock(hashtext('note-id:<SHORTCODE>.<YYYYMMDD>'))`. The retry loop is gone. The key is the ID prefix rather than the contract, because two contracts of the same client share an ID space. Eight parallel creates pass in the unit test and over HTTP (e2e). With the lock commented out, the unit test fails. Sequences are compared as numbers, so `.1000` follows `.999`.
4. **Ownership.** `contractBelongsToUser` is in `queries/contracts.ts`. `POST /api/notes`, `POST /api/time-entries`, `PUT`/`PATCH /api/time-entries/[id]` (when the contract or deliverable changes), `POST /api/timer/start` and `POST /api/timer/save` all answer `403 contract_forbidden`. A deliverable must belong to the entry's contract (`400 invalid_deliverable`). One extra fix: `POST /api/notes/[noteId]/time-entries` used to link any entry id. It now returns 404 for an entry that is not the caller's.
5. **CLI.** `PATCH` and `GET /api/time-entries/[id]` were added (`PUT` stays for the UI). `DELETE` already existed and now answers 404 on a non-UUID id instead of a 500. `PATCH` takes `date` and `duration` text: a range sets start and end, and a plain duration clears an old range. `chronolog edit <id> [--duration] [--description] [--date] [--deliverable X|none]`. `chronolog log` records the new entry in `last-entry.json` next to the config file. `chronolog undo` deletes that entry once, then forgets it. It refuses with exit 2 when nothing is recorded or the record is for another server. The CLI readme and the secretary skill (126 lines) are updated.
6. **Dead code.** `deleteWorkType` is removed.
7. **First-run notice.** `src/lib/components/onboarding/FirstRunNotice.svelte` is shown while the only client is the seeded Internal (`INTL`) one. It links to `/admin/clients` (Settings → Clients and contracts). It re-checks when the sidebar reloads contracts, so it goes away once a client exists. Page change: `src/routes/(workspace)/+layout.svelte` has one import plus one `<FirstRunNotice />` line above `TimeEntriesPanel` and one above `NoteListPanel`. No timesheet components were touched. Three Playwright locators (`getByText('Contracts')` twice and `getByRole('link', { name: 'Settings' })`) are now `exact`, because the notice's link text matched them for fresh test users.
8. **Housekeeping.** I deleted `fix/json-parse-error-handling`, `fix/time-entry-search-input-validation` and `fix/weekly-status-input-validation` on origin after task 1 was done and tested.

**Verification.** After the rebase: `npm run check` gives 0 errors (the 3 existing warnings in `src/routes/+layout.svelte`), `npm run lint` is clean, and `npm test` passes 679 tests in 64 files. New tests: `api-request`, `week-input`, `note-id-allocation`, `routes/api/api-hardening`, `cli/commands/correct`, `onboarding/first-run`. The API e2e suite passes 75/75 against port 5207, including the new `api-hardening-cli.e2e.test.ts`. Playwright chromium passes 37/37. Screenshots and the CLI transcript are in `docs/review/screenshots/sprint-029/`. They were taken just before the rebase onto sprint 030's timesheet changes.

**Test harness.** `src/e2e/{setup,helpers}.ts` and `e2e-playwright/auth.setup.ts` take `E2E_USER_PREFIX`, so this sprint's users are `qa-029-*`. Run command: `E2E_USER_PREFIX=qa-029-e2e E2E_BASE_URL=http://localhost:5207 BETTER_AUTH_URL=http://localhost:5207 npm run test:e2e`. Vite listens on `localhost`, not `127.0.0.1`.

**Left / follow-ups.**
- Only entries created by `chronolog log` can be undone. Edits are not undoable, and there is no history beyond the last entry.
- The first-run rule is name-based (client `Internal` with short code `INTL`). If someone renames the starter client, the notice disappears, which is acceptable.
- QA users `qa-029-*` (unit-test users are cleaned up; registered UI and e2e users and their data remain) are in the shared dev database.
