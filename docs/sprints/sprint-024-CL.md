# Sprint 024 — CL: Notes and editor rough edges

**Status:** signed-off 2026-11-03 on `sprint-024-CL/notes-rough-edges` (not merged)
**Branch:** `sprint-024-CL/notes-rough-edges` · **Worktree:** `.claude/worktrees/sprint-024-CL` · **Port:** 5201
**Sources:** `docs/review/2026-11-03-ux-friction.md` (finding numbers below), `docs/review/2026-11-03-integration-qa.md` (R2, R3, R4), sprint 020 sign-off follow-ups.

## Tasks (friction finding numbers in brackets)

1. **Autosave never loses text [2].** Flush pending note saves on component destroy, note/contract switch, `visibilitychange`, `beforeunload` and layout-mode change; show a small saved / saving / unsaved indicator in the editor header.
2. **Lists render [4].** Bullets and numbers visible in the editor, rendered mode and print.
3. **Wiki-links show titles [5] and the current note is excluded from `[[` suggestions [6].** Everywhere a link renders (editor, cards via `WikiLinkRenderer`, "Linked from", linked time entries) show the note's title or first line with the ID as tooltip. Autocomplete ranks exact-ID matches first (integration R2).
4. **Note search UI [7].** A search field at the top of `NoteListPanel` using the existing search endpoint; results across contracts, each showing its contract prefix.
5. **Attachments [10].** Fix `chronolog://attachment/undefined` and the 500 on load; images render after reload.
6. **Export [11].** PDF/print export waits for the note to load and prints only the note (no app chrome).
7. **New Note [19].** Focus the editor on create, debounce the button, do not persist until the first keystroke or title.
8. **Links both ways [21], clickable linked entries, R4.** Linked time entries in a note are clickable (open that day in time mode); show the entry's description with the `[[id]]` replaced by the note title.
9. **Sidebar counts refresh [23]** after create, move and delete (use the existing note events).
10. **Raw mode shows markdown not entities [24].**
11. **Following a link into another contract updates the sidebar and list [R3].** Use `navigation.openNote`.
12. **Polish:** mobile editor toolbar and height [25], native `confirm()` → inline confirm, delete button placement [37], code-block top band and toolbar underline [38], note list sort by modified with a toggle [40], move message clears on contract switch [43], long first line should not become a giant H1 [45 notes part].

## Boundaries
Owns `src/lib/components/notes/**`, `NoteListPanel.svelte`, `NoteEditorPanel.svelte`, `queries/notes.ts`, `queries/note-links.ts`, `api/notes/**`, `api/attachments/**`. Do not touch `weekly/*`, `timer/*`, `TimeEntriesPanel`, admin, `AppShell`, `ContractsSidebar` (025/026 own them); if `TimeEntryCard` must render titles, change only `WikiLinkRenderer`.

## Verification
check 0 errors, tests green, lint clean; real UI on port 5201 for every task with screenshots in `docs/review/screenshots/sprint-024/`; do not regress "editor markdown shortcuts and export" from the friction report's works-well list.

## Sign-off

**Status:** signed-off 2026-11-03. Branch `sprint-024-CL/notes-rough-edges` on top of `0c9edfe`, not merged.
Coordinator additions during the sprint (journey review `2026-11-03-ux-journeys.md` B-02/A-01 and B-03)
are included and marked "+".

### Per task

