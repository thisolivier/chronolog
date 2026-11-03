# Sprint 026 — CL: Admin, shell and safety

**Status:** signed-off (awaiting merge)
**Branch:** `sprint-026-CL/admin-shell-safety` · **Worktree:** `.claude/worktrees/sprint-026-CL` · **Port:** 5203
**Sources:** `docs/review/2026-11-03-ux-friction.md`, `docs/review/2026-11-03-integration-qa.md` (R1 and the two dev-environment issues), `BACKLOG.md` Task 15.

## Tasks

1. **Safe deletion [1, 20].** Deleting a contract or client with entries or notes: the confirm states the counts and offers "Archive" (default) or "Delete and reassign". Archive hides it from selects and the sidebar but keeps data. Reassign follows BACKLOG Task 15: system "Deleted Client / Deleted Contract" per user, entries get "Formerly: Client / Contract" appended, notes move. Deleting a deliverable with entries: confirm with count; entries keep a "Formerly: <name>" note in their description or the deliverable is archived. No silent cascades anywhere.
2. **Offline honesty [3].** The `ConnectionStatus` banner must actually show when offline (it did not in the review); timesheet shows "Offline, showing last loaded data" rather than "No entries"; note editor shows "Offline, changes not saved" until the outbox sprint. No data loss claims.
3. **Breakpoint [17].** Mobile drill-down below 768px; between 768 and 1023 a two-panel layout with a collapsible sidebar.
4. **Sidebar hierarchy [18].** Group contracts under client headings with the client colour dot, keep sort order, archived hidden; a tiny count of notes per contract that stays correct.
5. **Admin feedback and forms [29, 30, 31, 33].** Specific success and error messages, add-forms close on success, Cancel never looks primary, one breadcrumb, inline-edit inputs aligned, Escape cancels, drag-or-arrow reorder for contracts persisting `sortOrder` (BACKLOG Task 13), New Contract modal can create a client inline, "Settings" goes to a settings page that links admin and two-factor.
6. **Shell basics [32, 39].** `<title>` per route ("Chronolog · Notes · Rocket Build"), a friendly 404 and 500 page, malformed admin IDs give 404 not 500.
7. **Login robustness [R1].** `preventDefault` on login and register submit handlers; the native submit race cannot drop a sign-in.
8. **Note ID sequence per user [42]** (or document why global is fine for a single-user app and close it).
9. **Dev environment.** Cache the Postgres client across Vite reloads in `src/lib/server/db/index.ts` (globalThis pattern) so dev never exhausts connections; add `.claude/**` to Vite's `server.watch.ignored` so other worktrees do not trigger reloads.

## Boundaries
Owns `src/lib/components/admin/**`, `src/routes/admin/**`, `src/routes/settings/**`, `src/routes/login`, `src/routes/register`, `AppShell.svelte`, `ContractsSidebar.svelte`, `ConnectionStatus.svelte`, `src/app.html`, `src/routes/+error.svelte`, `queries/clients.ts`, `queries/contracts.ts`, `queries/deliverables.ts`, `api/clients/**`, `api/contracts/**`, `api/deliverables/**`, `db/index.ts`, `vite.config.ts`, a new migration for archive flags and system entities. Do not touch notes or timesheet components, `hooks.server.ts`, `env.ts`, `queries/notes.ts`, `queries/time-entries.ts` (023/024/025 own them). Sprint 023 is encrypting `clients.name` and `contracts.name` in parallel; keep query changes minimal and rebase onto main when 023 lands.

## Verification
check 0 errors, tests green including deletion reassignment tests against Postgres, lint clean; real UI on port 5203 at 1440, 900 and 390px widths with screenshots in `docs/review/screenshots/sprint-026/`; prove the offline banner appears with Playwright `setOffline`.

## Sign-off

Signed off 2026-11-03 on branch `sprint-026-CL/admin-shell-safety` (not merged). Verification: `npm run check` 0 errors (12 pre-existing warnings, none in files this sprint touched), `npm run lint` clean, `npm test` 356/356 including 10 deletion tests against Postgres. Real UI on port 5203 driven by Playwright at 1440, 900 and 390 px: 23/23 checks pass, no page errors, no 5xx (`docs/review/screenshots/sprint-026/probe-run.txt`, `probe.mjs`; QA user `qa-026-7lzva4@chronolog.test` left in the dev DB). Dev DB backed up before the migration to `~/Backups/chronolog-dev/daily/chronolog-2026-11-03T201904Z.dump`, using `scripts/backup-postgres.sh` pointed at the dev container.

