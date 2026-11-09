# Notes Components

WYSIWYG markdown editor components using TipTap v3.

## Architecture

The notes module provides a rich text editing experience with markdown support. The editor uses TipTap core with StarterKit (`heading`, `codeBlock` and `text` disabled; it bundles Link in v3, so its options are passed through `StarterKit.configure({ link: … })`, never registered twice). Those are replaced by AnchoredHeading, CodeBlockLowlight (syntax highlighting via lowlight) and MarkdownText. The editor also uses AttachmentImage, FileHandler, Placeholder, Markdown, WikiLink and the task-list extensions (`TaskListExtensions`, sprint 040-CL).

Saving is handled by `AutosaveController` (`note-autosave.ts`), not by the editor itself. Panels own the note lifecycle and the editor only reports content and save status.

## Components

### NoteEditor.svelte

Main editor component with toolbar and content area. Notes have no title field: the saved `title` is the first content line (wiki-links read as the target's cached title, sprint 043-CL), and the list shows that line too.

**Features:**
- Rich text editing with markdown serialization. Wiki-links are saved as `[[id]]` text (see `extensions/README.md`), which is what the server's backlink extraction reads
- Autosave through `AutosaveController`: 500 ms debounce, ordered saves, retry on failure, and a flush before the editor is destroyed or the note changes. `flushPendingSave()` is exported so the parent can flush before a move or delete
- Save status (`saved` / `saving` / `unsaved` / `error` / `conflict`) is reported through `onSaveStatusChange`; a 409 conflict halts autosave
- Dual format support: markdown and JSON
- Read-only mode support
- WikiLink inline nodes with `[[syntax]]` autocomplete through the shared link picker (059-DR: `search/LinkPicker.svelte`; title, contract mark and client/contract per row, code secondary; current note excluded; an empty `[[` lists recent notes of every contract; Escape or a press outside closes it and keeps the typed text)
- AnchoredHeading nodes with auto-generated slug IDs
- Click-to-navigate on wiki-link nodes
- Code blocks with syntax highlighting (CodeBlockLowlight + lowlight, github-light theme)
- Raw/rendered mode toggle (switch between WYSIWYG and raw markdown textarea). The TipTap mount `<div>` is always in the DOM and only hidden in raw mode — TipTap keeps a reference to the element it was mounted into, so removing it with `{#if}` left an empty editor on toggle back
- Inline image support via drag-drop, paste, or programmatic insertion
- File handler for images (jpeg/png/gif/webp/svg) and PDFs
- Checkbox task lists (`- [ ]` / `- [x]`, nestable with Tab / Shift-Tab): typing `[ ] ` or `[] ` at the start of a list item or line, or the toolbar's ☑ button. A tick is an ordinary edit (autosave, 409 rules unchanged). See `extensions/README.md`
- `chronolog://attachment/{uuid}` images render through the AttachmentImage node view (the document keeps the `chronolog://` src; the DOM shows a blob URL)
- Position memory (054-DR, SH-07): `note-scroll-memory.ts` records the note's scroll and caret as it moves and restores them on Back / Forward to the note (including the phone's return from capture)
- Styles live in `NoteEditor.css` (imported by the component; moved out of its `<style>` block in 054-DR, every rule was already global)

**Props:**
```typescript
interface Props {
  initialContent?: string;  // markdown string to load
  initialJson?: string;     // TipTap JSON to load (preferred)
  getNoteId?: () => string | null;  // read at save/upload time, so a draft gains its ID on first save
  onSave?: (data: NoteSaveData, options: { keepalive: boolean }) => Promise<void>;
  onSaveStatusChange?: (status: SaveStatus) => void;
  onWikiLinkClick?: (noteId: string, headingAnchor?: string) => void;
  onFileUpload?: (file: File) => Promise<string | null>;  // returns chronolog:// URL
  autofocus?: boolean;
  readonly?: boolean;
  compactToolbar?: boolean; // phone: core formatting plus menus (054-DR)
}
```

### note-autosave.ts

