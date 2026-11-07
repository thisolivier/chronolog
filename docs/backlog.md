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
- **046-CL** Search results as one interleaved list with type icons; one-line meta on phones.
- **043-CL** Trash view `/notes/trash`, link text in previews and titles, deleted-attachment styling, `NoteEditorPanel` split, reactive toolbar disabled states, phone Undo/linked entries/landscape.
- **044-CL** Playwright 2FA login test, version drift notice (`serverCommit` on `/api/me`), desktop sign-out clears the tray timer, distinct client colours, root navigation context, `undo --last-import` trashes imported notes, 0 svelte-check warnings, skill split into SKILL.md + reference.md, deterministic WebKit tests, screenshots only with `UPDATE_SPRINT_SCREENSHOTS=1`. CLI 1.3.0.
- **051-UI** Sidebar: "Notes" heading opens `/notes/all` (every contract, newest first, no pin float; `GET /api/notes?all=true`), Archived chevron in the right-hand column, Settings a row under Trash, no `+` (contracts from Settings), no note-list search box (top bar only). Note header: fixed-width Saved/Saving pill ("Draft" before first save), Move/Export without chevrons, click the note code to copy. Follow-ups: all-notes list uncapped; "Copied" bubble briefly overlaps the Move/Export line on phones; `dataService.searchNotes` unused by the UI; webkit `notes-followups` flake ("navigation interrupted by /").
- **050-UI** Back and forward: ‹ › left of the left-aligned search in the desktop top bar (also on the Search, Trash and Settings headers), › beside the phone's "← Back" when there is a step ahead, ⌘[ / ⌘] and Alt+←/→; week paging and in-timesheet week jumps are now steps, note moves and offline ID swaps replace. Follow-ups: two searches are both labelled "Search" (history keeps paths only); ⌘[ / ⌘] untested in the Tauri webview.
- **049-UI** Attach note on a time entry (new note on the entry's contract, `[[ID]]` appended to the description, note opens focused; offline via the outbox), `+` New contract beside the Contracts heading, client chevrons right-aligned under it. Attach note also on the running timer once it has a contract (links the note in the timer's description, opens it). Footer "New Contract" link removed and card buttons tightened to 32 px on touch (owner, 2026-11-05). Follow-up: API e2e `note-changes-cli` "note new --date yesterday" expects a 3-digit note number and fails once the dev DB passes 999 notes a day.
- **048-DT** Tauri iOS shell (`dev.thisolivier.chronolog`, loads production, portrait on iPhone), `scripts/ios/ship-ios.sh` TestFlight lane and `testflight-setup` skill from timeConvertor, `docs/IOS-RELEASE.md`, simulator UI-test driver in `scripts/ios/ui-check/`. Proven in the simulator up to the missing provisioning profile.
- **047-QA** iPhone UI pass (SE, 15, 15 Pro Max, WebKit): 16 px inputs, `dvh` + safe areas, 44 pt touch targets, Move menu and wiki-link list on screen, stacked Settings rows, phone Find button. Deferred: touch path to reorder clients, crowded title bar while a timer runs, small contract arrows, raw `[[ID]]` when editing an entry, sideways-scrolling note toolbar has no visible hint (`docs/review/2026-11-04-iphone-ui.md`).
- **045-CL** Offline outbox: per-user IndexedDB read cache, service worker for offline reload (not in Tauri), localStorage outbox with per-field conflict hold, `clientRequestId` idempotent creates (migration 0011), account-safe replay. Not queued offline: note move/pin/trash, attachments, week status, stopping a server timer.
- **Offline banner and read cache** (`fix/offline-banner-and-cache`): the banner shows when the server is unreachable, and the read cache is write-through.

## Next (owner-decided, in this order)

