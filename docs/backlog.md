# Chronolog — Backlog

The live backlog, rewritten 2026-11-03 after sprints 019 to 028. Sprint history is in `docs/sprints/readme.md`, owner decisions in `docs/decisions.md`, and the latest reviews in `docs/review/`. The root `BACKLOG.md` is the original long-form task list and is no longer maintained.

## Done (2026-11-03 session)

- **019-CL** Timesheet stabilised: duplicate-key crash fixed, timer and modal saves appear without a reload.
- **020-CL** Notes and editor stabilised: toolbar state, login redirect, wiki-link fixes.
- **021-CL** PowerSync, storage and spike code removed; lost wiring restored; doors closed.
- **022-IF** Production stack on the Mac mini: compose files, loopback binding, launchd scripts, backups.
- **023-CL** Device access key gate and encryption at rest (AES-256-GCM).
- **024-CL** Notes and editor rough edges: autosave flush, titles, search, export, draft New Note, 409 on stale saves.
- **025-CL** Timesheet and entry forms: one duration parser, visible errors, Escape and Enter rules, week status menu.
- **026-CL** Admin, shell and safety: safe deletion with archive, honest offline banner, 768 px breakpoint, page titles.
- **027-CL** Navigation state: the URL is the state, one `openNote()`, context labels, scroll restore.
- **028-CL** Personal API tokens, the `chronolog` CLI and the `chronolog-secretary` skill.
- **Offline banner and read cache** (`fix/offline-banner-and-cache`): the banner shows when the server is unreachable, and the read cache is write-through.

## Next (owner-decided, in this order)

1. **Go-live on the Mac mini.** Owner steps in `docs/DEPLOYMENT.md`: `.env.prod`, first deploy, first account with registration opened then closed, Cloudflare Tunnel ingress and rate-limit rules, nightly backups.
2. **Offline outbox sprint.** Long-lived read cache plus write outbox, last-write-wins per field, a visible "replayed" marker, and a held queue with a prompt when the server copy changed meanwhile (`docs/decisions.md`).
3. **Airtable hours logging skill.**
4. **End-client status and hours API skill.**
5. **Invoice generation from existing templates.**
6. **Key rotation (IF-4) and per-device keys (IF-5).** An `enc2:` envelope with a key id and a re-encrypt walker; several device keys so one lost device can be revoked alone.

## Carried-over follow-ups

### Notes / editor

