# Sprint 029 — CL: API hardening and quick wins

**Status:** in progress
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
