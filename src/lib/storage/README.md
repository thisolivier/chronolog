# Storage Abstraction Layer

Unified client-side storage interface for offline data access. The storage layer provides the same API regardless of platform — UI code never references SQLite or Dexie directly.

## Architecture

```
┌─────────────────────────┐
│   UI Components         │
│   (Svelte 5)            │
└────────┬────────────────┘
         │ getStorage()
┌────────▼────────────────┐
│   StorageAdapter        │  ← unified interface
│   (types.ts)            │
└────────┬────────────────┘
         │ platform detection (index.ts)
    ┌────┴─────┐
    ▼          ▼
┌────────┐ ┌──────────┐
│ SQLite │ │  Dexie   │
│ Adapter│ │  Adapter │
│ (Tauri)│ │  (PWA)   │
└────────┘ └──────────┘
```

## Files

| File | Purpose |
|------|---------|
| `types.ts` | StorageAdapter interface, row types mirroring server schema, TableName type |
| `index.ts` | Platform detection (`window.__TAURI__`), adapter factory (`getStorage()`) |
| `dexie-adapter.ts` | IndexedDB implementation via Dexie.js v4 (PWA/mobile) |
| `dexie-adapter.test.ts` | 22 tests using fake-indexeddb |
| `sqlite-adapter.ts` | SQLite implementation via @tauri-apps/plugin-sql (Tauri desktop) |
| `sqlite-schema.ts` | SQL table definitions and column mappings for SQLite |
| `sqlite-helpers.ts` | camelCase/snake_case conversion and boolean handling for SQLite |

## Usage

```typescript
import { getStorage } from '$lib/storage';

const storage = await getStorage();

// CRUD operations
await storage.put('clients', { id: '...', name: 'Acme', ... });
const clients = await storage.getAll('clients');
const client = await storage.getById('clients', 'some-uuid');
const filtered = await storage.query('timeEntries', { date: '2026-02-07' });
await storage.delete('clients', 'some-uuid');

// Blob storage for attachments
await storage.putBlob('attachment-uuid', someBlob);
const blob = await storage.getBlob('attachment-uuid');
```

## Platform Detection

The factory in `index.ts` checks `window.__TAURI__` to select the adapter:
- **Tauri desktop**: SqliteAdapter (local SQLite file via tauri-plugin-sql)
- **PWA / browser**: DexieAdapter (IndexedDB via Dexie.js)

The adapter is lazily initialized on first call to `getStorage()`.

## Row Types

All row types mirror the server-side Drizzle schema but use string timestamps (ISO format) instead of Date objects. This keeps serialization simple across both storage backends.

## Notes

- The SqliteAdapter can only run inside a Tauri shell (no unit tests — requires Tauri runtime)
- Attachment binary data is stored in a separate `_blobs` table/store, not in the attachments row
- Compound primary keys (noteLinks, noteTimeEntries) use special handling in both adapters
- No sync logic — that belongs to Task 11 (Offline Sync)