`AutosaveController` for the editor's save loop. `markDirty()` schedules a debounced save; `flush()` saves now and captures its snapshot synchronously, so it is safe right before the editor is destroyed; `flush({ keepalive: true })` is used on `pagehide` / `beforeunload`. Saves run one at a time, in order, and a failed save keeps its snapshot and retries. `trackNoteSave` and `waitForNoteSaves` are module-level, so a remounted panel waits for in-flight saves of a note before loading it.

### note-draft.svelte.ts

Draft state for "New Note". A draft is the URL `/notes/<contractId>/new` and opens an empty editor; nothing is persisted until the first keystroke, and the note is created on that first save, after which the URL becomes the note's.

### note-navigation.ts

`useNoteNavigation(navigation)` returns `openNoteById` and `openBacklink`. Both go through `navigation.openNote`, so the sidebar and the note list follow the note.

### note-events.ts

Typed window events (`note-created`, `note-saved`, `note-moved`, `note-deleted`, `note-restored`) that keep the list, sidebar and editor in sync without shared component state. `onNoteEvent` subscribes to one event; `onNoteCountsChanged` subscribes to the four events that change sidebar counts.

### note-titles.svelte.ts

Client cache of note display titles. Lookups are batched into one `GET /api/notes/titles?ids=&includeDeleted=1` request per tick, and results live in a `SvelteMap`. The wiki-link node view and `WikiLinkRenderer` read from it, so a link shows the target note's current title and the ID as a tooltip. Each entry carries `deletedAt` while the note is in the trash: `isNoteInTrash` drives the muted, struck-through "deleted" link style, and `setNoteTrashed` flips it on delete and restore.

### note-trash.ts

Browser side of the server-side trash (sprint 037-CL). `restoreTrashedNote` calls `DataService.restoreNote`, marks the note live in the title cache and dispatches `note-restored` (the list reloads, sidebar counts refresh). `showRestorePrompt` is the small inline confirm ("“Title” is in the trash. Restore / Cancel") that opens next to a clicked "deleted" wiki-link, in the editor and in time-entry descriptions alike.

### note-trash-toast.svelte.ts, NoteTrashToastHost.svelte (sprint 043-CL)

The ten-second "Moved to trash. Undo" toast after a delete. Its state is module-level (`showTrashToast`, `dismissTrashToast`) and the host is mounted once by the workspace layout, so the toast survives the editor panel unmounting (on a phone the list replaces the editor at once). Undo restores through `restoreTrashedNote` and opens the note.

### Trash page: trash-view.ts, TrashList.svelte (sprint 043-CL)

`/notes/trash` (`src/routes/notes/trash/+page.svelte`, a standalone page like Search) lists `GET /api/notes/trash`: title (or ID), contract, deleted date and days left before the 30-day purge (`purgeLabel`), with a Restore button per row; a restored row offers Open. Reached from "Trash" under the sidebar's Archived item (`layout/SidebarTrashLink.svelte`).

### Editor panel modules (split from `layout/NoteEditorPanel.svelte` in sprint 043-CL)

- **note-editor-session.ts** — `EditorSession` (one mounted editor) and its saving: a draft's note is created on its first save (`ensureNoteExists`), later saves update with conflict detection, and both refresh the title cache and dispatch `note-created` / `note-saved`. Talks to the panel through a small `SessionHost`.
- **note-panel-state.svelte.ts** — `NotePanelState`: the reactive panel state (session, note, backlinks, loading, save status), loading a note after its in-flight saves, opening drafts, and `showUrlSelection` for whatever the URL names.
- **note-panel-actions.ts** — upload, move to another contract, delete (then the Undo toast), following a wiki-link (restore prompt for a trashed note) and the Markdown / PDF exports.
- **NoteLinkedPanels.svelte** — backlinks, linked time entries and attachments under the editor; on a screen under 500 px tall (phone in landscape) they sit in a closed "Links and attachments" disclosure so the editor keeps the screen.

### note-sort.ts

`sortNotes(list, order, { floatPinned })`: `floatPinned: false` (the all-notes view, 051-UI) leaves pins in date order.

Sort order for the note list (`modified` or `created`), persisted in localStorage. `sortNotes` is pure.

