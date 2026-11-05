# Sprint 049 — UI: Attach a note to a time entry; sidebar contract button and chevrons

**Status:** merged
**Branch:** `sprint-049-UI/attach-note-sidebar` · **Worktree:** `.claude/worktrees/sprint-049-UI` · **Port:** 5225
**Sources:** owner requests 2026-11-05 (using the PWA on iPhone): "Attach a note button for a time recording — opens a new note for the client/contract, links it in the time entry text. New contract button gone in sidebar, add a + button to the right of the Contracts heading. Move chevron for each client to the right, aligned with the plus." Wave rules in `docs/sprints/_wave-rules.md` apply (no migration expected).

**Owns:** time entry card/editor components (`src/lib/components/weekly/`), the contracts sidebar (`src/lib/components/layout/ContractsSidebar.svelte`, `SidebarClientGroup.svelte`, related), their tests. Do not change API response shapes or the CLI.

## Tasks

1. **Attach a note to a time entry.** On each time entry (the card in the weekly/time view, both while viewing and editing; phone and desktop), an "Attach note" control (icon button with accessible label and tooltip, consistent with the card's other actions).
   - It creates a new note on the entry's client and contract (through the data service, so the offline outbox path still works; reuse whatever the "new note" flow already uses for its default title/body).
   - It appends a wiki-link to that note at the end of the entry's description using the existing wiki-link format (the one `[[` autocomplete inserts), separated by a space or new line as the description editor expects, and saves the entry. The note then shows the entry under "Linked Time Entries" via the existing `note_time_entries` sync.
   - It then opens the new note in the editor, ready to type (title focused, or body if the title is generated).
   - Entry with no contract or client: use what the entry has; if creating a note needs a client it doesn't have, disable the button with a tooltip explaining why.
   - Double-tap protection: one note per click.
2. **New contract button in the sidebar.** A `+` icon button to the right of the "Contracts" heading in the sidebar (accessible label "New contract"), opening the existing new-contract flow (find what the removed button used to do in git history: `git log -S` on the sidebar components). Works on phone (sidebar drawer) and desktop.
3. **Client chevrons on the right.** Each client group's expand/collapse chevron moves to the right edge of its row, horizontally aligned with the new `+` (same right inset, same icon box size), so the column of chevrons lines up under the plus. Keep the whole row as the toggle target where it is today, keep keyboard/ARIA (`aria-expanded`) behaviour.

## Verification

Screenshots (desktop 1280 and iPhone 390) in `docs/review/screenshots/sprint-049/`: an entry card with the attach control; the new note open after attaching; the entry showing the rendered link; the sidebar with `+` and right-aligned chevrons. Unit tests for any helper (e.g. appending the wiki-link to a description); Playwright (chromium and webkit) for attach-note end to end and the `+` opening new contract. `npm run check`, `npm test`, the touched Playwright specs. Sign-off section as per the wave rules.

## Sign-off (2026-11-05): ready for review

Branch `sprint-049-UI/attach-note-sidebar`, on `main` (`1d13459`, unchanged since the branch was cut). Not merged. No migration, no API or CLI change.

### Done

1. **Attach note.** `AttachNoteButton.svelte` (page-with-plus icon, `aria-label` "Attach note", tooltip "Attach a new note") sits under the card's Delete ×, shown the same way: on hover / keyboard focus on desktop (so also while an editor in the card is open), always on touch, 44×44 on touch like Delete. `attach-note.ts`: `attachNewNoteToEntry` creates an empty note on the entry's contract with `dataService.createNote` (the New Note draft also starts empty), then saves the entry with `appendWikiLinkToDescription` (`[[NOTE_ID]]` after a space at the end, the same form as the `[[` autocomplete and the API's `noteId`; it goes before any "Formerly: …" lines; never duplicated). Both go through the data service, so offline the create and the entry edit queue in the outbox (the edit carries the temp ID and waits for the create). The server's existing description sync then lists the entry under the note's Linked Time Entries. The card calls `onNoteAttached(noteId)`; TimeEntriesPanel opens it with `openNote(…, { focusEditor: 'new-note' })`, a new focus kind that focuses the editor on touch screens too (a followed link still does not, A-11). With the description editor open, its typed text is what gets the link and its pending blur-save is cancelled. A press while an attach is running is ignored (one note per click; a double click is tested). No contract: `aria-disabled` with the reason as tooltip (cannot happen today, every entry has a contract). A failure shows "Couldn't attach a note: …" in the card's error line.
2. **New contract `+`.** Right of the "Contracts" heading (`aria-label`/title "New contract", `data-testid="sidebar-new-contract"`), opening the same `ContractCreateModal` as before; desktop sidebar and phone home. The empty-sidebar hint now points at it.
3. **Chevrons on the right.** In `SidebarClientGroup` the chevron moved after the client name (`ml-auto`), with the heading `+`'s box (20×20, touch 32×44) and right inset, so the chevrons form one column under the `+` (Playwright checks the right edges agree within 1 px at 1280, 390 and 320). The name still opens the client view and the chevron button keeps `aria-expanded` / `aria-controls` and keyboard use; with the chevron gone from the left, the client dot now lines up with single-contract rows' dots.

### Deviations

- The footer **New Contract** button is still in the code and on screen (desktop and phone home, see `04-sidebar-*.png`); the owner reported it gone, so it may be out of view in the installed PWA. Kept as a second entry point; the reviewer may want it removed now the `+` exists.
- "Keep the whole row as the toggle target where it is today": today only the chevron toggles (the name opens the client view), so that split is kept.
- Desktop shows Attach note on hover / focus, like Delete, rather than always.
- Navigation store (`openNote` `focusEditor: 'new-note'`, `takeEditorFocus` returns it) and `note-panel-state.svelte.ts` changed a few lines outside the owned files, for focus on touch.

### Tests

- `npm run check` 0 errors / 0 warnings; `npm run lint` clean; `npm test` 111 files, 1073 tests (new: `attach-note.test.ts` 9, a `navigation.test.ts` case).
- New `e2e-playwright/attach-note-sidebar.spec.ts`: 6 tests × chromium + webkit, all green (also green on `iphone-se` with `PLAYWRIGHT_IPHONE_ALL=1`).
- Touched-area specs green on chromium, webkit, iphone-se and iphone-15: `sidebar-client-view`, `sidebar-archive-collapse`, `timesheet-polish`, `work-type-consistency`, `navigation-journeys`, `iphone-journeys` (62 passed, 13 skipped as designed).
- API e2e (`npm run test:e2e`): 128 / 129; the one failure, `note-changes-cli` "note new --date yesterday", expects a 3-digit sequence and the shared dev DB has reached `INTL.20261104.2047` (test-data volume, unrelated to this sprint).
- Screenshots (chromium) in `docs/review/screenshots/sprint-049/`: `01-entry-card-attach-{desktop,phone}`, `02-note-opened-{desktop,phone}`, `03-entry-linked-{desktop,phone}`, `04-sidebar-{desktop,phone}`, `05-new-contract-{desktop,phone}`.

### Follow-up (2026-11-05, owner)

- Footer "New Contract" link removed; the delete × and Attach note are 32 px on touch (no card min-height).
- Attach note on the running timer: shown beside "Description" once the timer has a contract; it creates a note on that contract, appends `[[NOTE_ID]]` to the timer's description (saved at once, or to the pending timer in storage) and opens the note with the editor focused. Playwright: `running timer: attach note…` (desktop and phone, chromium and webkit); screenshots `06-timer-attach-*`.
