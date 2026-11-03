# Manual-checklist driver (sprint 018-QA)

`qa-driver.mjs` drives the real UI through headless Chromium (Playwright library, not the
Playwright test runner) and walks sections A, C and E of `docs/sprints/sprint-018-QA.md` plus
the auth flows, the cross-sprint integration seams added after 019/020/021-CL, and one mobile
(375px) pass. It registers a fresh `qa-<date>-<runId>@chronolog.test` user, creates a client /
contract / deliverable through `/admin`, two notes, time entries and a timer run, then prints one
`[PASS]`/`[FAIL]` line per checklist item and a summary. It is deliberately not wired into
`package.json`; it is a review tool, not a CI gate.

The review it was written for is `docs/review/2026-11-03-qa-state.md`; it was brought up to date
with the merged 019/020/021-CL sprints for `docs/review/2026-11-03-integration-qa.md`.

## Running it

```bash
# 1. Dev stack (Postgres)
docker compose up -d postgres

# 2. Dev server on http://localhost:5173 (registration must be open; Better Auth only trusts
#    its base URL, so export BETTER_AUTH_URL when using another port)
ALLOW_REGISTRATION=true npm run dev
# e.g. ALLOW_REGISTRATION=true BETTER_AUTH_URL=http://localhost:5196 npm run dev -- --port 5196

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

`import { chromium } from 'playwright'` resolves from the repo's `node_modules`; `SHOTS` defaults to
`test-results/manual-checklist/screenshots` (set `QA_SHOTS_DIR` to write into
`docs/review/screenshots`); `OUT` defaults to `test-results/manual-checklist/qa-results.json`.

## Flows the driver assumes (updated for 019/020/021-CL)

- **Registration lands signed in.** `AUTH-register` waits for `/` (Better Auth auto sign-in plus
  the `/login` redirect for authenticated users). `AUTH-login-page-when-authenticated` asserts that
  redirect. `AUTH-login-redirect` clears cookies first to get the login form back.
- **`AUTH-native-submit-race`** runs in its own unauthenticated context and delays every script
  request (dev mode serves `/src`, `/@fs`, `/node_modules/.vite`, not `/_app`), so the click
  reliably lands before hydration.
- **New entry row** has Contract, Deliverable and (when the deliverable has work types) Work type
  selects. Fields are located by their `<label>` (`newEntryField('Contract')`), not "the select".
  The Deliverable select must be disabled until a contract is picked, and the deliverable chosen in
  the row must show on the saved card.
- **`selectByText`** polls until an enabled `<option>` with the text exists (contract and
  deliverable options are fetched after mount).
- **Sidebar contract buttons** are scoped to panel 1 (`sidebarContract(/General/)`): a time card's
  "Internal / General" contract button also matches `/General/`.
- **Wiki-link autocomplete** (editor and description) types the full note id. The editor step also
  asserts the inserted node's `data-note-id`. The description step records a FAIL when Enter picks the
  wrong note, then corrects the description so the later seams still run.
- **Move feedback** is `[data-testid="move-feedback"]` in the note list panel and must read
  "Moved to Acme Corp / Rocket Build".
- **Timer completion** must offer `#deliverable-select` (it renders once the contract's
  deliverables load). The saved card must appear without a reload (the `time-entry-saved` event).
- **Integration steps:** `A4-card-wiki-link-click-opens-note` (card link → notes mode → right
  note), `C2-card-wiki-link-after-move` (card link resolves the note's new contract),
  `A5-new-entry-row-deliverable`, and `M1-mobile-topbar-and-timesheet` (375px: Chronolog/Back top bar
  at y=0, sticky WeekStrip under it, 7 columns fit, no horizontal overflow, Back returns to level 0).

## Known limitations

- Running the dev server from the main checkout while another session works in
  `.claude/worktrees/*` makes Vite force full reloads mid-run, because it watches those
  `.svelte-kit/tsconfig.json` files. Each reload also leaks a Postgres pool (see the integration
  review), which can eventually exhaust `max_connections` and turn every request into a 500. If a run
  dies with steps timing out on `Time Entries`, check the dev log for `changed tsconfig` /
  `too many clients` and rerun.
- `E1-export-pdf-print` stubs `window.print`; the print dialog is not verifiable headless.
- The driver leaves its QA user, client, contract and entries in the dev database. Remove
  `qa-*@chronolog.test` users by hand if they accumulate.