### note-print.ts

PDF export. `printNote` copies the rendered note into a standalone document with its own print styles and prints only that, from a hidden iframe. `buildPrintDocument` builds that document and is pure, for tests. Task-list checkboxes print as ☐ / ☑ (`printTaskItemsAsBoxes`: an `<input>`'s checked state does not survive copying the HTML). The Markdown export writes the note's stored markdown, so `- [ ]` / `- [x]` are kept as they are.

### note-export.ts

Markdown export. `exportAsMarkdown` downloads a `.md` file; `buildMarkdownExportContent` prepends a title heading only when the content does not already start with it. Includes `sanitizeFilename`.

### note-scroll-memory.ts (054-DR)

Per-note position memory for SH-07. `rememberNotePosition` / `readNotePosition` keep `{ scrollTop, selectionFrom, selectionTo }` per note in sessionStorage (`chronolog:note-positions`, last 50 notes). `historyReturns` is fed by the root layout's `afterNavigate` and says whether a note was reached through Back / Forward (a popstate; a same-note URL correction right after does not cancel it). `attachNoteScrollMemory` (called by `NoteEditor` on mount) records on scroll of the note's nearest scrolling ancestor and on caret moves, and restores once on a history return, waiting a few frames for layout. A fresh open (list, link, search) still starts at the top. Pure parts are unit tested.

### ToolbarMenu.svelte (054-DR)

Small menu used by the phone toolbar (text style, "Formatting" overflow, Rich / Raw). Its trigger and items prevent mousedown, so the editor keeps focus and selection; a pointer open leaves focus in the editor, a keyboard open focuses the first item; Escape closes.

### EditorToolbar.svelte

Formatting toolbar (054-DR, NT-05). Desktop groups: B / I | ¶ Normal text, H1, H2, H3 | bullet, numbered, checklist | rule, Link, code block, Attach, then the Rich / Raw switch at the right (`editor-mode-switch`); the groups wrap on a narrow panel. Phone (`compact`): B, I, a "Text style" menu (Normal text, Heading 1–3), bullet list, checklist, a "Formatting" overflow (numbered list, rule, link, code block, attach file) and a "Rich ▾" menu for Rich text / Raw markdown. Buttons keep the editor selection (mousedown prevented, commands through `chain().focus()`). Shows active state indicators (bold, italic, headings, lists, task list, links, code blocks). Receives `transactionCount` from `NoteEditor` (bumped on every TipTap transaction) and reads it inside its `isActive()` and `canRun()` helpers (the disabled states follow the selection too since sprint 043-CL); the `Editor` instance never changes identity, so without that counter Svelte would not re-evaluate the highlights.

### NoteEditorHeader.svelte

Header above the editor (054-DR, NT-04): the contract mark, the note code with its copy icon (`NoteCodeCopyButton`), `SaveStatusIndicator`, a message line, the quiet repeat of the contract's pattern tile filling the free space up to the actions (NT-03, `note-editor-header-space`, 063-DR; uncapped since 064-DR; left out in the single-column layout, where Saved and the ellipsis sit on different rows), and one "Note actions" ellipsis menu (`NoteActionsMenu.svelte`). The client / contract text (`note-editor-context`) is visible only when `showContextText` (single-column phone layout, NT-01); elsewhere it stays as screen-reader text and the mark's tooltip. Delete asks for confirmation inline (`delete-confirm`; no native `confirm()`, which Tauri can suppress). A `conflict` status offers Reload. The note title stays in the body.

### NoteActionsMenu.svelte (054-DR)

The "Note actions" menu: Move (switches the menu to "Move note to", a list of the other contracts), Export as Markdown, Export as PDF, Delete (Discard on a draft). The actions are the panel's existing `note-panel-actions.ts` functions (flush before move/export, Undo toast after delete). Arrow keys, Home / End and Escape (back to the button) work inside it.

### NoteCodeCopyButton.svelte

The note code in the header (sprint 051-UI): a click or tap copies it through `$lib/utils/copy-text.ts` (Clipboard API, then a hidden-textarea `execCommand('copy')` fallback, for Safari/WebKit and the Tauri webview). A "Copied" bubble floats under the code for 1.5 s without moving the header line, and a polite live region announces it; if both ways are refused it says "Couldn't copy" and selects the code. A small copy icon beside the code (054-DR) runs the same copy. `data-testid="note-code-copy"`, `note-code-copy-icon`, `note-code-copied`.

### SaveStatusIndicator.svelte

The save pill (sprint 051-UI): "Saved" (leaf green) / "Saving" (ochre; also while a change waits for its debounce) / "Draft" (grey), one fixed width (`w-[4.75rem]`) so the header line never shifts or wraps while typing. Failures stay distinct: a rust pill sized to its message ("Couldn't save — retrying", or the conflict message with Reload). Labels and tones are `save-status-display.ts` (unit-tested); `data-testid="save-status"` keeps its `data-status` values (`saved`, `saving`, `unsaved`, `error`, `conflict`, `draft`).

### LinkedTimeEntries.svelte

Linked time under the editor: entries whose description links to the note, newest first. No heading since 064-DR (N3): each row (`LinkedTimeEntryRow.svelte`) starts with a small clock glyph (`linked-time-entry-clock`, `aria-hidden`) and is named "Linked time entry, …" for screen readers. Quiet (054-DR, NT-06): muted dates, and a row names its client / contract (with the contract mark) only when the entry is on another contract than the note (`noteContractId`; the API row carries `contractId`). Rows open the day in Time Entries; wiki-links in descriptions stay clickable. × asks first (064-DR): the row's duration and × become "Unlink? Unlink / Cancel" (`unlink-confirm`, the editor header's delete-confirm style, never a native `confirm()`); focus goes to Unlink, Escape or Cancel keeps the link and returns focus to the row's ×, and after unlinking focus moves to the next row's × (or the previous one). One row asks at a time. No timer controls.

