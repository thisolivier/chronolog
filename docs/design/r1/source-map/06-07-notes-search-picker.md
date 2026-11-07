# Source map 06/07: notes workspace, global search, wiki-link picker (IN-02)

Inspected on branch `design-r1` (2026-11-07), read-only. Paths are relative to the repo root. Section (a) records facts only. Sections (b) to (d) are analysis and recommendations.

## (a) What exists today

### 1. Notes list (`src/lib/components/layout/NoteListPanel.svelte`, `NoteListRow.svelte`, `NoteListNewNoteButton.svelte`)

- **Views.** There are three list keys: `contract:<id>`, `client:<id>` (`/notes/client/<id>`) and `all` (`/notes/all`) (NoteListPanel.svelte:60-68). They load through `getNotesForContract`, `getNotesForClient` and `getAllNotes` (:82-86). **No pinned-only view or route exists.** Pins float to the top in the contract and client lists and do not float in All notes (`floatPinned: !isAllNotesView`, :42). Routes live under `src/routes/(workspace)/notes/...`.
- **Header** (:243-286) has two rows.
  - Row 1 is the context block (`data-testid="note-list-context"`, :246-268). A contract list shows the client name (xs) above the contract name (h2). A client list shows "All contracts" above the client name. All notes shows "Every contract, newest first" above "All notes". The comment calls this "Rule 4: the list names its client and contract (the sidebar may be collapsed)".
  - Row 2 holds the sort toggle (`note-sort-toggle`, :270-278) and New Note (:279-284).
  - The sort toggle is a text button that switches between "Modified ↓" and "Created ↓". The choice persists through `note-sort.ts`.
  - **The header has no count anywhere.**
- **New Note** is a blue filled text button labelled "New Note" (NoteListNewNoteButton.svelte:59-69).
  - In a contract list it starts a draft for that contract.
  - In the client view or All notes, a single eligible contract is used directly. Otherwise a menu "New note for which contract?" opens (:70-91), listing "Client · Contract" items in All notes.
  - Clicks are debounced at 400 ms (NoteListPanel.svelte:124-131). The draft is created on first keystroke, and a draft row "New note / Not saved until you type" appears (:310-315).
  - It never uses the timer's contract.
- **Row** (NoteListRow.svelte:34-76):
  - Title is `firstLine` or "Untitled" (:31). The offline `OutboxMarker` sits beside it.
  - The second line holds the smart date (`formatSmartDate` of `createdAt`/`updatedAt` per sort, :52) followed by the `secondLine` excerpt (:53-55).
  - Contract context: in the client view the contract name sits inline before the date (:49-51). In All notes, "Client · Contract" (`contractDirectory.contextLabel`) gets its own line (:45-47; panel :321-326). A single-contract list shows no contract text.
  - **No contract mark or colour appears on rows.**
- **Selected row** uses `border-l-2 border-blue-600 bg-blue-50` (:37-38). The draft row uses the same treatment.
- **Pin** is an absolute button at the right (:59-75). It is amber and always visible when pinned. When unpinned it shows on hover or focus, and at 50% opacity on `hover:none` devices. Its accessible name is "Pin “title”" or "Unpin “title”". It has a 44 px target on coarse pointers.
- **States:** "Loading notes..." (:300-303), a red error box (:304-307), and the empty state "No notes yet" (:332-337). A move confirmation banner ("Moved to Client / Contract", 4 s) is shown (:289-297).
- **Phone:** the same component is rendered as mobile level 1 (`AppShell.svelte:194-199`; breakpoint `max-width: 767px`, :78). The shell top bar shows "← Back" plus a context title (`mobile-context-title`, :143-160), a Find button, a Search icon link and the TimerIndicator.

### 2. Note editor header (`src/lib/components/notes/NoteEditorHeader.svelte`, mounted in `layout/NoteEditorPanel.svelte:107-117`)

