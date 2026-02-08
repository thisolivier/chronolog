# Database Query Modules

Server-side query functions organized by domain entity. Each module exports functions that accept a database instance and return typed results using Drizzle ORM.

## Architecture

Query modules encapsulate all SQL logic for their domain. They are called by SvelteKit API routes (`+server.ts` files) and server load functions. The barrel export (`index.ts`) re-exports all modules for convenience.

## Modules

| File | Purpose |
|------|---------|
| `clients.ts` | Client CRUD queries |
| `contracts.ts` | Contract queries (by client, by ID) |
| `deliverables.ts` | Deliverable queries (by contract) |
| `work-types.ts` | Work type queries (by deliverable) |
| `time-entries.ts` | Time entry CRUD queries |
| `time-entries-weekly.ts` | Weekly time entry aggregation (grouped by day) |
| `weekly-statuses.ts` | Weekly status read/write queries |
| `notes.ts` | Note CRUD queries |
| `note-links.ts` | Wiki-link backlinks index (parse + store + query) |
| `attachments.ts` | File attachment CRUD queries |
| `wiki-link-parser.ts` | Parser for `[[wiki-link]]` syntax in note content |
| `extract-preview-lines.ts` | Extract preview text from note markdown |
| `sync-pull.ts` | Sync pull query -- fetches rows changed since a timestamp |
| `sync-push.ts` | Sync push query -- upserts client mutations to server tables |
| `sync-push-join-tables.ts` | Sync push for join tables (note_time_entries, note_links) |
| `sync.ts` | Shared sync utilities and type helpers |
| `index.ts` | Barrel re-export of all query modules |

## Sync Queries

The sync-related modules (`sync-pull.ts`, `sync-push.ts`, `sync-push-join-tables.ts`, `sync.ts`) support the offline sync protocol:

- **Pull** (`sync-pull.ts`): Accepts a `since` timestamp and returns all rows across all syncable tables that have been updated after that timestamp. Used by `GET /api/sync/pull`.
- **Push** (`sync-push.ts`): Accepts an array of client mutations and upserts them into server tables using last-write-wins conflict resolution via `updatedAt`. Used by `POST /api/sync/push`.
- **Push join tables** (`sync-push-join-tables.ts`): Handles sync for many-to-many join tables (`note_time_entries`, `note_links`) which have composite primary keys.

## Tests

Test files (`*.test.ts`) are co-located with their modules. Run all query tests with:

```bash
npx vitest run src/lib/server/db/queries/
```
