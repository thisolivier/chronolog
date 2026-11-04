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
- **029-CL** API hardening and quick wins: JSON body guards, weekly-status validation, note IDs in the user's timezone under an advisory lock, contract ownership on writes, `chronolog edit` and `undo`, first-run notice.
- **030-CL** Timesheet polish: today's alignment, timer pill and clock, timer past midnight, visible deliverable reset on contract change, Formerly line, keyboard focus after save and wiki-link.
- **Docs sweep**: SPEC storage and deployment passages current, obsolete PowerSync docs removed or marked historical.
- **031-CL** Clients, contracts, deliverables and work types through the API and the CLI (add, edit, archive, remove with safe deletion).
- **032-CL** One validation for contract, deliverable and work type on every entry write path; `chronolog edit --deliverable/--work-type`; `scripts/check-entry-references.mjs`.
- **033-CL** Archived group in the sidebar, single-contract clients as one row, archived-contract journeys fixed.
- **034-CL** `note edit/append/delete/restore`, `note new --date`, PATCH notes with conflict detection, markdown-only saves clear stale TipTap JSON.
- **036-CL** PDF attachments, upload type checked by magic bytes, `note attach`/`attachments`, `attachment get/delete`, `chronolog --version` 1.0.0, `BODY_SIZE_LIMIT` fix.
- **035-DT** macOS menu-bar app: window loads production, close hides, tray shows the running timer, built on the Mac mini (`~/sites/chronolog-desktop/`).
- **038-CL** `POST /api/notes/batch`, `POST /api/time-entries/batch`, `chronolog import notes|entries`, `undo --last-import`, CLI 1.1.0.
- **037-CL** Server-side note trash (`deleted_at`, 30-day purge, restore keeps ID and links), Undo toast, deleted wiki-links with inline restore, word count on create, container-runnable backfill and purge scripts; backlinks user-filter fix.
- **039-CL** Pinned notes (`note pin|unpin`), client view `/notes/client/<id>`, collapsible clients, drag/keyboard client reorder (`client edit --order`); migration 0010.
- **040-CL** Checkbox task lists in the editor and markdown, PDF boxes, `GET /api/notes/todos`, `chronolog todos`.
- **041-CL** Editable start on a running timer (`PATCH /api/timer`, `timer start --at`, `timer adjust`, `timer stop`), Today button, Archive / Activate in Settings.
- **042-CL** Global search (`/search`, `GET /api/search`, notes and entries, Cmd+K) and Cmd+F find in page; `chronolog search` covers entries. CLI 1.2.0.
- **Offline banner and read cache** (`fix/offline-banner-and-cache`): the banner shows when the server is unreachable, and the read cache is write-through.

## Next (owner-decided, in this order)

1. **Go-live on the Mac mini.** Owner steps in `docs/DEPLOYMENT.md`: `.env.prod`, first deploy, first account with registration opened then closed, Cloudflare Tunnel ingress and rate-limit rules, nightly backups.
2. **Offline outbox sprint** (045-CL; runs last in the 2026-11-04 backlog run). Long-lived read cache plus write outbox, last-write-wins per field, a visible "replayed" marker, and a held queue with a prompt when the server copy changed meanwhile (`docs/decisions.md`).
3. **Airtable hours logging skill.** Deferred by the owner until the MCP details are in hand.
4. **End-client status and hours API skill.** Deferred until the owner has API access.
5. **Invoice generation from existing templates.** Deferred until 3 and 4 are sorted.
6. **Key rotation (IF-4) and per-device keys (IF-5).** Discuss with the owner before starting. An `enc2:` envelope with a key id and a re-encrypt walker; several device keys so one lost device can be revoked alone.

## Owner-requested, back of the queue (2026-11-04)

All done in sprints 039–042 (2026-11-04). Open from them: the editor header has no pin control (list row only); the tablet overlay sidebar stays open when switching client views; `notes.is_pinned` is still written alongside `pinned_at` (drop later); find in page skips the raw markdown mode and wiki-link titles; `NoteEditor.svelte` is about 690 lines (move its CSS out); a client created after a reorder lands at the bottom.

## Carried-over follow-ups

### Notes / editor

- No trash view in the browser; reachable only via Undo, a deleted wiki-link or the CLI (037 sign-off).
- Phone: the Undo toast unmounts with the panel, so Undo is mostly desktop (037 sign-off).
- `NoteEditorPanel.svelte` is 526 lines and due a split; the secretary skill is 213 lines, over its 200 guideline (037 sign-off).

- Notes list preview shows raw link markdown for attachment links (`[file.pdf](chronolo…`); fix in `extract-preview-lines` (036 sign-off).
- A link to a deleted attachment opens a tab that closes again, with no "missing" styling unlike images (036 sign-off).