- **Left cluster** (:78-105):
  - The context "Client / **Contract**" is plain text (`note-editor-context`, :79-84). **There is no contract mark or colour.** The contract is the note's own (`panel.currentNote?.contractId ?? session.contractId`, NoteEditorPanel.svelte:109), never the timer's.
  - The note code button follows (`NoteCodeCopyButton.svelte`). The code text itself is the button (`aria-label="Copy note code …"`, :31-40). It shows a "Copied" or "Couldn't copy" bubble and announces through a live region (:41-50). If copying fails, the code is selected (:21). **There is no separate copy icon.** A draft shows "New note" instead (:88).
  - The save pill (`SaveStatusIndicator.svelte`, sprint 051) reads "Saved" (green), "Saving" (amber, also used for debounce-pending `unsaved`) or "Draft" (grey), at a fixed width of 4.75 rem (:17-28). Failure states are red and sized to their text: "Couldn't save — retrying" and "This note changed elsewhere, reload to see it" (`save-status-display.ts:19-38`). `data-status` carries the raw status, and tests rely on it.
  - A **Reload** button appears only on `conflict` (:92-101). A transient red header message also exists, used for upload, move, delete and export failures (:102-104; NoteEditorPanel.svelte:33-39).
- **Right cluster** (:128-212): three visible text buttons.
  - **Move** (:130-163) lazily fetches `getContracts()`, excludes the current contract and lists "Client / Contract" items. Choosing one flushes autosave, `updateNote({contractId})`, emits `note-moved` and re-opens the note under the new contract with `replace` (note-panel-actions.ts:52-86). There is no confirmation.
  - **Export** (:165-200) opens a menu with "Export as Markdown" and "Export as PDF" (print). Both flush saves first (note-panel-actions.ts:131-152).
  - **Delete** (:204-211) on a saved note swaps the right cluster for an inline confirmation "Delete this note? Delete / Cancel" (`delete-confirm`, :107-127). It does not use native `confirm()`. Deleting moves the note to the trash and shows a shell-level Undo toast (note-panel-actions.ts:88-113). On a draft the button reads "Discard" and acts immediately.
  - Menus are `aria-haspopup="menu"` buttons with no chevrons. They close on outside click (:42-53). On phones (`max-md`) they are left-anchored.
- **Title:** there is no title field. The title is derived on save from the document's first line (`NoteEditor.svelte:101-106`, `truncateNoteTitle(extractPreviewLines(...).firstLine)`). The header never shows the title.
- **Phone:** the same header with `flex-wrap` (:75). Buttons get `pointer-coarse:min-h-11`.

### 3. Toolbar and raw mode (`EditorToolbar.svelte`, `NoteEditor.svelte`)

- **Order and groups** (EditorToolbar.svelte:60-211), separated by 1 px rules:
  - [B, I]
  - [H1, H2, H3] (each `toggleHeading`, so pressing the active level returns to paragraph. **There is no explicit "Normal text" button.**)
  - [• bullet, 1. ordered, ☑ task list]
  - [— horizontal rule, Link, </> code block]
  - [Attach]
  - Buttons are text glyphs with `title` tooltips. Active state is `bg-blue-100 text-blue-700`. Disabled state follows `editor.can()` and is re-evaluated on every transaction through `transactionCount` (:18-31).
- **Link** uses `window.prompt('URL:')`. An empty value unlinks (:33-52).
- **Rich/Raw** is a separate button to the right of the toolbar, outside its scroller (NoteEditor.svelte:380-388). Its label is "◇ Rich" or "◆ Raw", with the title "Toggle raw markdown view".
- **Phone overflow:** the toolbar is `flex-nowrap` inside an `overflow-x-auto` wrapper and scrolls sideways (NoteEditor.svelte:374-379). There is no overflow menu. Targets are 44 px on coarse pointers. Docs/review/2026-11-04-iphone-ui.md:56 records that it scrolls sideways inside its strip.
- **Rich/raw conversion:**
  - TipTap with `tiptap-markdown` (`Markdown` extension, :271).
  - Rich → raw: `storage.markdown.getMarkdown()` (:339-346).
  - Raw → rich: `setContent(rawMarkdown)` with `isSyncingFromRaw` set, which suppresses autosave (:347-353).
  - While in raw mode, every snapshot first re-parses the raw markdown into TipTap to produce matching JSON (:90-100).
  - Both forms are saved: `content` (markdown) and `contentJson` (TipTap JSON). On load, JSON is preferred and markdown is the fallback (:231-242).
  - The TipTap mount stays in the DOM and is hidden in raw mode (:403-408), because TipTap holds the element.
