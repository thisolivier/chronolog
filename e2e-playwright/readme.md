# Playwright E2E Tests

Automated UI tests for Chronolog using Playwright. These tests exercise the full web UI layer
against the running SvelteKit dev server.

## Quick Start

```bash
# Ensure the Docker stack is running (Postgres, etc.)
docker compose up -d

# Ensure the dev server is running
npm run dev

# Run all Playwright tests (chromium + webkit)
npm run test:playwright

# Run only chromium tests (faster)
npm run test:playwright:chromium

# Open the interactive Playwright UI
npm run test:playwright:ui
```

## Prerequisites

- **Docker stack running** — the app needs Postgres and the auth backend
- **Dev server running** at `http://127.0.0.1:5173` (or it will be started automatically)
- **Playwright browsers installed** — run `npx playwright install` after first checkout

> Use `127.0.0.1` not `localhost` — there is an IPv6 Docker routing issue on macOS.

## Architecture

### Test Files

| File | Description |
|---|---|
| `auth.setup.ts` | Registers a test user and saves authenticated storage state |
| `smoke.spec.ts` | Basic app rendering, login page, navigation between sections |
| `pwa.spec.ts` | PWA manifest verification (JSON validity, fields, icon URLs) |
| `crud.spec.ts` | Full note CRUD through the UI (create, read, edit, delete) |
| `offline-behavior.spec.ts` | Service worker and offline navigation behaviour |
| `offline-outbox.spec.ts` | Sprint 045-CL (own `qa-045` user per test, `serviceWorkers: 'allow'` in Chromium): a note edit and a new time entry made offline are counted in the banner, survive a reload with no server (Chromium: offline, page from the service worker; WebKit: API refused, since Playwright's WebKit cannot load any page while emulated offline), replay on reconnect with a "replayed" marker; a note changed meanwhile from a second browser context is held and "Keep mine" resolves it; a note created offline gets its real ID (URL follows) and the editor keeps saving with no conflict; an entry conflict is held and "Keep the server's" drops mine; an entry whose create answer was lost (route fetches then aborts) is made once and keeps the edit made afterwards. Screenshots `sprint-045`. |
| `navigation-journeys.spec.ts` | Sprint 027-CL journeys 1, 2, 7, 8 and 10 of `docs/review/2026-11-03-ux-journeys.md`: URL state, reload, Back and the sidebar/list/editor agreeing on client and contract. Its tests run in order in one worker (`test.describe.configure({ mode: 'default' })` opts the file out of `fullyParallel`), because parallel API note creates under one user can collide on note IDs. |
| `cli-admin-objects.spec.ts` | Sprint 031-CL: the `chronolog` CLI (child process, token created in the page) builds client → contract → deliverable → work type; clicking Settings → Clients → client → contract shows them, and Back to app shows the contract in the sidebar, with no full page reload. |
| `timer-start-today.spec.ts` | Sprint 041-CL: editing a running timer's start (elapsed clock follows, overlap "Save anyway", future refused, Escape restores, the saved entry measures from the new start; a no-contract timer's start in localStorage then on the server; `qa-041-pw-*` user per timer test), the week header's Today button, and Archive / Activate rows in Settings. Screenshots to `docs/review/screenshots/sprint-041/` (chromium). |
| `timesheet-polish.spec.ts` | Sprint 030-CL: a contract change clears deliverable and work type visibly and saves the same (P-05); focus after saving an entry, cancelling the new-entry row and following a card's wiki-link (A-11, asserted on `document.activeElement`); the timer and week header agree on "today" for a Europe/London browser at 23:30 GMT and 00:30 BST (fake clock, a `qa-030-tz-*` user per test because the timer is per user). |
| `sidebar-archive-collapse.spec.ts` | Sprint 033-CL: single-contract clients are one row and expand back to heading plus children with a second contract; archiving and restoring a client and a contract in Settings moves them in and out of the sidebar's Archived item with no reload; landing on a single-contract note by URL and following a timesheet wiki-link to a note on an archived contract highlight the right row (Archived expands); the Archived toggle's `aria-expanded`, keyboard use, remembered state and the 390 px sidebar. Runs in order in one worker. |
| `task-lists.spec.ts` | Sprint 040-CL: a task list typed in the editor (`[ ] ` in a bullet item, Enter, Tab / Shift-Tab nesting, the toolbar button), two boxes ticked, saved as `- [x]`, still ticked after a reload; the PDF export prints ☐ / ☑ (chromium); unticking saves. A note created by the CLI as markdown opens with checkboxes beside a plain bullet; `chronolog todos` lists its open items and drops one ticked in the browser. Screenshots go to `docs/review/screenshots/sprint-040/`. |
| `sidebar-client-view.spec.ts` | Sprint 039-CL: pin a note from its row (top of the list, survives a reload, unpin by keyboard); the client view from a client's name (both contracts' notes with contract labels, pinned first, a note opens inside it, reload, Back, Forward, New Note asks for the contract); the chevron collapses a client and the choice survives a reload (single-contract clients have none); Alt+Arrow and drag reorder clients and the order survives a reload. Screenshots go to `docs/review/screenshots/sprint-039/`. |
| `note-trash.spec.ts` | Sprint 037-CL: Delete in the editor moves a note to the trash; the list and the sidebar count drop, the "Moved to trash. Undo" toast restores it (same ID, list and count back); deleted again, a wiki-link to it in another note is muted "deleted" and its inline Restore brings it back and opens it. Screenshots go to `docs/review/screenshots/sprint-037/`. |
| `notes-followups.spec.ts` | Sprint 043-CL: the trash page (sidebar Trash link, `/notes/trash`, days left, reload, Restore then Open); previews and titles show attachment-link filenames and wiki-links as the target's title or label, and a browser save keeps that title; a link to a deleted attachment is styled missing and opens no tab; on a phone the Undo toast works after the editor panel has unmounted; linked time entries stay on one line at 320 px and, in landscape 844×390, the linked panels start collapsed with the editor at least half the height; toolbar Bold disables in a code block and re-enables. Screenshots go to `docs/review/screenshots/sprint-043/`. |
| `search.spec.ts` | Sprint 042-CL: global search from the shell (Cmd/Ctrl+K, Enter to `/search?q=`, one list of hits since 046, arrow keys, a note hit and an entry hit open in the workspace, Back and reload keep the results; the phone header link), and find in page (Cmd/Ctrl+F) in a note (count, Enter/Shift+Enter, Escape clears, note not edited) and on a week (not from the sidebar). Screenshots go to `docs/review/screenshots/sprint-042/`. |
| `search-results-layout.spec.ts` | Sprint 046-CL: `/search` interleaves notes and time entries newest first, type icons labelled "Note" / "Time entry", client / contract on every hit, arrow keys walk the list; desktop icon column, phone (320 and 390 px) icon on the client/contract line with no sideways scroll; hits open their note or week. Screenshots go to `docs/review/screenshots/sprint-046/`. |
| `client-colours.spec.ts` | Sprint 044-CL (own user): two active clients sharing a colour show the hint in Settings → Clients; the New client form suggests the first unused colour and the created client has it; the API default is the next unused one; archiving one of the pair removes the hint. Screenshot `sprint-044`. |
| `two-factor-login.spec.ts` | Sprint 044-CL: a fresh user (own context) registers (the client-side move /register → /login → / must not throw "Navigation context not found"), enables TOTP in Settings with a code computed in the test (RFC 6238, HMAC-SHA1 via `node:crypto`; the helper is checked against the RFC test vector), signs out, signs in with the password, a wrong code is refused, a fresh code lands in the app. Screenshots `sprint-044`. |
| `iphone-journeys.spec.ts` | Sprint 047-QA, tagged `@iphone` (desktop projects skip it; own user per test): sign-in and the week (add in the modal, edit, delete with touch-sized × and Yes), timer start/stop/discard, notes (pin, toolbar, wiki-link list and Move menu inside the screen, Find from the title bar, delete and Undo), Settings → Clients stacked with actions in view (Archive / Activate, inline edit), 2FA and token pages, sidebar rows and client view, search from the title bar, the offline banner; landscape (iPhone 15 only): week strip scrolls away, a tall modal scrolls. Every screen: no sideways scroll, no field under 16 px, 44×44 targets. Helpers in `iphone-helpers.ts`. Screenshots `sprint-047`, named after the device project. |
| `work-type-consistency.spec.ts` | Sprint 032-CL: changing the deliverable resets the work type picker to none in the card editor and the add-entry row, and the saved entry matches; an API `work_type_mismatch` message shows in the card's error line. |
| `attach-note-sidebar.spec.ts` | Sprint 049-UI, desktop 1280 and phone 390 (touch) in each browser, own `qa-049` user per test: a card's Attach note (double clicked) makes one note on the entry's contract, the description ends with ` [[NOTE_ID]]`, the note opens with the editor focused and lists the entry under Linked Time Entries, and the card then shows the link under the note's title; with the description editor open the typed text gets the link; the sidebar `+` lines up with the client chevrons (right edge, box size, also at 320 px), the chevron still collapses by keyboard, and `+` opens New Contract and creates one. Screenshots `sprint-049`. |

