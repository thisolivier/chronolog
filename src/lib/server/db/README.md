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
    clients.ts        # Clients table (belongs to user)
    contracts.ts      # Contracts table (belongs to client)
    deliverables.ts   # Deliverables table (belongs to contract)
    work-types.ts     # Work types table (belongs to deliverable)
    time-entries.ts   # Time entries table (links user, contract, deliverable, work type)
    notes.ts          # Notes table with text primary key (CLIENT.YYYYMMDD.SEQ format)
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

## Scripts

- `npm run db:generate` -- Generate migration SQL from schema changes
- `npm run db:migrate` -- Apply pending migrations
- `npm run db:seed` -- Seed development data
- `npm run db:studio` -- Open Drizzle Studio (visual database browser)
