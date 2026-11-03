# Notes Components

WYSIWYG markdown editor components using TipTap v3.

## Architecture

The notes module provides a rich text editing experience with markdown support. The editor uses TipTap core with StarterKit (which bundles Link in v3 — its options are passed through `StarterKit.configure({ link: … })`, never registered twice), CodeBlockLowlight (syntax highlighting via lowlight), Image, FileHandler, Placeholder, Markdown, WikiLink, and AnchoredHeading extensions.

## Components

### NoteEditor.svelte

Main editor component with toolbar and content area (notes have no title field; the list shows the first content line).

**Features:**
- Rich text editing with markdown serialization — wiki-links are saved as `[[id]]` text (see `extensions/README.md`), which is what the server's backlink extraction reads
- Auto-save with 500ms debounce (`onSave` receives markdown and TipTap JSON)
- Dual format support: markdown and JSON
- Read-only mode support
- WikiLink inline nodes with `[[syntax]]` autocomplete showing note ID and content preview lines
- AnchoredHeading nodes with auto-generated slug IDs
- Click-to-navigate on wiki-link nodes
- Code blocks with syntax highlighting (CodeBlockLowlight + lowlight, github-light theme)
- Raw/rendered mode toggle (switch between WYSIWYG and raw markdown textarea). The TipTap mount `<div>` is always in the DOM and only hidden in raw mode — TipTap keeps a reference to the element it was mounted into, so removing it with `{#if}` left an empty editor on toggle back
- Inline image support via drag-drop, paste, or programmatic insertion
- File handler for images (jpeg/png/gif/webp/svg) and PDFs
- `chronolog://attachment/{uuid}` URL resolution for embedded images

**Props:**
```typescript
interface Props {
  initialContent?: string;  // markdown string to load
  initialJson?: string;     // TipTap JSON to load (preferred)
  noteId?: string;          // note ID (for parent to construct upload URL)
  onSave?: (data: { title: string; content: string; contentJson: string }) => void;
  onWikiLinkClick?: (noteId: string, headingAnchor?: string) => void;
  onFileUpload?: (file: File) => Promise<string | null>;  // returns chronolog:// URL
  readonly?: boolean;
}
```

### EditorToolbar.svelte

Formatting toolbar with active state indicators (bold, italic, headings, lists, links, code blocks). Receives `transactionCount` from `NoteEditor` (bumped on every TipTap transaction) and reads it inside its `isActive()` helper; the `Editor` instance never changes identity, so without that counter Svelte would not re-evaluate the highlights.

### note-export.ts

Utility module for exporting note content. Provides `exportAsMarkdown` (downloads `.md` file with title heading) and `exportAsPdf` (triggers browser print dialog). Includes `sanitizeFilename` and `buildMarkdownExportContent` helpers.

### print-styles.css

Print stylesheet (`@media print`) for clean PDF export via `window.print()`. Hides app chrome, shows only note content with serif typography, proper margins, and code block styling.

### LinkedTimeEntries.svelte

Displays time entries linked to the current note. Fetches from `/api/notes/[noteId]/time-entries` and supports unlinking entries.

## Custom Extensions

See `extensions/README.md` for documentation on WikiLink, AnchoredHeading, SuggestionDropdown, and the attachment URL resolver.

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