- **Attachments:**
  - The toolbar Attach button triggers a hidden `<input type=file multiple>` for JPEG, PNG, GIF, WebP, SVG and PDF (:363-370, :29-37). Drop and paste go through `FileHandler` (:261-269).
  - Images become inline `image` nodes. PDFs become `[name.pdf](chronolog://attachment/<id>)` links followed by an unlinked space (:168-224).
  - A draft is created before upload (note-panel-actions.ts:33-49).
  - `AttachmentList.svelte` lists attachments under the editor.

### 4. Linked time (`LinkedTimeEntries.svelte`, `NoteLinkedPanels.svelte`)

- **Fetch:** `dataService.getNoteTimeEntries(noteId)` → `GET /api/notes/[noteId]/time-entries` → `getLinkedTimeEntriesForNote` (`src/lib/server/db/queries/notes.ts:348-379`). That function joins `note_time_entries`, `time_entries`, `contracts` and `clients`, orders by date descending and has no limit. The panel re-fetches only when `noteId` changes (:56-60). Errors are logged only.
- **Link rows** are created server-side from wiki-links in an entry description. `extractDescriptionLinks` runs on create, and add/remove links are reconciled on update (`src/routes/api/time-entries/+server.ts:~106-112`, `[id]/+server.ts:~101-118`). They can also be posted explicitly (`POST /api/notes/[noteId]/time-entries`).
- **Render** (:63-119):
  - The panel is hidden when there are no entries. The heading reads "LINKED TIME ENTRIES" (uppercase xs).
  - Each row shows a blue date ("Tue, Nov 4"), then "— description" with wiki-links rendered through `WikiLinkRenderer` (resolved titles; deleted-note restore). Below that is a "Client / Contract" line, **always shown even when it matches the note's contract** (:100). The duration and a hover "×" **Unlink** button sit at the right (:107-114).
  - Clicking a row opens that day in time mode (`navigation.showTimeEntryDay`).
  - `clientColorIndex` is returned by the query but not rendered.
  - There are no timer controls.
- **Short screens** (`max-height: 500px`): backlinks, linked time and attachments collapse into a closed "Links and attachments" `<details>` (NoteLinkedPanels.svelte:17-44). Backlinks ("Linked from" chips) are `NoteBacklinks.svelte`.

### 5. Wiki-link model

- **Canonical text:** `[[NOTE_ID]]`, with optional `#heading` and `|label` (`src/lib/utils/wiki-link-text.ts:21-36`; `formatWikiLinkText` in `notes/extensions/wiki-link.ts:40-49` omits the label when it equals the ID).
- **Note IDs** are text primary keys of the form `SHORTCODE.YYYYMMDD.SEQ` with a 3-digit zero-padded sequence (`queries/notes.ts:107-133`). One example is `BIGCH.20260207.001`.
- **Stored forms:**
  - In the editor, a `wikiLink` atom inline node with attributes `noteId`, `label` and `headingAnchor` (wiki-link.ts:163-176, 312-337). It is stored in `content_json` and serialised verbatim as `[[…]]` into markdown `content` (:291-302).
  - Server link tables are derived from markdown: `note_links` (note → note, `parseWikiLinks` in `queries/wiki-link-parser.ts:7-28`) and `note_time_entries` (entry → note, from description text).
  - Entry descriptions are plain text containing `[[ID]]`.
- **Linkable targets: notes only.** Every parser, both pickers and both link tables target `notes.id`. Time entries (UUID IDs) cannot be wiki-link targets. They can only link to notes.
- **`[[` trigger:** `@tiptap/suggestion` 3.19.0 with `char: '[['` and `allowSpaces: true` (wiki-link.ts:180-183, 443-450). Typing a complete `[[ID]]` also converts through an `InputRule` (:416-441). Markdown parse uses a markdown-it inline rule (:103-145).
- **Picker query** (wiki-link.ts:185-214):
  - Calls `GET /api/notes/search?q=<query>&recent=1&limit=8&exclude=<current note>` on every query change, with no debounce.
  - An empty `[[` returns the 8 most recently edited notes.
  - **There is no contract or client scoping.** The search covers all of the user's non-trashed notes.
  - A non-OK response or exception becomes `[]`.
