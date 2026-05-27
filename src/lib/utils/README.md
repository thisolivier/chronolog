# Utilities

Pure utility modules with no server or framework dependencies. Usable on both client and server.

## Modules

- **iso-week.ts** — ISO week date calculations (Monday-of-week, week number, year, date ranges, formatting).
- **format-date.ts** — Smart date formatting (today as HH:mm, last 7 days as day name, older as DD/MM/YYYY).
- **time-parse.ts** — Time input parsing supporting both duration ("2h30m") and time range ("09:00-11:30") formats.
- **extract-preview-lines.ts** — Extracts first two non-empty text lines from TipTap JSON content for note list previews.
- **reconcile-description-links.ts** — Reconciles wiki-link references in time entry descriptions with the backlinks index.
- **client-colors.ts** — Client color palette and helper functions. Maps a `colorIndex` to a set of CSS color values (border, dot, background) used for client-specific visual accents throughout the UI.

## Testing

Utilities have co-located test files (`*.test.ts`) and run via `npx vitest run`.
