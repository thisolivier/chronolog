# Global search (sprint 042-CL)

One search over every note (ID, title, body) and time entry description, across all clients,
backed by `GET /api/search` (`src/lib/server/db/queries/global-search.ts`). The URL is the state:
`/search?q=…` (`src/routes/search/+page.svelte`), so Back/Forward and reload keep the results.

## Components

- **GlobalSearchField.svelte** — the field in the shell's top bar (desktop and tablet, in
  `AppShell.svelte`) and in the /search header. Enter goes to `/search?q=`; Cmd+K / Ctrl+K focuses
  the visible field from anywhere (capture phase, so the editor never sees it); Escape blurs;
  ArrowDown on /search moves into the results. On a phone the shell header has a search icon
  linking to `/search`, where the field takes focus.
- **SearchResults.svelte** — the Notes and Time entries groups ("2 of 31" when cut at the limit of
  50 each). Each hit shows client code, contract, date (and duration for entries) and a snippet with
  the matches in `<mark>`; Up/Down move between hits. Notes: title hits rank above body hits.
- **HighlightedText.svelte** — renders text plus match offsets (from the server) as `<mark>`s
  without `{@html}`.
- **entry-reveal.ts** — `revealTimeEntry(id)`: after `navigation.showTimeEntryDay(date)` opens the
  entry's week, waits for its card (`data-entry-id`), centres, focuses and briefly outlines it.
- **search-types.ts** — client shapes of the response and `fetchGlobalSearch()`.

A note hit opens through `navigation.openNote()`, like any other note link. The per-contract
"Search all notes" box in the note list (`/api/notes/search`) is separate and unchanged.
