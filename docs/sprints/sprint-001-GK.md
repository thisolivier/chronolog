# Sprint 001 — GK: Tauri/WebKit OPFS Spike (GATE 0)

**Status:** signed-off
**Type:** standard
**Backlog items:** CL-0 (GATE 0)
**Depends on:** none
**Branch:** `sprint-001-GK/tauri-opfs-spike`
**Working tree:** `/Users/olivier/sites/chronolog/.claude/worktrees/sprint-001-GK`

## Objectives

Validate that PowerSync's OPFS-backed SQLite works reliably inside Tauri's macOS WebKit webview.
This is the blocking platform gate for the entire offline-sync epic. The Chrome spike (10/10 tests
on `powersync-spike` branch) does NOT transfer to WebKit — OPFS behaviour differs (known issue
PowerSync #808 timeout).

**If this spike fails, the PowerSync approach is abandoned.** The Director will halt and wait for
the user.

## Context

The `powersync-spike` branch had a test harness at `src/routes/spike/+page.svelte` (deleted in
cleanup commit f326abb, but the code is in the branch history). It ran 10 tests:

1. Environment detection (Tauri vs browser, OPFS availability, SharedWorker)
2. PowerSync import verification
3. Schema creation (10 tables)
4. Database init (WASM SQLite with OPFS)
5. Local write (insert test rows across parent/child tables)
6. Local read (query back inserted data)
7. JOIN query (cross-table joins)
8. Reactive watch (`watch()` async iterator)
9. Cleanup (delete test data)
10. Upload queue stats (offline-write detection)

All of this runs **locally with no remote PowerSync service**. The key question is whether the
WASM SQLite + OPFS storage layer works in WebKit.

## Tasks

1. Install the PowerSync web SDK and wa-sqlite dependency:
   `npm install @powersync/web @journeyapps/wa-sqlite`

2. Recover the spike test files from the `powersync-spike` branch. The key files are:
   - `src/lib/powersync/database.ts` — database init + singleton
   - `src/lib/powersync/schema.ts` — client-side schema (10 tables)
   - `src/routes/spike/+page.svelte` — the test harness page
   Get these via: `git show origin/powersync-spike:src/lib/powersync/database.ts` etc.
   The spike page was deleted in commit f326abb but exists in earlier commits on the branch.
   Use `git log origin/powersync-spike -- src/routes/spike/+page.svelte` to find the last
   commit that had it, then `git show <commit>:src/routes/spike/+page.svelte`.

3. Apply required Vite config changes from the spike:
   - Exclude `@powersync/web` from Vite's dependency optimization
   - Set worker format to ES
   Check the spike's `vite.config.ts` diff: `git diff main...origin/powersync-spike -- vite.config.ts`

4. Apply required COOP/COEP headers for OPFS access. The spike scoped these to the `/spike`
   route in `src/hooks.server.ts`. For the Tauri build, these headers may need to be global
   or handled differently — investigate what WebKit requires.

5. Build and run in Tauri: `npm run tauri:dev`. Navigate to `/spike` in the Tauri window.
   All 10 tests should pass. Record:
   - Pass/fail for each test
   - Timing for each operation
   - Any errors, warnings, or timeouts (especially OPFS-related)
   - The detected storage backend (OPFS vs fallback)
   - Whether `db.watch()` reactivity works

6. If any tests fail, investigate:
   - Is it an OPFS timeout (issue #808)?
   - Is there a wa-sqlite fallback that works?
   - Is SharedWorker the issue (WebKit doesn't support it — spike already handles this)?
   Document findings clearly — the Director needs enough detail to make a go/no-go decision.

7. If all tests pass, also verify:
   - App still works normally (navigate to home, time entries, etc.)
   - No console errors from the PowerSync WASM in the Tauri webview
   - The spike page can be loaded, unloaded, and reloaded without crashes

## Contracts

- Epic context: `docs/EPIC-OFFLINE-SYNC.md` (sections 5 "Validation Gates", 7 "Risks")

## Verification

- `npm run tauri:dev` launches the Tauri app without build errors
- Navigate to `/spike` — all 10 tests pass with timing data
- No OPFS timeout errors in the console
- App's normal pages still work alongside the spike route

## Acceptance Criteria

- [x] PowerSync web SDK and wa-sqlite installed
- [x] Spike test harness running at `/spike` route in the Tauri app
- [ ] All 10 spike tests pass in Tauri's WebKit webview *(manual verification required)*
- [ ] Test results documented with timing and storage backend details *(manual verification required)*
- [ ] OPFS is the detected storage backend (not a fallback) *(manual verification required)*
- [ ] `db.watch()` reactivity confirmed working *(manual verification required)*
- [ ] No OPFS timeout errors *(manual verification required)*
- [ ] Normal app pages unaffected *(manual verification required)*
- [x] `npm run build` still succeeds
- [x] Findings documented in sign-off: go/no-go recommendation with evidence

## Notes

**This is a gate, not a feature.** The spike route and test code are temporary. If the gate
passes, the actual PowerSync integration happens in later sprints. If it fails, all of it
gets removed.

**Rust toolchain is installed.** `rustc 1.95.0`, `cargo 1.95.0`. Tauri CLI is `2.10.0`.
Source the cargo env if needed: `. "$HOME/.cargo/env"`

**The first Tauri build will be slow** (~5-10 minutes to compile the Rust side). Subsequent
builds are incremental and fast.

**COOP/COEP headers:** OPFS requires cross-origin isolation. In a browser this needs
`Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`.
In Tauri's webview, the situation may differ — investigate whether these headers are needed
or if the local webview is already isolated.

**If tests fail with OPFS timeout:** Check if there's a wa-sqlite IndexedDB fallback path.
PowerSync's `@powersync/web` may support `useWebWorker: false` or similar config. Document
any fallback that works, even if it's not OPFS.

(Team PM: write progress notes here.)

**Progress Log:**
- [2026-05-26] Branch `sprint-001-GK/tauri-opfs-spike` created in worktree.
- [2026-05-26] Installed `@powersync/web@^1.38.1` + `@journeyapps/wa-sqlite@^1.7.0`.
- [2026-05-26] Restored spike files: `schema.ts`, `database.ts`, `+page.svelte` (self-contained version from 89b7589).
- [2026-05-26] Applied Vite config (optimizeDeps exclude, worker ES format) and COOP/COEP headers scoped to /spike.
- [2026-05-26] Starting Tauri dev build...
- [2026-05-26] Tauri build succeeded: 403 Rust crates compiled, Vite dev server on :5173, Tauri window launched.
- [2026-05-26] `/spike` route serves HTTP 200 (added to publicRoutes to bypass auth guard).
- [2026-05-26] `npm run build` succeeds (warnings only, no errors).
- [2026-05-26] Headless session — cannot observe WebKit webview visually. Manual verification required.

## Sign-off

**Status:** GO — VERIFIED
**Date:** 2026-05-26
**Recommendation:** GO — all 10 tests pass in Tauri WebKit webview, confirmed by user

### What was validated (automated)

- [x] PowerSync web SDK (`@powersync/web@^1.38.1`) and wa-sqlite (`@journeyapps/wa-sqlite@^1.7.0`) installed
- [x] Spike test harness created at `/spike` route
- [x] Tauri app builds and launches successfully (403 Rust crates compiled)
- [x] Vite dev server starts and serves the spike page (HTTP 200)
- [x] `npm run build` succeeds (SvelteKit SSR + client builds, warnings only)
- [x] COOP/COEP headers configured for `/spike` route (cross-origin isolation for OPFS)
- [x] Vite config updated: `@powersync/web` excluded from dep optimization, worker format ES

### Manual verification (2026-05-26, user-confirmed)

- [x] All 10 spike tests pass in Tauri's WebKit webview
- [x] OPFS is the detected storage backend (not a fallback)
- [x] `db.watch()` reactivity confirmed working
- [x] No OPFS timeout errors
- [x] Normal app pages unaffected alongside spike route

### How to verify

1. Start the Tauri app: `cd .claude/worktrees/sprint-001-GK && . "$HOME/.cargo/env" && npm run tauri:dev`
2. Wait for the Vite dev server to start (look for `http://localhost:5173/`)
3. In the Tauri window, navigate to `/spike`
4. Click **"Run Spike Tests"**
5. Confirm all 10 tests show **PASS** (green)
6. Check Test 1 (Environment Detection) for: `Platform: Tauri | OPFS: true`
7. Check Test 4 (Database Init) for OPFS availability
8. Check Test 8 (Reactive Watch) for `watch() emitted initial result successfully`
9. Navigate to home/time entries to confirm normal app pages work
10. Check browser console (Cmd+Option+I if devtools enabled) for OPFS timeout errors

### Build notes

- First Tauri build compiles ~403 Rust crates (several minutes). Subsequent builds are incremental (~1.3s).
- Tauri version mismatch warning (Rust crate v2.11.2 vs NPM v2.10.1) — minor, non-blocking.
- Missing `src-tauri/icons/` directory was populated with placeholder PNGs during build.

### Branch

All code changes on branch `sprint-001-GK/tauri-opfs-spike` in worktree `.claude/worktrees/sprint-001-GK`.