### Project Configuration

The `playwright.config.ts` defines these projects:

1. **auth-setup** — Runs first. Registers a test user via the UI and saves cookies to
   `e2e-playwright/.auth/user.json`.
2. **chromium** — Runs all spec files with authenticated state, using Chromium.
3. **webkit** — Same tests, using WebKit. Catches WebKit-specific CSS/JS issues.
4. **iphone-se**, **iphone-15**, **iphone-15-pro-max** (sprint 047-QA) — WebKit with Playwright's
   `iPhone SE (3rd gen)`, `iPhone 15` and `iPhone 15 Pro Max` descriptors (viewport, touch, mobile
   user agent). They run only tests tagged `@iphone` by default; `PLAYWRIGHT_IPHONE_ALL=1` runs the
   whole suite on them (`PLAYWRIGHT_IPHONE_ALL=1 npx playwright test --project=iphone-15`).
   An `@iphone` test skips itself on desktop projects (`test.skip(({ isMobile }) => !isMobile)`).

Every browser project depends on `auth-setup`, so authentication runs once and is
shared across all browser projects.

### Screenshots for sprint reviews

Specs that take review screenshots get their folder from `sprintScreenshotDirectory('sprint-0NN')`
(`sprint-screenshots.ts`). By default it is `test-results/sprint-screenshots/sprint-0NN/`, so a full
run no longer rewrites every sprint's committed images. To refresh a sprint's images in
`docs/review/screenshots/sprint-0NN/`, run its spec with `UPDATE_SPRINT_SCREENSHOTS=1`:

