# Manual-checklist driver (sprint 018-QA)

`qa-driver.mjs` drives the real UI through headless Chromium (Playwright library, not the
Playwright test runner) and walks sections A, C and E of `docs/sprints/sprint-018-QA.md` plus
the auth flows, the cross-sprint integration seams added after 019/020/021-CL and 024/025/026-CL,
two phone (375px) passes and one tablet (900px) pass. It registers a fresh
`<prefix>-<runId>@chronolog.test` user, creates a client / contract / deliverable through `/admin`,
two notes, time entries and a timer run, then prints one
`[PASS]`/`[FAIL]` line per checklist item and a summary. It is deliberately not wired into
`package.json`; it is a review tool, not a CI gate.

The review it was written for is `docs/review/2026-11-03-qa-state.md`; it was brought up to date
with the merged 019/020/021-CL sprints for `docs/review/2026-11-03-integration-qa.md`, and with the
merged 024/025/026-CL sprints for `docs/review/2026-11-03-integration-qa-2.md`.

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
`QA_RESULTS`, `QA_USER_PREFIX` (default `qa-20261103`; e.g. `qa-int2` registers `qa-int2-<runId>@chronolog.test`).

Every console error, page error and failed request in the JSON is prefixed with the step that was
running (`[E1-create-note] GET … :: net::ERR_ABORTED`; `[after X]` = between steps), so each one can
be traced to a driver action.

## Paths adjusted when the driver was moved into the repo

`import { chromium } from 'playwright'` resolves from the repo's `node_modules`; `SHOTS` defaults to
`test-results/manual-checklist/screenshots` (set `QA_SHOTS_DIR` to write into
`docs/review/screenshots`); `OUT` defaults to `test-results/manual-checklist/qa-results.json`.

## Flows the driver assumes (updated for 024/025/026-CL; sidebar for 033/039-CL)

Selectors are DOM-based (test ids, roles, labels) rather than URL-based, because 027-CL changes the
URLs. The admin seam reaches `/admin/clients` through the sidebar "Settings" link and the "Clients
and contracts" card, and returns with "Back to app"; only the initial setup still uses `page.goto`.

- **Sidebar is grouped by client (026, reshaped by 033 and 039).** Panel 1 is
  `[data-testid="app-sidebar"]`; each active client is a `[data-testid="sidebar-client-group"]`
  (aria-label = client name), in the owner's manual order (039). A client with **two or more** active
  contracts has a heading (collapse chevron, colour dot, client name; the name opens the client view
  `/notes/client/<id>`) and the contract buttons under it. A client with **one** active contract is a
  single row, `[data-testid="sidebar-single-contract-row"]`: colour dot, contract name, and the client
  name beneath it (`[data-testid="sidebar-row-client-name"]`), so its dot is inside the row, not in a
  heading (033). Either way contract buttons carry `data-contract-id`, their accessible name starts with
  the contract name, and an optional `[data-testid="sidebar-note-count"]` badge. Archived clients and
  contracts sit under the collapsed **Archived** toggle at the bottom
  (`[data-testid="sidebar-archived-section"]`, groups `sidebar-archived-client-group`), never in the
  active list. `A10` asserts distinct client colours and Rocket Build under Acme Corp;
  `sidebarDots[contract]` is the contract's client colour (from the heading or the single row), compared
  against card borders and card dots. `expectNoteCount()` polls the badge (refreshed 150 ms after
  `notes-changed`), asserted after create, second create, move and delete.
- **New Note is a draft (024).** The header (`[data-testid="note-editor-header"]`) reads "New note" with a
  Discard button and no `POST /api/notes` is sent until the first keystroke; `waitForSavedNoteId()` then
  waits for the real ID. `currentNoteId()` reads the header, not a global `span.font-mono`.
- **Wiki-links render titles (024).** Editor chips (`.tiptap .wiki-link`) keep `data-note-id` and show the
  target's title; card links are `.wiki-link-rendered button[title="<id>"]` showing the title;
  "Linked from" chips are `[data-testid="note-backlinks"] button[title="<id>"]` showing the source title.
  An empty `[[` must list the other note and never the current one.
- **PDF export (024)** prints a hidden `iframe[data-note-print-frame]`; the driver stubs that frame's
  `print()` through a MutationObserver and asserts the app window itself is not printed.
- **Move (024 B-02):** the moved note stays open and the sidebar and list follow it to the destination.
- **Note delete (024)** is an inline confirm (`[data-testid="delete-confirm"]`), never a native dialog.
- **Admin delete (026)** opens `[data-testid="delete-impact-dialog"]`; `SEAM-admin-delete-dialog-counts`
  checks the counts against the sidebar's note count for the moved note, Archive focus, and Cancel.
- **Timer completion (025)** uses the shared DurationField: `#timer-time` is adjusted to `0.75`, the
  preview `#timer-time-message` must read "= 45m" and the saved card must show 45m.
- **Offline (026):** "server unreachable" is simulated with `page.route('**/api/**', abort)`, not
  `context.setOffline` (which would also cut Vite's HMR socket and could trigger a full reload).
  `SEAM-offline-banner-on-request-failure` expects the offline banner; `SEAM-offline-read-cache-after-note-save`
  expects a note opened from the read cache to contain what was saved before the outage.
- **Phone footer (025)** and **tablet overlay (026):** `M2-mobile-footer-actions` (Start Timer / Add Entry at the
  bottom of a 375px viewport, Add Entry modal fits) and `T1-tablet-notes-sidebar-overlay` (900px: notes
  mode hides the sidebar, ≡ opens a 240px overlay, picking a contract closes it).

### Earlier flows (019/020/021-CL), still asserted

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

- Failed requests with `net::ERR_ABORTED` under `[AUTH-register]` (the register page's move via
  `/login` → `/`, a client-side redirect since 044-CL; it was a full reload before), `[AUTH-login-redirect]` (the driver clears cookies and navigates while the
  app is still loading) or after a `page.reload()` are in-flight loads cancelled by navigation, not app
  errors. Their number varies per run with timing. The `ERR_INTERNET_DISCONNECTED` entries under the two
  `SEAM-offline-*` steps are the driver's own simulated outage.
- Running the dev server from the main checkout while another session works in `.claude/worktrees/*`
  used to force full reloads mid-run and leak Postgres pools; 026-CL fixed both (`vite.config.ts` ignores
  `<root>/.claude/**`, the client is cached on `globalThis`). If a run dies with steps timing out on
  `Time Entries`, still check the dev log for `changed tsconfig` / `too many clients`.
- `E1-export-pdf-print` stubs the print frame's `print()`; the native print dialog is not verifiable headless.
- After a reload the app opens in Time Entries (selection is in memory only); `E1-edit-note-tiptap-autosave`
  re-opens the note through the sidebar. 027-CL (navigation/URLs) is expected to change this.
- The driver leaves its QA user, clients, contracts, notes and entries in the dev database. Remove
  `qa-*@chronolog.test` users by hand if they accumulate.
