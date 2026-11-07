# Sprint 061-DR — Week numbering: ISO 8601 after all

**Status:** ready for review · branch `design-r1-iso-weeks` (from `main` at v1.5.0, fa03b84) ·
decision `docs/decisions.md` 2026-11-07 "Week numbering: ISO 8601 after all" · resolves the backlog
entry "revisit week numbering before 28 December".

## Rule

ISO 8601 everywhere: weeks start Monday, week 1 contains the year's first Thursday (the week of
4 January), a week belongs to the year of its Thursday, a year has 52 or 53 weeks. The Monday date
(`weekStart`) stays the week's identity (057-DR). v1.5.0's calendar-year rule agreed with ISO for every
week up to 21–27 Dec 2026, so nothing in production diverged.

**Note on the brief:** 2026 has **53** ISO weeks (1 Jan 2026 was a Thursday), so `2026-W53`
(28 Dec 2026 – 3 Jan 2027) is valid, as the fixture 2026-12-28 → 2026-W53 requires. Years without a
W53 used in tests: 2025, 2027, 2023. `2020-W53` is valid.

## What changed

- **One helper** `src/lib/utils/iso-week.ts` (`calendar-week.ts` deleted): `isoWeekOf`,
  `isoWeekNumber`, `isoWeekKey`, `parseIsoWeekKey`, `mondayOfIsoWeek`, `isoWeeksInYear`, `shiftWeek`,
  `mondayOnOrBefore` (UTC arithmetic), alongside the existing week-date formatters.
- **Shared fixtures** `src/lib/utils/iso-week.fixtures.json`, read by `iso-week-rule.test.ts` and the
  CLI's `cli/lib/cli-lib.test.mjs` (same file). Cross-checked against Python's `isocalendar()`:

  | Date | ISO week | Monday |
  | --- | --- | --- |
  | 2026-12-28 | 2026-W53 | 2026-12-28 |
  | 2027-01-01 | 2026-W53 | 2026-12-28 |
  | 2027-01-04 | 2027-W01 | 2027-01-04 |
  | 2025-12-29 | 2026-W01 | 2025-12-29 |
  | 2024-12-30 | 2025-W01 | 2024-12-30 |
  | 2028-01-01 (Sat) | 2027-W52 | 2027-12-27 |
  | 2033-01-01 (Sat) | 2032-W53 | 2032-12-27 |
  | 2029-01-01 (Mon) | 2029-W01 | 2029-01-01 |
  | 2034-01-01 (Sun) | 2033-W52 | 2033-12-26 |

  plus 2026-11-07 → W45, 2026-12-27 → W52, 2021-01-03 and 2020-12-31 → 2020-W53, and weeks per year
  (2020: 53, 2023–2025: 52, 2026: 53, 2027–2028: 52, 2032: 53, 2033: 52, 2099: 53).
