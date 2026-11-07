# Database Module

Server-side database layer for Chronolog, using Drizzle ORM with PostgreSQL.

## Architecture

The module is organized around three concerns:

1. **Schema definitions** (`schema/`) -- individual table files using Drizzle's `pgTable`
2. **Relations** (`relations.ts`) -- Drizzle relational query configuration
3. **Connection** (`index.ts`) -- database client setup and barrel exports

## File Structure

```
db/
  index.ts            # Database client instance, exports schema + relations
  schema.ts           # Barrel re-export of all tables (used by drizzle-kit)
  relations.ts        # Drizzle relations for relational queries
  seed.ts             # Development seed script
  schema/
    users.ts          # Users table
    clients.ts        # Clients table (belongs to user; archived_at, is_system, sort_order)
    contracts.ts      # Contracts table (belongs to client; archived_at, is_system)
    deliverables.ts   # Deliverables table (belongs to contract)
    work-types.ts     # Work types table (belongs to deliverable)
    time-entries.ts   # Time entries table (links user, contract, deliverable, work type)
    notes.ts          # Notes table with text primary key (CLIENT.YYYYMMDD.SEQ format); deleted_at = in the trash
    note-time-entries.ts  # Many-to-many join between notes and time entries
    weekly-statuses.ts    # Weekly submission status per user
    attachments.ts    # File attachments linked to notes (bytea storage)
    index.ts          # Barrel export of all tables
```

## Data Hierarchy

```
User
  -> Client (short_code like "BIGCH")
       -> Contract
            -> Deliverable
                 -> Work Type
  -> Time Entry (references contract, optionally deliverable + work type)
  -> Note (text ID: CLIENT.YYYYMMDD.SEQ)
       -> Attachment
  -> Weekly Status
```

Notes and time entries are linked via the `note_time_entries` join table.

## Note trash (sprint 037-CL)

Deleting a note sets `notes.deleted_at` (partial index `notes_trash_user_id_idx` on `user_id` where it is set, migration `0009`). The row keeps its ID, `note_links` and `note_time_entries`, so a restore clears one column. Reads skip trashed rows unless a caller passes `includeDeleted`: `listNotesForContract`, `listNotesForUser`, `getNoteForUser`, `updateNoteForUser`, `searchNotesForUser`, `getNoteTitlesForUser`, `getBacklinksForNote` (sources) and the contract note counts in `listContractsByClientWithNoteCount`. `queries/note-trash.ts` holds delete, restore, the trash list and `purgeExpiredTrash` (30 days, run inside every delete). Note ID allocation still sees trashed rows, so an ID is never reused while its note can come back. Safe deletion of a contract moves trashed notes too (the foreign key needs it) and counts them.

## Search (sprints 042-CL, 058-DR)

`queries/wiki-link-titles.ts` (sprint 043-CL): `wikiLinkPreviewOptions(userId, notes)` loads, in one query, the titles of every note the given notes link to (trashed targets included), so `GET /api/notes`, `getNoteTitlesForUser` and the trash list read wiki-links as their target's title in titles and previews. `getNoteTitlesForUser` also names a note that only has markdown by its first line.

`queries/global-search.ts` (`searchEverythingForUser`) backs `GET /api/search` and `chronolog search`; `queries/note-search.ts` (`searchNotesForUser`) backs the `[[` picker's `GET /api/notes/search`. Since sprint 058-DR both use the shared matcher in `$lib/server/search/` (see its README): every query word must match a record's own text (note ID, title, body; entry description) or its client/contract identity (plus deliverable and work type for entries), ranked on one scale (exact ID, ID prefix, title, ID substring, content plus identity, body, identity only; newest first within a rank). Rows are decrypted and matched in memory (the columns are encrypted, so no SQL `ILIKE`); trashed notes are never returned. Each hit carries client, contract, `clientColorIndex`, `rank`, `matchedIn`, `matchedContext` and a snippet with match offsets (`$lib/utils/search-snippet.ts`); the `/api/search` limit is per group and `total` counts every match.

## Pinned notes and client order (sprint 039-CL)

Migration `0010`: `notes.pinned_at timestamptz` and `clients.sort_order integer not null default 0`. A pinned note has `pinned_at` set (and `is_pinned` true; the old boolean is kept in step for older readers and can be dropped later); lists order by `pinned_at desc nulls last`, then `updated_at desc` (`noteListOrder` in `queries/notes.ts`). The migration gives notes already marked `is_pinned` a `pinned_at` equal to their `updated_at`. `queries/note-pins.ts` pins and unpins without touching `updated_at`. `listNotesForUser({ clientId })` lists every contract of a client (the client view).

Client names are encrypted, so the migration cannot number clients by name: every client starts at 0, and `sort_order`, then name, reads exactly as the old name order. `queries/client-order.ts` holds `compareClientOrder`, `reorderClientsForUser` (listed clients first, the rest after in their current order, all renumbered 0..n-1 in one locked transaction), `moveClientToPosition` (the CLI's `--order`) and `nextClientSortOrder` (a new client lands by name until the user has reordered, then last).

## Archiving and Safe Deletion

`clients` and `contracts` carry `archived_at` (hidden from the sidebar, work kept) and `is_system` (the per-user "Deleted Client" and "Deleted Contract", migration `0007`).

`time_entries.contract_id` and `notes.contract_id` no longer cascade on delete, so no path can silently drop billable work.

`queries/safe-deletion.ts` performs every admin delete in a single transaction:

- **Contract or client**: entries move to the system "Deleted Contract" (or "Deleted Client" / "Deleted Contract" for a client) with a `Formerly: Client / Contract` line appended to each description; notes move to the Deleted Contract. Then the contract or client is deleted. Names and descriptions are encrypted, so the line is appended in memory row by row.
- **Deliverable or work type**: entries keep a `Formerly: ...` line, then their reference is cleared and the row deleted.
- **Usage counts**: `getContractUsage` and `getEntryCountsBy` feed the confirm dialogs.

`queries/entry-references.ts` (`assertEntryReferences`) is the one rule for what an entry may point at: the contract is the user's, the deliverable is on that contract, the work type is under that deliverable (so never without one). Every entry write route calls it (through `entryReferenceProblem` in `src/routes/api/time-entries/entry-input.ts`); `scripts/check-entry-references.mjs` reports existing rows that break it.

`queries/formerly-line.ts` builds the appended `Formerly: ...` line on its own line so the original description is untouched.

## Usage

```typescript
import { database, users, clients } from '$lib/server/db';
import { eq } from 'drizzle-orm';

// Simple query
const allUsers = await database.select().from(users);

// Relational query (requires relations to be loaded)
const userWithClients = await database.query.users.findFirst({
  where: eq(users.email, 'admin@chronolog.dev'),
  with: { clients: true }
});
```

## Dev Connection

`index.ts` caches the postgres client on `globalThis` outside production, so Vite's SSR reloads reuse one pool instead of opening a new one each time.

## Scripts

- `npm run db:generate` -- Generate migration SQL from schema changes
- `npm run db:migrate` -- Apply pending migrations
- `npm run db:seed` -- Seed development data
- `npm run db:studio` -- Open Drizzle Studio (visual database browser)
