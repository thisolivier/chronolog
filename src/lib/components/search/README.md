# Global search (sprint 042-CL)

One search over every note (ID, title, body) and time entry description, plus each record's
client and contract identity (sprint 058-DR), across all clients,
backed by `GET /api/search` (`src/lib/server/db/queries/global-search.ts`). The URL is the state:
`/search?q=…` (`src/routes/search/+page.svelte`), so Back/Forward and reload keep the results.

## Components

- **GlobalSearchField.svelte** — the field in the shell's top bar (desktop and tablet, in
  `AppShell.svelte`, right after the ‹ › history buttons, sprint 050-UI) and in the /search header.
  Typing never adds a history step; Enter goes to `/search?q=` (a step, skipped when that search is
  already shown); Cmd+K / Ctrl+K focuses
  the visible field from anywhere (capture phase, so the editor never sees it); Escape blurs;
  ArrowDown on /search moves into the results. On a phone the shell header has a search icon
  linking to `/search`, where the field takes focus.
- **SearchResults.svelte** — one list of notes and time entries in the server's shared rank order
  (sprint 058-DR; newest first within a rank, as the `[[` picker orders notes),
  under a summary line ("3 notes · 7 time entries", "50 of 120 notes" when cut at the limit of 50
  per type; the API now allows up to 100). Up/Down walk the list in order; Up from the first hit returns to the field.
- **SearchHitRow.svelte** — one hit: type icon, client colour dot and "Client / Contract", date
  (and duration for entries) at the end of that line, then the title or description and the
  snippet with the matches in `<mark>`. From 768 px (`md`) the icon has its own left column; on a
  phone it sits at the start of the client/contract line, the client shows as its short code and
  the title and snippet run full width below (no sideways scroll at 320 px).
- **SearchTypeIcon.svelte** — inline SVG note / clock icon, `role="img"` labelled "Note" or
  "Time entry".
- **search-interleave.ts** — `interleaveSearchHits()` merges the API's two groups (the response
  shape only grows; the CLI reads it) by the hits' shared `rank` (058-DR, see
  `src/lib/server/search/README.md`), then recency: a note by its last modified time, an entry by
  its date then start time (none = start of day), compared in local time; ties keep the server order.
  Also `searchSummary()` and the phone date format.
- **HighlightedText.svelte** — renders text plus match offsets (from the server) as `<mark>`s
  without `{@html}`.
- **entry-reveal.ts** — `revealTimeEntry(id)`: after `navigation.showTimeEntryDay(date)` opens the
  entry's week, waits for its card (`data-entry-id`), centres, focuses and briefly outlines it.
- **search-types.ts** — client shapes of the response, `fetchGlobalSearch()`, and
  `fetchClientColorIndexes()` (`GET /api/clients`, once per page, for the colour dots).

A note hit opens through `navigation.openNote()`, like any other note link. This is the app's only
search box: the note list's own "Search all notes" box was removed in sprint 051-UI (owner
request). `/api/notes/search` stays: the `[[` wiki-link suggestions and the time entry
description's link input use it.