- Toolbar `disabled` states evaluate once; only the active highlights are reactive (020 sign-off).
- A keepalive save at unload can reach the server after the reloaded page has loaded the note; the next edit gets the conflict message, no text lost (024 sign-off).
- PDF export has not been tried in the native macOS print dialog; check on the Mac (024 sign-off, friction #11).
- No note-side picker to reference a time entry; only the time-entry side links today (friction #21, 024 task 8).
- Wiki-link text drops out of note titles and previews, leaving "Beta note links to" and "See ." (integration-qa-2 O1, journeys P-12).
- Note IDs keep the old client code after a client rename or a move (journeys P-07).
- Phone landscape: the editor is about 80 px tall, with the linked panels taking the rest of the screen (journeys A-09).
- Phone "Linked time entries": the date wraps into the duration (journeys P-06).
- The offline backend must implement the DataService methods added in 024 (`searchNotes`, `getNoteTitles`, `createNote`, `updateNote`) (024 sign-off).

### Timesheet / timer

- Pause was removed in 025; bringing it back needs a `paused_seconds` column (025 sign-off).
- A timer with no contract lives only in this browser's localStorage, so another device will not see it (025 sign-off).
- `TimeEntryDisplay.clientId`, `deliverableId` and `workTypeId` are still optional (019 sign-off).

### Admin / shell

- Two clients can share the same palette colour (Internal and Acme both pink in test data); more visible now that single-contract rows show the dot alone (033 sign-off).
- The checklist driver README still describes the pre-033 sidebar grouping (033 sign-off).

- The deliverable sort-order number field and drag-to-reorder are not built; contracts have up and down arrows only (026 sign-off, friction #30).
- Admin reads as a separate app rather than the same shell (journeys P-03).
- Two contracts with the same name under one client are allowed and look identical in the sidebar (journeys P-08).

### Navigation

- Sidebar is about 25 Tabs away from the editor and there are no keyboard shortcuts (journeys A-11, 030 sign-off).
- A save made from notes mode switches to the timesheet without focusing the new card; on touch screens a followed wiki-link does not focus the editor on purpose (030 sign-off).

- The root layout creates the navigation context only on initial mount, so a client-side move from an unauthenticated page into `/` throws "Navigation context not found"; `/login` works around it (020 sign-off).
- The in-app history mirror resets when the browser jumps to an entry it did not record, for example after a crash restore (027 sign-off).

### API / CLI

- `undo --last-import` removes entries only; imported notes are not undoable (038 sign-off).

- Opening a CLI note in the editor autosaves it as TipTap JSON, which counts as an edit (028 sign-off).
- No bulk reorder route for work types; names containing `/` are reachable by id only (031 sign-off).
- An entry edit that touches none of contract, deliverable or work type is not re-validated, so a pre-existing inconsistent row stays editable; `scripts/check-entry-references.mjs` reports such rows (032 sign-off).
- Version drift between laptop CLI and server is invisible; proposal: server reports its build commit on `/api/me`, CLI prints a one-line "run git pull" notice when they differ.
- `chronolog undo` only knows the last entry made by `chronolog log`; edits cannot be undone (029 sign-off).
- The first-run notice matches the starter client by name and short code `Internal`/`INTL`; renaming it hides the notice (029 sign-off).
- The failure limiter is in memory and per process (028 sign-off).

### Infrastructure / dev environment

- No automated test logs in with 2FA enabled; the 2FA login path was broken from sprint 003 until 2026-11-04 and nobody noticed. Add a Playwright test that enables TOTP, signs out, signs in with a generated code (HMAC-SHA1 TOTP in the test, no new dependency).

- Desktop app: owner to verify close-to-hide, Dock click, tray menu and Cmd+Q on the laptop and add the three screenshots to `docs/review/screenshots/sprint-035/` (Mac mini screen was locked). Bundle version is still 0.0.1 in `src-tauri/tauri.conf.json`; take it from `package.json`. Signing out while a timer runs leaves the menu bar showing it until the next signed-in page load. No updater yet (035 sign-off).

- `db:seed` writes plaintext; run `scripts/encrypt-existing.mjs` after seeding (023 sign-off).
- `encrypt-existing.mjs` has no tested route to production Postgres; only a database created before 023 needs it (023 sign-off, `docs/DEPLOYMENT.md`).
- Password reset has no tested production path: production Postgres has no host port and the image has no `tsx` (022 sign-off, `docs/DEPLOYMENT.md`).
- SSH key-only login and Screen Sharing restricted to the Tailscale interface are deferred; do them together with go-live, not unattended (`docs/decisions.md`).
- `svelte-check` reports 12 pre-existing warnings (026 sign-off).


## Housekeeping

- The three `fix/*` API-hardening branches were re-applied by hand in sprint 029 and deleted on origin.
- Shared dev Postgres holds leftover `qa-029-*` and `qa-030-*` users; harmless, delete when convenient.
- The Sprint 018-QA manual checklist was never run; the live QA reviews in `docs/review/` cover the automatable parts.
- Pre-prune safety net: `~/sites/chronolog-prune-backup-2026-11-03.bundle` holds every ref that existed before the worktree and branch prune.
