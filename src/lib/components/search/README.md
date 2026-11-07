# Global search and the link picker (sprints 042-CL, 058-DR, 059-DR)

One search over every note (ID, title, body) and time entry description, plus each record's
client and contract identity (sprint 058-DR), across all clients,
backed by `GET /api/search` (`src/lib/server/db/queries/global-search.ts`). The URL is the state:
`/search?q=…` (`src/routes/(workspace)/search/+page.svelte`), so Back/Forward and reload keep the
results. The `[[` wiki-link picker uses the same matcher through `GET /api/notes/search`.

## The /search route (059-DR, SR-01 / SH-05)

The page sits in the `(workspace)` route group: the workspace layout passes it to `AppShell` as
`searchPage`, which renders it in place of the note list and content panels (on a phone, in place
of the whole panel). So the sidebar, ‹ ›, and the timer widget or header pill (the shell's
one-visible-timer rule) stay available. On this route the shell renders no header search field and
the page shows one large query field above the results in every state: prompt, loading
("Searching…"), no matches, failure (with Try again; the query stays) and results. Each search has a
sequence number and an AbortController, so an older reply never replaces a newer one. On a phone
the title bar has "← Back to app" (`search-back-to-app`: Back when the step before is a workspace
place, else the last workspace place) and the timer pill, with no search icon or Find.

## Components

- **GlobalSearchField.svelte** — `size="header"`: the compact field at the far right of the
  shell's top bar (desktop and tablet; not rendered on /search). `size="large"`: the /search field.
  Typing never adds a history step; Enter goes to `/search?q=` (a step, skipped when that search is
  already shown); Cmd+K / Ctrl+K focuses the visible field from anywhere (capture phase, so the
  editor never sees it); Escape blurs; ArrowDown on /search moves into the results. The large
  field takes focus on arrival with the caret after the query (the header-to-route hand-off), and
  on a phone only when there is no query yet (so the keyboard does not cover results).
- **SearchResults.svelte** — one list of notes and time entries in the server's shared rank order
  (newest first within a rank, as the `[[` picker orders notes), hairline-divided, under a summary
  line ("3 notes · 7 time entries", "50 of 120 notes" when cut at the limit of 50 per type).
  Up/Down walk the list; Up from the first hit returns to the field. Empty: "Nothing matches …".
- **SearchHitRow.svelte** — one hit (SR-02): type icon and title (an entry's description) first,
  then `ContractMark` (sm) with "Client / Contract", then the excerpt with the server's highlight
  ranges (ochre `<mark>`). A metadata-only hit shows its reason ("Matches client Amplitude",
  `search-hit-reason`) and no highlighted excerpt. Desktop: quiet date at the right, an entry's
  duration under it; phone: text wraps, date and duration beneath the excerpt. The focused (active)
  row has the sage fill and pine edge.
- **SearchTypeIcon.svelte** — inline SVG note / clock icon, `role="img"` labelled "Note" or
  "Time entry".
- **search-interleave.ts** — `interleaveSearchHits()` merges the API's two groups (the response
  shape only grows; the CLI reads it) by the hits' shared `rank`, then recency; it does not
  re-sort beyond that. Also `searchSummary()` and the short entry date.
- **search-match-reason.ts** — `matchReason(hit)`: the "Matches client …" text for hits that
  matched only their identity (`matchedIn: 'context'`, fields from `matchedContext`).
- **HighlightedText.svelte** — renders text plus match offsets (from the server) as `<mark>`s
  without `{@html}`.
- **entry-reveal.ts** — `revealTimeEntry(id)`: after `navigation.showTimeEntryDay(date)` opens the
  entry's week, waits for its card (`data-entry-id`), centres, focuses and briefly outlines it.
- **search-types.ts** — client shapes of the response and `fetchGlobalSearch()`. Hits carry
  `clientColorIndex` (058-DR), so the extra `GET /api/clients` fetch is gone.

## The shared `[[` link picker (059-DR, SR-04..SR-07)

Linkable targets are **notes only** (time entries have UUIDs and no wiki-link parser or link table
as targets). The picker has no header, scope tabs, close control or second input; the query is
typed where the `[[` is, and matching is always global (no contract, client or timer filter).

- **LinkPicker.svelte** — presentational list. Props: `items`, `status` (`loading` / `ready` /
  `error`), `activeIndex`, `variant` (`desktop` / `phone`), `idPrefix`, `maxHeight`,
  `onChoose(index)`, `onActivate(index)`. A `listbox` named "Link a note" (no visible heading) of
  `option`s: contract mark, title, "Client / Contract"; desktop adds date and code at the right,
  phone stacks the code and omits the date. Active row: sage fill, pine edge. States: "Searching…"
  (only while nothing is shown yet; older rows dim while a newer query loads), "No matching
  notes", failure ("Couldn’t load notes"). The panel prevents `mousedown`, so pressing a row never
  takes focus from the text the caller is editing (the phone keyboard stays up).
- **link-picker-search.svelte.ts** — `createLinkPickerSearch({ fetchTargets?, debounceMs = 150,
  limit?, onChange? })` → `{ query, status, items, setQuery(query, { exclude?, immediate? }),
  retry(), dispose() }`. The first query asks at once, later ones after the debounce; every
  request is numbered and aborted when superseded, and only the latest one's reply is used.
- **link-targets.ts** — `LinkPickerItem`, `fetchLinkTargets(query, { exclude, limit, signal })`
  (`GET /api/notes/search?q=&recent=1&limit=8`; throws on a failed request so failure shows as
  failure) and `toLinkPickerItem()`.
- **link-picker-placement.ts** — `placeLinkPicker({ anchor, viewport, contentHeight, isPhone })`
  → `{ top, left, width, maxHeight, side }` for a `position: fixed` layer. Pass the visual
  viewport (`window.visualViewport`), so a phone's software keyboard is accounted for.

The editor uses these through `notes/extensions/wiki-link-picker.svelte.ts`. The time entry
description's `weekly/WikiLinkInput.svelte` should adopt them as described in
`docs/sprints/sprint-059-DR.md` ("WikiLinkInput adoption").

A note hit opens through `navigation.openNote()`, like any other note link; an entry hit opens its
week with the entry focused. This is the app's only search box: the note list's own "Search all
notes" box was removed in sprint 051-UI (owner request).
