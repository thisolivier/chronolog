# Manual-checklist driver (sprint 018-QA)

`qa-driver.mjs` drives the real UI through headless Chromium (Playwright library, not the
Playwright test runner) and walks sections A, C and E of `docs/sprints/sprint-018-QA.md` plus
the auth flows. It registers a fresh `qa-<date>-<runId>@chronolog.test` user, creates a client /
contract / deliverable through `/admin`, two notes, time entries and a timer run, then prints one
`[PASS]`/`[FAIL]` line per checklist item and a summary. It is deliberately not wired into
`package.json`; it is a review tool, not a CI gate.

The review it was written for is `docs/review/2026-11-03-qa-state.md`.

## Running it

```bash
# 1. Dev stack (Postgres + bucket storage; PowerSync is not needed)
docker compose up -d postgres bucket-storage

# 2. Dev server on http://localhost:5173
npm run dev

# 3. From the repo root
node e2e-playwright/manual-checklist/qa-driver.mjs
```

Outputs:

- `test-results/manual-checklist/qa-results.json` — structured results, console errors, page
  errors, failed requests and navigations (`test-results/` is git-ignored).
- `test-results/manual-checklist/screenshots/NN-*.png` — numbered screenshots per step.

Environment overrides: `QA_BASE_URL` (default `http://localhost:5173`), `QA_SHOTS_DIR`,
`QA_RESULTS`.

## Paths adjusted when the driver was moved into the repo

The original ran from a session scratchpad with absolute paths. Three lines changed:

- `import { chromium } from '/Users/olivier/sites/chronolog/node_modules/playwright/index.mjs'`
  is now `import { chromium } from 'playwright'` (resolves from the repo's `node_modules`).
- `SHOTS` was `/Users/olivier/sites/chronolog/docs/review/screenshots`; it now defaults to
  `test-results/manual-checklist/screenshots` relative to the repo root (set `QA_SHOTS_DIR` to
  write into `docs/review/screenshots` again).
- `OUT` was a scratchpad path; it now defaults to `test-results/manual-checklist/qa-results.json`.

Nothing else in the step logic was changed.

## Known driver limitations (false FAILs to expect)

These were identified while triaging the 2026-11-03 run; they are selector/timing problems in
the driver, not product bugs. See the review for the product bugs.

- `E1-edit-time-entry-contract`: `selectByText` reads `<option>`s before `ContractSelect` has
  finished loading them. Wait for `option:nth-child(2)` to be attached first (as the follow-up
  probes did).
- `A4-wiki-link-autocomplete-in-description`: types a shared prefix (`[[INTL.`) and presses
  Enter, which picks the first (most recent) suggestion, so it links the wrong note. Type the full
  ID before pressing Enter.
- `A5-border-updates-on-contract-select` and `A4-card-hierarchy-and-colours`: expect a
  `border-l-<colour>-<n>` class; the app emits `border-<colour>-<n>`. (The computed colour is
  wrong anyway, which is a real bug, but the regex crashes before reporting it.)
- `E1-timer-stop-save`, `E1-delete-time-entry`, `A4-deliverable-shown-on-card`: cascade from the
  timesheet not refreshing after a timer save (real bug). Reload the page before asserting.
- `C2-linked-time-entries-on-note`, `E1-backlinks-displayed`, `E1-wiki-link-click-navigates` and
  the three `C2-*-after-move` steps cascade from earlier failures (wrong note linked; note A not
  under the contract the step clicks).
- The driver leaves its QA user, client, contract and entries in the dev database. Remove
  `qa-*@chronolog.test` users by hand if they accumulate.
