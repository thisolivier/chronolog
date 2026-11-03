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

Integrates TipTap's Suggestion utility (triggered by `[[`) to provide autocomplete when typing wiki-links. The suggestion popup fetches matching notes from `/api/notes/search` (matched on note ID, title and body content); each `WikiLinkSuggestionItem` carries `firstLine`/`secondLine` content previews alongside `noteId`/`title`.

**Markdown round-trip.** The node contributes a tiptap-markdown spec via `addStorage().markdown`:

- `serialize(state, node)` writes `[[ID]]`, `[[ID|label]]`, `[[ID#heading]]` or `[[ID#heading|label]]` (label omitted when it equals the note ID), so `getMarkdown()` never falls back to the HTML `<span data-wiki-link>` form and the server's `updateNoteLinks()` can extract backlinks.
- `parse.setup(markdownit)` registers a markdown-it inline rule (before the built-in `link` rule) that turns `[[...]]` into a `wiki_link` token rendered as `<span data-wiki-link data-note-id data-label [data-heading-anchor]>`, which the node's `parseHTML` then picks up. This covers `setContent(markdown)` (raw-mode toggle) and the initial markdown content fallback. Registration is idempotent because tiptap-markdown calls `setup` on every parse.

Also exports `parseWikiLinkText(raw)` for parsing the interior of `[[...]]` tokens and `formatWikiLinkText(noteId, headingAnchor, label)` for the inverse. Tests live in `wiki-link.test.ts` (jsdom).

### SuggestionDropdown.ts

Vanilla JS dropdown component for the WikiLink suggestion popup. Each item shows the note ID, the first content line (falling back to title, then ID) and an optional truncated second line. Supports keyboard navigation (arrow keys, Enter, Escape) and mouse selection. Positions itself relative to the cursor, showing above or below depending on viewport space.

### attachment-resolver.ts

Resolves `chronolog://attachment/{uuid}` URLs to displayable blob URLs. Images and PDFs embedded in notes use this custom URL scheme. The resolver fetches binary data from `/api/attachments/{id}`, creates blob URLs via `URL.createObjectURL()`, and caches results to avoid re-fetching.

Exports:
- `parseChronologUrl(url)` -- extract attachment ID from a chronolog:// URL
- `buildChronologUrl(attachmentId)` -- build a chronolog:// URL from an ID
- `resolveAttachmentUrl(chronologUrl)` -- fetch and create a blob URL (async, cached)
- `revokeAttachmentUrl(blobUrl)` -- clean up a single blob URL
- `revokeAllTrackedUrls()` -- clean up all tracked blob URLs (for component teardown)
- `resolveAllChronologImages(container)` -- scan a DOM element for `<img>` tags with `chronolog://` src and replace with blob URLs
