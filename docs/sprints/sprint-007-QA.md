# Sprint 007 — QA: Playwright POC (Tauri UI Testing)

**Status:** signed-off
**Type:** spike / POC
**Backlog items:** QA (Director-dispatched)
**Depends on:** Sprint 006-CL (PWA offline shell — merged)
**Branch:** `sprint-007-QA/playwright-poc`
**Working tree:** `/Users/olivier/sites/chronolog/.claude/worktrees/sprint-007-QA`

## Objectives

Set up `tauri-plugin-playwright` for automated UI testing of the Chronolog Tauri desktop app on
macOS. This is a proof-of-concept sprint — the goal is to get the plugin working in "browser" mode
(headless Chromium with mocked Tauri IPC) and write basic smoke tests. The "tauri" mode (real
WKWebView) will need the user to grant screen recording permissions, so we lay the groundwork
and document the manual setup steps.

After this sprint, we have a working Playwright test setup that can run in CI (browser mode)
and locally against the real Tauri app (tauri mode, pending permissions).

## Tasks

### 1. Install Playwright dependencies

```bash
npm install -D @playwright/test
npx playwright install  # downloads browser binaries
```

Note: `@srsholmes/tauri-playwright` and `tauri-plugin-playwright` (Rust crate) are needed for
"tauri" mode but may not be available or stable. For this POC, start with **standard Playwright
against the SvelteKit dev server** (browser mode only). This tests the web UI layer without
needing the Tauri binary.

If `@srsholmes/tauri-playwright` is available on npm, install it and document the Rust-side
setup steps. If not, document what's needed for future tauri-mode integration.

### 2. Create Playwright configuration

Create `playwright.config.ts` at the project root:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e-playwright',
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
    {
      name: 'webkit',
      use: { browserName: 'webkit' },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
  },
});
```

Key decisions:
- Tests go in `e2e-playwright/` (separate from `src/e2e/` API tests)
- Include both chromium and webkit projects (webkit catches WebKit-specific issues)
- Use `127.0.0.1` not `localhost` (same IPv6 issue as CLI harness)
- `reuseExistingServer: true` — uses existing dev server or Docker app container

### 3. Write auth helper / fixture

Playwright tests need to authenticate. Create a fixture or helper that:
1. Navigates to `/login`
2. Fills email + password for a test user
3. Submits the form
4. Saves the authenticated storage state for reuse across tests

Use Playwright's `storageState` pattern for session persistence.

The test user can be created programmatically (POST to Better Auth signup API) or via
the login page UI. Prefer the UI approach since that's what we're testing.

### 4. Write smoke tests

File: `e2e-playwright/smoke.spec.ts`

Basic smoke tests that verify the app renders and navigation works:
- App loads and shows login page (unauthenticated)
- Can log in with test credentials
- After login: dashboard/time entries page loads
- Navigation: can click to Notes section
- Navigation: can click to Timer section
- Page titles/headings are correct

File: `e2e-playwright/pwa.spec.ts`

PWA verification:
- `manifest.webmanifest` is served and valid JSON
- Manifest has correct `name`, `short_name`, `display: standalone`
- Has valid icon URLs

### 5. Write CRUD smoke tests

File: `e2e-playwright/crud.spec.ts`

Basic CRUD through the UI (not API):
- Create a new note (click button, type content)
- Verify note appears in the list
- Edit the note
- Delete the note
- Verify it's gone

These tests verify the DataService→API→DB pipeline works through the actual UI.

### 6. Add npm script

Add to `package.json`:
```json
"test:playwright": "playwright test",
"test:playwright:ui": "playwright test --ui"
```

### 7. Create documentation

File: `e2e-playwright/readme.md`

Document:
- How to run tests (`npm run test:playwright`)
- Prerequisites (Docker stack for API, dev server running)
- Browser vs Tauri mode explanation
- How to set up tauri-mode later (Rust plugin, permissions)
- How to debug tests (`--ui` mode, traces)

### 8. Verify

- `npm run test:playwright` passes (chromium project at minimum)
- Existing tests unaffected: `npm run test` + `npm run test:e2e`
- `npm run check` passes
- Document any webkit-specific failures (expected — WebKit quirks)

## Contracts

- DataService interface: `docs/contracts/data-service-interface.md`
- Tauri UI testing research: `docs/tauri-ui-testing-research.md`

## Verification

- `npm run test:playwright` passes (at least chromium project)
- `npm run test` passes (unit tests unaffected)
- `npm run test:e2e` passes (API e2e unaffected)
- `npm run check` passes

## Acceptance Criteria

- [x] Playwright installed and configured
- [x] Auth fixture/helper for test user login
- [x] Smoke tests: login, navigation, page rendering
- [x] PWA manifest verification tests
- [x] CRUD smoke test through UI
- [x] `npm run test:playwright` script works
- [x] Documentation for running and extending tests
- [x] Existing tests unaffected
- [x] webkit project results documented (pass/fail/skip)

## Notes

**Docker stack must be running** for the API backend. The dev server connects to containerised
Postgres.

**Test user**: Register a new user via the login page UI or Better Auth API. The `ensureAppUser`
hook will auto-create the "Internal" client and "General" contract.

**WebKit gotcha**: Playwright's WebKit ≠ Tauri's WKWebView. Tests passing in Playwright WebKit
don't guarantee real Tauri behavior. But they catch basic WebKit CSS/JS incompatibilities.

**Tauri mode future work**: When `tauri-plugin-playwright` is integrated:
1. Add `tauri-plugin-playwright` to `src-tauri/Cargo.toml` behind `e2e-testing` feature flag
2. Register plugin in `src-tauri/lib.rs` with `#[cfg(feature = "e2e-testing")]`
3. Install `@srsholmes/tauri-playwright`
4. Add `tauri` project to playwright.config.ts
5. Run with `cargo tauri dev --features e2e-testing` + `npx playwright test --project=tauri`

