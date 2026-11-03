# Sprint 026 — CL: Admin, shell and safety

**Status:** active
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
_Fill in._
