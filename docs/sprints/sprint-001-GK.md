# Sprint 001 — GK: Tauri/WebKit OPFS Spike (GATE 0)

**Status:** active
**Type:** standard
**Backlog items:** CL-0 (GATE 0)
**Depends on:** none
**Branch:** (to be filled by Team PM)
**Working tree:** (to be filled by Team PM)

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

- [ ] PowerSync web SDK and wa-sqlite installed
- [ ] Spike test harness running at `/spike` route in the Tauri app
- [ ] All 10 spike tests pass in Tauri's WebKit webview
- [ ] Test results documented with timing and storage backend details
- [ ] OPFS is the detected storage backend (not a fallback)
- [ ] `db.watch()` reactivity confirmed working
- [ ] No OPFS timeout errors
- [ ] Normal app pages unaffected
- [ ] `npm run build` still succeeds
- [ ] Findings documented in sign-off: go/no-go recommendation with evidence

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

## Sign-off

(Team PM fills this when done)
