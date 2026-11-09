# Sprint 065-TT — Total time

**Branch:** `total-time` from `main` at `7ae885c` (v1.6.2), worktree `.claude/worktrees/total-time`. **Status:** built and tested, not merged, no version bump, not deployed. No new dependencies, no migration (owner rule), nothing in `src-tauri/`.

## Owner's words (the brief)

> In timesheets if you tap on the weekly total of time you get a 'total time' modal, where you can select which contracts to include, a date range, and you see the total time recorded in that range. It should be easy to deselect all contracts (to make choosing just one easy), and easy to select 'for all time'. Would be good for the CLI to get this kind of total time for [array of contracts] within [date 1] to [date 2] range. Crib from existing design notes, nothing fancy. Mobile views too (happy for mobile to go full window with top bar navigation as required).

## Goal

One number for "how much time went on these contracts over this period", in the app and from the CLI, from the same server query.

## What shipped

- **Server.** `getTotalTime` (`src/lib/server/db/queries/time-entries-total.ts`) sums `duration_minutes` and counts entries per contract in Postgres (`GROUP BY`), for the user's own non-draft entries, with an optional inclusive `from` / `to` and a contract selection (`'all'` or IDs; an empty list is a zero total without a query). Contract and client names are decrypted after the aggregate. `GET /api/time-entries/total?from=&to=&contracts=` validates dates (`isCalendarDate`), `from <= to` and contract IDs (400), answers `{ from, to, totalMinutes, entryCount, contracts: [{ contractId, contractName, clientName, clientShortCode, totalMinutes, entryCount }] }`, most minutes first. Another user's contract ID is never counted.
- **Data service.** `getTotalTime({ from, to, contracts })` on `DataService`, `FetchDataService` (via `fetchFreshJson`, so a failure never returns an old cached total) and `DelegatingDataService`; `OfflineDataService` wraps it in `runOnlineOnly`.
- **App.** The week total in the week strip is a button (`data-testid="week-total"`, title "Total time"); an older week's total in the timesheet is one too (`older-week-total`). Both open `TotalTimeModal` for that week: From / To date inputs, quick ranges (All time, "Week N" when the viewed week is not the current one, This week, This month, This year; the matching one shows pressed), contracts grouped by client with colour tile, short code and name, All / None, inactive contracts under a collapsed "Show inactive", and the result (large total, entry count, client · contract · time rows). Defaults: the viewed week, every active contract. Requests are debounced 200 ms, stale replies dropped, "…" while loading. Empty states: "No contracts selected", "No time recorded", "From is after To", "Needs a connection" offline. Desktop: centred overlay; phone: full window sized to the visual viewport with the bark header as the top bar (title left, Close right). Escape, backdrop and Close close it; focus returns to the total that opened it.
- **CLI.** `chronolog total --contract X… | --client X… | --all-contracts [--from D] [--to D] [--all-time] [--json]`. Repeated flags are kept in a new `flagValues` from the argument parser. Default range: the current week from `/api/me`; `--from` or `--to` alone is open-ended; date words as `--date`. Contract references follow the never-guess rule (exit 3).

## Files

- New: `src/lib/server/db/queries/time-entries-total.ts`, `src/routes/api/time-entries/total/+server.ts`, `src/routes/api/time-entries-total.test.ts`, `src/lib/components/weekly/TotalTimeModal.svelte`, `TotalTimeContractList.svelte`, `TotalTimeResult.svelte`, `total-time.ts`, `total-time.test.ts`, `cli/commands/total.mjs`, `cli/commands/total.test.mjs`, `e2e-playwright/total-time.spec.ts`.
- Changed: `WeekStrip.svelte`, `layout/TimeEntriesPanel.svelte`, `services/{data-service,fetch-data-service,delegating-data-service,types}.ts`, `fetch-data-service.test.ts`, `offline/offline-data-service.ts`, `cli/chronolog.mjs`, `cli/lib/args.mjs`, `cli/lib/cli-lib.test.mjs`; docs: `weekly/readme.md`, `layout/README.md`, `services/readme.md`, `cli/readme.md`, `cli/CHANGELOG.md` (Unreleased), `.claude/skills/chronolog-secretary/SKILL.md` (Totals section).

## Tests

- Vitest: route test (8: auth, all-time, range, open bounds, contract filter, other user's contract, empty list, 400s), helper test (12), data service (3 new), CLI `total` (9) and parser (1 new). `npm test`: 145 files, 1415 tests passed.
- Playwright `e2e-playwright/total-time.spec.ts` against a worktree dev server on port 5180: defaults / None / one contract / All time / empty range / Close and Escape with focus return (chromium, webkit), viewed earlier week and backdrop close, the phone layout fills the viewport with the header as top bar (`@iphone`: iphone-se, iphone-15), and the CLI against the server (all time JSON, `--client` plain output, a 2025 range, unknown contract exit 3, no contracts exit 2).
- `npm run check` 0 errors 0 warnings, `npm run lint` clean. Regression runs: `time-review`, `polish-time`, `timesheet-polish` (chromium), `iphone-journeys` (iphone-se) pass.

## Deviations and notes

- The CLI's usage error is exit 2 (the CLI's existing `UsageError` code), not 1.
- CLI durations use the CLI's existing `12h30m` form, not `12h 30m`, to match `week`.
- The modal lists the contracts `/api/contracts` returns (not archived, not the system "Deleted Contract"); archived contracts' time is reachable from the CLI with `--all-contracts`, not from the modal.
- The modal sends explicit contract IDs even when every box is ticked, so its "All" means the listed contracts.
- The result sits under the contract list as specified; on a phone with many contracts it is below the fold.