### LinkedTimeEntryRow.svelte

One linked time entry (split from `LinkedTimeEntries` in 064-DR): clock glyph, date, description, the contract line when it differs, and the right-hand group (duration and ×, or the inline unlink question). The parent owns which row is confirming and where focus goes (`data-unlink-request` / `data-unlink-confirm` hooks).

### NoteBacklinks.svelte

"Linked from" list of notes that link to the current note, shown by display title. The server leaves out trashed sources.

### print-styles.css

`@media print` rules for the app page. The PDF export does not use this file: `note-print.ts` carries its own copy of the print styles, so change both when changing print typography.

### LinkedTimeEntries.svelte

Displays time entries linked to the current note. The date and duration never wrap (one line on a phone). Fetches from `/api/notes/[noteId]/time-entries` and supports unlinking entries (after the inline "Unlink?" confirm, 064-DR). Rows open the entry's day in time mode (`navigation.showTimeEntryDay`), which scrolls the timesheet to it; descriptions render wiki-links through `WikiLinkRenderer`, so they show note titles.

### AttachmentList.svelte

Lists the note's attachments: an image or document icon, the filename (a button that opens the file in a new tab through `openAttachment`, sprint 036), the size, and a delete button. Refreshes on the `note-attachments-changed` window event the upload handler fires.

## Custom Extensions

See `extensions/README.md` for documentation on WikiLink, AnchoredHeading, MarkdownText, AttachmentImage, the `[[` picker renderer (`wiki-link-picker.svelte.ts`), and the attachment URL resolver.

## Svelte 5 Integration

TipTap doesn't have native Svelte 5 support. The integration uses:

1. Manual editor instantiation in `onMount`
2. Direct DOM element binding via `bind:this`
3. `onTransaction` callback bumps a `$state` counter (deferred with `queueMicrotask` so it never writes state during a derived evaluation) that the toolbar depends on
4. Proper cleanup in `onDestroy`

## Data Format

The editor maintains content in two formats:

1. **Markdown**: Human-readable, portable format via `tiptap-markdown` extension
2. **JSON**: TipTap's native format, preserves all editor state including wiki-link nodes

When loading content, JSON is preferred as it maintains exact formatting and structure.