- **Popup** (`extensions/SuggestionDropdown.ts`): vanilla DOM, `absolute z-50`, appended to `<body>`, `max-h-60` with internal scrolling (:33-38).
  - Each row shows the ID (mono, grey) on top, then `firstLine || title || id`, then an optional `secondLine` (:109-133).
  - **There is no client or contract on rows.**
  - Selection uses `bg-blue-50` (:169-173).
  - Empty results show "No matching notes" (:101-106). Loading and failure states do not exist, and failure renders as "No matching notes".
  - There is no `role` or accessible name.
- **Positioning:** below the caret, flipping above when there is not enough space. The left edge and width are clamped to the viewport (`min(400, vw-16)`; sprint 047) (:178-208). It is not aware of `visualViewport` or the software keyboard.
- **Keys:**
  - ArrowUp and ArrowDown stop at the ends without wrapping. Mouseenter moves the selection.
  - Enter inserts. Escape removes the popup DOM but leaves the plugin active, so later typing updates a detached element until the token ends (:59-86, 91-93).
  - Clicking a row (`click` with `preventDefault`) inserts (:140-144). `mousedown` is not prevented, so on touch the editor can blur before `chain().focus()` refocuses it.
- **Insertion** (:216-243, 252-255, 263-266) replaces the suggestion range (`[[` plus the query) with a `wikiLink` node whose `label` is the note ID (so it serialises as `[[ID]]`), followed by a plain space, in one chained transaction. Insertion does not navigate.
- **Stale responses:** the app has no guard. The `@tiptap/suggestion` view `update` awaits `items()` and then calls `onUpdate` (node_modules/@tiptap/suggestion/dist/index.js:160-171), so a slow older response can overwrite newer results.
- **Rendering:**
  - The node view shows the target's live title from the shared title cache (`note-titles.svelte.ts`, which batches `GET /api/notes/titles?ids=&includeDeleted=1`). The display falls back to label, then ID, and appends `› heading`. The `title` attribute holds the ID (wiki-link.ts:362-406).
  - Trashed targets get `.wiki-link-deleted`: muted and struck through with a "(deleted)" suffix (NoteEditor.svelte:~642-651). Clicking one offers a restore prompt (note-panel-actions.ts:116-129).
  - Clicking a link calls `useNoteNavigation.openNoteById`, which switches the sidebar and list to the target's contract (`note-navigation.ts:38-43`).
- **Time-entry picker** (`weekly/WikiLinkInput.svelte`, used in `TimeEntryCard.svelte:407` edit mode and `NewEntryRow.svelte:135`). It is not used in the timer or the Add Entry modal; those use "Attach note" (`weekly/attach-note.ts:16-28`) to append `[[ID]]`. Differences from the editor picker:
  - It detects the last unclosed `[[` before the caret (:31-50).
  - It has a 200 ms debounce (:110-111) but still no stale-response guard.
  - **An empty query does not fetch.** It shows "Type to search notes..." with no recent notes (:55-59, 170-173).
  - It sends no `limit` (the server default is 10) and no `exclude`.
  - It renders `id · title` using the **stored `title`**, not `displayTitle`, so rows can show the ID only (:182-186).
  - Arrow keys wrap (:120-128). Rows insert on `mousedown`, which keeps focus (:180).
  - Escape closes the popup and keeps the text. Blur closes it after 150 ms (:137-153).
  - It inserts plain text `[[ID]]` with the caret after it and no trailing space (:78-97).
  - Read mode renders through `WikiLinkRenderer.svelte` (titles and deleted-restore).

### 6. Global search