| # | Task | Result | Evidence |
|---|------|--------|----------|
| 1 | Safe deletion | **Done.** Migration `0007` adds `archived_at` and `is_system` to clients and contracts, and stops `time_entries.contract_id` and `notes.contract_id` from cascading. `queries/safe-deletion.ts` does each delete in one transaction: entries move to the per-user "Deleted Client / Deleted Contract" (created on first use, one per user, guarded by partial unique indexes) with `Formerly: Client / Contract[ / Deliverable / Work type]` appended, then notes move, then the contract or client is deleted. Deliverable and work type deletes add `Formerly: …` to their entries. The dialog states real counts, and Archive is the focused default. A forced failure part-way (trigger on notes) rolls everything back. | shots 20–24; `safe-deletion.test.ts` |
| 2 | Offline honesty | **Done.** The banner now sits inside the shell, in the page flow. It is driven by `navigator.onLine` plus network-level request failures. Time mode says "Offline, showing last loaded data…" and the week stays on screen, because GETs fall back to the last loaded copy. Notes mode says "Offline, changes not saved…". Writes are never cached or queued, and after reconnecting it shows "Back online". | shots 50 (1440/900/390, `setOffline`), 51 |
| 3 | Breakpoint | **Done.** Below 768 px it is the mobile drill-down. From 768 to 1023 px the layout has two panels; in notes mode the sidebar becomes a ≡ overlay that closes on selection. Tablet and desktop share one DOM branch, so crossing 1024 px no longer remounts the editor. | shots 40–42 |
| 4 | Sidebar hierarchy | **Done.** Contracts sit under client headings with the colour dot, in manual order and then by name. Archived and system contracts are hidden. Note counts refresh on `notes-changed`, which the DataService fires after note create, delete and move, and on `note-moved`. | shot 10; probe T4 |
| 5 | Admin feedback and forms | **Done.** Messages name the item. A duplicate short code names the code; the old generic error came from Drizzle wrapping the 23505 error. Add-forms close only on success. Cancel is always secondary and the toggle hides while a form is open. There is one breadcrumb, rooted at Settings. Inline client edit inputs sit in their own columns. Escape cancels. Up/down reorder calls `PATCH /api/contracts/reorder` (BACKLOG Task 13; arrows, no drag). New Contract can create a client inline. The sidebar "Settings" link goes to `/settings`, which links clients and two-factor, and `/admin` redirects there. | shots 01–05, 11 |
| 6 | Shell basics | **Done.** Every route has a title ("Chronolog · Notes · TPS Reports"). `+error.svelte` is a friendly 404/500 page, with `error.html` as a fallback. A `uuid` param matcher makes malformed admin IDs return 404. | shot 30; probe T6 |
| 7 | Login robustness | **Done.** `preventDefault` is in the login, 2FA and register handlers, and the submit buttons stay disabled until hydrated. Pressing Enter before hydration no longer does a native submit. | probe R1 |
| 8 | Note ID sequence | **Closed as documented** in `docs/SPEC.md` § Note ID System. `notes.id` is a global primary key and there is one account per instance, so a per-user counter would collide. | — |
| 9 | Dev environment | **Done.** The Postgres client is cached on `globalThis` outside production. Vite ignores `<root>/.claude/**`, anchored to the root because a bare `**/.claude/**` hid a worktree's own files. | `db/index.ts`, `vite.config.ts` |

**Follow-ups:**
- (025) Time cards collapse the newline, so "Formerly: …" reads inline after the description; consider rendering it on its own muted line.
- (024) `NoteListPanel` and `NoteEditorPanel` need no change for counts, because the DataService announces them.
- Merge note: migration `0007` must stay ahead of any 024/025 migration. Regenerate theirs after this merges.
- The deliverable sort-order number field and drag-to-reorder in the sidebar were not done (arrows in admin cover Task 13's persistence).
- `queries/work-types.ts` still exports an unused cascading `deleteWorkType`; nothing calls it.