```bash
UPDATE_SPRINT_SCREENSHOTS=1 npx playwright test e2e-playwright/two-factor-login.spec.ts --project=chromium
```

### Tests that need their own user

Every spec shares one user, and chromium and webkit run at the same time. A test that changes
state the whole user sees (the client order, cards on a given day) can be upset by the same test in
the other browser. Such a test calls `signInAsFreshUser(page, baseURL, label)` (`fresh-user.ts`)
first; it signs the context up as a new user (`$E2E_USER_PREFIX-<label>-…`). Used by the two
client-reorder tests, journey J2 and the client colour test (044-CL), which were flaky in WebKit for this reason and
because they reloaded while a save was still in flight; they now wait for the server state.

### Auth Pattern

The auth setup registers a fresh user with a timestamped email each run, so tests
don't depend on pre-existing database state. The `ensureAppUser` server hook
auto-creates the "Internal" client and "General" contract for new users.

The authenticated storage state (cookies) is saved to `e2e-playwright/.auth/user.json`
and loaded by all test projects automatically.

## Browser Mode vs Tauri Mode

Currently, tests run in **browser mode** — headless Chromium/WebKit against the SvelteKit
dev server. This tests the web UI layer but not the native Tauri shell.

### Future: Tauri Mode

When `tauri-plugin-playwright` is integrated, tests can run against the real WKWebView:

1. Add `tauri-plugin-playwright` to `src-tauri/Cargo.toml` behind `e2e-testing` feature flag
2. Register plugin in `src-tauri/lib.rs` with `#[cfg(feature = "e2e-testing")]`
3. Install `@srsholmes/tauri-playwright` (available on npm as v0.2.2)
4. Add a `tauri` project to `playwright.config.ts`
5. Run: `cargo tauri dev --features e2e-testing` + `npx playwright test --project=tauri`

The socket bridge used by the plugin does NOT require macOS accessibility permissions.
Screen recording permission is only needed for screenshots/video capture.

### WebKit Caveat

Playwright's WebKit build is **not** the same as macOS WKWebView. Tests passing in
Playwright WebKit do not guarantee identical behavior in the real Tauri app. However,
they do catch basic WebKit CSS and JavaScript incompatibilities.

## Debugging

```bash
# Run with visible browser (headed mode)
npx playwright test --headed

# Run a specific test file
npx playwright test smoke.spec.ts

# Run with debug inspector
npx playwright test --debug

# View the HTML test report
npx playwright show-report

# View traces from failed retries
# (traces are saved on first retry — see playwright.config.ts)
```

## Relationship to Other Test Suites

| Suite | Command | What it Tests |
|---|---|---|
| Unit tests | `npm run test` | Vitest unit tests in `src/` |
| API E2E | `npm run test:e2e` | CLI-driven API endpoint tests in `src/e2e/` |
| **Playwright E2E** | `npm run test:playwright` | **UI tests in `e2e-playwright/`** |

All three suites are independent and can run in parallel. None shares test state.