| # | Task | Result | What changed |
|---|------|--------|--------------|
| 1 | Autosave never loses text [2] | **Done** | `notes/note-autosave.ts` `AutosaveController`: debounced saves run in order; `dispose()` captures the editor snapshot synchronously before TipTap is destroyed (note switch, contract switch, Time Entries, layout change) and sends it with `keepalive`; `visibilitychange`/`pagehide`/`beforeunload` flush with `keepalive` (bodies over 60 KB fall back to a normal request); failures keep the text and retry every 5 s. `trackNoteSave`/`waitForNoteSaves` make a remounted panel wait for in-flight saves before loading. Header indicator: Saved / Saving… / Unsaved changes / Couldn't save — retrying. Proof: `e2e-playwright/notes-autosave.spec.ts` (type → switch note at once → reload → text there; type → reload; type → Time Entries → reload), green in Chromium and WebKit, ×3 repeat; probe T1 covers 1440→600→1440 mid-edit. |
| 2 | Lists render [4] | **Done** | Disc/circle/square and decimal/lower-alpha markers in the editor CSS and in the print document. |
| 3 | Wiki-links show titles [5], no self-suggestions [6], R2 | **Done** | Editor chips are a node view showing the target's title (ID as tooltip; markdown stays `[[id]]`, inserted links carry no label so titles stay live); `WikiLinkRenderer` (cards, linked entries) uses the same `note-titles.svelte.ts` cache (`GET /api/notes/titles`); "Linked from" shows titles. `queries/note-search.ts` ranks exact ID, ID prefix, title, ID substring, body (decrypt-and-filter in memory, no SQL on encrypted columns); `[[` excludes the current note and an empty `[[` lists recent notes. Saved `title` is now the first line. |
| 4 | Note search UI [7] | **Done** | Search field at the top of `NoteListPanel` (all contracts, `SHORTCODE · Contract` prefix, debounced, Esc/× clears). |
| 5 | Attachments [10] | **Done** | Root cause: `uploadAttachment` returned `{attachment}` unwrapped as `{id}` → `undefined`. Fixed in `FetchDataService`; `AttachmentImage` node view resolves `chronolog://` to a blob URL (no DOM rewriting, no `chronolog:` requests); `GET /api/attachments/:id` is 404 for non-UUIDs, `Cache-Control: private` (023 follow-up 5), RFC 5987 filename. Attachment list refreshes after upload. |
| 6 | Export [11] | **Done** | `note-print.ts` prints the rendered note alone from a hidden iframe (own print CSS, waits for images), so no app chrome and no breakpoint remount. Not exercised against the native macOS print dialog (headless). Markdown export: no duplicated title heading, filename from the first line. |
| 7 | New Note [19] | **Done** | Draft editor with focus; nothing persisted until the first save; double-click reuses the draft; empty drafts vanish; note IDs retry on a unique-key race. |
| 8 | Links both ways [21], R4 | **Done (as scoped)** | Linked time entries show titles, the date opens that week in time mode, wiki-links in the description open the note. A note-side picker to reference an entry is not built. |
| 9 | Sidebar counts refresh [23] | **Blocked by boundary** | `note-created` / `note-deleted` / `note-moved` events and `onNoteCountsChanged()` exist (`notes/note-events.ts`), but `ContractsSidebar` belongs to 026 and was not touched. Wiring is 3 lines in its script: `import { onNoteCountsChanged } from '$lib/components/notes/note-events';` and `$effect(() => onNoteCountsChanged(() => loadContracts()));`. |
| 10 | Raw mode markdown [24] | **Done** | `extensions/markdown-text.ts` replaces StarterKit's `text` serializer: only a `<` that could open a tag is escaped, so raw mode, saved content and export show `->`. Old `&gt;` content parses back cleanly. |
| 11 | Cross-contract links [R3] | **Done** | Every note opened from the notes UI (editor links, Linked from, search, linked-entry links) goes through `navigation.openNote` (`notes/note-navigation.ts`). A missing target shows "That note no longer exists". |
| 12 | Polish [25, 37, 38, 40, 43, 45] | **Done** | Toolbar scrolls instead of wrapping and shares one bottom rule with Rich; editor min height 24 rem with the panel scrolling; Delete moved to the editor header with inline confirm (no `confirm()`); code block top band removed; list sort Modified/Created toggle (localStorage); move message belongs to the destination contract and clears on switch; H1 1.5 em. |
| + | Journey B-02 / A-01 | **Done** | A moved note stays open under its new contract (sidebar and list follow). Proof: `e2e-playwright/notes-navigation.spec.ts` (two tests). |
| + | Journey B-03 conflict | **Done** | `PUT /api/notes/:id` accepts `expectedUpdatedAt`; the row is locked and compared at millisecond precision; a stale copy gets 409. The editor stops autosaving and shows "This note changed elsewhere, reload to see it" with Reload. Proof: `e2e-playwright/notes-conflict.spec.ts`; DB tests in `notes.test.ts`. |

### Verification

- `npm run check`: 0 errors (23 pre-existing warnings, none in changed files). `npm run lint`: clean.
  `npm test`: 34 files, **373 passed** (was 33/357 at branch start, plus new tests for autosave, search
  ranking, conflicts, markdown text, print document, sort, display titles, data service).
- Playwright (`PLAYWRIGHT_BASE_URL=http://localhost:5201 npx playwright test e2e-playwright/notes-*.spec.ts`):
  **13 passed** (6 tests × Chromium and WebKit + auth setup). `playwright.config.ts` now honours
  `PLAYWRIGHT_BASE_URL`; `auth.setup.ts` waits for hydration and accepts landing on `/` after register.
- Real-UI probe (`scratchpad/sprint-024/probe-024.mjs`, user `qa-024-*@chronolog.test` left in the dev DB):
  **21/21 PASS** at 1440×900 and 390×844, 0 page errors; the only HTTP ≥ 400 are deliberate (404 for
  `/api/attachments/undefined` and a deleted note, 409 from the two-tab test).
- Works-well item "editor markdown shortcuts and export": `#`, `- `, `1. `, ``` input rules and a clean
  Markdown export re-verified (probe T2, T10, WW-markdown-export-clean).
- Screenshots `docs/review/screenshots/sprint-024/`: 01–02 new note, 03 lists/code, 04 raw mode, 05–07
  wiki-links and Linked from, 08–09 linked entries, 10 attachment after reload, 11 print document, 12
  search, 13 move keeps note open, 14 cross-contract link, 15 inline delete, 16–17 save indicator, 18
  conflict, 20–22 phone editor, list with search, header.

### Follow-ups

1. Task 9 wiring in `ContractsSidebar` (026 or at merge; snippet above).
2. Native macOS / Tauri print dialog not exercised for the iframe export; check on the Mac.
3. A keepalive save at unload can, in a rare race, reach the server after the reloaded page has fetched
   the note; the page then shows the older text and the next edit gets the conflict message (no loss).
4. `DataService` gained `searchNotes`, `getNoteTitles`, `createNote(…, initial)` and
   `updateNote(…, { keepalive })`; `fetch-helpers` throws `HttpError` with `status`. A future offline
   backend must implement them.
5. Notes created via the API with markdown but no `contentJson` still list as "Untitled" (journey A-08).

