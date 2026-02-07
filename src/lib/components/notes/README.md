# Notes Components

WYSIWYG markdown editor components using TipTap v2.

## Architecture

The notes module provides a rich text editing experience with markdown support. The editor uses TipTap core with the Starter Kit, Link, Placeholder, and Markdown extensions.

## Components

### NoteEditor.svelte

Main editor component with title field, toolbar, and content area.

**Features:**
- Title input field with change tracking
- Rich text editing with markdown serialization
- Auto-save with 1.5s debounce
- Dual format support: markdown and JSON
- Read-only mode support
- Prose styling for readability

**Props:**
```typescript
interface Props {
  initialContent?: string;  // markdown string to load
  initialJson?: string;     // TipTap JSON to load (preferred)
  noteTitle?: string;       // initial title
  onSave?: (data: { title: string; content: string; contentJson: string }) => void;
  onTitleChange?: (title: string) => void;
  readonly?: boolean;
}
```

**Usage:**
```svelte
<NoteEditor
  noteTitle="Meeting Notes"
  initialJson={savedJson}
  onSave={(data) => console.log('Saving:', data)}
  onTitleChange={(title) => console.log('Title:', title)}
/>
```

### EditorToolbar.svelte

Formatting toolbar with active state indicators.

**Features:**
- Bold (⌘B), Italic (⌘I)
- Headings (H1, H2, H3)
- Lists (bullet, ordered)
- Horizontal rule
- Link management (add/edit/remove)
- Active state highlighting
- Keyboard shortcuts

**Props:**
```typescript
interface Props {
  editor: Editor | null;
}
```

## Svelte 5 Integration

TipTap doesn't have native Svelte 5 support. The integration uses:

1. Manual editor instantiation in `onMount`
2. Direct DOM element binding via `bind:this`
3. `onTransaction` callback for reactivity (toolbar state updates)
4. Proper cleanup in `onDestroy`

## Styling

The editor uses:
- Tailwind v4 utility classes for layout and interactive elements
- Custom CSS for TipTap content styling (headings, lists, links, code, blockquotes)
- Prose-inspired typography for readability
- Gray-scale palette with blue accents for active states

## Data Format

The editor maintains content in two formats:

1. **Markdown**: Human-readable, portable format via `tiptap-markdown` extension
2. **JSON**: TipTap's native format, preserves all editor state

When loading content, JSON is preferred as it maintains exact formatting and structure.

## Auto-save

Changes trigger a debounced save after 1.5 seconds of inactivity. The `onSave` callback receives:
- `title`: Current note title
- `content`: Markdown serialization
- `contentJson`: JSON serialization

Both the title and editor content changes trigger the debounced save.