- **Server** (`src/lib/server/db/queries/global-search.ts`, `GET /api/search`). Every searched column is **encrypted at rest**, so the server loads all of the user's rows, decrypts them and matches in memory. SQL `ILIKE`, tsvector and trigram are explicitly not used (:14-20; note-search.ts:9-15).
  - **Query:** the whole trimmed, lower-cased query is a single substring needle. There is no tokenisation, no operators and no prefix or word logic. The minimum length is 2 (:57, 171-176). The maximum is 200 characters, with a 400 `query_too_long` error otherwise (`+server.ts:9,24-26`).
  - **Notes** exclude trashed notes and are ranked by `rankNoteMatch` (note-search.ts:38-62): exact ID 0, ID prefix 1, display-title substring 2, ID substring 3, markdown body substring 4. Ties are newest-updated first (:97-127).
  - **Time entries** match **description only**, newest first (date, then start time, then created). They have **no `isDraft` filter** (:130-164).
  - **Client and contract names, short codes, deliverables and work types are not searched** for either type. They are only returned as context (`HitContext`, :22-28).
  - **Response:** `{query, notes:{hits,total}, timeEntries:{hits,total}, minimumQueryLength}`. The `limit` applies per group (default 20, maximum 50). `total` counts every match. The CLI (`cli/commands/search.mjs`) consumes this shape.
  - **Excerpt:** `buildSearchSnippet` gives about 180 characters around the first match, with 50 before it, word-trimmed with "…". It returns match offsets (`utils/search-snippet.ts:52-78`). A note's body is plain-texted (`plainTextFromMarkdown`) with the leading title stripped. A match only in markup (for example a link target) shows the raw markdown (global-search.ts:105-110). `titleMatches` are computed for the title.
- **Picker search** (`searchNotesForUser`, note-search.ts:108-142; `/api/notes/search`) uses the **same `rankNoteMatch`**. It differs in these ways:
  - The minimum length is 0 (an empty `q` with `recent=1` returns the newest notes).
  - The default limit is 10 and the maximum 50.
  - It supports `exclude`.
  - It returns no snippet or offsets.
  - It decrypts the body only when ID and title fail.
  - Note: `displayTitle` may be null here, whereas global search falls back to the ID.
- **Route `/search`** (`src/routes/search/+page.svelte`) is a **standalone page outside `AppShell`**.
  - Its own header (:67-86) holds the "Chronolog" link (sm and up), HistoryButtons (md and up), the `GlobalSearchField` (flex-1, autofocus when the query is empty) and a "Back to app" link.
  - The URL `?q=` is the state (:20). Each change aborts the previous fetch through `AbortController`, which handles stale responses (:33-49). It fetches `limit=50` (`search-types.ts:14-18`) and client colour indexes from `/api/clients` (:27-31).
  - **States:**
    - Prompt: "Search the titles and text of every note, and every time entry description." or "Type at least two characters."
    - Error: "Search failed. Check your connection and try again." (role=alert)
    - Loading: "Searching…", shown only before the first result, because `result` is reset to null on each query.
    - Empty: "Nothing matches." (:89-105; SearchResults.svelte:52-54)
- **Results** (`SearchResults.svelte`, `search-interleave.ts:28-43`):
  - A summary line reads, for example, "4 notes · 7 time entries" or "50 of 120 notes" (:51-56).
  - Notes and entries are interleaved in **one list sorted newest first by date**. **Server rank is discarded except as a tie-break.**
  - Up and Down move through the hits, and Up from the first returns to the field (:38-46).
- **Row** (`SearchHitRow.svelte:33-75`):
  - Type icon (`SearchTypeIcon`, document or clock).
  - Context line: a client colour dot (client-level colour), then "Client / Contract". On a phone the client short code replaces the client name (:45-50).
  - A right-aligned date: note `formatSmartDate(updatedAt)`, or the entry's day header plus `formatMinutes(duration)` (:51-58).
  - For notes, a bold title with `<mark class="bg-amber-200">` highlights, then a 1-line (phone) or 2-line (md) snippet. For entries, the description snippet.
  - The row is the button. Hover and focus use a white fill with a border (`focus:border-blue-400`).
  - Opening a note calls `navigation.openNote`. Opening an entry shows the day and calls `revealTimeEntry`.
- **Header field and route interaction** (`GlobalSearchField.svelte`):
  - On desktop and tablet the shell top bar has the field at `w-60 lg:w-72`, left-aligned after Back/Forward (`AppShell.svelte:211-224`).
  - Typing does nothing until Enter, which `goto('/search?q=')` with `keepFocus` (:30-37). Escape blurs the field.
  - Cmd/Ctrl+K focuses and selects whichever field is visible, using a capture-phase window listener (:48-56). A ⌘K hint shows when the field is empty.
  - On a phone the shell has only a search icon linking to `/search` with no query (`AppShell.svelte:174-182`). The `/search` header is the phone's query field.

