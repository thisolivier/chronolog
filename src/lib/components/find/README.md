# Find in page (sprint 042-CL)

Cmd+F (Ctrl+F off Apple platforms) inside the note editor panel or the timesheet opens a find bar
at the top of that panel: every match highlighted, a "3 of 12" count, next/previous (Enter /
Shift+Enter or the arrow buttons), Escape or ✕ closes and clears the highlights. Elsewhere (the
sidebar, the note list, settings) the browser's own find is left alone.

## Components

- **FindBar.svelte** — the bar and its keyboard handling. Mounted as the first child of a panel
  (one line each in `NoteEditorPanel.svelte`, `mode="editor"`, and `TimeEntriesPanel.svelte`,
  `mode="dom"`); its parent element is the panel it searches. The shortcut is taken only while the
  focused element, or the last click when nothing is focused, is inside that panel. While open it
  follows the page: a MutationObserver re-runs a DOM search (debounced), the editor mode re-reads
  the plugin state and re-attaches when the editor is remounted (another note).
- **editor-find.ts** — a ProseMirror plugin (`editorFindKey`) registered on the live TipTap editor
  with `editor.registerPlugin` when the bar opens and removed on close, so the editor setup is not
  touched. It finds matches per text block (across marks; inline atoms count as one character) and
  draws `Decoration.inline`s. Only plugin meta is dispatched: the document never changes, TipTap
  fires no `update`, nothing autosaves. Closing leaves the selection on the current match. The
  editor instance is found from the DOM (`.tiptap` element's `editor` property).
- **dom-find.ts** — matches as DOM `Range`s over the panel's visible text nodes (not inputs,
  textareas, `aria-hidden` or `[data-find-exclude]`, which marks the bar itself), painted with the
  CSS Custom Highlight API (`::highlight(chronolog-find)`), which leaves the DOM alone. Without
  that API the count and stepping still work. `installFindStyles()` adds the colours once.
- **shortcuts.ts** — `isFindShortcut`, `isSearchShortcut` (Cmd/Ctrl+K, used by the global search
  field) and `shortcutLabel`.

## Notes

- Raw markdown mode in the editor is not searched (the textarea has no highlights).
- Desktop app: Tauri's default macOS menu has no Find item and the app adds none, so Cmd+F and
  Cmd+K reach the page (checked in `tauri-2.12.5` `Menu::default`, not run in the app).

Tests: `find.test.ts` (jsdom: plugin, no document change, DOM finder, shortcuts) and
`e2e-playwright/search.spec.ts`.
