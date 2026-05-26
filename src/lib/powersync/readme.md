# PowerSync Module

Offline-first sync layer using [PowerSync](https://www.powersync.com/).
Enabled when `PUBLIC_SYNC_MODE=powersync`.

## Architecture

Reads come from **local SQLite** (instant, offline-capable).
Writes go to **local SQLite → PowerSync CRUD queue → BackendConnector → REST API → Postgres**.

## Files

| File | Purpose |
|------|---------|
| `schema.ts` | PowerSync client schema — local SQLite table definitions mirroring the server Postgres schema (excludes binary columns) |
| `database.ts` | Database singleton — init, connect, and disconnect the PowerSync instance |
| `connector.ts` | `BackendConnector` — fetches JWTs from `/api/powersync/token` and uploads queued CRUD operations to the REST API |
| `powersync-data-service.ts` | `DataService` implementation that delegates reads and writes to the query/mutation modules below |
| `queries-read.ts` | Read queries for contracts, clients, notes, and attachments |
| `queries-time.ts` | Read queries for timer state, deliverables, and work types |
| `mutations.ts` | Write operations — local inserts, updates, and deletes that feed the CRUD queue |

## Data Flow

```
User action
  → mutations.ts (local SQL write)
    → PowerSync CRUD queue
      → connector.ts (uploads to REST API)
        → Postgres (server)
          → PowerSync sync service
            → local SQLite (other clients)
```

## Key Details

- The `BackendConnector` handles both authentication (JWT fetch) and data upload (CRUD queue flush).
- The schema intentionally omits binary/blob columns present in Postgres — attachments store metadata only.
- All read queries run against the local SQLite database, so the UI stays responsive even when offline.