## (b) Gaps against the spec

| Req | Today → change needed |
| --- | --- |
| NT-01 | The list header always names client/contract (Rule 4, NoteListPanel.svelte:246-268), and the editor header always names it (:79-84). This repeats sidebar context in all three columns. **Change:** the header must depend on layout (sidebar visible vs `panel1Collapsed`/overlay/phone). All-notes and client rows already carry context. Cross-contract link opening already re-scopes the sidebar and list to the target (note-navigation.ts:38-43). Confirm the timer stays independent. |
| NT-02 | Missing: **count**, **icon** New note (today a blue text button), sage/pine selection (today blue-600/blue-50). "Created sort" exists as a Modified/Created toggle, so keep both orders. Rows already have title, date and excerpt, plus context in multi-contract lists. No pinned-only view exists, so the spec's "pinned" context applies only to pins floated within contract/client lists. |
| NT-03 | Not started. Today the header has two rows (context row, then sort/new row). Placing the repeat "between Notes/count and New note" implies a single Notes/count/New-note row, so the existing sort toggle must find a home on that row or stay in the second row. Raw 27 needs checking. |
| NT-04 | The mark is missing (text only). The code copy exists, but the code itself is the button, with **no separate copy icon**. The Saved pill exists but is a coloured pill, not a "quiet check". Real failure and conflict states and Reload exist and must stay. **Move, Export and Delete are visible buttons and must move into a single "Note actions" ellipsis menu.** The Move submenu, Export submenu, inline Delete confirm (`delete-confirm`), Discard-for-draft and Undo toast must all survive. The title is already body-only. |
| NT-05 | Groups match the spec except that the order today is rule, link, code, then attach. Normal text is reached by toggling the active H level, with no explicit control. If a menu replaces H1–H3, add an explicit "Normal text". Link uses `window.prompt`, which may be suppressed in Tauri (the header comment notes native `confirm()` is). Phone today is a sideways scroller with no overflow menu, so a formatting overflow is new. Rich/Raw is a toggle button, not a "choice". |
| NT-06 | Context is always shown (spec: only when different from the note). The **Unlink ×** control is not in the spec but exists and must be kept. There are no timer controls (OK). Rows open the day, and inline wiki-links open notes (OK). The panel does not refresh when an entry is edited elsewhere (pre-existing). |
| NT-07 | The phone header wraps rather than compacting. The shell already shows the TimerIndicator on phone levels ≥ 1 (AppShell.svelte:183-191). Scroll and position restoration is SH-07 territory and was not inspected here. |
| SR-01 | `/search` puts the query field inside its own header row, not as a large input above the results. The desktop shell field is not shown on `/search` because the page is outside AppShell. The phone `/search` header has the field, not "Back to app + capture". **Capture access is absent on `/search`** (no TimerIndicator). The phone search icon does not carry a query (fine). The header-to-route handoff is Enter → goto with `keepFocus`, but the route mounts a different input instance and focus is re-acquired only when `q` is empty (`autofocus={!query}`). |
| SR-02 | Mixed list exists. The order differs (icon, context, date, then title, then snippet), while the spec says title first, then contract mark and label, then excerpt. The mark is a client-colour dot, not a contract mark. Highlight is `bg-amber-200` (needs ochre token). The selected state is a focus border (needs sage/pine). Phone date is in the context line (spec: beneath the excerpt). Note-hit open uses `navigation.openNote` and entry-hit open uses `showTimeEntryDay` plus `revealTimeEntry`; preserve both. |
| SR-03 | Partly true: both surfaces share `rankNoteMatch` for notes, but there are differences. (1) **Client/contract metadata is not searchable on either surface**, so "Amplitude" fails unless it appears in the text. (2) There is no token combination: "Hungryroot roles" is one substring. (3) `/search` re-sorts by date, so its order differs from the picker's rank order. (4) Minimum length is 2 vs 0. The stable code works today (exact/prefix ID ranks). There is no hidden contract restriction today (OK). |
| SR-04 | `[[` opens recent notes in the editor (OK). WikiLinkInput shows **no recent notes on an empty query**, a gap. There are no scope controls anywhere (OK). Target type is notes only. |
| SR-05 | Picker rows lead with the ID and have **no client/contract**. The API already returns `contractName`, `clientName` and `clientShortCode` (note-search.ts:17-30), but the client drops them (wiki-link.ts:198-210). There is no accessible name or listbox semantics. Selection is blue-50. |
| SR-06 | Keyboard insert replaces only the token, and the caret ends after the trailing space (OK; the time-entry picker adds no space). Escape keeps text but leaves a detached dropdown (see a.5). Touch: `click` without a `mousedown` preventDefault risks a blur and keyboard bounce on iOS. Undo: insertion is one chain; verify with a test. There is no auto-closing `]]` (OK). |
| SR-07 | Desktop anchoring and flip and horizontal clamp exist. **There is no keyboard or `visualViewport` handling on mobile.** Loading, no-match and failure are not distinguished (failure becomes "No matching notes", and nothing shows until the first response). **No stale-response guard** on either picker. The "dimming/reflow" constraint is already met (body-level absolute). |

