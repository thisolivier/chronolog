# Timer API

The running timer is a draft time entry (`is_draft = true`): one per user, started with a contract,
stopped (end time and duration set), then saved (draft cleared) or discarded. Dates and times are
the user's local wall clock, sent by the browser or the CLI.

## Routes

- `GET status` -- the draft (running or stopped) with contract and client names, or `null`.
- `POST start` -- `{ contractId, date?, startTime?, confirmed? }`; 409 when a draft exists. A given
  start without `confirmed` is checked like `PATCH` below. The browser always sends `confirmed`.
- `PATCH /api/timer` (`+server.ts`, sprint 041-CL, extended 056-DR) -- `{ startTime?, date?,
  confirmed?, resume?, expectedStartedAt? }`. Running: moves the start. Stopped: moves the start and
  keeps the end, re-measuring the duration (400 `invalid_start` at/after the end, 400
  `interval_too_long`; overlaps checked over start..end). Stopped with `resume: true`: clears the
  end so the timer runs again from its start (or the given one) through now (design r1 SP-05);
  409 `timer_running` if it is not stopped. Also 400 `start_in_future` / `start_too_early`, 404
  `no_running_timer`, 409 `timer_changed` (stale `expectedStartedAt`), 409 `start_overlaps_entry`
  (with `overlappingEntry`) unless `confirmed`.
- `POST stop` -- `{ endTime? }`; duration from full seconds, rounded up, midnight-safe.
- `POST save`, `POST discard` -- finish or drop the draft: `{ entryId, expectedStartedAt?, ... }`.
  Since 056-DR both lock the row and refuse anything but the draft (409 `not_a_draft`: a stale
  device cannot overwrite or delete an entry saved elsewhere) or a moved draft (409
  `timer_changed`). `expectedStartedAt` is required (409 `expected_start_required`) for a split
  remainder and for a save with time overrides; it compares at the precision sent. Save links the
  notes named by `[[links]]` in the description.
- `POST split` (sprint 056-DR) -- `{ entryId, expectedStartedAt, boundary, clientRequestId, left:
  { action: "save", contractId, ... } | { action: "discard" }, right?: { contractId?, ... } }`.
  One transaction: the left part `start..boundary` is saved (with its links) or discarded and the
  draft advances to `boundary..end-or-now` with the right content; a right part with no contract
  deletes the draft and answers `remainder: { kind: "pending", endTime }` for the browser's pending
  timer. Optional `expectedEndedAt` (null = running) is checked and feeds a replay's `endTime`.
  The same `clientRequestId` again answers the first outcome with `replayed: true`. Errors write
  nothing: 400 `invalid_split` / `invalid_boundary` / `contract_required` / `boundary_outside` /
  `interval_too_long`, the entry reference errors, 404, 409 `not_a_draft` / `timer_changed`.
  Only the live draft can be split, never a saved entry.

Times are local wall clock; `expectedStartedAt` and `boundary` are `YYYY-MM-DDTHH:MM[:SS]`.

## Modules

- `local-clock.ts` -- validates the `YYYY-MM-DD` / `HH:MM[:SS]` strings clients send.
- `timer-start-rules.ts` -- pure start rules: "now" in the caller's timezone (`X-Timezone`), future
  (2 minutes of slack for clock skew), the 24-hour limit (durations come from times of day), and
  which saved entry a run from the start to now overlaps (zero-length entries ignored).
- `start-guard.ts` -- applies the rules for a user (reads the entries, builds the 409 message
  naming "Client / Contract HH:MM–HH:MM on date"); `runEnd` checks a stopped timer's start..end.
  DB access is in `$lib/server/db/queries/timer-start.ts`.
- `timer-moments.ts` -- pure: `YYYY-MM-DDTHH:MM[:SS]` moments, a draft's start and end (end before
  start = next day), where a split boundary may fall, how far a stopped start may move.
- `split-request.ts` -- pure reading of the split body. `expected-start.ts` -- the optional
  `expectedStartedAt` of save, discard and PATCH.
- DB: `$lib/server/db/queries/timer-draft.ts` (locked, draft-only save and discard) and
  `timer-split.ts` (the split transaction and its replay).

Tests: `timer-start-rules.test.ts`, `timer-moments.test.ts`, `split-request.test.ts` (pure),
`timer-adjust.test.ts` (handlers against the dev database), API e2e `src/e2e/timer-split.e2e.test.ts`.