- Toolbar `disabled` states evaluate once; only the active highlights are reactive (020 sign-off).
- A keepalive save at unload can reach the server after the reloaded page has loaded the note; the next edit gets the conflict message, no text lost (024 sign-off).
- PDF export has not been tried in the native macOS print dialog; check on the Mac (024 sign-off, friction #11).
- No note-side picker to reference a time entry; only the time-entry side links today (friction #21, 024 task 8).
- Note pinning from the UI spec is not built (friction #40).
- Wiki-link text drops out of note titles and previews, leaving "Beta note links to" and "See ." (integration-qa-2 O1, journeys P-12).
- Wiki-links to deleted notes render and do nothing on click (journeys A-10).
- Note IDs keep the old client code after a client rename or a move (journeys P-07).
- Phone landscape: the editor is about 80 px tall, with the linked panels taking the rest of the screen (journeys A-09).
- Phone "Linked time entries": the date wraps into the duration (journeys P-06).
- The offline backend must implement the DataService methods added in 024 (`searchNotes`, `getNoteTitles`, `createNote`, `updateNote`) (024 sign-off).

### Timesheet / timer

- Pause was removed in 025; bringing it back needs a `paused_seconds` column (025 sign-off).
- A timer with no contract lives only in this browser's localStorage, so another device will not see it (025 sign-off).
- `calculateElapsedFromStartTime` ignores the date, so a timer running past midnight under-reports its display (025 sign-off).
- Bare integers are read as minutes (`8` is 8 minutes); revisit if users type hours (025 sign-off).
- Time cards collapse the newline, so "Formerly: ..." reads inline; give it its own muted line (026 sign-off).
- Changing an entry's contract silently drops its deliverable (journeys P-05).
- The timer pill shows the pink Internal colour with no contract, and `0:00:01` against `00:00:01` in the widget (journeys P-02).
- Today's section is inset 12 px, so its cards do not line up with other days (journeys P-01).
- `TimeEntryDisplay.clientId`, `deliverableId` and `workTypeId` are still optional (019 sign-off).

### Admin / shell

- The deliverable sort-order number field and drag-to-reorder are not built; contracts have up and down arrows only (026 sign-off, friction #30).
- `deleteWorkType` in `queries/work-types.ts` still cascades and nothing calls it; remove it (026 sign-off).
- Admin reads as a separate app rather than the same shell (journeys P-03).
- Two contracts with the same name under one client are allowed and look identical in the sidebar (journeys P-08).
- First run gives an empty week and a hidden "General" contract, and nothing says clients are made under Settings (friction #31).

### Navigation

- The root layout creates the navigation context only on initial mount, so a client-side move from an unauthenticated page into `/` throws "Navigation context not found"; `/login` works around it (020 sign-off).
- Keyboard focus is lost after saving an entry and after following a wiki-link, and lands on `<body>` (027 sign-off, journeys A-11).
- The in-app history mirror resets when the browser jumps to an entry it did not record, for example after a crash restore (027 sign-off).

### API / CLI

- `POST /api/notes` retries an ID collision five times, then returns 500; eight parallel creates exhaust it. Fix before any bulk import (027 sign-off).
- `getNextNoteId` uses the UTC date, so evening notes on the laptop get tomorrow's date (028 sign-off).
- Opening a CLI note in the editor autosaves it as TipTap JSON, which counts as an edit (028 sign-off).
- `POST /api/notes` and `POST /api/time-entries` do not check that the contract belongs to the user; harmless with one user per instance (028 sign-off).
- The failure limiter is in memory and per process (028 sign-off).
- The CLI cannot edit or delete entries; candidates are `chronolog edit` or `chronolog undo` (028 sign-off).

### Infrastructure / dev environment

- `db:seed` writes plaintext; run `scripts/encrypt-existing.mjs` after seeding (023 sign-off).
- `encrypt-existing.mjs` has no tested route to production Postgres; only a database created before 023 needs it (023 sign-off, `docs/DEPLOYMENT.md`).
- Password reset has no tested production path: production Postgres has no host port and the image has no `tsx` (022 sign-off, `docs/DEPLOYMENT.md`).
- Leftover `chronolog-bucket-storage-1` container and `chronolog_bucket_storage_data` volume from PowerSync; remove them (022 sign-off).
- SSH key-only login and Screen Sharing restricted to the Tailscale interface are deferred; do them together with go-live, not unattended (`docs/decisions.md`).
- `svelte-check` reports 12 pre-existing warnings (026 sign-off).
- `.claude/context7-registry.md`: `/svelte/svelte` no longer resolves and `/ueberdosis/tiptap` redirects (020 sign-off).

### Docs

- `docs/SPEC.md` still describes Dexie and IndexedDB as the PWA storage layer (021 sign-off).
- `docs/platform-abstraction.md` describes the deleted `src/lib/storage` design, and the README links to it (021 sign-off).
- `docs/backlog-client.md` and `docs/backlog-infrastructure.md` carry obsolete PowerSync items; this file replaces them (021 sign-off).
- `docs/ONBOARDING.md` restore section still mentions sprint 024 (028 sign-off).

## Housekeeping

- Three unmerged API-hardening branches on origin, each with one commit not on `main` (checked 2026-11-03): `fix/json-parse-error-handling` (try/catch around `request.json()`), `fix/time-entry-search-input-validation`, `fix/weekly-status-input-validation`. Re-apply onto `main` by merge or by hand, then delete the branches.
- The Sprint 018-QA manual checklist was never run; the live QA reviews in `docs/review/` cover the automatable parts.
- Pre-prune safety net: `~/sites/chronolog-prune-backup-2026-11-03.bundle` holds every ref that existed before the worktree and branch prune.
