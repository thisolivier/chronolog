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

Integrates TipTap's Suggestion utility (triggered by `[[`) to provide autocomplete when typing wiki-links. The suggestion popup fetches matching notes from `/api/notes/search`.

Also exports `parseWikiLinkText(raw)` for parsing the interior of `[[...]]` tokens.

### SuggestionDropdown.ts

Vanilla JS dropdown component for the WikiLink suggestion popup. Supports keyboard navigation (arrow keys, Enter, Escape) and mouse selection. Positions itself relative to the cursor, showing above or below depending on viewport space.

### attachment-resolver.ts

Resolves `chronolog://attachment/{uuid}` URLs to displayable blob URLs. Images and PDFs embedded in notes use this custom URL scheme. The resolver fetches binary data from `/api/attachments/{id}`, creates blob URLs via `URL.createObjectURL()`, and caches results to avoid re-fetching.

Exports:
- `parseChronologUrl(url)` -- extract attachment ID from a chronolog:// URL
- `buildChronologUrl(attachmentId)` -- build a chronolog:// URL from an ID
- `resolveAttachmentUrl(chronologUrl)` -- fetch and create a blob URL (async, cached)
- `revokeAttachmentUrl(blobUrl)` -- clean up a single blob URL
- `revokeAllTrackedUrls()` -- clean up all tracked blob URLs (for component teardown)
- `resolveAllChronologImages(container)` -- scan a DOM element for `<img>` tags with `chronolog://` src and replace with blob URLs
