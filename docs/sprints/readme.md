# Sprint Index

## Active Sprints

| Sprint | Team | Phase | Status |
|--------|------|-------|--------|
| 018-QA | QA | Manual testing backlog | superseded by docs/review/2026-11-03-qa-state.md |
| 066-TR | Design | Total time r1 layout (approved design pack `docs/design/total-time-r1`): bounded two-column desktop modal (date toolbar, big pine total with By contract open, client-tinted contract column with pattern marks), phone results screen with a Contracts row opening a live selection sheet (Done / Escape only close it, sheet first), Try again on failure; presentation only ([spec](sprint-066-TR.md)) | branch `total-time-r1`, not merged |
| 065-TT | Feature | Total time: tapping the week total opens a Total time modal (date range with All time / week / month / year, contracts with All / None, total and per-contract breakdown; phone full window), `GET /api/time-entries/total`, `chronolog total` ([spec](sprint-065-TT.md)) | merged, live at v1.7.0 |
| 060-DR | Design | Design r1 polish after checkpoint B/C: link titles in search excerpts and split cards, 24-hour time fields, new-entry placeholders, split summary footprint, compact phone week controls, stopped pill, phone notes title, disabled toolbar buttons ([spec](sprint-060-DR.md)) | merged, live at v1.5.1 |
| 064-DR | Design | Owner polish round: edge-to-edge day bars with entry times aligned on the day total, pulse light removed, contract picked from the timer heading (no tile region until chosen, Select / Change dropdown), editor-header repeat uncapped, one-row notes list header with a borderless New note icon, linked time rows with clock glyph and inline unlink confirm ([spec](sprint-064-DR.md)) | merged, live at v1.6.1; scrollbar fix v1.6.2 |
| 063-DR | Design | Contract pattern tiles: 32 procedural one-colour cutouts (CSS mask over the client colour), deterministic hash allocation with no migration, tiles in every ContractMark, DS-04 placements (timer 1.5-tile region, selected sidebar row, notes list and editor header repeats) ([spec](sprint-063-DR.md)) | merged, live at v1.6.0 |
| 062-DR | Design | "Chronolog" home button top left on every layout with ‹ › right of it (desktop, tablet, phone, /search, Settings, Trash); the phone's "← Back" label and "← Back to app" replaced; compact phone pill below 420 px ([spec](sprint-062-DR.md)) | merged, live at v1.5.1 |
| 061-DR | Design | Week numbering back to ISO 8601 everywhere (labels, `/time/YYYY-Www`, `/api/me`, weekly statuses, CLI); one helper `iso-week.ts`, shared fixtures; no migration ([spec](sprint-061-DR.md)) | merged, live at v1.5.1 |
| 059-DR | Design | Design r1 stage 7: `/search` inside the app shell with one large query field, title-first results with contract marks and match reasons, shared `[[` link picker (identity rows, stale guard, above the phone keyboard, full dismissal) ([spec](sprint-059-DR.md)) | merged, live at v1.5.0 |
| 055-DR | Design | Design r1 stage 4: time capture and completion (stable completion form, one shared ontology cascade with sole-option and failure rules, 409 handling, phone capture screen with Back, keyboard-safe actions, manual entry Escape guard, Split stub) ([spec](sprint-055-DR.md)) | merged, live at v1.5.0 |
| 056-DR (UI) | Design | Design r1 stage 5: the desktop two-card split (shared boundary, Flip, left first, right Stop / Save / Discard / Resume, Cancel and Escape guard, resize cancel, split marker and reload reconcile) ([spec](sprint-056-DR-ui.md); server half [sprint-056-DR-api.md](sprint-056-DR-api.md)) | merged, live at v1.5.0 |
| 057-DR | Design | Design r1 stage 6: weekly time review (week overview strip, sticky bark day headings, aligned entry rows with ContractMarks, local missing-detail cues, steady inline editing, phone reflow without the footer timer) and Week 1 = week containing 1 January, reverted to ISO by 061-DR ([spec](sprint-057-DR.md)) | merged, live at v1.5.0 |
| 053-DR | Design | Design r1 stage 3a: app shell and sidebar (tinted client groups, ContractMarks, surface selection, Time Entries mute), search at the far right, one visible timer (collapse, header reflection, Finish entry), shared capture store ([spec](sprint-053-DR.md)) | merged, live at v1.4.0 |
| 054-DR | Design | Design r1 stage 3b: notes list / editor headers (context ownership, New note icon, Note actions menu), grouped toolbar with phone overflow, quiet linked time, note scroll restore on Back ([spec](sprint-054-DR.md)) | merged, live at v1.4.0 |
| 058-DR (API) | Server | Shared search matcher: client/contract-aware, word AND, one rank scale for `/api/search` and the `[[` picker ([spec](sprint-058-DR-api.md)) | merged, live at v1.4.0 |
| 056-DR (API) | Server | Design r1 split groundwork: `POST /api/timer/split` (one transaction, idempotent), resume and stopped-start edit via `PATCH /api/timer`, draft-only save/discard, links on timer save ([spec](sprint-056-DR-api.md); UI half [sprint-056-DR-ui.md](sprint-056-DR-ui.md)) | merged, live at v1.4.0 |
| 052-DR | Design | Design r1 stage 2: tokens, system font, earth-tone palette and client colours, ContractMark, control recipes | merged, live at v1.4.0 |
| 051-UI | Client | Sidebar tidy (Archived chevron, Settings in list, no +), Notes heading opens all notes, Saved/Saving pill, copy note code | merged |
| 050-UI | Client | Back and forward through the user's journey (top bar ‹ ›, phone ›, every navigation a step) | ready for review |

