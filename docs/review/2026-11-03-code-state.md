# Chronolog — Code-State Review (2026-11-03)

**Reviewed commit:** `84180d6` on `main` (last pre-pause commit, 27 May 2026).
**Method:** read-only code reading plus `npm run check`, `npm run lint`, `npm test`. No Docker, no servers, no source edits.
**Note on drift:** while this review was in progress the owner's session added `0a84cc6` and `cd5ac62` (housekeeping only: deleted `test.txt` / `test_script.py` / `test_multiline.txt`, pruned all sprint branches and `.claude/worktrees/`, touched `CLAUDE.md`, `.gitignore`, `docs/backlog.md`, `docs/sprints/readme.md`). `git diff --stat 84180d6 HEAD -- src` is empty, so every finding below applies unchanged to the current `main`.

**Size:** ~15.5k lines of non-test source under `src/` (`.ts` + `.svelte`), ~5.7k lines of tests, 7 Drizzle migrations, 25 API routes, 10 page routes.

---

## 1. What the app actually does today on `main`

### Routes and shell

| Route | File | State |
|---|---|---|
| `/` | `src/routes/+page.svelte` | **working** — the whole app lives here (AppShell + panels) |
| `/login`, `/register`, `/settings/two-factor` | `src/routes/{login,register,settings/two-factor}/+page.svelte` | **working** (Better Auth client; login does a full reload via `window.location.href = '/'`, `login/+page.svelte:35,59`) |
| `/admin`, `/admin/clients`, `/admin/clients/[clientId]`, `/admin/clients/[clientId]/contracts/[contractId]` | `src/routes/admin/**` | **working** (SvelteKit form actions) |
| `/time` | `src/routes/time/+page.server.ts:6-9` | **dead** — `load` redirects to `/`; the `delete` / `updateStatus` form actions at lines 11-47 can never be reached |
| `/time/new` | `src/routes/time/new/+page.svelte` (210 lines) + `+page.server.ts` | **orphaned** — the only form that sets deliverable + work type, but nothing links to it (`grep 'href="/time'` finds nothing); on submit it redirects to `/time?date=…` which bounces to `/` |
| `/spike` | `src/routes/spike/+page.svelte` (349 lines), `+page.ts` (`ssr=false`) | **dead product code, live route** — GATE 0 diagnostic page; listed as a *public* route in `src/hooks.server.ts:16` |
| `/api/*` | 25 `+server.ts` files | see §2 |

`src/routes/+layout.svelte` (35 lines) creates three contexts for authenticated users: navigation state (`$lib/stores/navigation.svelte.ts`), timer display state (`$lib/stores/timer-state.svelte.ts`) and a `DelegatingDataService(new FetchDataService())` (`+layout.svelte:29`). Nothing else: no service-worker registration, no offline banner, no sync-mode switch (see §2 for how that was lost).

### Modes and panels (`src/lib/components/layout/`)

- Navigation defaults to **time-entries** mode (`navigation.svelte.ts:75`). Clicking a contract in `ContractsSidebar.svelte:46-48` switches to **notes** mode; "Time Entries" switches back.
- **Desktop (≥1024px):** `AppShell.svelte:148` renders Panel 2 *only* in notes mode, so time mode is sidebar + content, notes mode is sidebar + note list (resizable, `AppShell.svelte:19-59`) + editor. Top bar has hamburger + `TimerIndicator` (`AppShell.svelte:112-133`). **working.**
- **Mobile (<1024px):** `AppShell.svelte:82-107` is a 3-level push/pop. Level 1 renders `panel2()` regardless of mode, and `+page.svelte:18-24` still puts `WeekListPanel` in `panel2` for time mode. So on a phone the flow is Contracts → **WeekListPanel** → TimeEntriesPanel; on desktop `WeekListPanel` is never rendered. There is no timer indicator and no header at level 0 on mobile. **wired-but-untested** (sprint 017 explicitly left mobile as a stretch goal).

### Time entries (`TimeEntriesPanel.svelte`, `weekly/*`)

