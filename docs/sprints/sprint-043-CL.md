# Sprint 043 — CL: Notes and editor follow-ups

**Status:** merged
**Branch:** `sprint-043-CL/notes-followups` · **Worktree:** `.claude/worktrees/sprint-043-CL` · **Port:** 5221
**Sources:** "Carried-over follow-ups / Notes / editor" in `docs/backlog.md`. Runs in parallel with 044-CL; wave rules in `docs/sprints/_wave-rules.md` apply (no migration in this sprint).

**Owns:** notes components, editor, note list, preview extraction, wiki-link rendering. 044 owns auth, CLI, desktop, admin colours and the root layout.

## Tasks

1. **Trash view.** A "Trash" entry (at the bottom of the note list or in the sidebar's Archived area; pick the quieter one and say why) lists the user's trashed notes from `GET /api/notes/trash` with deleted date and days left before the 30-day purge, and a Restore button per row. URL is the state (`/notes/trash`).
2. **Previews and titles.** The note list preview shows link text, not raw markdown, for attachment links (`extract-preview-lines`). Wiki-link text no longer drops out of titles and previews ("Beta note links to" → "Beta note links to Alpha note"; use the target's title or the id when unknown).
3. **Deleted attachment links.** A link to a deleted attachment gets the same "missing" styling as a missing image and does not open a tab that closes again.
4. **Split `NoteEditorPanel.svelte`** (over 500 lines after 040 and 042) into focused components/modules under ~200 lines each, no behaviour change; the existing Playwright note specs prove it.
5. **Toolbar `disabled` states** become reactive like the active highlights (020 follow-up).
6. **Phone.** "Linked time entries": the date no longer wraps into the duration. The Undo toast after a delete survives the panel unmount (move it to a shell-level toast host) so Undo works on a phone too. Landscape phone: the editor gets at least half the height (collapse the linked panels by default in landscape).
7. **Tests.** Unit where logic changes (preview extraction, title extraction); Playwright: trash view restore, phone-viewport Undo after delete, deleted-attachment styling (chromium and webkit).

## Verification

Screenshots: trash view; previews with link text; phone Undo toast; phone linked entries. Sign-off as per the wave rules.

## Sign-off

**2026-11-04, implemented on `sprint-043-CL/notes-followups`, rebased onto `main` (`c52f65c`, after the sprint 046 merge). Status: ready for review, not merged.**

### What was done

1. **Trash view.** `/notes/trash` (`src/routes/notes/trash/+page.svelte`), a standalone page like Search (own header, Back to app, the URL is the state; `parseWorkspacePath` returns null for it so the navigation store never reads `trash` as a contract). Rows (`notes/TrashList.svelte`, data from `notes/trash-view.ts`): title or ID, `SHORTCODE/Contract`, deleted date, "N days left" before the 30-day purge, and Restore; a restored row says "Restored" and offers Open, which opens the note in the workspace. Empty state and load error with Try again. **Entry point:** "Trash" under the sidebar's Archived item (`layout/SidebarTrashLink.svelte`, same muted uppercase style, a divider of its own when there is no Archived item). Chosen over the foot of the note list because the trash spans every contract (a per-contract list footer would suggest a per-contract trash) and is rarely needed; one registration line in `ContractsSidebar.svelte`.
2. **Previews and titles.** New pure `utils/wiki-link-text.ts`. `extractPreviewLines` reads every text block (list items included, so a note starting with a list now has a preview) and a wiki-link as its label, else the target's title (`resolveNoteTitle`), else the ID; `extractMarkdownPreviewLines` shows `[file.pdf](chronolog://…)` as `file.pdf`, images as their alt and `[[ID]]` the same way. Server: `queries/wiki-link-titles.ts` loads the targets' titles in one query, used by `GET /api/notes` (titles and previews), `getNoteTitlesForUser` (wiki-link chips, backlinks lookups) and the trash list. Browser: the title the editor saves and the previews the panel announces use the cached titles. Titles saved before this sprint that dropped the link text ("Beta note links to") are recognised in `noteDisplayTitle` (stored title equals the first line without links) and derived again, so they read right without a re-save. Also fixed on the way: `getNoteTitlesForUser` returned no title for a note created as markdown (CLI) until first edited, so its wiki-link chips showed the ID.
3. **Deleted attachment links.** `notes/extensions/attachment-availability.ts`: `HEAD /api/attachments/<id>` once per attachment (no HTTP cache; only a 404 counts as missing), forgotten on `note-attachments-changed`. The `AttachmentLinkStatus` extension decorates links to a missing file (`attachment-link-missing`: dashed placeholder border, muted, struck through, "(deleted)", like a missing image) with plugin meta only, so the document never changes and nothing autosaves. `openAttachment` returns early for a known-missing file, so no tab opens and closes.
4. **`NoteEditorPanel.svelte` split** from 528 to 130 lines: `notes/note-editor-session.ts` (sessions, create-on-first-save, updates, events; 144), `notes/note-panel-state.svelte.ts` (`NotePanelState`: what the panel shows, loading, drafts, URL selection; 190), `notes/note-panel-actions.ts` (upload, move, delete, wiki-link follow, exports; 154), `notes/NoteLinkedPanels.svelte` (51). No behaviour change beyond tasks 2 and 6; the existing note specs (crud, autosave, conflict, navigation, trash, task lists, search find-in-note, CLI edit) pass. The 042 find bar import and mount are unchanged.
5. **Toolbar disabled states** go through `canRun()`, which reads `transactionCount` like `isActive()`, so they follow the selection (e.g. Bold is disabled inside a code block and enabled again outside).
6. **Phone.** Linked time entries: date and duration are `whitespace-nowrap` and the description truncates (one line at 320 px, the date ends before the duration). The Undo toast is module state (`notes/note-trash-toast.svelte.ts`) shown by `notes/NoteTrashToastHost.svelte`, mounted once in `(workspace)/+layout.svelte`, so Undo works after a phone's list replaces the editor; a failed Undo shows "Could not restore the note" in the toast's place (was the editor header). Landscape: on a screen under 500 px tall the backlinks / linked entries / attachments sit in a closed "Links and attachments" disclosure (hidden when all three are empty), so the editor keeps the screen.
7. **Tests** (below).

### Tests

- Unit (new 15): `utils/wiki-link-text.test.ts` (8: parsing, label/title/ID rule, collecting targets, markdown links, JSON previews with links, list items, markdown previews, legacy stored titles), `notes/extensions/attachment-availability.test.ts` (3, jsdom: one HEAD per attachment, no tab for a missing file, decoration without a document change or `update`), `notes/trash-view.test.ts` (3), `stores/navigation-routes.test.ts` (+1: `/notes/trash` is not a workspace URL).
- API e2e: `src/e2e/note-previews.e2e.test.ts` (3: list titles and previews with wiki-link and attachment text, titles of markdown notes, trash titles).
- Playwright: `e2e-playwright/notes-followups.spec.ts` (6 tests, chromium and webkit): trash view and restore; previews and titles with link text and the saved title; deleted-attachment styling and no tab; phone Undo after the panel unmounts; phone linked entries on one line and landscape editor height with collapsed panels; toolbar disabled states. The shared `noteListItem` helper now matches a row by its title line, since a preview can now quote another note's title (it made `note-trash.spec.ts` click the wrong row).

### Verification

After the rebase onto `c52f65c`: `npm run check` 0 errors (the 3 existing warnings in `src/routes/+layout.svelte`, 044's file), `npm run lint` clean, `npm test` **998 passed in 103 files**, API e2e against `http://localhost:5221` (`E2E_USER_PREFIX=qa-043-e2e`) **124 passed in 21 files**, Playwright (`qa-043-pw`, chromium and webkit) full suite **141 passed, 1 flaky, 5 skipped**: the flaky one is the known webkit "reorder clients by dragging" (passed on retry; 044 task 8), the skipped are the chromium-only offline tests under webkit. Before the `noteListItem` fix, `note-trash.spec.ts` failed in both browsers (see Tests).

Screenshots in `docs/review/screenshots/sprint-043/`: `01-trash-view.png`, `02-previews-link-text.png`, `03-deleted-attachment-link.png`, `04-phone-undo-toast.png` (390 px, list shown, toast still up), `05-phone-linked-entries.png` (320 px), `06-phone-landscape-editor.png` (844×390).

### Left, and notes

- No schema change (no migration).
- Global search (`/api/search`) and the per-contract note search still title notes without resolving wiki-link targets (they show the label or the ID); only the list, titles lookup and trash resolve them.
- A wiki-link's target title is one level deep (a target whose own title is a link shows that link's ID), and a saved title keeps the target's title as of the save; renaming the target later does not rewrite it.
- At 844×390 the app is in the tablet layout (two panels); the disclosure applies by height, so it also collapses on a short desktop window.
- The trash list has no "delete forever" or "empty trash" (not asked); purge stays as in 037.
- `NoteEditor.svelte` itself is still about 700 lines; not in scope.
- Merge risk with 044: `src/lib/stores/navigation-routes.ts` (+ test) gains a `TRASH_SEGMENT` constant and one early return in `parseWorkspacePath`; if 044's navigation-context work touches that function, expect a small conflict (keep both). `ContractsSidebar.svelte` gains an import and one mount line; `(workspace)/+layout.svelte` an import and the toast host. `e2e-playwright/readme.md` and `src/e2e/readme.md` gain a row each (keep both). `notes-helpers.ts` `noteListItem` changed (any new 044 spec using it by preview text would need the title instead).
- QA users `qa-043-pw-*` and `qa-043-e2e-*` and their data remain in the shared dev database.
