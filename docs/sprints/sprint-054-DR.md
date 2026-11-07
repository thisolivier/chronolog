# Sprint 054 — DR: Design r1 stage 3b, notes workspace headers, toolbar, linked time, note position

**Status:** ready for review
**Branch:** `design-r1-stage3b` (from the integration branch `design-r1` at `c1e43d2`) · **Worktree:** `.claude/worktrees/design-r1-stage3b` · **Port:** 5183 (server started with `ALLOW_REGISTRATION=true TRUSTED_ORIGINS=http://127.0.0.1:5183,http://localhost:5183`)
**Sources:** `docs/design/r1/specs/06-notes-workspace.md` (NT-01, NT-02, NT-04 to NT-07; NT-03 repeats deferred by the owner on 2026-11-07), `02-shell-and-navigation.md` (SH-07, SH-08), `01-design-system.md` (DS-02, DS-04, DS-06), source maps `06-07-notes-search-picker.md` §§1–4 and `02-shell-and-navigation.md` §§5–6, crops `notes-list-panel.png`, `notes-editor-panel.png`, `notes-mobile-context-toolbar.png`, `notes-mobile-document.png`.
**Ran beside:** stage 3a (AppShell, sidebar, timer widget / indicator, timer stores, history-buttons spec) in a sibling worktree. None of those files is touched here.

## What was built

- **Notes list (NT-01, NT-02).** Header: title and count, free space (kept for the deferred repeat), a New note icon button (page with a plus; accessible name and tooltip "New note"; 32 px, 44 px on touch; same draft and "which contract?" behaviour), the Created / Modified sort below. Rows keep title, time and excerpt; lists spanning contracts add a line with the `ContractMark` (sm) and the contract. Selected row and the draft row: quiet sage fill (`bg-moss-100`) and a 2 px pine edge (`border-selection-edge`).
- **Context ownership** is one pure function, `layout/note-context-ownership.ts`, used by the list and the editor panel (table below).
- **Editor header (NT-04).** Contract mark, the copyable note code plus a copy icon (both run the same copy), the unchanged Saved / Saving / Draft / failure pill, Reload on conflict, the message line, free space for the repeat, and one ellipsis button "Note actions" (`NoteActionsMenu.svelte`): Move (the menu becomes "Move note to" with the other contracts), Export as Markdown, Export as PDF, Delete (Discard on a draft). The actions are the existing `note-panel-actions.ts` functions, so the save flush, the inline Delete confirmation (`delete-confirm`), the Undo toast and the draft discard behave as before. Keyboard: the first item takes focus, arrows / Home / End move, Escape returns to the button. No title in the header.
- **Toolbar (NT-05).** Desktop: B I | ¶ (Normal text, new explicit choice) H1 H2 H3 | bullet, numbered, checklist | rule, Link, code block, Attach | Rich / Raw two-way switch at the right (`editor-mode-switch`, stays right when the groups wrap on a narrow panel). Phone (`compactToolbar`, layout mode `mobile`): B, I, a "Text style" menu (Normal text, Heading 1–3, `menuitemradio`), bullet list, checklist, a "Formatting" ellipsis menu (numbered list, rule, link, code block, attach file) and "Rich ▾" opening Rich text / Raw markdown. No capability removed; the toolbar no longer scrolls sideways (iPhone review 2026-11-04). Selection and focus survive menu use: triggers and items prevent mousedown, a pointer open leaves focus in the editor, commands run through `chain().focus()`; Escape anywhere closes an open toolbar menu. The `window.prompt` link flow is unchanged.
- **Linked time (NT-06).** Heading "Linked time · N", muted dates and descriptions, the × Unlink kept, rows still open the day and wiki-links stay clickable, no timer controls. A row names "Client / Contract" with the contract mark only when the entry is on another contract than the note. `GET /api/notes/<id>/time-entries` rows now also carry `contractId` (no schema change; the type field is optional so older cached rows still work, falling back to a name comparison).
- **Note position memory (SH-07, NT-07).** `notes/note-scroll-memory.ts`: per-note `{ scrollTop, selectionFrom, selectionTo }` in sessionStorage (`chronolog:note-positions`, last 50 notes), recorded on scroll of the note's nearest scrolling ancestor (rAF) and on caret moves (300 ms). Restored once when the note is reached through Back / Forward: the root layout's `afterNavigate` feeds `historyReturns.record(type, path)`; a popstate to the note counts, and a same-note URL correction right after does not cancel it. The phone's return from the capture screen is a Back, so it restores too; nothing in the timer is touched. A fresh open (list, wiki-link, search) still starts at the top. The caret is restored as the editor selection without focusing (no keyboard popping up on a phone).
- **NoteEditor CSS** moved to `notes/NoteEditor.css` (imported by the component). Every rule was `:global`, so the move is mechanical: `:global(x)` became `x`. `NoteEditor.svelte` is now 435 lines (from 710).

## Context ownership as implemented (`note-context-ownership.ts`)

"Navigation hidden" = phone, tablet (the notes sidebar is an overlay), or desktop with the sidebar collapsed (`navigation.panel1Collapsed`).