- Single-week view driven by `navigation.selectedWeek` (`TimeEntriesPanel.svelte:29-52`). `WeekStrip.svelte` (sticky, 7 day columns, client-colour proportion bars, prev/next week, week total, status chip that cycles Unsubmitted → Draft ready → Submitted at `WeekStrip.svelte:37,81-85`). **working.**
- Day sections only up to today (`TimeEntriesPanel.svelte:168-170`); navigating to a future week renders "No days to display" even though the strip allows it.
- Initial load fetches 4 weeks (`:80`), and `ensureWeekLoaded` fetches any week you navigate to (`:90-106`). The "Load older weeks" button (`:356-366`) fetches 4 more weeks into the cache but **nothing displays them** (only the selected week is rendered) and `hasMoreWeeks` is never set to `false` (`:17`). **wired-but-pointless.**
- Every create/edit/delete calls `refreshWeeks()` which re-fetches *all* loaded weeks (`:132-140`).
- `TimeEntryCard.svelte`: inline edit of description (with `[[` autocomplete via `WikiLinkInput`), contract (`ContractSelect`), time (`parseTimeInput` accepts `2h30m` or `9:00-11:30`), two-step delete. **working.** Work type / deliverable are display-only (`:257-262`); there is no inline editor for them and `PUT /api/time-entries/[id]` ignores `deliverableId`/`workTypeId` entirely (`src/routes/api/time-entries/[id]/+server.ts:24-28`).
- `NewEntryRow.svelte`: description, contract, time. The 017 rewrite **dropped `DeliverableSelect`** (the pre-merge version had it — `git show c155e2c^1:src/lib/components/weekly/NewEntryRow.svelte` references it twice; the current file has a `<!-- Deliverable (future) -->` comment at `:131`). `AddTimeEntryModal.svelte` never had it. Net: **CL-6 (deliverable selector, sprint 010) regressed**; the only live path that sets deliverable/work type is the timer completion form.
- Wiki-links in card descriptions render as clickable spans (`WikiLinkRenderer.svelte:63` calls `onNoteLinkClick?.()`), but `TimeEntriesPanel.svelte:274` mounts `<TimeEntryCard {entry} onUpdated={refreshWeeks} />` **without** `onNoteLinkClick`, so clicking a link is a no-op. **dead.**

### Timer (`src/lib/components/timer/`, `src/routes/api/timer/*`)

- `TimerWidget.svelte` (317 lines) in the sidebar: idle → running → paused → stopped → completion form (contract/deliverable/work type via `CascadingSelects`) → save/discard. Start creates a server-side draft (`is_draft=true`) on the first active contract (`fetch-data-service.ts:174-185`); draft contract/description are persisted while running (`TimerWidget.svelte:86-92,115-126`). Reload recovers a running or stopped draft from `GET /api/timer/status`. `TimerIndicator` in the top bar mirrors it via the shared store. **working** at the API level (QA sprint 014 verified every timer endpoint).
- **Pause is cosmetic.** `handlePause()` only stops the client tick (`TimerWidget.svelte:144-150`); `stopTimer()` on the server computes duration as DB `start_time` → now (`src/lib/server/db/queries/time-entries.ts:181-186`), so paused minutes are billed. UI-SPEC says the user must "manually adjust start or end time to account for the gap", but neither is editable in the running/stopped UI.
- `startTimer` stores the **UTC** date (`toISOString()`, `time-entries.ts:149`) with the **local** time (`toTimeString()`, `:150`); `stopTimer` is minute-granular and clamps negative spans to 0, so a timer across midnight saves 0 minutes.
- `POST /api/timer/start` returns 409 when a *stopped-but-unsaved* draft exists (`api/timer/start/+server.ts`), with a misleading "already running" message.

### Notes (`NoteListPanel.svelte`, `NoteEditorPanel.svelte`, `notes/*`)

- Per-contract list (pinned first, then `updatedAt`), create (server-generated `CLIENT.YYYYMMDD.SEQ` id, `queries/notes.ts:50-88`), delete with `window.confirm`. The list shows the first two content lines (`extractPreviewLines`) — notes have no editable title field in the editor; `title` in the DB is only written if something passes it. Pin is display-only (no toggle). **working.**
- `NoteEditor.svelte` (497 lines): TipTap StarterKit + `CodeBlockLowlight` + Link + Image + FileHandler + Placeholder + `tiptap-markdown` + custom `WikiLink` (with `SuggestionDropdown`) + `AnchoredHeading`; raw-markdown/rendered toggle; debounced autosave; drag/paste upload of images/PDFs through `onFileUpload` → `POST /api/notes/[noteId]/attachments` (stored as `bytea`, resolved back via `chronolog://` URLs). **working** per sprint 012/013 sign-offs; untested in a browser since May.
- Export: Markdown = Blob download (`note-export.ts:27-35`); PDF = `window.print()` with `print-styles.css` (`:41-43`). **working** (unit-tested helpers; the print path is browser-dependent).
- Move to another contract (sprint 016): dropdown in the editor header → `PUT /api/notes/[noteId]` with `contractId` → `window.dispatchEvent('note-moved')` → `NoteListPanel` removes it (`NoteListPanel.svelte:124-131`). **wired-but-untested** (the final commit `84180d6` added the listener after the sprint sign-off).
- Backlinks ("Linked from") and `LinkedTimeEntries` (date, description, client/contract, duration, unlink) render under the editor. **working.**

### Linking

- Note → note: `[[id]]` parsed on `PUT /api/notes/[noteId]` *only when `content` is truthy* (`api/notes/[noteId]/+server.ts:51-53`), rebuilding `note_links` (`queries/note-links.ts:44-72`).
- Time entry → note: `[[id]]` in descriptions reconciled against `note_time_entries` on `POST /api/time-entries` (`+server.ts:35-46`) and `PUT /api/time-entries/[id]` (`:40-62`). **working** at the API level, with the click-through dead as noted above.
- Note → time entry: `POST /api/notes/[noteId]/time-entries` exists and `DataService.linkNoteTimeEntry` is implemented, but **no UI calls it** — notes can only *unlink*.
- Heading anchors are stored, never navigated (v2 by design).

