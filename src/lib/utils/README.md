# Utilities

Pure utility modules with no server or framework dependencies. Usable on both client and server.

## Modules

- **iso-week.ts** — ISO week date calculations (Monday-of-week, week number, year, date ranges, formatting).
- **format-date.ts** — Smart date formatting (today as HH:mm, last 7 days as day name, older as DD/MM/YYYY).
- **duration.ts** — The one duration parser and formatter for every time entry form. `parseDuration()` accepts decimal hours (`1.5`), hours and minutes (`1h30m`, `2h 30`, `1:30`), bare minutes (`90`, `90m`) and time ranges (`09:00-11:15`, `9-10:30`). It rejects zero, anything over 24 hours and a range that ends before it starts, and warns above 12 hours. Also provides `formatMinutes` ("2h 15m"), `formatMinutesCompact` (week strip), `formatTimeRange`, `formatDurationInput` and `validateDurationMinutes` (used by the API routes). Tested in `duration.test.ts`.
- **extract-preview-lines.ts** — Extracts the first two non-empty text lines (every text block, list items included) from TipTap JSON content for note list previews. A wiki-link reads as its label, else the target's title (`resolveNoteTitle` option), else its ID (sprint 043-CL).
- **markdown-preview-lines.ts** — The same for notes that only have markdown (created over the API): heading, list and quote markers stripped, links shown as their text (`[file.pdf](chronolog://…)` → `file.pdf`, `[[ID]]` → title or ID).
- **note-display-title.ts** — `noteDisplayTitle(title, contentJson, options)`: the stored title, else the first line. A stored title saved before sprint 043, which dropped wiki-link text ("Beta note links to"), is recognised and derived again with the links.
- **wiki-link-text.ts** — Pure wiki-link text helpers (sprint 043-CL): `parseWikiLinkText` (also used by the editor extension), `wikiLinkPlainText`, `collectWikiLinkNoteIds` (targets from JSON and markdown, for the server's one-query title lookup in `queries/wiki-link-titles.ts`) and `markdownLinksToText`.
- **reconcile-description-links.ts** — Reconciles wiki-link references in time entry descriptions with the backlinks index.
- **client-colors.ts** — Client color palette and helper functions. Maps a `colorIndex` to a set of CSS color values (border, dot, background) used for client-specific visual accents throughout the UI. `suggestClientColorIndex` gives a new client the first colour no active client uses (the least used one once all eight are taken); `findSharedClientColors` lists colours two active clients share, for the hint in Settings → Clients (044-CL).
- **usage-summary.ts** — Wording for the admin delete confirm dialogs ("2 contracts, 3 time entries (4h 45m) and 1 note") and `hasRecordedWork()`, which decides whether Archive is offered first. No server imports.
- **group-contracts-by-client.ts** — Groups contracts under their client for the sidebar, clients ordered by name and contracts keeping their server order.
- **sidebar-sections.ts** — Splits the sidebar's contracts into active client groups and the Archived section (a contract is archived when it or its client is); used by the contract directory store.
- **search-snippet.ts** — Search snippets (sprint 042-CL): `findMatchRanges` (case-insensitive), `plainTextFromMarkdown`, `buildSearchSnippet` (an excerpt around the first match, cut at words, with match offsets) and `snippetParts` for rendering `<mark>`s. Shared by `GET /api/search` and the results page.
- **task-items.ts** — `extractTaskItems(markdown)`: the `- [ ]` / `- [x]` items of a note (text, checked, depth, line), skipping fenced code and empty items. Used by `GET /api/notes/todos` (sprint 040-CL).
- **uuid.ts** — `isUuid()`, used by the `[clientId=uuid]` / `[contractId=uuid]` route matchers so malformed IDs return 404 rather than a database error.

## Testing

Utilities have co-located test files (`*.test.ts`) and run via `npx vitest run`.
