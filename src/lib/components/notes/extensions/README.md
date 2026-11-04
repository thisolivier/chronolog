# TipTap Extensions

Custom TipTap extensions for the Chronolog notes editor.

## Extensions

### anchored-heading.ts

Extends the built-in Heading node to auto-generate URL-friendly slug IDs from heading text content. This enables `[[NOTE#heading-slug]]` wiki-link syntax to target specific sections within a note.

When using this extension, disable the default Heading from StarterKit:

```ts
StarterKit.configure({ heading: false }),
AnchoredHeading,
```

Also exports `generateSlug(text)` for reuse elsewhere (e.g., resolving wiki-link anchors).

### wiki-link.ts

WikiLink inline node extension that renders `[[note-links]]` in the editor. Supports the full wiki-link syntax:

- `[[NOTE_ID]]` -- plain link
- `[[NOTE_ID|label]]` -- link with display text
- `[[NOTE_ID#heading]]` -- link to heading
- `[[NOTE_ID#heading|label]]` -- heading link with display text

Integrates TipTap's Suggestion utility (triggered by `[[`) to provide autocomplete when typing wiki-links. The suggestion popup calls `/api/notes/search` (ranked: exact ID, ID prefix, title, ID substring, body). The note being edited is excluded through `editor.storage.wikiLink.getCurrentNoteId`, and an empty query lists recent notes (`recent=1`). Each `WikiLinkSuggestionItem` carries `firstLine`/`secondLine` content previews alongside `noteId`/`title`. Inserted links carry no label, so the chip keeps showing the target's live title.

**Node view.** The node renders the linked note's title from the shared title cache (`../note-titles.svelte.ts`), with the note ID as a tooltip. The document still stores only the ID, so markdown stays `[[id]]`.

**Markdown round-trip.** The node contributes a tiptap-markdown spec via `addStorage().markdown`:

- `serialize(state, node)` writes `[[ID]]`, `[[ID|label]]`, `[[ID#heading]]` or `[[ID#heading|label]]` (label omitted when it equals the note ID), so `getMarkdown()` never falls back to the HTML `<span data-wiki-link>` form and the server's `updateNoteLinks()` can extract backlinks.
- `parse.setup(markdownit)` registers a markdown-it inline rule (before the built-in `link` rule) that turns `[[...]]` into a `wiki_link` token rendered as `<span data-wiki-link data-note-id data-label [data-heading-anchor]>`, which the node's `parseHTML` then picks up. This covers `setContent(markdown)` (raw-mode toggle) and the initial markdown content fallback. Registration is idempotent because tiptap-markdown calls `setup` on every parse.

Also exports `parseWikiLinkText(raw)` for parsing the interior of `[[...]]` tokens and `formatWikiLinkText(noteId, headingAnchor, label)` for the inverse. Tests live in `wiki-link.test.ts` (jsdom).

### SuggestionDropdown.ts

Vanilla JS dropdown component for the WikiLink suggestion popup. Each item shows the note ID, the first content line (falling back to title, then ID) and an optional truncated second line. Supports keyboard navigation (arrow keys, Enter, Escape) and mouse selection. Positions itself relative to the cursor, showing above or below depending on viewport space.

### markdown-text.ts

Replaces StarterKit's `text` node. Its markdown serializer escapes `<` only where it could open a tag, comment or autolink, so `->` stays `->` in saved markdown, raw mode and the Markdown export (the default serializer wrote `-&gt;`). `escapeTagOpeners` is exported for tests.

### task-list.ts, task-list-dom.ts (sprint 040-CL)

Checkbox task lists, `- [ ] open` / `- [x] done`, nestable. `TaskListExtensions` registers:

- `ChronologTaskList`: the official `TaskList` (from `@tiptap/extension-list`, the TipTap version installed) with a `tight` attribute so prosemirror-markdown writes one item per line, and a serializer that uses `*` instead of `-` when a bullet list is a direct neighbour (`taskListMarker`). Otherwise markdown-it would read `- a` then `- [ ] b` back as one list.
- `ChronologTaskItem`: the official `TaskItem` (`nested: true`). An extra input rule turns a bullet or numbered list item into a task item when `[ ] `, `[] ` or `[x] ` is typed at its start (the list is split around it, and it joins a task list right before or after it); anywhere else the stock rule starts a new task list. A capture-phase `mousedown` listener focuses the editor before a checkbox click: the stock handler's `focus()` otherwise focused the DOM inside its own command chain in Safari and the tick was lost ("Applying a mismatched transaction").
- `TaskListMarkdownNormaliser`: a markdown parse hook (`splitMixedTaskLists` in `task-list-dom.ts`) that splits a list mixing plain and task items into consecutive bullet and task lists.

Parsing is tiptap-markdown's own task-list spec (markdown-it-task-lists). Tests: `task-list.test.ts` (round-trips: plain, nested, beside bullet lists, mixed, with wiki-links and code blocks; typing the markers) and `../note-print-tasks.test.ts`. Task items in markdown are read on the server by `$lib/utils/task-items.ts`.

### attachment-image.ts

`AttachmentImage` extends the Image node. The document keeps the `chronolog://attachment/{id}` src (so saved markdown and JSON never contain blob URLs), while a node view shows a blob URL resolved by `attachment-resolver.ts`.

### attachment-link.ts

A PDF (any non-image attachment) sits in a note as an ordinary link, `[report.pdf](chronolog://attachment/{id})` (sprint 036). The Link mark keeps only hrefs whose scheme it knows, so `NoteEditor` passes `ATTACHMENT_LINK_PROTOCOLS` (`chronolog`) to StarterKit's `link` options; without it the href is dropped on parse. `attachmentHrefFromTarget(target)` finds such a link from a click, and `openAttachment(url)` opens a tab inside the click (so popup blockers allow it), then points it at the resolver's blob URL (closing it if the fetch fails). `AttachmentList` opens files the same way. SVG (and other active content) is never opened as a page, since a blob URL carries the app origin. The editor CSS gives these links a document icon; printing (`note-print.ts`) replaces them with the filename marked "(attached file)".

### attachment-availability.ts (sprint 043-CL)

Which attachment links point at a deleted file. `checkAttachment(url)` asks `HEAD /api/attachments/<id>` once per attachment (`cache: 'no-store'`; only a 404 counts as missing, so offline leaves it unknown) and remembers the answer; `note-attachments-changed` forgets the answers. The `AttachmentLinkStatus` extension draws an inline decoration (`attachment-link-missing`: dashed, struck through, "(deleted)", like a missing image) over links to a missing file; only plugin meta is dispatched, so the document never changes and nothing autosaves. `openAttachment` returns early for a known-missing file instead of opening a tab that closes again (and checks after a failed open).

### attachment-resolver.ts

Resolves `chronolog://attachment/{uuid}` URLs to displayable blob URLs. Images and PDFs embedded in notes use this custom URL scheme. The resolver fetches binary data from `/api/attachments/{id}`, creates blob URLs via `URL.createObjectURL()`, and caches results to avoid re-fetching. `AttachmentImage` uses it, and the blob URLs are revoked on teardown.

Exports:
- `parseChronologUrl(url)` -- extract attachment ID from a chronolog:// URL
- `buildChronologUrl(attachmentId)` -- build a chronolog:// URL from an ID
- `resolveAttachmentUrl(chronologUrl)` -- fetch and create a blob URL (async, cached)
- `revokeAttachmentUrl(blobUrl)` -- clean up a single blob URL
- `revokeAllTrackedUrls()` -- clean up all tracked blob URLs (for component teardown)
- `resolveAllChronologImages(container)` -- scan a DOM element for `<img>` tags with `chronolog://` src and replace with blob URLs