1. **Go-live on the Mac mini.** Owner steps in `docs/DEPLOYMENT.md`: `.env.prod`, first deploy, first account with registration opened then closed, Cloudflare Tunnel ingress and rate-limit rules, nightly backups.
2. ~~Offline outbox~~ done in 045-CL. Follow-ups: queue note move/pin/trash and server-timer stop offline; `offline-data-service.ts` and `outbox-replay.ts` over 200 lines. Long-lived read cache plus write outbox, last-write-wins per field, a visible "replayed" marker, and a held queue with a prompt when the server copy changed meanwhile (`docs/decisions.md`).
3. **Airtable hours logging skill.** Deferred by the owner until the MCP details are in hand.
4. **End-client status and hours API skill.** Deferred until the owner has API access.
5. **Invoice generation from existing templates.** Deferred until 3 and 4 are sorted.
6. **iOS build: owner steps left.** 047 and 048 done. Owner: App ID `dev.thisolivier.chronolog`, App Store Connect record, "Chronolog App Store" profile, then `scripts/ios/ship-ios.sh 1` (the `testflight-setup` skill walks it; `docs/IOS-RELEASE.md`). Follow-ups: attachments open with `window.open`, which the iOS shell does not support (web-side fix); iPhone landscape locked because the shell reports stale safe-area insets after rotation; signed-in flows against production untried in the app until the first TestFlight install. Running side by side with the installable PWA (web app manifest, Apple home-screen tags, real icons; added 2026-11-04) to decide whether the shell earns its keep.
7. **Key rotation (IF-4) and per-device keys (IF-5).** Discuss with the owner before starting. An `enc2:` envelope with a key id and a re-encrypt walker; several device keys so one lost device can be revoked alone.

## Owner-requested (2026-11-07): revisit week numbering before 28 December

The design overhaul (057-DR, v1.5.0) replaced ISO week numbering with "Week 1 is the Monday-start
week containing 1 January". The owner flagged this as rushed and wants a proper discussion of what
ISO weeks are and which convention Chronolog should support. Nothing diverges until 28 Dec 2026, so
the decision can wait, but it must land before then (the two rules disagree from that date through
all of 2027).

Facts for the discussion:

- **ISO 8601 weeks.** Weeks start Monday. Week 1 is the week containing the year's first Thursday
  (equivalently, the week containing 4 January). A year has 52 or 53 weeks; up to three days of
  early January can belong to the previous ISO year (e.g. 1–3 Jan 2027 are 2026-W53) and up to three
  days of late December to the next. This is what most European clients, payroll systems, Outlook
  and Google Calendar (with Monday start) and `date +%V` use. It is what the app used until v1.5.0
  and what `weekly_statuses.year/week_number` rows written before then hold.
- **Current rule (calendar-year).** Week 1 is the Monday-start week containing 1 January; a week
  spanning two years belongs to the year of its Sunday. Every date's week number is at most one
  higher than ISO, and only in years where 1 January falls on a Friday, Saturday or Sunday
  (next: 2027, then 2028 and 2033). Simpler to explain, but no client or tool will agree with it.
- **What is affected.** Week labels and the `/time/YYYY-Www` URL, `GET /api/me` (`week`, with
  `isoWeek` kept as an alias holding the same value), `chronolog week|status|me`, and the
  `weekly_statuses` key. Storage is keyed by the Monday date, so switching back is a label change
  plus the renumber step in `weekly-statuses.ts`; no migration.
- **Options.** (a) Return to ISO everywhere and delete the calendar-year helper; (b) keep the
  calendar-year rule and accept disagreement with client timesheets; (c) ISO numbering for labels
  with the Monday date as the only identity in URLs and the API (`/time/2026-12-28`), which avoids
  the W53 ambiguity in bookmarks whichever rule is shown.
- **Recommendation to discuss:** (a) or (c). Client invoicing and submitted-week records are the
  places where a number that disagrees with the client's calendar causes real confusion.

## Owner-requested, back of the queue (2026-11-04)

All done in sprints 039–042 and 046 (2026-11-04). Open from them: global search does not resolve wiki-links to titles; saved titles keep a linked note's old title after a rename; the editor header has no pin control (list row only); the tablet overlay sidebar stays open when switching client views; `notes.is_pinned` is still written alongside `pinned_at` (drop later); find in page skips the raw markdown mode and wiki-link titles; `NoteEditor.svelte` is about 690 lines (move its CSS out); a client created after a reorder lands at the bottom.

