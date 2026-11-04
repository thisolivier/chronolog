# Utilities

Pure utility modules with no server or framework dependencies. Usable on both client and server.

## Modules

- **iso-week.ts** — ISO week date calculations (Monday-of-week, week number, year, date ranges, formatting).
- **format-date.ts** — Smart date formatting (today as HH:mm, last 7 days as day name, older as DD/MM/YYYY).
- **duration.ts** — The one duration parser and formatter for every time entry form. `parseDuration()` accepts decimal hours (`1.5`), hours and minutes (`1h30m`, `2h 30`, `1:30`), bare minutes (`90`, `90m`) and time ranges (`09:00-11:15`, `9-10:30`). It rejects zero, anything over 24 hours and a range that ends before it starts, and warns above 12 hours. Also provides `formatMinutes` ("2h 15m"), `formatMinutesCompact` (week strip), `formatTimeRange`, `formatDurationInput` and `validateDurationMinutes` (used by the API routes). Tested in `duration.test.ts`.
- **extract-preview-lines.ts** — Extracts first two non-empty text lines from TipTap JSON content for note list previews.
- **reconcile-description-links.ts** — Reconciles wiki-link references in time entry descriptions with the backlinks index.
- **client-colors.ts** — Client color palette and helper functions. Maps a `colorIndex` to a set of CSS color values (border, dot, background) used for client-specific visual accents throughout the UI.
- **usage-summary.ts** — Wording for the admin delete confirm dialogs ("2 contracts, 3 time entries (4h 45m) and 1 note") and `hasRecordedWork()`, which decides whether Archive is offered first. No server imports.
- **group-contracts-by-client.ts** — Groups contracts under their client for the sidebar, clients ordered by name and contracts keeping their server order.
- **sidebar-sections.ts** — Splits the sidebar's contracts into active client groups and the Archived section (a contract is archived when it or its client is); used by the contract directory store.
- **uuid.ts** — `isUuid()`, used by the `[clientId=uuid]` / `[contractId=uuid]` route matchers so malformed IDs return 404 rather than a database error.

## Testing

Utilities have co-located test files (`*.test.ts`) and run via `npx vitest run`.