### Admin (`src/routes/admin/**`, `components/admin/*`)

Clients (name, short code, emoji), contracts (name, description, active), deliverables and work types (with reorder action) — all via form actions, all **working** per QA 014. Sign-out lives only on `/admin/+page.svelte:4-18` (direct `fetch('/api/auth/sign-out')`). There is **no UI for `colorIndex`**: every client is created with the default `0` (`schema/clients.ts:14`, `hooks.server.ts:58-65`, `seed.ts`), so the entire client-colour system from sprint 017 renders every client in the same colour unless the DB is edited by hand.

### Auth, security, data protection

- Better Auth email/password + TOTP (`src/lib/server/auth.ts`), route guard and app-user provisioning in `src/hooks.server.ts`. **working.**
- `auth.ts:8` falls back to `'default-secret-for-development'` if `BETTER_AUTH_SECRET` is unset; `auth.ts:21-23` hard-codes a Tailscale IP in `trustedOrigins`.
- **Encryption at rest is not implemented.** `docs/SPEC.md` requires AES-256-GCM for note content/titles, descriptions and attachments; `ENCRYPTION_KEY` appears in `.env.example` and both compose files but `grep ENCRYPTION_KEY|createCipheriv src` returns nothing.
- Unauthenticated `/api/*` requests get a `303` to `/login` rather than `401` (`hooks.server.ts:103-105`; QA BUG-008). `request.json()` is unguarded in every route (origin branch `fix/json-parse-error-handling` fixes 9 of them).

### PWA / offline

`vite.config.ts` still configures `SvelteKitPWA` (manifest, Workbox `NetworkFirst` for `/api/*`), but the explicit registration, update toast and `ConnectionStatus` banner were removed from `+layout.svelte` by merge `c155e2c` (see §2). Whether the plugin's default auto-injection still registers a service worker needs a live check; from the code, the offline UX delivered in sprint 006 is **unwired**.

---

## 2. Data layer

### The abstraction

- `src/lib/services/data-service.ts` — `DataService` interface, 29 methods (contracts 3, clients 1, notes 6, attachments 3, note-time links 3, time entries 6, timer 5, deliverables/work types 2). `docs/contracts/data-service-interface.md` describes an older 28-method shape (`getClient`, `updateClient`, `getWeeklyStatuses`…) that does not match the code — **stale contract doc**.
- `fetch-data-service.ts` (212 lines) — the only implementation the UI ever sees; thin wrappers over `fetch-helpers.ts` (which also owns 401/303 session-expiry redirect, `fetch-helpers.ts:21-30`).
- `delegating-data-service.ts` (177 lines of pure pass-through) — exists solely so the layout can `setDelegate()` to PowerSync after an async connect. **Nothing calls `setDelegate` on `main`** (`grep setDelegate src` → only its definition).
- Components honour the "no direct fetch" rule with two exceptions: `components/weekly/WikiLinkInput.svelte:57` (note search) and `routes/admin/+page.svelte:6` (sign-out). `timer-api.ts:29-126` still contains seven direct-fetch wrappers that no longer have callers.

### `PUBLIC_SYNC_MODE` — what it does today

- Client side: **nothing.** The toggle landed in `1b30741` (sprint 004) as `import.meta.env.PUBLIC_SYNC_MODE` in `+layout.svelte` and was deleted by merge `c155e2c` (16/17-CL). Cause: every sprint branch from 012-CL to 017-CL was cut from `1d0aebe` (before the 006 PWA merge), and the merge resolution of `+layout.svelte` took the branch side wholesale — removing the PowerSync swap, the service-worker registration, the update prompt and `<ConnectionStatus />` in one go (`git diff c155e2c^1 c155e2c -- src/routes/+layout.svelte`). No sprint document records this; `docs/sprints/readme.md` lists 004-CL as merged.
- Even before the regression the toggle was doubtful: Vite only exposes `VITE_`-prefixed variables on `import.meta.env`, and `vite.config.ts` sets no `envPrefix`; a `PUBLIC_` var needs `$env/static/public`. There is no evidence in any sign-off that `PowerSyncDataService` was ever exercised from the UI — gate B/C "PASS" verdicts (`docs/gate-verdicts.md`) were obtained through the REST API and the fetch path ("because the same REST endpoints are used").
- Server side: `hooks.server.ts:110-122` reads `process.env.PUBLIC_SYNC_MODE` and, when `powersync` (or on `/spike`), adds COOP/COEP headers. `docker-compose.prod.yml:14` sets `PUBLIC_SYNC_MODE=powersync`, so **production would send cross-origin-isolation headers for a client that never uses PowerSync**; `.env` has `fetch`.

