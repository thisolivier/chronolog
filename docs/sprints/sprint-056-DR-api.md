# Sprint 056 — DR: Timer split, resume and draft guards (server side)

**Status:** ready for review
**Branch:** `design-r1-split-api` (from `design-r1`) · **Worktree:** `.claude/worktrees/design-r1-split-api` · **Dev server port:** 5256
**Sources:** design r1 specs `docs/design/r1/specs/04-split-time.md` (SP-01, SP-02, SP-04, SP-05, SP-07, SP-08), `03-time-capture.md` (TC-04, TC-06); source map `docs/design/r1/source-map/03-04-capture-and-split.md` (§a1, §a6, O10, O13, risks d1–d2).
**Scope:** server groundwork for the desktop split UI. No `.svelte`, no `src-tauri/`, no migration, no new dependency.

## Endpoints

All times are the caller's local wall clock. `expectedStartedAt` and `boundary` are `YYYY-MM-DDTHH:MM[:SS]` (no zone).

### `POST /api/timer/split` (new)

Body:
```
{ entryId, expectedStartedAt, expectedEndedAt?, boundary, clientRequestId,
  left:  { action: "save", contractId, deliverableId?, workTypeId?, description? } | { action: "discard" },
  right?: { contractId?, deliverableId?, workTypeId?, description? } }
```
200:
```
{ replayed: boolean,
  left:      { action: "saved", entry } | { action: "discarded", date, startTime, endTime },
  remainder: { kind: "draft", timer } | { kind: "pending", date, startTime, endTime, description } | { kind: "gone" } }
```
- **Left** `start..boundary`: saved as a normal entry (`is_draft = false`, start/end times, duration from the timer rule: seconds, rounded up, at least 1 minute), with note links for its `[[links]]`; or discarded (nothing logged).
- **Right** `boundary..end-or-now`: with a contract the draft row advances (start = boundary, content replaced, links reconciled; a stopped draft keeps its end and its duration is re-measured, a running one stays running). Without a contract (SP-03's blank new part) the draft row is deleted and `remainder.kind = "pending"`: the browser keeps that part as its pending timer from the boundary (the existing contractless-timer model, source map §a6). `endTime` is the stopped source's end (null when it was running); on a replay the row is gone, so `endTime` comes from the request's `expectedEndedAt` (send it for a stopped draft; absent gives null).
- `kind: "gone"` only on a replay whose remainder has since been saved, discarded or split again.
- Errors, nothing written: 400 `invalid_split`, `invalid_boundary`, `invalid_client_request_id` (required, ≤ 90 chars), `contract_required` (left save without contract), `boundary_outside` (not strictly inside start..end, or start..now with the usual 120 s clock-skew slack), `interval_too_long` (a part ≥ 24 h); 403 `contract_forbidden`, 400 `deliverable_mismatch` / `work_type_mismatch` (the sprint 032 rule, applied to both parts); 404 `not_found`; 409 `not_a_draft` (the id is a saved entry: SP-01/O13, never split a saved entry); 409 `timer_changed` (draft start ≠ `expectedStartedAt`).

`expectedEndedAt` (optional; `null` = "I see it running") is checked against the locked draft: a mismatch (stopped or resumed elsewhere) is 409 `timer_changed`. `expectedStartedAt` / `expectedEndedAt` compare at the precision sent: `…T09:00` matches a start stored as 09:00:37, `…T09:00:00` does not.

### `PATCH /api/timer` (extended)

Body `{ startTime?, date?, confirmed?, resume?, expectedStartedAt? }`.
- Running: unchanged (moves the start; `startTime` required).
- Stopped, no `resume`: was 409 `timer_stopped`, a guard only. Now moves the start and keeps the end; the duration is re-measured. 400 `invalid_start` at/after the end, 400 `interval_too_long` for ≥ 24 h; overlap check over start..end unless `confirmed`.
- Stopped, `resume: true` (SP-05 Resume): clears `end_time`, duration back to 0; the timer runs from its start (or the given `startTime`/`date`) through now, editing time included. Start rules apply (future / 24 h; overlap 409 `start_overlaps_entry` unless `confirmed`). 409 `timer_running` if not stopped.
- 409 `timer_changed` when `expectedStartedAt` is given and stale.

### `POST /api/timer/save`, `POST /api/timer/discard` (defect fix)

Both accept an optional `expectedStartedAt` and now run in a transaction that locks the row: 409 `not_a_draft` when it is already a saved entry (a stale device could previously overwrite or hard-delete it, source map risk d1), 409 `timer_changed` when the start moved, 404 `not_found`. Save now links the notes named by `[[links]]` in the description (source map §a2 gap), through the same function `PUT /api/time-entries/[id]` uses.

## Transaction and idempotency

`splitDraftTimer` (`src/lib/server/db/queries/timer-split.ts`), one `database.transaction`:
1. `SELECT … FOR UPDATE` the user's row `entryId`.
2. Replay check: an entry with `client_request_id = clientRequestId` (the saved left part) or a draft with `<clientRequestId>:remainder` (the advanced draft). Either → answer the first outcome, `replayed: true`, write nothing.
3. Validate: still a draft, start = `expectedStartedAt`, boundary inside (the route's pure `splitBoundaryProblem` on the locked row).
4. Insert the left entry with `clientRequestId` + its links; update the draft (mark, start, content, duration, links) or delete it.

A duplicate sent at the same moment blocks on the row lock, then sees the marks (READ COMMITTED re-reads) and replays; a unique-index violation (the same id racing on another row) reruns the transaction, which replays. So a retry after a resize or lost answer (SP-07 "save in flight") settles exactly once and the original interval is never double-counted or lost (SP-08). The marks reuse migration 0011's `client_request_id` column and partial unique index, so no migration; timer save clears the remainder mark.

**Known limit (SP-08, not closed):** a split with `left: discard` *and* a pending (contractless) right part removes the only row, so nothing carries a mark: a retry of that exact request answers 404 `not_found` (pinned by an e2e test). Keeping the row is not possible because `time_entries.contract_id` is NOT NULL; closing the gap needs a small `timer_split_requests (user_id, client_request_id, outcome jsonb)` table and a migration, not done here. Until then the client, which knows its own request, can treat that 404 on a retry of that split as settled. Every other combination replays: save-left via the left entry's id, a draft right via the remainder mark.

## Review fixes (2026-11-07, second pass)

1. **Stale device after a split (high).** `expectedStartedAt` is now required (409 `expected_start_required`) on `POST /api/timer/save` and `/discard` when the draft is a split remainder (`:remainder` mark), and on any save that overrides the times (`durationMinutes` / `startTime` / `endTime`). So a device that still shows 09:00–10:00 after another split it at 09:30 can neither save its edited times (09:00–09:30 logged twice) nor discard the 09:30–10:00 remainder. `TimerWidget.svelte` (two lines: Save and Discard pass the start it holds) and the CLI's `timer stop` now send `expectedStartedAt`.
2. **Pending remainder end (medium, SP-08).** `pending` carries `endTime`; replays read it from `expectedEndedAt`; the discard + pending replay gap is documented above.
3. **Precision (medium).** Expected moments compare at the precision sent (`momentMatches`, `queries/timer-draft-rules.ts`, unit-tested).
4. **PATCH race (low).** The move, stopped-move and resume updates re-check the start, date and end the route read in their `WHERE` clause; a miss is 409 `timer_changed`.
5. **Tests.** A concurrent duplicate with `left: discard` and a draft right part (no unique insert to collide on, so it passes only with the row lock: verified by removing `FOR UPDATE`, which fails exactly that test); the resume test logs its own overlapping entry; new e2e cases for stale save with time overrides, stale discard, the pending end and replay, and HH:MM precision. `timer.e2e.test.ts`'s adjusted-time save now sends `expectedStartedAt` and first checks the 409 without it.

Results after the fixes: `npm run check` `svelte-check found 0 errors and 0 warnings`; `npm run lint` exit 0; `npm test` `Test Files 120 passed (120)`, `Tests 1148 passed (1148)`; `npm run test:e2e` `Test Files 23 passed (23)`, `Tests 143 passed (143)`.

## Behaviour changes callers may notice

- A **retried** `POST /api/timer/save` (the first one succeeded but its answer was lost) now gets 409 `not_a_draft` instead of 200; treat it as saved if the entry exists.
- `chronolog timer adjust` now works on a **stopped** timer (the server no longer answers `timer_stopped`): it moves the start and keeps the end.
- A timer save reconciles links to its description: a save **without a description** (or one dropping `[[links]]`) removes the draft's note links, e.g. those added by Attach note while it ran.
- Save with time overrides, or save/discard of a split remainder, needs `expectedStartedAt` (older clients that never split are unaffected except for overrides: the current widget now sends it).

## Validation and shared code

- One reference validation on every write: `entryReferenceProblem` for the left save and a right part with a contract.
- One link sync: `reconcileTimeEntryLinksInTransaction` (`queries/time-entries-batch.ts`) replaces the inline add/remove loop of `PUT /api/time-entries/[id]` and serves timer save and both split parts; new left entries use the existing `linkTimeEntryToNotesInTransaction`. Unknown or trashed notes are skipped, as before.
- Kept per O10: timer rounding (ceil, ≥ 1 min), local wall-clock strings, dating by start day, midnight wrap, no overlap enforcement on save. Splitting can therefore add up to 1 minute in total (source map risk d6).

## Client service layer

`DataService` gains `splitTimer(input)` (`POST /api/timer/split`) and `resumeTimer({ start?, confirmed?, expectedStartedAt? })` (`PATCH /api/timer` with `resume: true`); `discardTimer(entryId, { expectedStartedAt? })` and `SaveTimerInput.expectedStartedAt` pass the guard through. Fetch, delegating and offline services implement them. Timer requests are still not queued offline: `OfflineDataService.splitTimer` / `resumeTimer` go through `runOnlineOnly` (`src/lib/offline/online-only.ts`), which throws `NotAvailableOfflineError` ("Splitting the timer is not available offline. Reconnect and try again.") when offline or when the request fails at the network level. Server errors (409 etc.) pass through unchanged.

## Tests

- Unit: `timer-moments.test.ts` (12: moment parsing, midnight end, boundary strictly inside running/stopped, skew slack, ≥ 24 h, stopped start), `split-request.test.ts` (13), `online-only.test.ts` (3), `fetch-data-service.test.ts` (+3, method lists), `timer-adjust.test.ts` (stopped start now moves and is re-measured; resume, `timer_running`, `timer_changed`).
- API e2e `src/e2e/timer-split.e2e.test.ts` (9): split save with link and advance; identical retry → one entry, `replayed`; stale `expectedStartedAt` → 409; concurrent duplicate → one entry; stopped-draft discard keeps end; blank remainder → pending, no draft; boundary at start 400, foreign contract 403, split of a saved entry 409 `not_a_draft`; resume (overlap asks, then confirmed); save/discard of a saved entry 409 and the entry unchanged; discard `expectedStartedAt`; timer save links its note.

Results (2026-11-07, worktree dev server on 5256 against the dev Postgres):
- `npm run check`: `svelte-check found 0 errors and 0 warnings`
- `npm run lint`: `eslint .` exit 0, no output
- `npm test`: `Test Files 119 passed (119)`, `Tests 1142 passed (1142)`
- `npm run test:e2e`: `Test Files 23 passed (23)`, `Tests 139 passed (139)` (baseline before the sprint: 22 files, 130 tests)

## Follow-ups

1. **UI sprint:** the split overlay and its store (SP-06/SP-07 state outside `TimerWidget`), flushing the description debounce before reading content (risk d4), a pending-timer source split (localStorage split-intent marker, O10), disabling Split while offline, sending `expectedStartedAt` from the existing Save/Discard.
2. **CLI:** `chronolog timer split` / `timer resume` would map directly onto these endpoints; not built. The CLI's `timer adjust` now also works on a stopped timer (the server no longer answers `timer_stopped`); its help text could say so.
3. If the discard + pending retry limit matters in practice, a small `timer_split_requests` table would give every split a durable outcome (needs a migration).
4. Right-part duration on split could be "total minus left" to avoid the possible +1 minute; left as the existing rule for now (O10).
5. `PUT /api/time-entries/[id]` still accepts a draft and can set times without re-measuring the duration (source map §a1); unchanged here.