## (c) Open items this informs

**O07 (multi-contract list pattern). Recommendation:** in All notes and the client view, put **no repeat** in the list header, or a neutral, non-contract texture. Instead, give each row a compact contract mark, which also satisfies the NT-01 rule that "each row identifies its contract". The client view could use a client-level repeat only if O02 defines one; otherwise none. The editor header always uses the opened note's contract (`panel.currentNote.contractId`, already the source today). On narrow widths, drop the repeat first (`min-width: 0`, `overflow: hidden`, with the repeat as a flex-1 filler at lowest priority) before any truncation of names or control targets.

**O08 (search algorithm). Recommendation: one shared server matcher.** Both endpoints already decrypt every candidate in memory, so adding fields costs no extra queries.
- *Module:* a pure module, for example `src/lib/server/search/record-matcher.ts`, that exports `matchRecord(queryTerms, fields) → { rank, matchedIn, ranges } | null`.
- *Callers:* `searchNotesForUser` and `searchEverythingForUser` both call it, and neither keeps its own logic.
- *Fields per candidate:*
  - Notes: `id`, `displayTitle`, `body` (markdown → plain), `clientName`, `clientShortCode`, `contractName`.
  - Entries: `description`, plus the same context fields. Deliverable and work type can be added later.
- *Parsing:* trim, lower-case, NFC-normalise, then split on whitespace into terms. Keep the whole string as a "phrase" too.
- *Matching:* **every term must match some field (AND across terms, OR across fields)**, using case-insensitive substring as today. This makes "Hungryroot roles" match context plus body.
- *Rank tiers* (lower is better), extending today's tiers:
  1. Exact ID.
  2. ID prefix.
  3. Phrase in title.
  4. All terms in title.
  5. ID substring.
  6. Phrase in body.
  7. All terms in content fields (title, body, description).
  8. Terms satisfied only with help from context (client/contract) fields.
  9. Context-only match.
- *Tie-break:* newest `updatedAt`, then ID.
- *Output:* `matchedIn: 'context'` with no body highlight for metadata-only hits; the snippet is the start of the body, unhighlighted. This satisfies SR-03's "does not invent a highlighted excerpt".
- *Surface parameters:* `types`, `limit`, `minLength` (picker 0 with recent-on-empty; search 2) and `exclude`.
- *`/search` ordering:* stop the newest-first re-sort in `search-interleave.ts` (or merge the groups by shared rank, then date) so identical queries order consistently with the picker.
- *Unchanged:* keep the no-SQL-`ILIKE` rule (encryption) and the `/api/search` group shape (the CLI depends on it).
- *Still open:* ambiguous names (a short term matching many contracts), weights within a tier, and very large note counts (a full decrypt per keystroke; consider a per-request or short-TTL decrypted cache before adding a debounce).

**O09 (link targets). Recommendation:** confirm **notes as the only linkable type** for r1. The canonical representation stays `[[NOTE_ID]]`, with optional `#heading` and `|label`; inserted links use the ID only and the title is resolved live. Time entries have UUIDs, no wiki-link parser support and no link table as targets, so adding them is separate scope. Because only notes are offered, the picker needs no type labels. Keep the server-derived `note_links` and `note_time_entries` tables as they are.