**Screen recording permission**: The "tauri" mode socket bridge doesn't need accessibility
permissions for basic testing. Screen recording permission is only needed for screenshots/video.
The user will need to grant this manually in System Settings.

**Use `localhost`** for Playwright base URL — Better Auth validates the origin header against
`BETTER_AUTH_URL` (set to `http://localhost:5173` in Docker Compose), so `127.0.0.1` causes
"Invalid origin" errors during sign-up/sign-in. This differs from the CLI harness which uses
`127.0.0.1` because it doesn't go through Better Auth's origin validation.

## Sign-Off

**Date:** 2026-05-26
**Commit:** `795b9d7` on branch `sprint-007-QA/playwright-poc`

### Results

| Suite | Tests | Status |
|---|---|---|
| Playwright (chromium) | 14 | All pass |
| Playwright (webkit) | 13 | All pass |
| Playwright total | 27 | All pass (15s) |
| Unit tests | 269 | All pass (unaffected) |
| API e2e tests | 32 | All pass (unaffected) |
| svelte-check | 1 error (pre-existing jose type issue) | Unaffected |

### Files Created

| File | Purpose |
|---|---|
| `playwright.config.ts` | Playwright config with 3 projects (auth-setup, chromium, webkit) |
| `e2e-playwright/auth.setup.ts` | Auth fixture: registers test user via UI, saves storage state |
| `e2e-playwright/smoke.spec.ts` | 10 tests: unauthenticated pages, authenticated navigation |
| `e2e-playwright/pwa.spec.ts` | 3 tests: manifest config validation, icon file existence |
| `e2e-playwright/crud.spec.ts` | 1 test: full note create/read/edit/delete through UI |
| `e2e-playwright/readme.md` | Documentation: setup, running, debugging, architecture |
| `e2e-playwright/.auth/` | Storage state directory (gitignored) |

### Key Decisions

1. **`localhost` not `127.0.0.1`**: Better Auth origin validation requires matching the `BETTER_AUTH_URL` env var
2. **PWA manifest tests verify config, not HTTP**: In dev mode, `@vite-pwa/sveltekit` does not serve `manifest.webmanifest` (requires build). Tests verify vite.config.ts manifest fields and that icon files exist on disk
3. **Auth setup uses project dependencies**: Single auth-setup project runs first, chromium/webkit projects depend on it and automatically get the storage state
4. **`@srsholmes/tauri-playwright` documented but not installed**: Available on npm (v0.2.2). Tauri-mode integration steps documented in readme.md for future sprint
5. **WebKit passes fully**: All 13 webkit tests pass with no WebKit-specific issues detected