## Owner-requested (2026-11-05)

- **Desktop timer placement.** Hide the top bar's running-timer indicator while the sidebar timer widget is on screen; when the left-most sidebar is collapsed, keep the timer widget visible in the middle (notes/time entries list) panel instead of losing it.

## Carried-over follow-ups

### Notes / editor




- A keepalive save at unload can reach the server after the reloaded page has loaded the note; the next edit gets the conflict message, no text lost (024 sign-off).
- PDF export has not been tried in the native macOS print dialog; check on the Mac (024 sign-off, friction #11).
- No note-side picker to reference a time entry; only the time-entry side links today (friction #21, 024 task 8).
- Note IDs keep the old client code after a client rename or a move (journeys P-07).

### Timesheet / timer

- A timer with no contract lives only in this browser's localStorage, so another device will not see it (025 sign-off).
- `TimeEntryDisplay.clientId`, `deliverableId` and `workTypeId` are still optional (019 sign-off).

### Admin / shell


- The deliverable sort-order number field and drag-to-reorder are not built; contracts have up and down arrows only (026 sign-off, friction #30).
- Admin reads as a separate app rather than the same shell (journeys P-03).
- Two contracts with the same name under one client are allowed and look identical in the sidebar (journeys P-08).

### Navigation

- Sidebar is about 25 Tabs away from the editor and there are no keyboard shortcuts (journeys A-11, 030 sign-off).
- A save made from notes mode switches to the timesheet without focusing the new card; on touch screens a followed wiki-link does not focus the editor on purpose (030 sign-off).

- The in-app history mirror resets when the browser jumps to an entry it did not record, for example after a crash restore (027 sign-off).

### API / CLI


- Opening a CLI note in the editor autosaves it as TipTap JSON, which counts as an edit (028 sign-off).
- No bulk reorder route for work types; names containing `/` are reachable by id only (031 sign-off).
- An entry edit that touches none of contract, deliverable or work type is not re-validated, so a pre-existing inconsistent row stays editable; `scripts/check-entry-references.mjs` reports such rows (032 sign-off).
- `chronolog undo` only knows the last entry made by `chronolog log`; edits cannot be undone (029 sign-off).
- The first-run notice matches the starter client by name and short code `Internal`/`INTL`; renaming it hides the notice (029 sign-off).
- The failure limiter is in memory and per process (028 sign-off).

### Infrastructure / dev environment


- Desktop app: rebuild on a Mac to pick up 1.3.0 (`git pull && npm install && CI=true npm run tauri:build`, install the dmg; 044 sign-off). Owner to verify close-to-hide, Dock click, tray menu and Cmd+Q on the laptop and add the three screenshots to `docs/review/screenshots/sprint-035/` (Mac mini screen was locked). The bundle already takes its version from `package.json`. No updater yet (035 sign-off).

- `db:seed` writes plaintext; run `scripts/encrypt-existing.mjs` after seeding (023 sign-off).
- `encrypt-existing.mjs` has no tested route to production Postgres; only a database created before 023 needs it (023 sign-off, `docs/DEPLOYMENT.md`).
- Password reset has no tested production path: production Postgres has no host port and the image has no `tsx` (022 sign-off, `docs/DEPLOYMENT.md`).
- SSH key-only login and Screen Sharing restricted to the Tailscale interface are deferred; do them together with go-live, not unattended (`docs/decisions.md`).


## Housekeeping

- The three `fix/*` API-hardening branches were re-applied by hand in sprint 029 and deleted on origin.
- The Sprint 018-QA manual checklist was never run; the live QA reviews in `docs/review/` cover the automatable parts.
- Pre-prune safety net: `~/sites/chronolog-prune-backup-2026-11-03.bundle` holds every ref that existed before the worktree and branch prune.