**O11 (autosave/rich-raw), for the record:** autosave is debounced and flushes on note switch, unmount, `visibilitychange`, `pagehide` and `beforeunload` with `keepalive`. A `409` becomes `conflict` with Reload. Raw mode re-parses into TipTap on every save. The reskin should not alter `NoteEditor.svelte` logic beyond toolbar placement.

## (d) Risks and must-not-break

- **Encryption at rest:** any matcher work must stay in-memory after decrypt (`encryption-at-rest.test.ts`).
- **CLI contract:** `/api/search` response shape (`cli/commands/search.mjs`, `src/e2e/search-cli.e2e.test.ts`). `/api/notes/search` response (`fetch-data-service.test.ts:298`; offline `offline-reads.ts:108` excludes it from note caching).
- **Draft lifecycle:** the draft is created on first keystroke. Move, Export and Delete flush autosave first. Delete goes to the trash with an Undo toast that survives panel unmount on phone. Move re-opens with `replace`. A Move, Export or Delete menu redesign must keep these calls unchanged (`note-panel-actions.ts`).
- **TipTap mount** must stay mounted in raw mode. `transactionCount` drives toolbar state. The wiki-link node view subscribes to the title cache. Menus or overflow must not steal the editor selection (use `mousedown` preventDefault).
- **Fragile selectors** in tests:
  - `notes-navigation.spec.ts:33` finds the picker by `body > div.absolute.z-50`.
  - `iphone-journeys.spec.ts:134-138` finds it by text.
  - Many tests use `save-status` plus `data-status`, `note-code-copy`, `note-code-copied`, `delete-confirm`, `note-list-row`, `note-row-contract`, `note-sort-toggle`, `note-list-context`, `global-search-input`, `search-hit-note`, `search-hit-entry`, `search-hit-context`, `search-hit-date`, `search-hit-type-icon`, `mobile-search-link`, `linked-time-entries`, `linked-time-entry*` and `note-linked-panels`.
  - Removing the visible Move/Export buttons breaks `page.getByRole('button', { name: /^Move/ })` (iphone-journeys.spec.ts:142,147).
- **Existing coverage to keep green:**
  - Playwright:
    - `sidebar-notes-header.spec.ts` (All notes, pill, copy code, phone)
    - `notes-navigation.spec.ts` (wiki-link, backlink and search open in their own contract; move)
    - `notes-followups.spec.ts` (link previews, deleted attachment, phone linked time, toolbar disabled states)
    - `note-trash.spec.ts` (deleted wiki-link restore)
    - `notes-autosave.spec.ts`
    - `notes-conflict.spec.ts`
    - `task-lists.spec.ts`
    - `attach-note-sidebar.spec.ts`
    - `search.spec.ts` (shell search, Cmd+F, phone)
    - `search-results-layout.spec.ts` (desktop and phone rows, no sideways scroll)
    - `iphone-journeys.spec.ts` (notes journey, search journey, 44 px targets)
  - API and e2e: `src/e2e/search.e2e.test.ts`, `search-cli.e2e.test.ts`, `notes.e2e.test.ts`, `note-previews.e2e.test.ts`, `note-trash-cli.e2e.test.ts`, and `src/routes/api/search/search.test.ts` (7).
  - Unit:
    - `extensions/wiki-link.test.ts` (11)
    - `utils/wiki-link-text.test.ts` (8)
    - `queries/note-links.test.ts` (16)
    - `queries/notes.test.ts` (searchNotesForUser)
    - `utils/search-snippet.test.ts`
    - `search/search-interleave.test.ts` (6; it asserts newest-first, so it changes if O08's ordering is adopted)
    - `notes/editor-features.test.ts`
    - `starter-kit-link.test.ts`
    - `save-status-display.test.ts`
    - `note-sort.test.ts`
    - `note-trash.test.ts`
    - `find/find.test.ts`
- **Missing tests worth adding before stage 7:**
  - A picker stale-response race.
  - Touch insertion that keeps focus and the keyboard.
  - Undo after insertion.
  - The SR-03 query table run against both endpoints.
  - Picker error vs empty states.
