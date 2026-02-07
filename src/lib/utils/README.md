# Utilities

Pure utility modules with no server or framework dependencies. Usable on both client and server.

## Modules

- **iso-week.ts** — ISO week date calculations (Monday-of-week, week number, year, date ranges, formatting). 38 tests.
- **format-date.ts** — Smart date formatting (today as HH:mm, last 7 days as day name, older as DD/MM/YYYY). 6 tests.
- **extract-preview-lines.ts** — Extracts first two non-empty text lines from TipTap JSON content for note list previews. 11 tests.

## Testing

All utilities have co-located test files (`*.test.ts`) and run via `npx vitest run`.
