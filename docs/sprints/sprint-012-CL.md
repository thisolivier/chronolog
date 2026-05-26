# Sprint 012 — CL: Markdown Editor Enhancements (CL-4)

**Status:** pending
**Type:** standard
**Backlog items:** CL-4
**Depends on:** nothing
**Branch:** `sprint-012-CL/markdown-editor`

## Objectives

Enhance the TipTap note editor with code blocks (syntax highlighting) and a raw/rendered
mode toggle. The editor already uses `tiptap-markdown` and stores both markdown and JSON.

**Important discovery:** The current editor ALREADY stores markdown (`content` field) and
JSON (`contentJson` field). The `tiptap-markdown` extension is already wired in. We do NOT
need a storage migration — the markdown storage is already in place.

## Tasks

### 1. Add code block extension with syntax highlighting

Install and configure a syntax-highlighting code block extension for TipTap.

Options (in order of preference):
- `@tiptap/extension-code-block-lowlight` — uses lowlight (highlight.js based), well-supported
- `@tiptap/extension-code-block` — basic code blocks without highlighting (fallback)

File: `src/lib/components/notes/NoteEditor.svelte`

- Add the code block extension to the editor config
- Replace the basic `codeBlock` from StarterKit with the lowlight version
- Register common languages: javascript, typescript, python, bash, sql, json, html, css, markdown
- Style code blocks with a monospace font and subtle background

### 2. Add code block button to toolbar

File: `src/lib/components/notes/EditorToolbar.svelte`

- Add a "Code" button (or `</>` icon) that inserts a code block
- Add language selector for code blocks (dropdown or inline picker)
- The code block should support typing ``` followed by a language name (GFM syntax)

### 3. Add raw/rendered mode toggle

Create a toggle that switches between:
- **Rendered mode** (current): TipTap WYSIWYG editor with rich formatting
- **Raw mode**: Plain textarea showing the raw markdown, monospace font

File: `src/lib/components/notes/NoteEditor.svelte` (or a wrapper)

Implementation:
- Add a toggle button/switch in the editor header area (near the toolbar)
- In rendered mode: show the current TipTap editor (no change)
- In raw mode: hide TipTap, show a `<textarea>` with the markdown content
- Switching from raw → rendered: parse the textarea markdown back into TipTap
- Switching from rendered → raw: extract markdown from TipTap
- Auto-save should work in both modes
- The toggle state does NOT persist — always start in rendered mode

### 4. Style code blocks

Add CSS for syntax-highlighted code blocks:
- Dark or subtle background for code blocks
- Monospace font (use the system monospace stack)
- Line numbers (optional, nice-to-have)
- Language label in the top-right corner of the block
- Horizontal scroll for long lines (no wrapping)

Use a highlight.js theme that matches the app's design (a light theme — the app uses
a light background). Consider `github` or `github-light` themes.

### 5. Update tests

- Test that code blocks render with syntax highlighting
- Test that raw/rendered toggle preserves content
- Test that GFM code block syntax (```) works in the editor
- Existing note tests must still pass

### 6. Verify

- `npm run test` passes
- `npm run check` passes (no new errors)
- `npm run build` succeeds
- Code blocks display with syntax highlighting
- Raw/rendered toggle works without data loss

## Key Files

- `src/lib/components/notes/NoteEditor.svelte` — main editor component
- `src/lib/components/notes/EditorToolbar.svelte` — toolbar buttons
- `src/lib/components/notes/extensions/` — custom TipTap extensions
- `src/routes/api/notes/[noteId]/+server.ts` — note save API

## Acceptance Criteria

- [ ] Code blocks with syntax highlighting (lowlight or equivalent)
- [ ] Language selector or GFM ``` syntax for code blocks
- [ ] Code block button in toolbar
- [ ] Raw/rendered mode toggle
- [ ] Content preserved across mode switches
- [ ] Auto-save works in both modes
- [ ] Styled code blocks (monospace, background, language label)
- [ ] All existing tests pass + new tests
- [ ] `npm run check` passes
- [ ] `npm run build` succeeds

## Notes

**`tiptap-markdown` is already installed** (`^0.9.0`). The editor already stores markdown.

**StarterKit includes a basic `codeBlock`** — disable it when adding the lowlight version
to avoid conflicts: `StarterKit.configure({ codeBlock: false })`.

**The `content` field already stores markdown.** No DB migration needed. The raw mode
textarea just shows this same field directly.

**highlight.js languages are tree-shakeable.** Only import the languages you need to keep
the bundle small. Common set: js, ts, python, bash, sql, json, html, css, md.

**Docker stack must be running** for e2e tests and the dev server.
