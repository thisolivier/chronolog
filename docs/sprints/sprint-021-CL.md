# Sprint 021 — CL: Remove dead sync code, restore lost wiring, close the doors

**Status:** signed-off
**Type:** Client/Infra — deletion and wiring
**Depends on:** nothing. **Merges first**; 019-CL and 020-CL rebase onto it.
**Branch:** `sprint-021-CL/dead-code-and-wiring`
**Worktree:** `.claude/worktrees/sprint-021-CL`
**Source of truth:** `docs/review/2026-11-03-code-state.md` §2, §3, §4; `docs/review/2026-11-03-infra-state.md` §2

## Decisions already taken by the owner

- PowerSync is out. Offline will be done later as a cache + outbox sprint. Delete, do not disable.
- Production will be fetch-mode only: app + Postgres.
- Registration is closed by default.

## Tasks

1. **Delete PowerSync client and server plumbing:** `src/lib/powersync/*`, `src/routes/api/powersync/*`,
   `src/lib/server/powersync-auth*`, `src/e2e/powersync-*.e2e.test.ts` and `sync-roundtrip` tests that
   only exist for it, the `PUBLIC_SYNC_MODE` / `VITE_POWERSYNC_URL` env plumbing, the COOP/COEP branch in
   `hooks.server.ts`, the `powersync` and `bucket-storage` services and `config/powersync.yaml`,
   `config/sync_rules.yaml`, `config/dev-jwk.json`, `config/dev-public.pem` from both compose files, and
   the npm deps `@powersync/web`, `@journeyapps/wa-sqlite`. Keep `config/init-db.sql` only if something
   other than replication needs it.
2. **Delete the dead storage layer and spike:** `src/lib/storage/*` (+ tests), `src/routes/spike/*`,
   the `dexie` and `@tauri-apps/plugin-sql` deps, and the `tauri_plugin_sql` registration in
   `src-tauri/src/lib.rs` / capabilities.
3. **Delete `WeekListPanel`** and what exists only for it: `getWeekSummaries` on `DataService` and
   `FetchDataService`, `GET /api/weeks`, `getWeeklyTotals`. Salvage from `wip/2026-05-27-debug-session`
   (cherry-pick by hand, do not merge): hunks 2c, 2d (mobile AppShell top bar + timer indicator, mobile
   level-1 routing), 3 (readmes), 5 (`+page.svelte` panel 2 is always `NoteListPanel`), and the
   `try/catch` around `auth.api.getSession` from hunk 1 without the logging. Leave hunks 2e and 4 alone.
4. **Other dead code from §3:** `SidebarToggle.svelte`, `StatusBadge.svelte` + tests (WeekStrip has its
   own; do NOT edit WeekStrip), dead fetch wrappers in `timer-api.ts` (keep
   `calculateElapsedFromStartTime`), `src/routes/time/new/*` and the `/time` page-server actions,
   `src/lib/index.ts`, `src/lib/components/time/readme.md`, the uncalled query functions listed in §3,
   the unused `NoteTimeEntryLink` imports (4 lint errors). Leave `DeliverableSelect.svelte` alone
   (019-CL is re-wiring it).
5. **Restore what the 016/017 merge lost from sprint 006** in `src/routes/+layout.svelte`: service-worker
   registration and update prompt, and the `ConnectionStatus` banner. Do not restore the sync-mode swap.
   Verify `vite.config.ts` still builds the PWA manifest.
6. **Close the doors:** registration disabled unless `ALLOW_REGISTRATION=true` (page shows a short
   message; API refuses); unauthenticated requests to `/api/*` get `401` JSON, not a `303` to `/login`;
   `BETTER_AUTH_SECRET` and `ENCRYPTION_KEY` have no hard-coded fallbacks (fail fast at boot with a clear
   message). Keep the `trustedOrigins` list but read it from env.
7. **Lint config:** add `playwright-report/` and `test-results/` to the eslint ignores.
8. **Docs:** update every readme/doc §3 lists as stale for the things you removed (`services/readme.md`,
   `layout/README.md`, `weekly/readme.md`, `stores/README.md`, `docs/contracts/data-service-interface.md`,
   `docs/UI-SPEC.md` panel 2 note, `README.md` prerequisites, `docs/DEPLOYMENT.md` PowerSync mentions,
   `.env.example`, `.env.prod.example`). Rewrite `CLAUDE_MEMORIES.md` "Current Direction" to the new
   direction in five lines. Delete the `wip/2026-05-27-debug-session` branch locally and on origin once
   hunks are salvaged.

## Boundaries

Do NOT edit: `WeekStrip.svelte`, `TimeEntryCard.svelte`, `NewEntryRow.svelte`, `TimerWidget.svelte`,
`AddTimeEntryModal.svelte`, `TimeEntriesPanel.svelte` (beyond removing a `WeekListPanel` import if any),
`NoteEditor.svelte`, `wiki-link.ts`, `SuggestionDropdown.ts`, `queries/notes.ts` search function,
`DeliverableSelect.svelte`. Those belong to 019-CL / 020-CL.