### Is the PowerSync path still coherent with the schema and API? No.

`src/lib/powersync/` (schema 157, database 91, connector 193, data-service 427, mutations 510, queries-read 271, queries-time 76 lines; 46 unit tests, all mocked):

1. **Schema drift.** `schema.ts:19-29` has no `color_index` on `clients` (added by migration `0006`), yet `queries-read.ts:54,95` select `clients.color_index`. PowerSync drops columns absent from the client schema, so `getContractsByClient()`/`getContracts()` would fail with "no such column" on first render in PowerSync mode.
2. **Upload payloads are snake_case, the API is camelCase.** `connector.ts:162` forwards raw `opData` (`contract_id`, `duration_minutes`, `is_draft`…) to REST routes that read `contractId` etc. `POST /api/notes` returns 400 "contractId is required" (`api/notes/+server.ts:52`); `PUT /api/time-entries/:id` returns 400 "No fields to update" (`[id]/+server.ts:24-31`). `uploadData` throws, PowerSync retries forever, the local queue never drains. `connector.test.ts:126,152` only assert URLs/ops, never payload compatibility.
3. **Note ID divergence.** `mutations.ts` generates note IDs locally by counting local rows (`createNote`), while `POST /api/notes` ignores any supplied `id` and generates its own (`api/notes/+server.ts:56-62`) — a successful upload would create a *second* note on the server.
4. **Missing endpoints.** `TABLE_API_CONFIG` maps `clients` PUT → `POST /api/clients`, which only implements `GET` (`api/clients/+server.ts`). `weekly_statuses` PUT posts snake_case to an endpoint expecting `{year, weekNumber, status}`.
5. `sync_rules.yaml` is coherent (global bucket, `SELECT *` per table, attachments metadata only). JWT/JWKS (`powersync-auth.ts`) is coherent for a single user but regenerates its RSA key per process (`:14-24`).

Verdict: the PowerSync client is a well-structured but **never-integrated** layer; it would need a payload-mapping layer, server-side id reconciliation, schema parity and real (non-mocked) upload tests before it could be switched on.

### `src/routes/spike` — dead code?

Yes, functionally: it is the GATE 0 diagnostic from sprint 001-GK (`docs/ux/11-spike-page.md` documents it). It is still a live, **unauthenticated** route (`hooks.server.ts:16`) that dynamically imports `@powersync/web` (`spike/+page.svelte:47`), inflates the build (QA 014 noted a 567 kB chunk), carries 2 of the 11 real lint errors, and triggers the COOP/COEP branch in hooks. Recommend deleting it (history keeps it).

### `src/lib/storage/` — also dead

`DexieAdapter`/`SqliteAdapter`/`StorageAdapter` (Task 10): zero imports outside the module (`grep -rn "lib/storage\|DexieAdapter\|SqliteAdapter" src` only hits the module itself). `dexie` and `@tauri-apps/plugin-sql` are dependencies, and `src-tauri/src/lib.rs` registers `tauri_plugin_sql`, purely for this unused module. The EPIC explicitly superseded it with PowerSync.

---

## 3. Dead or orphaned code

### Components with zero references (import count across `src/`, excluding tests)

| File | Lines | Status |
|---|---|---|
| `src/lib/components/layout/WeekListPanel.svelte` | 179 | imported by `+page.svelte:4` but only ever rendered on mobile time mode (see §1); desktop-dead since 017 |
| `src/lib/components/layout/ConnectionStatus.svelte` (+ 6 tests) | 58 | unreferenced since merge `c155e2c` |
| `src/lib/components/layout/SidebarToggle.svelte` | — | unreferenced (AppShell has its own hamburger) |
| `src/lib/components/weekly/StatusBadge.svelte` (+ 7 tests) | — | unreferenced; `WeekStrip.svelte:37,70-85` re-implements the same cycle inline |
| `src/lib/components/timer/DeliverableSelect.svelte` | — | unreferenced after the 017 rewrite of `NewEntryRow` (CL-6 regression) |
| `src/lib/components/timer/timer-api.ts` | 136 | only `calculateElapsedFromStartTime` is used (`TimerWidget.svelte:8`); lines 29-126 are dead fetch wrappers |

### Modules, routes and files

