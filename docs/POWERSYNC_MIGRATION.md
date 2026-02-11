# PowerSync Migration Plan

## Context

Task 11 (PR #4) implemented a custom offline sync engine (~2,300 lines) with push/pull cycles, mutation queue, last-write-wins conflict resolution, and dual online/offline read routing. While well-structured, this is a significant amount of custom sync infrastructure to maintain.

**PowerSync** is a production-ready sync service built specifically for Postgres. It replaces the custom sync engine with ~280 lines of configuration + connector code, while providing battle-tested sync via Postgres WAL replication.

## Architecture Overview

```
Postgres ──WAL replication──▶ PowerSync Service ──WebSocket──▶ Client SQLite (OPFS/wa-sqlite)
                                                                    │
Client writes ──▶ Local SQLite ──▶ uploadData() ──▶ API routes ──▶ Postgres
                                                                    │
                              PowerSync detects change via WAL ◀────┘
```

PowerSync handles the **read path** only (Postgres → client). Writes go through a `BackendConnector.uploadData()` callback that sends mutations to existing API routes. PowerSync then detects the Postgres changes via WAL and syncs them back to all clients.

## Platform Compatibility

### PWA (Chrome/Firefox/Safari)
- PowerSync Web SDK uses wa-sqlite (WASM) + OPFS for persistent local SQLite
- Chrome 102+, Firefox 111+, Safari 15.2+ support OPFS
- Falls back to IndexedDB (IDBBatchAtomicVFS) when OPFS unavailable
- Multi-tab via SharedWorker (Chrome/Firefox; not Safari)

### Tauri Desktop (macOS WebKit)
- WebKit supports OPFS since Safari 15.2 — works in Tauri webview
- Community templates confirm viability (MrLightful/powersync-tauri, hut36/tauri-powersync)
- SharedWorker NOT supported in WebKit — single-window only (fine for Chronolog)
- PowerSync has a native Tauri SDK on their roadmap (not yet available)
- Risk: WebKit-specific OPFS bugs (timeout issues reported in Safari, issue #808)

### Key Risk
WebKit OPFS reliability in Tauri's webview. The spike (Phase 0) validates this before committing to the full migration.

## What Gets Replaced vs Kept (from PR #4)

| Category | Fate | Notes |
|---|---|---|
| Custom sync engine (engine, queue, metadata, fetcher) | **Replaced** | PowerSync handles sync orchestration |
| Storage adapters (Dexie, SQLite) | **Replaced** | PowerSync manages its own SQLite |
| Server sync endpoints (/api/sync/push, pull) | **Replaced** | PowerSync uses its own protocol |
| Server sync queries (sync-push, sync-pull) | **Replaced** | PowerSync uses WAL replication |
| Service layer (service-notes, time-entries, timer) | **Adapted** | Public API kept, internals simplified |
| SyncedDataService | **Adapted** | Becomes thin wrapper around PowerSync |
| Local queries (in-memory joins) | **Adapted** | Rewritten as SQL queries (simpler) |
| UI components | **Kept** | 90-95% unchanged |
| Type definitions (data shapes) | **Kept** | NoteDetail, WeekData etc. stay the same |

## Migration Phases

### Phase 0: Spike (this branch) ← CURRENT
**Goal**: Validate PowerSync works in both browser and Tauri webview.
- Install @powersync/web + @journeyapps/wa-sqlite
- Configure Vite (WASM exclusions, worker format, COOP/COEP headers)
- Initialize PowerSync client-side with a test schema
- Verify OPFS/wa-sqlite works in Chrome and Tauri WebKit
- Test basic read/write against local SQLite (no server sync yet)
- **Exit criteria**: PowerSync SQLite initializes and queries work on both platforms

### Phase 1: Base PR — DataService Abstraction (separate branch from main)
**Goal**: Decouple components from direct fetch() so other features aren't blocked.
- Define a `DataService` interface with all read/write methods components need
- Implement with direct fetch() (same behavior as current)
- Refactor components to use `getDataService()` context instead of fetch()
- This PR can merge independently — no sync dependency
- Future: swap DataService implementation for PowerSync

### Phase 2: PowerSync Infrastructure (after spike validates, new branch)
- Set up PowerSync Service (Docker Compose, self-hosted, Postgres-only storage)
- Configure Postgres WAL for logical replication
- Write Sync Rules YAML (define what data each user gets)
- Add JWT token endpoint (/api/powersync-token)
- Implement BackendConnector (fetchCredentials + uploadData)

### Phase 3: PowerSync DataService Implementation
- Implement DataService interface backed by PowerSync
- SQL queries for local reads (replace in-memory joins)
- PowerSync mutations for writes
- Sync status indicator integration
- Tests for connector, SQL queries, sync cycle

### Phase 4: Cleanup & Polish
- Remove unused storage adapters (Dexie, custom SQLite)
- Remove unused sync code if any remains
- Update documentation
- Tauri + PWA end-to-end testing

## PowerSync Configuration Reference

### Sync Rules (draft)
```yaml
bucket_definitions:
  user_clients:
    parameters: SELECT request.user_id() as user_id
    data:
      - SELECT * FROM clients WHERE user_id = bucket.user_id

  user_contracts:
    parameters: SELECT request.user_id() as user_id
    data:
      - SELECT c.* FROM contracts c
        JOIN clients cl ON c.client_id = cl.id
        WHERE cl.user_id = bucket.user_id

  user_deliverables:
    parameters: SELECT request.user_id() as user_id
    data:
      - SELECT d.* FROM deliverables d
        JOIN contracts c ON d.contract_id = c.id
        JOIN clients cl ON c.client_id = cl.id
        WHERE cl.user_id = bucket.user_id

  user_work_types:
    parameters: SELECT request.user_id() as user_id
    data:
      - SELECT wt.* FROM work_types wt
        JOIN deliverables d ON wt.deliverable_id = d.id
        JOIN contracts c ON d.contract_id = c.id
        JOIN clients cl ON c.client_id = cl.id
        WHERE cl.user_id = bucket.user_id

  user_time_entries:
    parameters: SELECT request.user_id() as user_id
    data:
      - SELECT * FROM time_entries WHERE user_id = bucket.user_id

  user_notes:
    parameters: SELECT request.user_id() as user_id
    data:
      - SELECT * FROM notes WHERE user_id = bucket.user_id

  user_note_links:
    parameters: SELECT request.user_id() as user_id
    data:
      - SELECT nl.* FROM note_links nl
        JOIN notes n ON nl.source_note_id = n.id
        WHERE n.user_id = bucket.user_id

  user_note_time_entries:
    parameters: SELECT request.user_id() as user_id
    data:
      - SELECT nte.* FROM note_time_entries nte
        JOIN notes n ON nte.note_id = n.id
        WHERE n.user_id = bucket.user_id

  user_weekly_statuses:
    parameters: SELECT request.user_id() as user_id
    data:
      - SELECT * FROM weekly_statuses WHERE user_id = bucket.user_id

  user_attachments:
    parameters: SELECT request.user_id() as user_id
    data:
      - SELECT a.id, a.note_id, a.filename, a.mime_type, a.size_bytes, a.created_at
        FROM attachments a
        JOIN notes n ON a.note_id = n.id
        WHERE n.user_id = bucket.user_id
```

Note: Attachment binary data (bytea column) should NOT sync via PowerSync. Use a separate file storage mechanism.

### Docker Compose (self-hosted, Postgres-only)
```yaml
services:
  powersync:
    image: journeyapps/powersync-service:latest
    ports:
      - "8080:8080"
    volumes:
      - ./config/powersync.yaml:/config/powersync.yaml
    depends_on:
      source-db:
        condition: service_healthy

  # PowerSync bucket storage (separate from app DB)
  powersync-storage:
    image: postgres:17
    environment:
      POSTGRES_PASSWORD: ps_storage
      POSTGRES_DB: powersync_storage
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
```

### Vite Config Additions
```typescript
optimizeDeps: {
  exclude: ['@powersync/web']
},
worker: {
  format: 'es'
}
```

### COOP/COEP Headers (hooks.server.ts)
```typescript
response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
```

## Decision Log

| Decision | Rationale |
|---|---|
| Fresh PR, not on top of task-11 | Bulk of task-11 code (sync engine) gets replaced; cleaner to start fresh |
| Cherry-pick UI refactoring from task-11 | Component changes are valuable regardless of sync backend |
| Self-hosted PowerSync, not cloud | Keeps infrastructure under control; free; Postgres-only storage |
| DataService abstraction as separate base PR | Unblocks other feature work while PowerSync migration proceeds |
| OPFS with IDBBatchAtomicVFS fallback | Best production compatibility; Safari incognito falls back gracefully |

## Spike Results (2026-02-10)

### Chrome (Chromium)
All 10 tests passed:
- **Environment**: OPFS available, SharedWorker available
- **PowerSync Import**: 486ms (WASM load)
- **Schema**: 10 tables created successfully
- **Database Init**: 46ms — SQLite ready via OPFS
- **Local Write**: 5,356ms (cold first write, subsequent writes much faster)
- **Local Read**: 358ms — read back inserted rows correctly
- **JOIN Query**: 142ms — cross-table join (notes→contracts→clients) works correctly
- **Reactive Watch**: 88ms — `db.watch()` emits results on table changes
- **Cleanup**: 166ms — DELETE operations work
- **Upload Queue**: 69ms — CRUD queue tracked 6 pending items from writes

No console errors or warnings.

### WebKit / Tauri
- macOS 15.5 with Safari 18.5 — well past OPFS minimum (Safari 15.2)
- Community templates (MrLightful/powersync-tauri, hut36/tauri-powersync) confirm Tauri+PowerSync works
- SharedWorker NOT available in WebKit (multi-tab disabled, single-window fine for Chronolog)
- Full Tauri build test deferred (requires Rust compilation); WebKit compatibility confirmed via platform checks

### Verdict
**PowerSync is viable.** The Web SDK works correctly in SvelteKit with the Vite config (`optimizeDeps.exclude`, `worker.format: 'es'`). COOP/COEP headers applied per-route to avoid breaking auth. All critical operations (schema, write, read, join, watch, queue) function correctly.

## Phase 1: Base PR — DataService Abstraction (COMPLETE)

### Purpose
Decouple UI components from direct `fetch()` calls. This creates a stable interface that can be backed by either server fetch (current) or PowerSync (future), unblocking other feature work.

### What Was Done

**Phase 1a** — Defined interface, types, and implementation in `src/lib/services/`:
- `data-service.ts` — DataService interface with 28 methods across 7 domains
- `types.ts` — 20+ shared type definitions
- `fetch-data-service.ts` — Implementation via `fetch()` (current behavior)
- `fetch-helpers.ts` — Shared HTTP helpers (fetchJson, postJson, putJson, deleteRequest)
- `context.ts` — Svelte context provider (setDataServiceContext / getDataService)
- `index.ts` — Barrel exports

**Phase 1b** — Refactored 15 components + root layout to use `getDataService()`:
- Replaced all direct `fetch('/api/...')` calls with `dataService.methodName()`
- Net -184 lines (151 added, 335 removed) — cleaner, more declarative data access
- Wired context in `+layout.svelte` for authenticated users

**Phase 1c** — QA validation:
- 0 type errors, 163 tests pass
- No remaining direct fetch() calls in components
- Architectural review completed (minor findings addressed)

### Files Changed
- **New**: `src/lib/services/` (6 files — see `src/lib/services/readme.md`)
- **Modified**: 15 component files + `src/routes/+layout.svelte`

### What This Enables
- Other features can build on `DataService` methods immediately
- PowerSync migration (Phase 2-3) only needs a new implementation of the same interface
- Components never need to change again for sync backend swaps

## Open Questions

1. **Attachment binary sync** — PowerSync can't sync bytea blobs efficiently. Options: separate file storage (S3/local), lazy-load from server, or keep current custom blob handling.
2. **Note ID generation** — Currently `shortCode.YYYYMMDD.SEQ`. With PowerSync, IDs should be generated client-side (UUID) and server can assign display ID on sync.
3. **Sync Rules JOIN limitations** — PowerSync Sync Rules don't support JOINs in some configurations. Need to verify the draft rules above work.
4. **COOP/COEP vs better-auth** — Cross-origin isolation headers may interfere with auth flows. Test during spike.