## Verification

- `npm run check` 0 errors; `npm run lint` fewer errors than before; `npm test` green; `npm run build`
  succeeds; `docker compose config` valid for both compose files.
- Real UI: `npm run dev -- --port 5193`; login, time mode, notes mode, mobile viewport (375px) time and
  notes navigation, offline banner appears when the network is set offline. Screenshots into
  `docs/review/screenshots/sprint-021/`.

## Sign-off

**Status:** signed-off (2026-11-03, Team PM). Branch `sprint-021-CL/dead-code-and-wiring`, four commits on top of `e3fabb9`:
`5bc4941` PowerSync/storage/spike removal, `dfdce8e` WeekListPanel + dead code + mobile shell, `45c71f4` doors + layout restore, `3172384` docs.
Net against `main`: 113 files changed, 838 insertions(+), 7074 deletions(-). Non-test source under `src/` went from 15,741 to 11,772 lines; tests from 5,710 to 4,001 lines.

### What changed

- **Deleted (Tasks 1, 2):** `src/lib/powersync/` (2,793 lines incl. 1,029 of mocked tests), `src/lib/storage/` (1,456), `src/routes/spike/` (351), `src/routes/api/powersync/` (41), `powersync-auth.ts` + test (121), PowerSync-only e2e suites (`powersync-infra`, `powersync-sync`, `sync-roundtrip` ×2; 559), the whole `config/` directory (78: sync rules, dev keys, `init-db.sql`), the `powersync` and `bucket-storage` compose services and `wal_level=logical`, `PUBLIC_SYNC_MODE` / `VITE_POWERSYNC_URL` plumbing, `optimizeDeps`/worker settings in `vite.config.ts`, `tauri-plugin-sql` in `src-tauri`. npm deps removed: `@powersync/web`, `@journeyapps/wa-sqlite`, `dexie`, `@tauri-apps/plugin-sql`, plus orphaned `jose` and `fake-indexeddb`.
- **Deleted (Tasks 3, 4):** `WeekListPanel.svelte` (179), `GET /api/weeks` (62), `getWeekSummaries` on `DataService`/`DelegatingDataService`/`FetchDataService` (+2 tests), `WeekSummary` type, `getWeeklyTotals` (lived in `time-entries-weekly.ts`), `SidebarToggle` (42), `StatusBadge` + 7 tests (87), dead `timer-api.ts` wrappers (file is now 12 lines), `/time` and `/time/new` routes (363; nothing linked to them), `src/lib/index.ts`, `components/time/readme.md`, uncalled query functions (`listNotesForUser`, `getNoteWithTimeEntriesForUser`, `getOutgoingLinksForNote`, `listWeeklyStatuses`, `listTimeEntriesForDate`), the four unused `NoteTimeEntryLink` imports and the `PowerSyncDataService` export in `services/index.ts`.
- **Salvaged by hand from `wip/2026-05-27-debug-session`** (hunks 2c, 2d, 3, 5, and the `try/catch` of hunk 1 without logging): mobile AppShell has a permanent top bar (Chronolog / ← Back) with `TimerIndicator` when pushed in; mobile time mode goes Contracts → TimeEntriesPanel directly; panel 2 is always `NoteListPanel`; a throwing `getSession` is treated as no session. Hunks 2a, 2b, 2e, 4, 6–9 left alone. One deliberate deviation: the mobile timer indicator tap navigates to level 0 (where `TimerWidget` lives) instead of being a no-op. `navigation.svelte.ts`: `selectWeek` no longer pushes a mobile level (WeekStrip is inside the panel already on screen); 2 new store tests. Branch deleted locally and on origin.
- **Restored (Task 5)** in `+layout.svelte`: `virtual:pwa-register` registration (skipped under Tauri), the update prompt (`data-testid="pwa-update-prompt"`), and `<ConnectionStatus />` for authenticated users. No sync-mode swap. `vite.config.ts` unchanged; the build emits `build/client/sw.js`, `manifest.webmanifest`, `workbox-*.js`.
- **Doors closed (Task 6):** new `src/lib/server/env.ts` (reads `$env/dynamic/private`; `BETTER_AUTH_SECRET` and `ENCRYPTION_KEY` required at boot with a message naming the missing variables, optional only while `building`); `auth.ts` takes secret/baseURL/`trustedOrigins` from it (`TRUSTED_ORIGINS` comma-separated + `BETTER_AUTH_URL`; the hard-coded Tailscale IP is gone); registration closed unless `ALLOW_REGISTRATION=true` via Better Auth `emailAndPassword.disableSignUp`, `/register` renders "Registration is closed on this instance." with a Sign in link; unauthenticated `/api/*` → `401 {"error":"Unauthorized"}`, pages still 303. `hooks.server.ts` lost the COOP/COEP branch and the `/spike` + `/api/powersync/jwks` public routes. Dev compose sets `ALLOW_REGISTRATION: "true"`; prod compose and `.env.prod.example` default to false; `playwright.config.ts` sets it for the e2e web server.
- **Lint (Task 7):** `playwright-report/`, `test-results/`, `.claude/` ignored.
- **Docs (Task 8):** `data-service-interface.md` (matches `DataService` exactly), `UI-SPEC.md` panel 2 / mobile notes, `README.md` prerequisites + env table, `DEPLOYMENT.md` (app + Postgres, first-account procedure), `docker-stack.md` (was entirely about the removed stack), `EPIC-OFFLINE-SYNC.md` history banner, PM prompts, `.env.example` / `.env.prod.example`, `src/lib/server/README.md`, services / stores / layout / weekly / timer readmes, `src/e2e` and `e2e-playwright` readmes, `CLAUDE_MEMORIES.md` Current Direction (five lines) plus stale bullets.

