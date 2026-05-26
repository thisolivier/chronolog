# Sprint 013 — CL: Note Export (CL-5)

**Status:** pending
**Type:** standard
**Backlog items:** CL-5
**Depends on:** Sprint 012-CL (MD editor — merged)
**Branch:** `sprint-013-CL/note-export`

## Objectives

Add per-note export to Markdown file and PDF. The note editor already stores markdown
in the `content` field. Export should be accessible from the note detail view.

## Tasks

### 1. Add export buttons to NoteEditorPanel

File: `src/lib/components/layout/NoteEditorPanel.svelte`

Add export buttons (or a dropdown menu) in the note editor header area:
- "Export as Markdown" — downloads a `.md` file
- "Export as PDF" — downloads a `.pdf` file

Use the note title (or note ID if untitled) as the filename.

### 2. Implement Markdown export

This is straightforward — the `content` field already contains markdown.

- Get the markdown content from the current note
- Create a Blob with MIME type `text/markdown`
- Trigger a download with filename `{title}.md`
- Include the note title as a `# Heading` at the top of the file if not already present

### 3. Implement PDF export

For client-side PDF generation, use a lightweight approach:
- Use the browser's `window.print()` with a print-specific stylesheet, OR
- Use a library like `jspdf` + `html2canvas`, OR
- Render the markdown to HTML and use `@react-pdf/renderer` or similar

**Recommended approach**: Use `window.print()` with a `@media print` stylesheet.
This is zero-dependency and produces high-quality PDFs. Add a print stylesheet that:
- Hides the app chrome (sidebar, toolbar, navigation)
- Shows only the note content
- Uses clean typography with proper margins
- Includes the note title as a header

If `window.print()` is insufficient (e.g., needs to work headlessly or the user
wants direct `.pdf` download without the print dialog), use a library.

### 4. Style the print view

File: create `src/lib/components/notes/print-styles.css` or add to the existing styles

- Hide everything except the note content
- Clean serif or sans-serif typography
- Proper page margins (1 inch / 2.5cm)
- Code blocks should have a light background and monospace font
- Page breaks should avoid splitting headings from their content

### 5. Write tests

- Test that MD export produces valid markdown with title heading
- Test that the export buttons render in the note editor
- Existing tests must pass

### 6. Verify

- `npm run test` passes
- `npm run check` passes (no new errors)
- `npm run build` succeeds
- MD export downloads a valid `.md` file
- PDF export produces a clean printable view

## Acceptance Criteria

- [ ] "Export as Markdown" button in note editor
- [ ] "Export as PDF" button in note editor
- [ ] MD export downloads `.md` file with title heading
- [ ] PDF export produces clean output (via print or library)
- [ ] All existing tests pass + new tests
- [ ] `npm run check` passes
- [ ] `npm run build` succeeds

## Notes

**Keep dependencies minimal.** `window.print()` with CSS is strongly preferred over
adding a PDF generation library. The user has a browser — use it.

**The note content is already markdown.** The `content` field from the DataService
contains the raw markdown. No conversion needed for MD export.

**Docker stack must be running** for the dev server.
