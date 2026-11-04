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
| `navigation-journeys.spec.ts` | Sprint 027-CL journeys 1, 2, 7, 8 and 10 of `docs/review/2026-11-03-ux-journeys.md`: URL state, reload, Back and the sidebar/list/editor agreeing on client and contract. Its tests run in order in one worker (`test.describe.configure({ mode: 'default' })` opts the file out of `fullyParallel`), because parallel API note creates under one user can collide on note IDs. |
| `cli-admin-objects.spec.ts` | Sprint 031-CL: the `chronolog` CLI (child process, token created in the page) builds client → contract → deliverable → work type; clicking Settings → Clients → client → contract shows them, and Back to app shows the contract in the sidebar, with no full page reload. |
| `timesheet-polish.spec.ts` | Sprint 030-CL: a contract change clears deliverable and work type visibly and saves the same (P-05); focus after saving an entry, cancelling the new-entry row and following a card's wiki-link (A-11, asserted on `document.activeElement`); the timer and week header agree on "today" for a Europe/London browser at 23:30 GMT and 00:30 BST (fake clock, a `qa-030-tz-*` user per test because the timer is per user). |
| `work-type-consistency.spec.ts` | Sprint 032-CL: changing the deliverable resets the work type picker to none in the card editor and the add-entry row, and the saved entry matches; an API `work_type_mismatch` message shows in the card's error line. |

### Project Configuration

The `playwright.config.ts` defines three projects:

1. **auth-setup** — Runs first. Registers a test user via the UI and saves cookies to
   `e2e-playwright/.auth/user.json`.
2. **chromium** — Runs all spec files with authenticated state, using Chromium.
3. **webkit** — Same tests, using WebKit. Catches WebKit-specific CSS/JS issues.

Both chromium and webkit depend on `auth-setup`, so authentication runs once and is
shared across all browser projects.

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