- `src/lib/storage/*` — 7 files + README + 22 tests, dead (§2).
- `src/routes/spike/*` — dead (§2).
- `src/routes/time/+page.server.ts` actions, `src/routes/time/new/*` — unreachable (§1).
- `src/lib/index.ts` — scaffold placeholder.
- `src/lib/components/time/readme.md` — a README for `TimeEntryRow.svelte`, which sprint 017 deleted; the directory now contains only this file.
- Server query functions with no callers outside their own file: `listNotesForUser`, `getNoteWithTimeEntriesForUser` (`queries/notes.ts:4,30`), `getOutgoingLinksForNote` (`note-links.ts:27`), `listWeeklyStatuses` (`weekly-statuses.ts:61`), `listTimeEntriesForDate` (`time-entries.ts:59`).
- `NoteTimeEntryLink` type is imported-but-unused in 4 files (4 of the 11 lint errors).
- `DataService.getWeekSummaries` / `GET /api/weeks` / `getWeeklyTotals` exist only for `WeekListPanel`.
- Root `test.txt` (`test`), `test_script.py` (`print("test")`), `test_multiline.txt` (`line1..3`) — committed junk from the scaffold era; **deleted today in `0a84cc6`**.
- `BACKLOG.md` (root, Feb 2026) duplicates `docs/backlog.md`; `CLAUDE_MEMORIES.md` is stale (says `DataService` only exists on the spike branch and that no `.env` exists).

### Stale tests

- `ConnectionStatus.test.ts` (6), `status-badge.test.ts` (7), `dexie-adapter.test.ts` (22) test code nothing renders or imports.
- `powersync-data-service.test.ts` (35, 716 lines) and `connector.test.ts` (11) test an unreachable path with mocks that cannot catch the payload/ID/schema incoherence in §2.
- `fetch-data-service.test.ts` is 1,031 lines for a 212-line file (every method mocked at the `fetch` level).
- `queries/notes.test.ts` (3) and `queries/attachments.test.ts` (7) are integration tests that need Postgres; without it `npm test` exits 1.

### Stale documentation (mentions things that no longer exist or are wrong)

`docs/UI-SPEC.md` (still specifies a week list in Panel 2), `docs/contracts/data-service-interface.md` (wrong method list), `src/lib/services/readme.md` (describes the PowerSync swap in the layout), `src/lib/components/layout/README.md` ("WeekListPanel — Panel 2 content in notes mode"), `src/lib/components/weekly/readme.md` (lists `WeekListPanel` as a parent), `src/lib/components/timer/readme.md` (says `ContractSelect` fetches `/api/contracts` and `AddTimeEntryModal` calls `apiCreateManualEntry`; both now use `DataService`), `src/lib/stores/README.md` (describes `isRunning`/`activeContractName`, which do not exist), `src/lib/components/notes/README.md` (says `LinkedTimeEntries` fetches directly), `src/lib/storage/README.md` (dead module), `src/lib/powersync/readme.md` ("Enabled when `PUBLIC_SYNC_MODE=powersync`").

### Branch/worktree state (as found at `84180d6`)

30 local branches and 15 `.claude/worktrees/*` checkouts, all merged (the 1-5 "ahead" commits were sprint-doc sign-offs only). Local `main` was 17 commits ahead of `origin/main`. All of this was pruned today in `0a84cc6` (a bundle backup is recorded in `docs/backlog.md`). Still unmerged on origin and worth a look: `fix/json-parse-error-handling`, `fix/time-entry-search-input-validation`, `fix/weekly-status-input-validation` (1 commit each, March 2026); `powersync-spike` (11) and `task-11-offline-sync` (4) are historical.

---

## 4. Branch `wip/2026-05-27-debug-session`

One commit (`74bff0f`, re-created today as `wip/…`) on top of `84180d6`; 14 files, +115/−231. It does **not** type-check: `src/lib/server/db/queries/notes.ts` calls `extractPreviewLines(row.contentJson)` at line 231 but the file only *re-exports* it (`export { extractPreviewLines } from '$lib/utils/extract-preview-lines'` at line 243), which creates no local binding. Fix is a one-line `import`.

What it was doing: diagnosing a login/redirect hang (hence request/session logging in hooks, layout, page), finishing the sprint-017 cleanup by deleting `WeekListPanel`, and enriching `[[` autocomplete with note preview lines.

