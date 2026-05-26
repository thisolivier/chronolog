# Sprint 012 — CL: Markdown Editor Enhancements (CL-4)

**Status:** signed-off
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

- [x] Code blocks with syntax highlighting (lowlight or equivalent)
- [x] Language selector or GFM ``` syntax for code blocks
- [x] Code block button in toolbar
- [x] Raw/rendered mode toggle
- [x] Content preserved across mode switches
- [x] Auto-save works in both modes
- [x] Styled code blocks (monospace, background, language label)
- [x] All existing tests pass + new tests
- [x] `npm run check` passes (no new errors; 4 pre-existing errors remain)
- [x] `npm run build` succeeds

## Notes

**`tiptap-markdown` is already installed** (`^0.9.0`). The editor already stores markdown.

**StarterKit includes a basic `codeBlock`** — disable it when adding the lowlight version
to avoid conflicts: `StarterKit.configure({ codeBlock: false })`.

**The `content` field already stores markdown.** No DB migration needed. The raw mode
textarea just shows this same field directly.

**highlight.js languages are tree-shakeable.** Only import the languages you need to keep
the bundle small. Common set: js, ts, python, bash, sql, json, html, css, md.

**Docker stack must be running** for e2e tests and the dev server.

## Sign-off

**Branch:** `sprint-012-CL/markdown-editor`
**Commit:** `7ab6573`
**Worktree:** `/Users/olivier/sites/chronolog/.claude/worktrees/sprint-012-CL`

### Results
- **Tests:** 219/219 passed (14 test files), including 7 new editor-features tests
- **Build:** Succeeds
- **Check:** 4 pre-existing errors (hooks.server.ts, powersync connector, jose KeyLike), 0 new errors

### What was delivered
1. **CodeBlockLowlight extension** — `@tiptap/extension-code-block-lowlight` + `lowlight` with `createLowlight(common)` (~35 languages). StarterKit's basic codeBlock disabled.
2. **Toolbar code block button** — `</>` button in EditorToolbar.svelte with active state highlighting.
3. **GFM ``` syntax** — typing triple backtick + language name works via CodeBlockLowlight input rules.
4. **Raw/rendered mode toggle** — "◇ Rich" / "◆ Raw" button next to toolbar. Switches between TipTap WYSIWYG and raw markdown textarea. Content preserved across switches. Auto-save works in both modes via `isSyncingFromRaw` flag to prevent double-saves.
5. **Code block styling** — github-light theme (20 hljs token rules), language label in top-right corner, light background (#f6f8fa), monospace font, horizontal scroll.
6. **Tests** — `editor-features.test.ts` with 7 tests covering code block creation from markdown, JSON round-trip, markdown extraction, unspecified language, toggle command, and raw mode toggle simulation.

### Notes
- The test agent discovered that `common` from `lowlight` is a language map, not a lowlight instance. Fixed to `createLowlight(common)` which provides the `highlight`/`highlightAuto`/`listLanguages` methods that CodeBlockLowlight requires.
- `jsdom` added as devDependency for headless TipTap Editor testing in vitest.
