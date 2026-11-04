# Notes Components

WYSIWYG markdown editor components using TipTap v3.

## Architecture

The notes module provides a rich text editing experience with markdown support. The editor uses TipTap core with StarterKit (`heading`, `codeBlock` and `text` disabled; it bundles Link in v3, so its options are passed through `StarterKit.configure({ link: … })`, never registered twice). Those are replaced by AnchoredHeading, CodeBlockLowlight (syntax highlighting via lowlight) and MarkdownText. The editor also uses AttachmentImage, FileHandler, Placeholder, Markdown, WikiLink and the task-list extensions (`TaskListExtensions`, sprint 040-CL).

Saving is handled by `AutosaveController` (`note-autosave.ts`), not by the editor itself. Panels own the note lifecycle and the editor only reports content and save status.

## Components

### NoteEditor.svelte

Main editor component with toolbar and content area. Notes have no title field: the saved `title` is the first content line, and the list shows that line too.

**Features:**
- Rich text editing with markdown serialization. Wiki-links are saved as `[[id]]` text (see `extensions/README.md`), which is what the server's backlink extraction reads
- Autosave through `AutosaveController`: 500 ms debounce, ordered saves, retry on failure, and a flush before the editor is destroyed or the note changes. `flushPendingSave()` is exported so the parent can flush before a move or delete
- Save status (`saved` / `saving` / `unsaved` / `error` / `conflict`) is reported through `onSaveStatusChange`; a 409 conflict halts autosave
- Dual format support: markdown and JSON
- Read-only mode support
- WikiLink inline nodes with `[[syntax]]` autocomplete (current note excluded; an empty `[[` lists recent notes)
- AnchoredHeading nodes with auto-generated slug IDs
- Click-to-navigate on wiki-link nodes
- Code blocks with syntax highlighting (CodeBlockLowlight + lowlight, github-light theme)
- Raw/rendered mode toggle (switch between WYSIWYG and raw markdown textarea). The TipTap mount `<div>` is always in the DOM and only hidden in raw mode — TipTap keeps a reference to the element it was mounted into, so removing it with `{#if}` left an empty editor on toggle back
- Inline image support via drag-drop, paste, or programmatic insertion
- File handler for images (jpeg/png/gif/webp/svg) and PDFs
- Checkbox task lists (`- [ ]` / `- [x]`, nestable with Tab / Shift-Tab): typing `[ ] ` or `[] ` at the start of a list item or line, or the toolbar's ☑ button. A tick is an ordinary edit (autosave, 409 rules unchanged). See `extensions/README.md`
- `chronolog://attachment/{uuid}` images render through the AttachmentImage node view (the document keeps the `chronolog://` src; the DOM shows a blob URL)

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

Browser side of the server-side trash (sprint 037-CL). `restoreTrashedNote` calls `DataService.restoreNote`, marks the note live in the title cache and dispatches `note-restored` (the list reloads, sidebar counts refresh). `showRestorePrompt` is the small inline confirm ("“Title” is in the trash. Restore / Cancel") that opens next to a clicked "deleted" wiki-link, in the editor and in time-entry descriptions alike. `NoteEditorPanel` shows a ten-second "Moved to trash. Undo" toast after a delete, which uses the same restore.

### note-sort.ts

Sort order for the note list (`modified` or `created`), persisted in localStorage. `sortNotes` is pure.

### note-print.ts

PDF export. `printNote` copies the rendered note into a standalone document with its own print styles and prints only that, from a hidden iframe. `buildPrintDocument` builds that document and is pure, for tests. Task-list checkboxes print as ☐ / ☑ (`printTaskItemsAsBoxes`: an `<input>`'s checked state does not survive copying the HTML). The Markdown export writes the note's stored markdown, so `- [ ]` / `- [x]` are kept as they are.

### note-export.ts

Markdown export. `exportAsMarkdown` downloads a `.md` file; `buildMarkdownExportContent` prepends a title heading only when the content does not already start with it. Includes `sanitizeFilename`.

### EditorToolbar.svelte

Formatting toolbar with active state indicators (bold, italic, headings, lists, task list, links, code blocks). Receives `transactionCount` from `NoteEditor` (bumped on every TipTap transaction) and reads it inside its `isActive()` helper; the `Editor` instance never changes identity, so without that counter Svelte would not re-evaluate the highlights.

### NoteEditorHeader.svelte

Header above the editor: note ID, `SaveStatusIndicator`, Move / Export / Delete actions and a message line. Delete asks for confirmation inline (no native `confirm()`, which Tauri can suppress). A `conflict` status offers Reload.

### SaveStatusIndicator.svelte

Small status label for the save state (saved, saving, unsaved, error, conflict, or draft).

### NoteBacklinks.svelte

"Linked from" list of notes that link to the current note, shown by display title. The server leaves out trashed sources.

### NoteSearchResults.svelte

Result list for the note search field in the note list. Each result shows the contract prefix, since search spans all contracts.

### print-styles.css

`@media print` rules for the app page. The PDF export does not use this file: `note-print.ts` carries its own copy of the print styles, so change both when changing print typography.

### LinkedTimeEntries.svelte

Displays time entries linked to the current note. Fetches from `/api/notes/[noteId]/time-entries` and supports unlinking entries. Rows open the entry's day in time mode (`navigation.showTimeEntryDay`), which scrolls the timesheet to it; descriptions render wiki-links through `WikiLinkRenderer`, so they show note titles.

### AttachmentList.svelte

Lists the note's attachments: an image or document icon, the filename (a button that opens the file in a new tab through `openAttachment`, sprint 036), the size, and a delete button. Refreshes on the `note-attachments-changed` window event the upload handler fires.

## Custom Extensions

See `extensions/README.md` for documentation on WikiLink, AnchoredHeading, MarkdownText, AttachmentImage, SuggestionDropdown, and the attachment URL resolver.

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