| # | Hunk | What it does | Recommendation |
|---|---|---|---|
| 1 | `src/hooks.server.ts` | `console.log` on every request, `try/catch` around `auth.api.getSession`, log on redirect | **Salvage the try/catch only** (a throwing `getSession` currently 500s every page; treating it as "no session" is correct). Drop the per-request logging, or gate it behind an env flag. |
| 2a | `AppShell.svelte` | `onMount` console.log | **Discard.** |
| 2b | `AppShell.svelte` | wrap `getTimerStateContext()` in try/catch | **Discard** — the context is always set for authenticated users; swallowing it hides real bugs. |
| 2c | `AppShell.svelte` mobile | permanent top bar ("Chronolog" at level 0, Back otherwise) + `TimerIndicator` when not at root | **Salvage** — mobile currently has no header at level 0 and no timer indicator. |
| 2d | `AppShell.svelte` mobile | level 1 renders `panel2` only in notes mode, else `panel3` | **Salvage** — makes mobile time mode match desktop (no week list) and is what lets hunk 5 delete the panel. |
| 2e | `AppShell.svelte` desktop | show `TimerIndicator` only when the sidebar is collapsed | **Owner's call** — contradicts sprint 018-QA item A9 ("visible even when sidebar collapsed" implies always), but avoids showing the timer twice. Not a bug fix. |
| 3 | `layout/README.md`, `weekly/readme.md` | remove `WeekListPanel` references | **Salvage** with hunk 5. |
| 4 | `TimeEntriesPanel.svelte:235`, `WeekStrip.svelte:128` | remove today's amber section background; soften today's column | **Preference** — reverts sprint 017 task 12 styling. Keep only if the owner disliked the amber. |
| 5 | delete `WeekListPanel.svelte`; simplify `+page.svelte` panel2 to `<NoteListPanel />` | **Salvage** — the panel is desktop-dead now and mobile-dead after 2d. Also lets `getWeekSummaries`, `/api/weeks` and `getWeeklyTotals` go. |
| 6 | `SuggestionDropdown.ts`, `wiki-link.ts` | autocomplete items show first/second content line instead of (usually empty) title | **Salvage** — notes have no titles in practice, so this is a real usability fix. Depends on 7. |
| 7 | `queries/notes.ts` `searchNotesForUser` | select `content_json`, return `firstLine`/`secondLine` | **Salvage with the import fixed.** Consider also matching on content (QA BUG-006) while there. |
| 8 | `+layout.server.ts`, `+layout.svelte`, `+page.svelte` | `console.log` on load/mount | **Discard.** |
| 9 | `api/notes/search/+server.ts` | request/result logging | **Discard.** |

Suggested handling: do not merge the branch. Cherry-pick 2c, 2d, 3, 5, 6, 7(+import) into one small "remove WeekListPanel, richer wiki autocomplete" change; take 1's try/catch separately; drop the rest; delete the branch.

---

## 5. Code health against `CLAUDE.md`

### Files over 200 lines (29 total; worst 15)

| Lines | File |
|---|---|
| 1031 | `src/lib/services/fetch-data-service.test.ts` |
| 716 | `src/lib/powersync/powersync-data-service.test.ts` |
| 510 | `src/lib/powersync/mutations.ts` |
| 497 | `src/lib/components/notes/NoteEditor.svelte` |
| 427 | `src/lib/powersync/powersync-data-service.ts` |
| 369 | `src/lib/components/layout/TimeEntriesPanel.svelte` |
| 360 | `src/lib/storage/sqlite-adapter.ts` (dead) |
| 349 | `src/routes/spike/+page.svelte` (dead) |
| 343 | `src/routes/settings/two-factor/+page.svelte` |
| 325 | `src/lib/storage/dexie-adapter.test.ts` (dead) |
| 317 | `src/lib/components/timer/TimerWidget.svelte` |
| 313 | `src/lib/powersync/connector.test.ts` |
| 312 | `src/lib/components/layout/NoteEditorPanel.svelte` |
| 291 | `src/lib/components/notes/extensions/wiki-link.ts` |
| 290 | `src/lib/components/weekly/TimeEntryCard.svelte` |

Next 14: `queries-read.ts` 271, `seed.ts` 268, `queries/notes.ts` 254, `admin/…/[contractId]/+page.server.ts` 233, `NoteListPanel.svelte` 219, `iso-week.test.ts` 216, `navigation.test.ts` 213, `fetch-data-service.ts` 212, `time-parse.test.ts` 211, `time/new/+page.svelte` 210, `print-styles.css` 208, `navigation.svelte.ts` 207, `types.ts` 202, `e2e-playwright/sync-roundtrip.spec.ts` 201. Removing the dead sync/storage/spike code alone takes 8 of the 29 off the list.

### Modules missing a readme

`src/lib/server/db/queries/` (14 files, the busiest server module), `src/routes/api/` (25 routes; only `api/notes/` has one), `src/routes/time/`, `src/routes/spike/`, `src/routes/settings/`, `src/routes/login|register/`, `src/lib/components/` (root), `src-tauri/`, `config/` (PowerSync + sync rules), `scripts/`, `drizzle/`. Plus the ten stale readmes listed in §3.

### `npm run check`

