# Notes Components

WYSIWYG markdown editor components using TipTap v2.

## Architecture

The notes module provides a rich text editing experience with markdown support. The editor uses TipTap core with StarterKit, Link, Image, FileHandler, Placeholder, Markdown, WikiLink, and AnchoredHeading extensions.

## Components

### NoteEditor.svelte

Main editor component with title field, toolbar, and content area.

**Features:**
- Title input field with change tracking
- Rich text editing with markdown serialization
- Auto-save with 1.5s debounce
- Dual format support: markdown and JSON
- Read-only mode support
- WikiLink inline nodes with `[[syntax]]` autocomplete
- AnchoredHeading nodes with auto-generated slug IDs
- Click-to-navigate on wiki-link nodes
- Inline image support via drag-drop, paste, or programmatic insertion
- File handler for images (jpeg/png/gif/webp/svg) and PDFs
- `chronolog://attachment/{uuid}` URL resolution for embedded images

**Props:**
```typescript
interface Props {
  initialContent?: string;  // markdown string to load
  initialJson?: string;     // TipTap JSON to load (preferred)
  noteTitle?: string;       // initial title
  noteId?: string;          // note ID (for parent to construct upload URL)
  onSave?: (data: { title: string; content: string; contentJson: string }) => void;
  onTitleChange?: (title: string) => void;
  onWikiLinkClick?: (noteId: string) => void;
  onFileUpload?: (file: File) => Promise<string | null>;  // returns chronolog:// URL
  readonly?: boolean;
}
```

### EditorToolbar.svelte

Formatting toolbar with active state indicators (bold, italic, headings, lists, links).

### LinkedTimeEntries.svelte

Displays time entries linked to the current note. Fetches from `/api/notes/[noteId]/time-entries` and supports unlinking entries.

## Custom Extensions

See `extensions/README.md` for documentation on WikiLink, AnchoredHeading, SuggestionDropdown, and the attachment URL resolver.

## Svelte 5 Integration

TipTap doesn't have native Svelte 5 support. The integration uses:

1. Manual editor instantiation in `onMount`
2. Direct DOM element binding via `bind:this`
3. `onTransaction` callback for reactivity (toolbar state updates)
4. Proper cleanup in `onDestroy`

## Data Format

The editor maintains content in two formats:

1. **Markdown**: Human-readable, portable format via `tiptap-markdown` extension
2. **JSON**: TipTap's native format, preserves all editor state including wiki-link nodes

When loading content, JSON is preferred as it maintains exact formatting and structure.
