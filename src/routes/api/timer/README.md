# Timer API

The running timer is a draft time entry (`is_draft = true`): one per user, started with a contract,
stopped (end time and duration set), then saved (draft cleared) or discarded. Dates and times are
the user's local wall clock, sent by the browser or the CLI.

## Routes

- `GET status` -- the draft (running or stopped) with contract and client names, or `null`.
- `POST start` -- `{ contractId, date?, startTime?, confirmed? }`; 409 when a draft exists. A given
  start without `confirmed` is checked like `PATCH` below. The browser always sends `confirmed`.
- `PATCH /api/timer` (`+server.ts`, sprint 041-CL) -- `{ startTime, date?, confirmed? }` moves the
  running timer's start. 400 `invalid_start` / `start_in_future` / `start_too_early`, 404
  `no_running_timer`, 409 `timer_stopped`, 409 `start_overlaps_entry` (with `overlappingEntry`)
  unless `confirmed`.
- `POST stop` -- `{ endTime? }`; duration from full seconds, rounded up, midnight-safe.
- `POST save`, `POST discard` -- finish or drop the draft.

## Modules

- `local-clock.ts` -- validates the `YYYY-MM-DD` / `HH:MM[:SS]` strings clients send.
- `timer-start-rules.ts` -- pure start rules: "now" in the caller's timezone (`X-Timezone`), future
  (2 minutes of slack for clock skew), the 24-hour limit (durations come from times of day), and
  which saved entry a run from the start to now overlaps (zero-length entries ignored).
- `start-guard.ts` -- applies the rules for a user (reads the entries, builds the 409 message
  naming "Client / Contract HH:MM–HH:MM on date"). DB access is in
  `$lib/server/db/queries/timer-start.ts`.

Tests: `timer-start-rules.test.ts` (pure), `timer-adjust.test.ts` (handlers against the dev database).