- **Labels**: week strip heading, ‹ › titles (from the helper, so 2026 Week 52 → 53 → 2027 Week 1;
  057's wrap-at-52 fix kept), page title, phone titles.
- **`/time/YYYY-Www`**: ISO keys; W53 matches only in 53-week years (`/time/2025-W53` is a 404); the
  2000–2099 guard kept. `legacyIsoWeekRedirect` deleted: ISO keys are canonical again, and every
  calendar-year URL v1.5.0 produced for weeks up to 2026-W52 is the same ISO URL. (A v1.5.0 URL for a
  later week, e.g. its `2027-W01`, now means ISO 2027-W01; nobody could have bookmarked one with data
  in it before today's switch, and the week strip makes it one click.)
- **`GET /api/me`**: `week` and `isoWeek` both ISO, same value.
- **Weekly statuses** (`weekly-statuses.ts`, `week-input.ts`): read and written by Monday; the
  duplicate-Monday guard kept. The renumber step is kept because the table's unique key is still
  `(user_id, year, week_number)` and migrations are out of scope: a v1.5.0 client could still write
  28 Dec 2026 as `(2027, 1)`, which would collide with ISO 2027-W01 (4 Jan). It now renumbers to ISO,
  reads the user's rows once per status write and updates only rows that differ: a no-op for every row
  stored today (idempotency tested). The dev DB holds 5 such `(2027, 1)` rows for 2026-12-28 from 057's
  e2e test users; they are fixed on those users' next write.
- **CLI** `cli/lib/dates.mjs`: ISO week 1 (Monday on or before 4 January); `week`, `status`, `me`
  messages say ISO 8601. `2026-W53` and `2020-W53` parse; `2025-W53` is refused.
- Kept from 057: Monday as identity, the Submitted hint ("a record only; nothing is sent"), the failed
  status-save error under the status.

## Tests (verbatim)

- `npm run check`: `svelte-check found 0 errors and 0 warnings`
- `npm run lint`: clean (exit 0)
- `npm test`: `Test Files  138 passed (138)` · `Tests  1348 passed (1348)` (includes the CLI's `cli-lib.test.mjs`, 22 tests)
- `E2E_BASE_URL=http://localhost:5192 BETTER_AUTH_URL=http://localhost:5192 npm run test:e2e`: `Test Files  24 passed (24)` · `Tests  151 passed (151)`
- `npx playwright test e2e-playwright/time-review.spec.ts e2e-playwright/timesheet-polish.spec.ts --project=chromium`: `1 skipped` · `13 passed (15.8s)`
- `PLAYWRIGHT_BASE_URL=http://localhost:5192 npx playwright test --project=chromium`: `14 skipped` · `151 passed (1.6m)`

Updated tests: `iso-week-rule.test.ts` (replaces `calendar-week.test.ts`; round trip of every week
2020–2034), `week-labels.test.ts`, `local-calendar.test.ts`, `navigation-routes.test.ts`,
`week-input.test.ts`, `api-hardening.test.ts`, DB-backed `weekly-statuses.test.ts` (v1.5.0-numbered
rows read by Monday; writing ISO 2027-W02 renumbers a colliding `(2027, 2)` row; second pass is a
no-op; W53 only in 53-week years), `cli-lib.test.mjs`, API e2e year-boundary status test,
Playwright `time-review.spec.ts` year boundary (2026-W53 heading, ‹ › titles 52 / 1 and 53, paging
to 2027-W01 and back, `/time/2025-W53` 404).

## Review hardening

- The web client posts a week status as `{ weekStart, status }` (`DataService.updateWeeklyStatus(weekStart,
  status)`), never a year and week number, so a client can't number a week differently from the server.
  The server already prefers `weekStart` when both are sent; `{ year, weekNumber }` (ISO) stays accepted for
  the CLI. Weekly status is not queued offline (SPEC "Not queued"), so the outbox has no replay path for it.
- A cached v1.5.0 bundle still sends `{ year, weekNumber }` by its rule; from 28 Dec 2026 it would file
  "2027 Week 1" under ISO 2027-W01. Bundles update on reload (service worker update notice) long before then.
- API e2e: `weekStart` only stores by that Monday; `weekStart` wins over a conflicting `(2027, 1)`.
- `npm run check` 0/0 · lint exit 0 · `npm test` `Tests  1348 passed (1348)` · `npm run test:e2e`
  `Tests  152 passed (152)` · `time-review.spec.ts` chromium `1 skipped` · `7 passed (15.2s)`.

## Docs

`docs/decisions.md` (new entry), `docs/backlog.md` (entry resolved), `docs/SPEC.md` (weekly status
fields), `cli/CHANGELOG.md` (Unreleased entry; 1.5.0 note marked superseded; the "update before
28 Dec" warning withdrawn), `src/lib/utils/README.md`, `src/lib/stores/README.md`,
`src/lib/components/weekly/readme.md`, `cli/readme.md`, sprint index, 057-DR note.

## Follow-ups

- Release: the CLI's Unreleased entry goes out with the next version bump; until then a laptop on
  1.5.0 computes calendar-year weeks, which only matters from 28 Dec 2026.
- Optional later migration (not done here): drop the `(user_id, year, week_number)` unique key in
  favour of `(user_id, week_start)` and delete the renumber step.
