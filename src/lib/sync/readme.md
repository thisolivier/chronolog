# Sync Module

Client-side sync engine and data service layer for offline-first data synchronization. Provides a unified API for UI components to read and write data, with automatic fallback between server APIs (online) and local storage (offline).

## Architecture

```
┌─────────────────────────┐
│   UI Components         │  ← use getDataService() from context
│   (Svelte 5)            │
└────────┬────────────────┘
         │
┌────────▼────────────────┐
│   SyncedDataService     │  ← main data layer bridge
│   (synced-data-service) │    online: server APIs + local cache
│                         │    offline: local queries + sync queue
└────────┬────────────────┘
    ┌────┴─────────┐
    ▼              ▼
┌────────┐   ┌──────────┐
│ Sync   │   │  Local   │
│ Engine │   │  Queries │
└───┬────┘   └──────────┘
    │
┌───▼────────────────────┐
│   SyncEngine           │  ← orchestrator (push then pull)
└───┬────────────────────┘
    ├────────────┐
    ▼            ▼
┌────────┐ ┌──────────┐
│ Queue  │ │ Metadata │
└───┬────┘ └────┬─────┘
    ▼            ▼
┌────────────────────────┐
│   StorageAdapter       │  ← sync queue + metadata + data tables
│   (Dexie or SQLite)    │
└────────────────────────┘
```

## Files

| File | Purpose |
|------|---------|
| `synced-data-service.svelte.ts` | Main service — bridges UI to storage+sync |
| `service-notes.ts` | Note CRUD operations (create, update, delete, get, list) |
| `service-time-entries.ts` | Time entry CRUD operations (create, update, delete, list by week) |
| `service-timer.ts` | Timer operations (start, stop, get running timer) |
| `data-types.ts` | Type definitions for service method return values |
| `local-queries.ts` | Offline query helpers — computes joined data from local storage |
| `context.ts` | Svelte context helpers — setDataServiceContext / getDataService |
| `sync-engine.svelte.ts` | Sync orchestrator — coordinates push/pull cycles |
| `sync-queue.ts` | Mutation queue — stores pending local changes |
| `sync-metadata.ts` | Sync state tracking — last sync timestamp |
| `sync-fetcher.ts` | HTTP transport — pull/push via Fetch API |
| `online-status.svelte.ts` | Reactive online/offline detection (Svelte 5 runes) |
| `types.ts` | Shared types for sync protocol (client + server) |
| `index.ts` | Module entry point — public API exports |

### Tests (`__tests__/`)

| File | Purpose |
|------|---------|
| `sync-queue.test.ts` | SyncQueue mutation queueing (12 tests) |
| `sync-metadata.test.ts` | SyncMetadata timestamp tracking (4 tests) |
| `sync-fetcher.test.ts` | SyncFetcher HTTP transport (11 tests) |
| `sync-engine.test.ts` | SyncEngine orchestration (16 tests) |
| `synced-data-service.test.ts` | SyncedDataService integration (10 tests) |
| `local-queries.test.ts` | Offline query helpers (18 tests) |
| `mock-storage-adapter.ts` | In-memory StorageAdapter for tests |

## Usage

Components access the data service via Svelte context:

```typescript
// In a Svelte component
import { getDataService } from '$lib/sync/context';

const dataService = getDataService();

// Read data (online: server API, offline: local storage)
const contracts = await dataService.getContractsByClient();
const notes = await dataService.getNotesForContract(contractId);
const note = await dataService.getNoteById(noteId);

// Write data (updates local + server/queue)
const { note } = await dataService.createNote(contractId);
await dataService.updateNote(noteId, { title: 'New Title' });
await dataService.deleteNote(noteId);
```

The service is initialized in `+layout.svelte` and provided via context.

## Data Access Strategy

- **Online reads**: Server APIs (give us computed/joined data). Local storage updated in background.
- **Offline reads**: Local storage with client-side joins in `local-queries.ts`.
- **Writes**: Always update local storage. Online: also call server API. Offline: queue mutation for sync.
- **Periodic sync**: Every 30 seconds when online. Immediate sync on offline-to-online transition.

## Sync Protocol

1. **Push first**: Local mutations sent to `POST /api/sync/push`
2. **Then pull**: Changed rows fetched from `GET /api/sync/pull?since={timestamp}`
3. **Last-write-wins**: Server resolves conflicts using `updatedAt` timestamps

## Error Handling

- **Network errors**: Mutations stay in queue, fallback to local data silently
- **Auth errors (401)**: `authExpired` flag set, UI should redirect to login
- **Server errors**: Reported in engine state, local data served as fallback

## Testing

Tests use `MockStorageAdapter` (in-memory) and mock `fetch`:

```bash
npx vitest run src/lib/sync/
```
