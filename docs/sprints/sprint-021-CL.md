# Sprint 021 — CL: Remove dead sync code, restore lost wiring, close the doors

**Status:** active
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

_Team PM fills in: deleted line count, test counts, screenshots, follow-ups._
