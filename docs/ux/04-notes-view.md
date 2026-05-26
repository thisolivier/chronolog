# Notes View

## Overview

The notes view activates when a user clicks a contract in the sidebar. It consists of two panels:
- **Panel 2** (`NoteListPanel`): A scrollable list of notes for the selected contract
- **Panel 3** (`NoteEditorPanel`): The TipTap rich-text editor for the selected note, plus backlinks, linked time entries, and attachments

## Note List Panel (Panel 2)

### Layout

```
+------------------------------+
|  Notes      [Delete] [New]   |   <-- header with action buttons
+------------------------------+
|                               |
|  | First line of note        |   <-- note card (clickable)
|  | May 24  Second line...    |      date + preview
|                               |
|  || First line (selected)    |   <-- blue left border + bg
|  || May 23  Preview text     |
|                               |
|  | [pin] Pinned note         |   <-- pin icon for pinned notes
|  | May 22  Some preview      |
|                               |
|  ...                          |
+------------------------------+
```

### Header Actions

- **Delete button**: Only shown when a note is selected (`selectedNoteId` is set). Red text. Shows a `window.confirm()` dialog before deleting.
- **New Note button**: Blue button. Creates a new note for the selected contract via `dataService.createNote(contractId)`. The new note is prepended to the list and auto-selected.

### Note Cards

Each note shows:
- **First line**: Bold, truncated. Shows "Untitled" if empty.
- **Pin icon**: Small pushpin emoji shown if `note.isPinned` is true.
- **Second line**: Date prefix (formatted via `formatSmartDate`) + second content line in gray.
- **Selection indicator**: Blue left border + blue background when selected.

### Note Preview Updates

When a note is saved in the editor (Panel 3), a `CustomEvent('note-saved')` is dispatched on `window`. The NoteListPanel listens for this event and updates the matching note's `firstLine`, `secondLine`, and `updatedAt` in place, avoiding a full refetch.

### Reactivity

The note list is re-fetched whenever `navigationContext.selectedContractId` changes. When the contract is cleared, the list is emptied.

## Note Editor Panel (Panel 3)

### Layout

```
+--------------------------------------------------------------+
|  (empty state: "Select a note to view")                      |
|                                                               |
|  -- or when a note is selected --                             |
|                                                               |
|  +----------------------------------------------------------+|
|  | [B] [I] | [H1] [H2] [H3] | [*] [1.] | [--] [Link] |Att||  <-- toolbar
|  +----------------------------------------------------------+|
|  |                                                           ||
|  |  Note content area (TipTap editor)                        ||
|  |  Supports: headings, bold, italic, lists, links,          ||
|  |  code blocks, blockquotes, horizontal rules,              ||
|  |  images, wiki-links [[NOTE.ID]], file attachments         ||
|  |                                                           ||
|  +----------------------------------------------------------+|
|                                                               |
|  Linked from                                  (backlinks)     |
|  [NOTE.ID * title] [NOTE.ID * title]                         |
|                                                               |
|  Linked Time Entries                                          |
|  [entry-id...]  x                                             |
|                                                               |
|  Attachments                                                  |
|  [IMG] filename.png  1.2 MB  x                               |
|  [PDF] document.pdf  340 KB  x                                |
+--------------------------------------------------------------+
```

### Empty/Loading/Error States

- **No note selected**: "Select a note to view" (gray, centered)
- **Loading**: "Loading note..." (gray, centered)
- **Error**: Red error message with "Try again" button
- **Note loaded**: Editor + supplementary sections

### TipTap Editor

`NoteEditor.svelte` creates a TipTap `Editor` with these extensions:

| Extension | Purpose |
|-----------|---------|
| StarterKit (heading disabled) | Base rich text (bold, italic, lists, code, blockquote, etc.) |
| AnchoredHeading | Custom heading extension that generates anchor IDs |
| Link | Hyperlinks (click-to-open disabled) |
| Image | Inline images (base64 disallowed) |
| FileHandler | Drag-and-drop / paste file handling |
| Placeholder | "Start writing..." placeholder text |
| Markdown | Markdown serialization/deserialization |
| WikiLink | Custom inline node for `[[NOTE.ID]]` links |

**Content loading priority**: JSON (`contentJson`) is preferred over markdown (`content`). If JSON parse fails, falls back to markdown string.

**Auto-save**: Content changes trigger a debounced save (500ms). The save extracts both markdown (via `editor.storage.markdown.getMarkdown()`) and JSON (via `editor.getJSON()`), then calls the `onSave` callback with `{ title, content, contentJson }`.

**File upload**: Files dropped or pasted are processed by `processUploadedFiles()`:
- Images (JPEG, PNG, GIF, WebP, SVG) are inserted as `<img>` nodes with a `chronolog://` URL
- PDFs are inserted as text links with the filename

**Wiki-link navigation**: Clicking a `[data-wiki-link]` element in the editor triggers `onWikiLinkClick(noteId, headingAnchor)`, which navigates to that note via `navigation.selectNote()`.

**Attachment URL resolution**: `chronolog://` URLs in images are resolved to real blob URLs via the `attachment-resolver` module, which fetches attachment data from `/api/attachments/[id]` and creates object URLs.

### Editor Toolbar

`EditorToolbar.svelte` provides formatting buttons:

| Button | Action | Active State |
|--------|--------|-------------|
| **B** | Toggle bold | Blue when bold |
| *I* | Toggle italic | Blue when italic |
| H1, H2, H3 | Toggle heading levels | Blue when active |
| * (bullet) | Toggle bullet list | Blue when active |
| 1. (ordered) | Toggle ordered list | Blue when active |
| -- (rule) | Insert horizontal rule | -- |
| Link | Prompt for URL, set/unset link | Blue when link |
| Attach | Open file picker (images + PDFs) | -- |

Buttons are disabled when the editor is null or the action cannot be performed.

### Backlinks Section

Shown below the editor when `backlinks.length > 0`. Fetched via `dataService.getNoteBacklinks(noteId)`.

Each backlink is a clickable chip showing:
- Source note ID (monospace, indigo)
- Note title (if available, gray, after a dot separator)

Clicking a backlink navigates to that note.

### Linked Time Entries Section

`LinkedTimeEntries.svelte` shows time entries linked to this note. Each entry displays:
- Truncated entry ID (first 8 characters, monospace)
- Unlink button ("x") that calls `dataService.unlinkNoteTimeEntry()`

### Attachments Section

`AttachmentList.svelte` shows file attachments for this note. Each attachment displays:
- Type badge: "IMG" or "PDF"
- Filename (truncated)
- File size (formatted: B, KB, or MB)
- Delete button ("x") that calls `dataService.deleteAttachment()`

## Files

| File | Purpose |
|------|---------|
| `src/lib/components/layout/NoteListPanel.svelte` | Panel 2: note list with create/delete |
| `src/lib/components/layout/NoteEditorPanel.svelte` | Panel 3: editor + backlinks + attachments |
| `src/lib/components/notes/NoteEditor.svelte` | TipTap editor with extensions |
| `src/lib/components/notes/EditorToolbar.svelte` | Formatting toolbar |
| `src/lib/components/notes/LinkedTimeEntries.svelte` | Linked time entries section |
| `src/lib/components/notes/AttachmentList.svelte` | Attachments section |
| `src/lib/components/notes/extensions/wiki-link.ts` | WikiLink TipTap node |
| `src/lib/components/notes/extensions/anchored-heading.ts` | Heading with auto-generated anchors |
| `src/lib/components/notes/extensions/attachment-resolver.ts` | chronolog:// URL resolver |
| `src/lib/components/notes/extensions/SuggestionDropdown.ts` | Suggestion dropdown for wiki-links |
