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
{ entryId, expectedStartedAt, boundary, clientRequestId,
  left:  { action: "save", contractId, deliverableId?, workTypeId?, description? } | { action: "discard" },
  right?: { contractId?, deliverableId?, workTypeId?, description? } }
```
200:
```
{ replayed: boolean,
  left:      { action: "saved", entry } | { action: "discarded", date, startTime, endTime },
  remainder: { kind: "draft", timer } | { kind: "pending", date, startTime, description } | { kind: "gone" } }
```
- **Left** `start..boundary`: saved as a normal entry (`is_draft = false`, start/end times, duration from the timer rule: seconds, rounded up, at least 1 minute), with note links for its `[[links]]`; or discarded (nothing logged).
- **Right** `boundary..end-or-now`: with a contract the draft row advances (start = boundary, content replaced, links reconciled; a stopped draft keeps its end and its duration is re-measured, a running one stays running). Without a contract (SP-03's blank new part) the draft row is deleted and `remainder.kind = "pending"`: the browser keeps that part as its pending timer from the boundary, with the source's end if it was stopped (the existing contractless-timer model, source map §a6).
- `kind: "gone"` only on a replay whose remainder has since been saved, discarded or split again.
- Errors, nothing written: 400 `invalid_split`, `invalid_boundary`, `invalid_client_request_id` (required, ≤ 90 chars), `contract_required` (left save without contract), `boundary_outside` (not strictly inside start..end, or start..now with the usual 120 s clock-skew slack), `interval_too_long` (a part ≥ 24 h); 403 `contract_forbidden`, 400 `deliverable_mismatch` / `work_type_mismatch` (the sprint 032 rule, applied to both parts); 404 `not_found`; 409 `not_a_draft` (the id is a saved entry: SP-01/O13, never split a saved entry); 409 `timer_changed` (draft start ≠ `expectedStartedAt`).

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

**Known limit:** a split that discards the left part *and* hands the remainder back as pending leaves no server row to carry a mark; its retry answers 404 `not_found` (the draft is gone). The client knows its own request, so it can treat that 404 as settled when it was retrying that exact split.

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
