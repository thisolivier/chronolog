# Sprint 032 — CL: Work type must match the deliverable; CLI edit of work type

**Status:** in progress
**Branch:** `sprint-032-CL/work-type-consistency` · **Worktree:** `.claude/worktrees/sprint-032-CL` · **Port:** 5210
**Sources:** sprint 031 sign-off leftovers; owner request 2026-11-04.

## Objective

A time entry can never carry a work type that does not belong to its deliverable, or a deliverable that does not belong to its contract, whichever path writes it. `chronolog edit` can change an entry's deliverable and work type.

## Tasks

1. **One validation function.** In the time-entries query module (or a small `entry-references.ts` next to it), `assertEntryReferences({ userId, contractId, deliverableId, workTypeId })` that checks: the contract belongs to the user; the deliverable, if given, belongs to that contract; the work type, if given, belongs to that deliverable (and so a work type without a deliverable is an error). Throw a typed error that the API layer maps to 400 with codes `deliverable_mismatch` and `work_type_mismatch` and a message naming both objects, for example `Work type "Interviews" belongs to deliverable "Discovery", not "Recommendations"`.
2. **Every write path uses it.** `POST /api/time-entries`, `PUT` and `PATCH /api/time-entries/[id]`, `POST /api/timer/start` and `/api/timer/save`, and any admin form action or server load that writes entries. Sprint 029 added the contract-ownership check in several places; fold it into this one function so there is one source of truth. For `PATCH`, validate the merged result (existing values plus the changes), so changing only the deliverable with a stale work type is rejected rather than silently kept.
3. **UI never sends a mismatch.** Check the entry card editor, the add-entry row and the timer widget: when the deliverable changes, the work type picker must reset to none (sprint 030 did this for contract changes). If any form can still submit a stale pair, fix it. Show the API's message in the form's existing error line if it ever comes back.
4. **CLI.** `chronolog edit <entry-id> [--deliverable X|none] [--work-type X|none]`. A work type is resolved under the entry's (new or current) deliverable; `--deliverable none` clears both. `chronolog log` already takes `--work-type`; make sure both commands exit 3 with candidates when the work type is not under that deliverable, and surface the API's 400 message otherwise. Update the CLI readme and the skill's logging section (one or two lines, stay under 180 lines).
5. **Existing data.** Write `scripts/check-entry-references.mjs` that reports (never fixes) entries whose work type or deliverable is inconsistent, runnable against dev; document in the sign-off how many the dev DB has. Production is fresh, so no migration.
6. **Tests.** Unit tests for the validation function (all four cases) and for each route's 400; API e2e for `chronolog edit --work-type` success and the mismatch exit; Playwright for the deliverable change resetting the work type in the card editor.

## Boundaries

Owns `src/routes/api/time-entries/**`, `src/routes/api/timer/**`, `src/lib/server/db/queries/time-entries.ts` and the new validation file, the entry forms and timer widget (only for task 3), `cli/`, the skill, `scripts/check-entry-references.mjs`. No schema change.

## Working rules

Worktree only. Dev server port 5210 with `BETTER_AUTH_URL=http://localhost:5210` and `ALLOW_REGISTRATION=true`; shared dev Postgres 127.0.0.1:5432, users `qa-032-*`, no reset, no seed. `npm run check` 0 errors, `npm test`, `npm run lint`, API e2e and Playwright green; rebase onto `main` before sign-off. Do not merge.

## Verification

Sign-off at the bottom: what was done, what was left, test counts, the dev-DB inconsistency count from task 5, and a short transcript of `chronolog edit --work-type` succeeding and failing in `docs/review/screenshots/sprint-032/transcript.md`.