## Completed Sprints

| Sprint | Team | Phase | Status |
|--------|------|-------|--------|
| 050-UI | Client | Back/forward through the journey: top bar ‹ › left of search, ⌘[ ⌘], week paging is a step | merged |
| 049-UI | Client | Attach a note to a time entry; sidebar + New contract; client chevrons on the right | merged |
| 048-DT | Desktop/iOS | Tauri iOS shell and TestFlight lane (ship-ios.sh), up to signing | merged |
| 047-QA | QA | iPhone-size UI pass: 18 issues, 14 fixed; iPhone Playwright projects | merged |
| 045-CL | Client/Server | Offline outbox: persistent read cache, write outbox, idempotent creates, service worker | merged |
| 044-CL | Client/Infra | Platform follow-ups: 2FA test, drift notice, colours, flaky tests | merged |
| 043-CL | Client | Notes follow-ups: trash view, previews, phone Undo, panel split | merged |
| 046-CL | Client | Search results interleaved with type icons | merged |
| 039-CL | Client/Server | Pinned notes, client view, sidebar collapse and client reorder | merged |
| 040-CL | Client/Server | Checkbox task lists, `chronolog todos` | merged |
| 041-CL | Client/Server | Editable timer start, Today button, Archive/Activate in Settings | merged |
| 042-CL | Client/Server | Global search and find in page | merged |
| 037-CL | Client/Server | Server-side note trash with restore; word count on create | merged |
| 038-CL | Client/Server | Batch notes and time entries, chronolog import | merged |
| 035-DT | Desktop | macOS menu-bar app (Tauri 2) wrapping production | merged |
| 036-CL | Client/Server | Attachments: PDFs, magic-byte checks, CLI attach/get/delete, CLI 1.0.0 | merged |
| 034-CL | Client/Server | CLI edits, appends, deletes, restores and backdates notes | merged |
| 033-CL | Client | Archived clients in the sidebar; single-contract collapse | merged |
| 032-CL | Client/Server | Work type must match the deliverable; CLI edit of work type | merged |
| 031-CL | Client/Server | Admin objects through the API and CLI | merged |
| 029-CL | Client/Server | API hardening and quick wins | merged |
| 030-CL | Client | Timesheet polish | merged |
| 027-CL | Client | Navigation state, URLs and context | merged |
| 028-CL | Client/Server | API tokens, CLI and the laptop skill | merged |
| 024-CL | Client | Notes and editor rough edges | merged |
| 026-CL | Client | Admin, shell and safety | merged |
| 025-CL | Client | Timesheet and entry-form rough edges | merged |
| 023-CL | Client/Server | Device access key gate + encryption at rest | merged |
| 019-CL | Client | Stabilise: timesheet bugs | merged |
| 022-IF | Infrastructure | Production stack on the Mac mini | merged |
| 020-CL | Client | Stabilise: notes and editor bugs | merged |
| 021-CL | Client/Infra | Stabilise: dead sync code out, lost wiring back, doors closed | merged |
| 017-CL | Client | Timesheet redesign (UX-2 impl) | merged |
| 004-CL | Client | Phase D — Wire PowerSyncDataService | merged |
| 016-CL | Client | Note move between contracts | merged |
| 015-UX | UX | Future feature recommendations (UX-4) | signed-off |
| 014-CL | Client | Note-time entry linking (CL-8) | merged |
| 014-QA | QA | Full feature verification (Tasks 1-10 + sync infra) | conditionally passed |
| 013-UX | UX | Note-time linking UX (UX-3) | signed-off |
| 013-CL | Client | Note export MD+PDF (CL-5) | merged |
| 012-UX | UX | Timesheet layout redesign (UX-2) | signed-off |
| 012-CL | Client | Markdown editor + code blocks (CL-4) | merged |
| 011-UX | UX | Document existing app (UX-1) | merged |
| 010-CL | Client | Deliverable selector (CL-6) | merged |
| 009-CL | Client | Hours total in week status (CL-7) | merged |
| 001-GK | Gate Keeper | GATE 0 — Tauri/WebKit OPFS spike | signed-off (GO) |
| 002-IF | Infrastructure | Phase A — Containerised stack | merged |
| 002-CL | Client | Phase C — DataService abstraction | merged |
| 003-IF | Infrastructure | Phase B — Sync rules + schema + auth | merged |

## Closed Sprints

| Sprint | Team | Phase | Status |
|--------|------|-------|--------|
| 001-IF | Infrastructure | (superseded by 002-IF) | closed |
| 001-CL | Client | (superseded by 002-CL) | closed |