| Layout / list | Sidebar | List header (`data-owner`) | List rows | Editor header |
|---|---|---|---|---|
| Desktop, sidebar shown, one contract | names client / contract (selected) | `notes`: "Notes" + count (client / contract as screen-reader text only) | title, time, excerpt | mark + code + status + Note actions (client / contract as screen-reader text and the mark's tooltip) |
| Desktop sidebar collapsed, or tablet, one contract | hidden | `contract`: client (small) above mark + contract, + count | title, time, excerpt | as above |
| Phone list (one contract) | not on screen | `contract` | title, time, excerpt | — |
| Phone note (single column) | not on screen | — | — | client / contract visible with the mark, actions on that row; code and status below |
| Client view `/notes/client/<id>` (any layout) | client heading highlighted | `client`: "All contracts" above the client name, + count | + mark and contract name | mark (text visible on phone only) |
| All notes `/notes/all` (any layout) | "Notes" heading highlighted | `all`: "Every contract, newest first" above "All notes", + count | + mark and "Client · Contract" | mark (text visible on phone only) |
| Linked time | — | — | — | entry names client / contract only when not the note's contract |

The editor always shows the opened note's own contract (`panel.currentNote.contractId`), never the timer's (SH-08). No pinned-only view exists, so there is no "pinned" row in the table.

## Decisions

- **Screen-reader context kept.** Where the visible client / contract text is removed (list and editor headers in three columns), it stays as `sr-only` text, so the list heading and the editor are still named for assistive technology. Existing tests asserting `note-list-context` / `note-editor-context` text keep passing; the new spec checks the `sr-only` class and `data-owner` / `data-visible`.
- **Tablet counts as navigation hidden.** AppShell's overlay open state is local to AppShell; the overlay is closed whenever the list and editor are in use, so the list header names the contract on tablet. No new store was needed: `navigation.layoutMode` and `navigation.panel1Collapsed` already exist.
- **Phone keeps a heading menu, desktop keeps H1 / H2 / H3 buttons.** The brief asked for explicit H1–H3 plus Normal text on desktop (existing `toggleHeading` behaviour and tests kept); the phone menu sets a style outright (`setHeading` / `setParagraph`), which suits a radio choice. The mock-up's desktop "H1 ▾" dropdown is a follow-up if wanted.
- **Restore only on history returns**, not on every open (the timesheet restores per week on every visit). SH-07 speaks of history; a fresh open starting at the top is the conservative reading.
- **Move stays a submenu inside Note actions** rather than a second menu button, so there is exactly one note-actions menu. Its item reads "Move" with a quiet "to another contract" hint (hidden from the accessible name).
- **Test names.** New note's accessible name is now "New note"; tests that look for `{ name: 'New Note' }` still match (Playwright role names are case-insensitive substrings). Move / Export / Delete are menu items now: tests use the new `chooseNoteAction` / `moveOpenNote` helpers (`notes-helpers.ts`). The phone Attach check now opens "Formatting". Test ids `note-list-context`, `note-editor-context`, `delete-confirm`, `save-status`, `note-code-copy`, `data-toolbar-task-list` are unchanged.

## Hooks needed from stage 3a

- **Phone title bar repeats the context.** `mobile-context-title` (`navigation-labels.ts` `titleForRoute`, AppShell) still shows "Client · Contract" on the phone list and note, which the list header and editor header now name. 3a could show "Notes" / the note title there (the D26 phone mock-up shows "‹ Notes").
- **If the tablet sidebar stops being an overlay** (or AppShell gains a "navigation visible" notion), expose it on the navigation store and replace `isNavigationHidden`'s layout rule with it (one function, `note-context-ownership.ts`).
- **`timer-indicator` test id.** `notes-headers.spec.ts` (phone return from capture) clicks `getByTestId('timer-indicator')` to reach the capture screen; keep the id or update that line.
- **Scroll containers.** Position memory uses the note's nearest scrolling ancestor; if 3a changes the panel-3 scroller nothing needs wiring, but please keep a single vertical scroller around the editor.

## Tests

- `npm run check`: `svelte-check found 0 errors and 0 warnings`
- `npm run lint`: no problems (eslint prints nothing).
- `npm test`: `Test Files  124 passed (124)` · `Tests  1193 passed (1193)`. New: `layout/note-context-ownership.test.ts` (7, the NT-01 rule per layout and scope), `notes/note-scroll-memory.test.ts` (8: storage, cap and replacement, broken storage, history-return rule incl. URL correction and capture return, caret clamping).
- `PLAYWRIGHT_BASE_URL=http://localhost:5183 npm run test:playwright:chromium`:
  ```
  3 failed
    [chromium] › e2e-playwright/search-results-layout.spec.ts:92:1 › desktop: one list newest first, type icon column, client and contract, hits open
    [chromium] › e2e-playwright/search-results-layout.spec.ts:135:2 › phone 320px: icon on the client/contract line, no sideways scroll, hits open
    [chromium] › e2e-playwright/search-results-layout.spec.ts:135:2 › phone 390px: icon on the client/contract line, no sideways scroll, hits open
  6 skipped
  100 passed (59.0s)
  ```
  The three failures are not from this sprint: `search-results-layout` asserts the 046 newest-first interleave (`['entry', 'note', 'note', 'note', 'entry', 'entry']`), and 058-DR (API), already on `design-r1`, ranks time entries by the shared rank instead (`sprint-058-DR-api.md`: "entries in shared rank (were newest first)"; "Playwright not run"). No search file is changed here. Follow-up for 058-DR's UI sprint.
- `PLAYWRIGHT_BASE_URL=http://localhost:5183 npx playwright test --project=iphone-se --project=iphone-15 --project=iphone-15-pro-max`:
  ```
  2 skipped
  17 passed (16.4s)
  ```
- `notes-headers.spec.ts` alone on desktop WebKit: `7 passed (7.4s)`.
- Updated specs: `iphone-journeys` (Formatting menu instead of the sideways toolbar; Note actions → Move and Delete), `navigation-journeys`, `notes-navigation`, `note-trash`, `notes-followups`, `crud`, `task-lists`, `sidebar-notes-header`, and the manual `qa-driver.mjs` (Raw switch, Discard / Delete through Note actions).
- New `notes-headers.spec.ts` (7 tests): three-column headers name the contract once and hiding the sidebar restores it in the list header; all-notes rows carry marks; linked time names only the other contract; Note actions runs Export (download), Move and Delete (confirm, Undo) with keyboard focus and Escape; Back / Forward restore a long note's scroll on desktop (through another note and through Time Entries) but a fresh open starts at the top; on a phone through Back / Forward and the return from the capture screen with the timer still running; the phone toolbar overflow, heading menu and Rich / Raw menu.

## Screenshots (`docs/review/screenshots/sprint-054/`)

| File | Shows |
|---|---|
| `desktop-01-three-columns.png` | 1280: sidebar names Rank Group; list "Notes 2"; editor mark, code, copy icon, Saved, ellipsis; toolbar groups with Rich / Raw at the right; linked time naming only the other client's contract |
| `desktop-02-navigation-hidden.png` | sidebar collapsed: the list header names client and contract with the mark |
| `desktop-03-all-notes.png` | all notes: rows with marks and "Client · Contract", sage selection |
| `desktop-04-note-actions.png` | Note actions open: Move, Export as Markdown, Export as PDF, Delete |
| `phone-01-note-toolbar.png` | 390: editor header with client / contract and the actions, code and status below; compact toolbar |
| `phone-02-formatting-open.png` | the Formatting overflow open, right-aligned on screen, the selection kept in the text |

Reviewed by eye; fixed during the sprint: the phone Formatting menu opened off the right edge (now right-aligned), and on a narrow desktop panel (900 px) Rich / Raw wrapped to the left (now `ml-auto`).

## Review fixes (independent review, same day)

- **Blocker fixed:** "‹ Move to" closed the whole Note actions menu (the view swap detached the clicked item before the document click listener ran). The outside-close now listens on `pointerdown` and tests `event.composedPath()`.
- Delete from the menu focuses the confirmation's Delete button (focus no longer drops to the body); Tab from a menu item returns focus to the trigger and closes, so the browser moves on from the button.
- An open Note actions menu closes whenever the note (or its contract) changes, e.g. Back by shortcut or swipe, so a Move list built for one note cannot move another.
- Tests no longer pass on screen-reader text: `navigation-journeys` and `sidebar-archive-collapse` check the scope through `data-contract-id` on `note-list-context` / `note-editor-context` and the visible title (`note-list-title` reads "Notes") with the new `expectNotesScopedTo` helper. `notes-headers` gained the "‹ Move to" round trip, focus checks and the history note-switch case (8 tests).
- Re-run: check `svelte-check found 0 errors and 0 warnings`; lint clean; `Test Files 124 passed (124)`, `Tests 1193 passed (1193)`; chromium `3 failed` (the search-results-layout three, fixed on `design-r1`) `6 skipped` `101 passed (1.3m)`; iPhone projects first run `1 failed` (`iphone-15` week journey, `page.goto: Navigation to "/time" is interrupted by another navigation to "/"`, not a notes path) `2 skipped` `16 passed (22.5s)`, re-run `2 skipped` `17 passed (18.1s)`.
- Note for after the merge with 3a: 3a exposes `shellPresentation.sidebarOnScreen`, which `isNavigationHidden` in `note-context-ownership.ts` derives on its own; a follow-up stage switches it to read the shell store so there is one source of truth.

## Follow-ups

- NT-03 inline contract repeats (deferred 2026-11-07): space is kept in both headers (`note-list-header-space`, and the flex gap after the save pill).
- Replace the `window.prompt` link flow with an inline link field.
- In raw mode the toolbar still acts on the hidden rich editor (pre-existing); disable formatting while Raw is shown.
- Desktop heading control as the mock-up's "H1 ▾" dropdown, if wanted after review.
- `search-results-layout.spec.ts` needs the 058-DR rank order (see Tests).
- The editor body scrolls inside the editor box with linked time below it on desktop (pre-existing layout); position memory follows whichever element scrolls.
- The list count is the loaded list's length (archived contracts' notes included in all notes); revisit if the sidebar counts differ by design.
