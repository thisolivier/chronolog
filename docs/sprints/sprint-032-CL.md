# Sprint 032 — CL: Work type must match the deliverable; CLI edit of work type

**Status:** ready for review
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

## Sign-off

**Status:** ready for review. Implemented on 2026-11-04 on `sprint-032-CL/work-type-consistency`. Rebased on `main` (`16af0c1`, which had nothing new) and not merged.

### Per task

| # | Task | Result | What changed |
|---|------|--------|--------------|
| 1 | One validation function | **Done** | `src/lib/server/db/queries/entry-references.ts`: `assertEntryReferences({ userId, contractId, deliverableId, workTypeId })` throws `EntryReferenceError` (`status`, `code`). The codes are 400 `invalid_contract` (not a UUID), 403 `contract_forbidden`, 400 `deliverable_mismatch` (`Deliverable "Support" belongs to contract "Retainer", not "Research"`) and 400 `work_type_mismatch` (`Work type "Interviews" belongs to deliverable "Discovery", not "Recommendations"`, or `…, but the entry has no deliverable`). Lookups join up to `clients.user_id`. Another user's deliverable or work type is reported by id only and never by name. The contract name is decrypted only for the message. |
| 2 | Every write path uses it | **Done** | `entry-input.ts`'s `checkContractAccess` is replaced by `entryReferenceProblem`, which wraps the function into the shared error shape. It is used by `POST /api/time-entries`, `PUT`/`PATCH /api/time-entries/[id]`, `POST /api/timer/start` (contract only) and `POST /api/timer/save` (contract, deliverable and work type). `PUT`/`PATCH` validate the **merged** entry (current values plus the body) whenever the body names a contract, deliverable or work type. Changing only the deliverable while a stale work type remains is a 400, and the entry is left unchanged. A description-only edit does not re-check references, so an old inconsistent row can still be edited. No admin form action or server load writes entries, so there was nothing else to fold in. The deliverable code changed from 029's `invalid_deliverable` to `deliverable_mismatch`, and nothing in the repo read the old code. |
| 3 | UI never sends a mismatch | **Done** | The card editor already reset the work type on a deliverable change (`handleDeliverableChange` sends `workTypeId: null`). The add-entry row, the Add Entry modal and the timer completion form relied on `WorkTypeSelect` dropping a stale selection **after** the new list loaded, which left a gap where a submit could send the old pair. `WorkTypeSelect` now clears the selection as soon as `deliverableId` changes. That one change covers all four forms, and the initial value is kept when an editor opens. All four forms already show `describeSaveError(…)` in their error line, which includes the API message (Playwright checks this on the card). The running timer only ever carries a contract. |
| 4 | CLI | **Done** | `chronolog edit <id> [--deliverable X\|none] [--work-type X\|none]` (`--tag` also works). A work type is resolved under the new deliverable if one is given, otherwise under the entry's current one. `--deliverable none` clears both. A new deliverable without `--work-type` clears a work type that belonged to the old one. A work type on an entry with no deliverable, or combined with `--deliverable none`, exits 2. The new `cli/lib/entry-references.mjs` is shared by `log` and `edit`. A work type that is not under the deliverable exits 3 with `No work type matches “X” under deliverable “D”.`, and the candidates are that deliverable's work types. A 400 from the API prints its message and exits 1, as before. `edit` output now shows `[Deliverable > Work type]`. The CLI readme, the usage text and the skill are updated: the skill gains 3 lines and is now 161, plus a failure-table row for the two codes. |
| 5 | Existing data | **Done** | `scripts/check-entry-references.mjs` (`node --env-file=.env scripts/check-entry-references.mjs [--json]`) runs in one read-only transaction. It reports `contract_not_owned`, `deliverable_mismatch`, `work_type_without_deliverable` and `work_type_mismatch`, with ids and the plaintext deliverable and work type names. It never decrypts and never fixes anything. It exits 1 when it finds rows. **Dev DB: 564 entries checked, 0 inconsistent.** To prove it detects problems, I seeded a temporary `qa-032-script-check` user with one bad row of each of the three deliverable and work-type kinds. It reported 3 with the right issues. I then removed the user and its rows. |
| 6 | Tests | **Done** | `queries/entry-references.test.ts` has 6 tests: consistent, contract, deliverable, work type, no deliverable, and another user's objects. `routes/api/entry-references-routes.test.ts` has 17 tests: POST has 3 mismatch cases plus 1 success; PUT and PATCH have 5 each, including the merged stale-work-type case; a description-only PATCH; timer start 403; timer save mismatch, then a save that succeeds. The shared fixture is `queries/entry-reference-fixture.ts` (`qa-032-*` users, cleaned up). `cli/commands/correct.test.mjs` adds 7 tests. The API e2e `src/e2e/entry-references-cli.e2e.test.ts` has 6 tests: `edit --work-type` success, exit 3 with candidates and nothing changed, moving and clearing the pair, `log` exit 3 with nothing logged, API 400 on PUT, and API 400 on a POST with no deliverable. The Playwright `e2e-playwright/work-type-consistency.spec.ts` has 3 tests per browser: a deliverable change in the card editor resets the work type to none and the save matches; the same in the add-entry row; a mocked 400 shows in the card's error line. |

### Verification

- `npm run check`: **0 errors**. The 3 warnings are the existing ones in `src/routes/+layout.svelte`.
- `npm run lint`: clean.
- `npm test`: **735 passed** in 68 files (705 after sprint 031).
- API e2e: **86/86** in 12 files, against `http://localhost:5210` with `E2E_USER_PREFIX=qa-032-e2e`.
- Playwright: **76 passed, 5 skipped**, 0 failed. The skips are the existing chromium-only offline tests on webkit. Run with `PLAYWRIGHT_BASE_URL=http://localhost:5210 E2E_USER_PREFIX=qa-032-pw npx playwright test --retries=0`.
- Transcript: `docs/review/screenshots/sprint-032/transcript.md`. It shows the setup, `edit --work-type` succeeding, the exit 3 with candidates (human and `--json`), `log` exit 3, moving and clearing the pair, exit 2 with no deliverable, and the API's 400 to a raw stale `PATCH`.

### Left / notes

- The CLI never sends a stale pair, so it reaches the server's 400 only through a race, such as the deliverable being changed in the app between the CLI's read and its write. In that case it prints the server message and exits 1. The transcript shows that message from a raw `PATCH`.
- `PATCH` re-validates only when the body touches a reference. A row that was already inconsistent can still have its description or duration edited. Since the dev DB has none and production is fresh, this only matters for data written before this sprint.
- Safe deletion (`safe-deletion.ts`) clears references itself and is outside this check. It never creates a mismatch: deleting a deliverable cascades to its work types.
- QA users: `qa-032-e2e-*`, `qa-032-pw-*` and `qa-032-transcript-*` (with the NWR client) remain in the shared dev DB. The unit-test users (`qa-032-refs-*`, `qa-032-routes-*`) are removed by their tests.