On `84180d6` after `svelte-kit sync`: **0 errors, 23 warnings in 12 files** (the brief's "1 error / 24 warnings" was not reproduced here; the 4 errors QA 014 recorded in May were fixed by sprints 004/006). Warning categories:

- 17 × `state_referenced_locally` — props copied into `$state` for editable forms: `admin/ClientRow.svelte:7-9`, `ContractRow.svelte:15-17`, `WorkTypeRow.svelte`, `DeliverableCard.svelte`, `timer/TimerCompletionForm.svelte` (`initialContractId`/`initialDescription`), `routes/+layout.svelte` (×3, `data`), `routes/time/new/+page.svelte` (×2).
- 5 × a11y — `a11y_autofocus` (`TimeEntryCard.svelte:275`, `WikiLinkInput.svelte:161`), `a11y_label_has_associated_control` (`NewEntryRow.svelte:135,141`), `a11y_no_static_element_interactions` (`AddTimeEntryModal.svelte:82`).
- 1 × `non_reactive_update` — `NoteEditor.svelte:55` (`editorElement` bound without `$state`).

### `npm run lint`

- At `84180d6` with the 15 stale worktrees present: **51,775 errors**, 99.9% from `.claude/worktrees/*/.svelte-kit/**` generated files (now pruned).
- After the prune: **3,325 errors**, of which 3,314 come from `playwright-report/trace/*.js` (generated, git-ignored, but not in `eslint.config.js` ignores). `eslint.config.js:50` should add `playwright-report/`, `test-results/`, `.claude/`.
- **11 real errors in `src/`:** `TimeEntriesPanel.svelte:187,195` (`svelte/prefer-svelte-reactivity`), `note-export.ts:5` (`prefer-const`), `WikiLinkInput.svelte:142` (unused `event`), `WikiLinkRenderer.svelte:54` (each without key), `NoteTimeEntryLink` unused in `data-service.ts:11`, `delegating-data-service.ts:21`, `fetch-data-service.ts:12`, `powersync-data-service.ts:25`, and `spike/+page.svelte:216,310`.

### Other health observations

- Two direct `fetch` calls in components (§2) and a `window.dispatchEvent` bus for `note-saved` / `note-moved` (`NoteEditorPanel.svelte:91,156`, `NoteListPanel.svelte:134-135`) where a store would do.
- Server modules read `process.env` directly (`db/index.ts:6`, `auth.ts:8-9`, `hooks.server.ts:110`) instead of `$env/dynamic/private`; combined with hard-coded fallbacks this makes it easy to run against the wrong DB/secret without noticing.
- Date handling mixes UTC (`toISOString().split('T')[0]` in `api/weeks/+server.ts:19,33`, `queries/time-entries.ts:75,149`, `queries/notes.ts:67`) with local dates (`TimeEntriesPanel.svelte:25`, `navigation.svelte.ts:70`, `WeekStrip.svelte:47-53`).
- `getNextNoteId` (`queries/notes.ts:50-88`) is read-then-insert with no uniqueness guard beyond the PK; and it is not user-scoped (fine for one user).
- `tsconfig.json` and `vite.config.ts` are fine; `svelte.config.js` uses `adapter-node` only (the SPEC's dual static/node build for Tauri was never set up; `tauri.conf.json` points `frontendDist` at `../build`, which `adapter-node` does not produce as a static site).

---

## 6. Test suite inventory

| Suite | Command | Files / tests | Needs | Result today |
|---|---|---|---|---|
| Unit (vitest) | `npm test` (`vite.config.ts` `test.include: src/**/*.test.ts`, excludes `src/e2e`) | 23 files / 335 tests | nothing for 21 files; **Postgres on `localhost:5432`** for `queries/notes.test.ts` (3) and `queries/attachments.test.ts` (7) | 325 pass, 10 skipped, **2 files FAIL with `ECONNREFUSED`, exit 1** (~1 s) |
| API e2e (vitest) | `npm run test:e2e` (`vitest.config.e2e.ts`) | 11 files / 46 tests | full Docker stack: app on `127.0.0.1:5173`, Postgres, **PowerSync service on :8080** for `powersync-infra` (3) and `powersync-sync` (4); registers a fresh user per run (`src/e2e/setup.ts`), files run sequentially | not run (no Docker) |
| Playwright | `npm run test:playwright` (`playwright.config.ts`) | 5 specs / 22 tests × 2 browsers (+ `auth.setup.ts`) | dev server on `localhost:5173` (auto-started), Postgres, `npx playwright install`; registers a user through the UI per run | not run. `offline-behavior.spec.ts` (5) is `test.skip` on WebKit (`:23`) → 5 skipped by design. Selectors (`Time Entries` button, `Notes` heading, `New Note`, `Delete`) still exist in current components, so smoke/crud should still pass; `pwa.spec.ts` only checks the manifest. |

Unit test distribution: utils 104 (iso-week 38, time-parse 33, reconcile-description-links 18, client-colors 9, format-date 6); services 51; PowerSync 46 (mocked); storage 22 (dead module); notes/editor 48 (note-export 20, attachment-resolver 14, editor-features 7, anchored-heading 7); server 31 (note-links 16, extract-preview-lines 11, powersync-auth 4); stores 10; layout/weekly 13 (both for unreferenced components); DB-dependent 10.

There is **no single command** that runs all three suites (CLAUDE.md asks for one), and `npm test` is red on a laptop without Docker because the two DB tests fail in `beforeAll` rather than skipping.

---

## 7. Top 10 risks / defects visible from code

1. **Merge `c155e2c` silently reverted sprint 006 + the sync toggle.** `+layout.svelte` lost service-worker registration, the update prompt, `ConnectionStatus`, and the `PUBLIC_SYNC_MODE` → `PowerSyncDataService` swap. The project's headline epic is unwired on `main` and no document says so.
2. **The PowerSync client cannot work against this API** (§2): snake_case uploads vs camelCase routes, locally generated note IDs vs server-generated, `clients.color_index` missing from the client schema, `POST /api/clients` does not exist. Its 46 unit tests are green because they mock everything. "GATE B/C PASS" never ran this code path in a browser.
3. **Timer pause does not change the saved duration** (`TimerWidget.svelte:144-150` vs `queries/time-entries.ts:181-186`), plus UTC-date/local-time mix (`:148-150`) and midnight clamp to 0. Billing-affecting.
4. **Security gaps vs SPEC:** no encryption at rest (`ENCRYPTION_KEY` unused), default `BETTER_AUTH_SECRET` fallback (`auth.ts:8`), hard-coded Tailscale IP in `trustedOrigins` (`auth.ts:22`), public unauthenticated `/spike`, `303` instead of `401` on `/api/*`, unguarded `request.json()` everywhere.
5. **Silent failure of writes.** Every save/delete `catch`es and `console.error`s only (`TimeEntryCard.svelte:67-83`, `NoteEditorPanel.svelte:101-103`, `TimerWidget.svelte:89-91,121-123`); debounced saves can be lost on navigation; no toast/feedback (UX-4 #3).
6. **CL-6 regressed.** Deliverable/work type cannot be set from `NewEntryRow` (lost in 017), `AddTimeEntryModal`, or inline on a card, and `PUT /api/time-entries/[id]` drops those fields (`:24-28`). The only live path is the timer completion form; the full form at `/time/new` is unreachable.
7. **Note-link navigation from time entries is a no-op** (`TimeEntriesPanel.svelte:274` passes no `onNoteLinkClick`), and notes can only unlink, never link, time entries (`linkNoteTimeEntry` has no UI caller). Half of CL-8 is dead on arrival.
8. **Client colours are all the same.** No admin UI, seed or provisioning sets `colorIndex`; every client is `0`, so the colour dots, card borders and WeekStrip bars from 017 carry no information.
9. **Week view loading is incoherent:** "Load older weeks" fetches but never displays (`TimeEntriesPanel.svelte:108-129,356-366`), `hasMoreWeeks` is never cleared, future weeks render empty, `refreshWeeks` re-fetches every cached week on each edit, and `/api/time-entries/weekly` does one status query per week.
10. **Process hygiene:** `eslint.config.js` does not ignore generated output (3,314 noise errors), `npm test` needs Docker to go green, 29 files >200 lines (8 of them dead code), 10 stale readmes, a stale interface contract, two backlogs (`BACKLOG.md` vs `docs/backlog.md`), `CLAUDE_MEMORIES.md` out of date, `UI-SPEC.md` still describing the pre-017 layout.

Lower-priority but real: `getNextNoteId` race; `ensureAppUser` in-memory cache per process; attachments stored as `bytea` with no size limit; `AppShell` mobile has no timer/header; `isPinned` has no toggle; search is title/id-only while notes have no titles.

### Rebuild vs stabilise

**Stabilise the core; cut the sync layer out rather than rebuild the app.**

Reasoning:

- The alive core — SvelteKit routes + Drizzle/Postgres + Better Auth + `FetchDataService` + TipTap + the 017 time view — is architecturally sound, modular (29 panels/components with clear seams), and was verified end-to-end at the API level in May (QA 014: every endpoint PASS; 46 API e2e + 22×2 Playwright tests green at the 008 sign-off). Most of the defects above are local and each is a day or less of work; none argues for a different stack.
- What *is* unsalvageable in its current form is the offline/sync story: `storage/` is dead, the PowerSync client is incoherent with the API (§2) and has never run in the UI, and the one merge that was supposed to carry the PWA shell dropped it. Roughly 4-5k of the ~15.5k source lines (powersync 1.7k, storage ~0.9k incl. schema/helpers, spike 0.35k, `/time` routes 0.35k, orphan components ~0.5k, plus 1.1k of tests for them) are dead or unreachable. Removing them makes `main` honest, halves the >200-line offenders, and removes `dexie`, `@tauri-apps/plugin-sql`, `@journeyapps/wa-sqlite` and `@powersync/web` from the dependency tree.
- Offline sync should be re-decided, not re-implemented reflexively. For a single-user app whose primary target is a desktop that is usually online, a NetworkFirst service worker plus read-through caching may be enough; if true offline writes are still required, PowerSync deserves a fresh, gated sprint with **payload-compatibility tests against the real API** (not mocks), a server-side id-reconciliation design for notes, and schema parity checks — i.e. redo Phase D properly rather than resurrect this one.

Suggested order of work if stabilising: (1) land the §4 salvage + lint ignores + skip-without-DB for the two integration tests; (2) delete dead code (storage, spike, `/time*`, orphans, `WeekListPanel`) and fix the docs that reference them; (3) fix risks 3, 5, 6, 7, 8 (all UI/API local); (4) security items in 4; (5) decide offline; (6) only then reopen 018-QA against a running stack.