### Verification

| Check | Before (main `e3fabb9`) | After |
|---|---|---|
| `npm run check` | 0 errors, 23 warnings | 0 errors, 21 warnings |
| `npm run lint` | 11 errors | 5 errors (all in 019/020 boundary files: `TimeEntriesPanel` ×2, `note-export.ts`, `WikiLinkInput`, `WikiLinkRenderer`) |
| `npm test` | 23 files / 335 tests | 20 files / 269 tests (−81 for deleted PowerSync/storage/StatusBadge/weeks; +15 new: env 9, hooks 4, navigation 2) |
| `npm run build` | — | succeeds, also with `.env` absent; `node build` without a secret exits 1 naming it |
| `docker compose config` | — | valid for `docker-compose.yml` and `docker-compose.prod.yml` (`--env-file .env.prod.example`) |

Real UI on `npm run dev -- --port 5193` (headless Chromium via Playwright, probes in the session scratchpad, QA user `qa-021-d9cauk@chronolog.test` left in the dev DB):

- Registration closed (`ALLOW_REGISTRATION=false`): `/register` shows the closed message without a form; `POST /api/auth/sign-up/email` → 400 `EMAIL_AND_PASSWORD_SIGN_UP_IS_NOT_ENABLED` (403 `INVALID_ORIGIN` from an untrusted origin); unauthenticated `GET /api/contracts`, `/api/time-entries/weekly`, `/api/timer/status` → 401 JSON; `GET /` → 303 `/login`.
- Registration open: register → login → desktop time mode (WeekStrip, no week list) → notes mode editor → offline banner appears with the network offline and clears on online → mobile 375px: Chronolog top bar at level 0, Time Entries → TimeEntriesPanel in one tap with Back, contract → note list → New Note → editor, Back ×2 to contracts, offline banner. 17/17 pass, no page errors.
- Service worker: on the production build (`node build` on :5194) `navigator.serviceWorker.getRegistration()` is `activated` at scope `/`, console logs "PWA ready for offline use", `/sw.js` and `/manifest.webmanifest` serve 200. (Dev mode has no SW because `devOptions.enabled` is not set — expected.)

Screenshots in `docs/review/screenshots/sprint-021/`: `01-registration-closed`, `02-desktop-time-mode`, `03-desktop-notes-mode`, `04-offline-banner`, `05-mobile-level0-contracts`, `06-mobile-time-entries`, `07-mobile-note-list`, `08-mobile-note-editor`, `09-mobile-offline`.

### Follow-ups deferred

- `CLAUDE.md` (owner permission required): line 39 `config/ — PowerSync service config and sync rules` no longer exists; the overview's "Postgres, PowerSync, app server" should read "Postgres and the app server".
- `docs/SPEC.md` lines 101/137/166 still describe Dexie/IndexedDB as the PWA storage layer; `docs/platform-abstraction.md` describes the deleted `src/lib/storage` design (README links it); `docs/backlog-client.md` / `docs/backlog-infrastructure.md` carry PowerSync items (CL-1, CL-2, IF-*) that are now obsolete; `docs/backlog.md` lines 102–103, 120, 143 — all left for the Director/owner.
- `ENCRYPTION_KEY` is now required at boot but still unused in code (encryption at rest is not implemented — code-state §1).
- `ConnectionStatus` says "changes are saved locally", which is not true until the cache + outbox sprint; the SW is `NetworkFirst` for `/api/*` only. Consider softer copy.
- `e2e-playwright/offline-behavior.spec.ts` and `src/e2e/attachments-offline.e2e.test.ts` were kept but not run (need the full stack); the API e2e suite still expects Postgres at `localhost:5432` and an app on 5173.
- Remaining 5 lint errors and the 21 svelte-check warnings are in files owned by 019-CL / 020-CL.
- Boundary conflicts: none hit. `TimeEntriesPanel.svelte` was not touched (it had no `WeekListPanel` import); `DeliverableSelect.svelte`, `WeekStrip.svelte`, `NoteEditor.svelte`, `wiki-link.ts`, `SuggestionDropdown.ts`, `queries/notes.ts` `searchNotesForUser` untouched. Both sibling sprints will see conflicts only in `+layout.svelte` / `hooks.server.ts` / `AppShell.svelte` if they edited those, which the boundaries forbid.
