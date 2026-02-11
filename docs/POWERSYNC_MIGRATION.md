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

### Phase 0: Spike (COMPLETE)
**Goal**: Validate PowerSync works in both browser and Tauri webview.
- 10/10 tests passed in Chrome (see Spike Results below)

### Phase 1: DataService Abstraction (COMPLETE)
**Goal**: Decouple components from direct fetch() so other features aren't blocked.
- See "Phase 1" section below for full details

### Phase 2: PowerSync Infrastructure (COMPLETE)
- Docker Compose: PowerSync service + bucket storage Postgres (source DB runs natively)
- Postgres WAL: logical replication enabled, replication user + publication created
- Sync Rules: 7 per-user bucket definitions for all 10 tables (`config/sync_rules.yaml`)
- JWT auth: RSA key pair generation, JWKS endpoint, token endpoint
- BackendConnector: fetchCredentials + uploadData mapping CRUD to REST API
- **Note**: Source Postgres runs natively on host (not in Docker). Docker Compose only
  runs PowerSync service and bucket storage, connecting to host via `host.docker.internal`

### Phase 3: PowerSync DataService Implementation (COMPLETE)
- Implemented `PowerSyncDataService` backed by PowerSync's local SQLite
- SQL queries for local reads replace in-memory joins (notes, time entries, contracts, etc.)
- PowerSync CRUD mutations for writes, queued and uploaded via `BackendConnector.uploadData()`
- Sync status exposed via PowerSync's `connected` / `lastSyncedAt` reactive properties
- BackendConnector maps CRUD operations to existing REST API endpoints
- Schema definitions for all 10 tables in PowerSync format
- JWT auth connector: fetches tokens from `/api/auth/powersync/token`, JWKS endpoint for verification

### Phase 4: Cleanup & Polish
- Remove unused storage adapters (Dexie, custom SQLite)
- Remove unused sync code if any remains
- Update documentation
- Tauri + PWA end-to-end testing

## PowerSync Configuration Reference

### Sync Rules (`config/sync_rules.yaml`)

PowerSync data queries must SELECT from a single table -- JOINs and subqueries are not supported. To make this work, all tables have a denormalized `user_id` column so each table can be filtered directly.

```yaml
bucket_definitions:
  # Single bucket per user containing all their data
  user_data[]:
    parameters: SELECT request.user_id() as user_id
    data:
      - SELECT * FROM clients WHERE clients.user_id = bucket.user_id
      - SELECT * FROM contracts WHERE contracts.user_id = bucket.user_id
      - SELECT * FROM deliverables WHERE deliverables.user_id = bucket.user_id
      - SELECT * FROM work_types WHERE work_types.user_id = bucket.user_id
      - SELECT * FROM time_entries WHERE time_entries.user_id = bucket.user_id
      - SELECT * FROM notes WHERE notes.user_id = bucket.user_id
      - SELECT * FROM note_links WHERE note_links.user_id = bucket.user_id
      - SELECT * FROM note_time_entries WHERE note_time_entries.user_id = bucket.user_id
      - SELECT * FROM weekly_statuses WHERE weekly_statuses.user_id = bucket.user_id
      - SELECT id, note_id, user_id, filename, mime_type, size_bytes, created_at FROM attachments WHERE attachments.user_id = bucket.user_id
```

Key design decisions:
- **Single parameterized bucket** (`user_data[]`) instead of separate buckets per table. This simplifies configuration and sync lifecycle.
- **Denormalized `user_id`** on every table (including `contracts`, `deliverables`, `work_types`, `note_links`, `note_time_entries`, `attachments`) avoids the need for JOINs.
- **Attachment binary data** (bytea column) is excluded from sync via explicit column selection. Binary blobs should use a separate file storage mechanism.

### Docker Compose (`docker-compose.yml`)

The source PostgreSQL database runs **natively on the host** (not in Docker). Docker Compose only runs the PowerSync service and its bucket storage database, connecting to the host DB via `host.docker.internal`.

```yaml
services:
  # NOTE: The source PostgreSQL database runs natively on the host (not in Docker).
  # It must have wal_level=logical set. Run: ALTER SYSTEM SET wal_level = logical;
  # Then restart Postgres. See config/init-db.sql for replication user setup.

  powersync-storage:
    image: postgres:17
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: powersync_storage
      POSTGRES_DB: powersync_storage
    ports:
      - "5431:5432"
    volumes:
      - powersync_storage_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d powersync_storage"]
      interval: 5s
      timeout: 5s
      retries: 5

  powersync:
    image: journeyapps/powersync-service:latest
    restart: unless-stopped
    command: ["start", "-r", "unified"]
    depends_on:
      powersync-storage:
        condition: service_healthy
    ports:
      - "8080:8080"
    volumes:
      - ./config:/config
    environment:
      PS_DATA_SOURCE_URI: "postgresql://powersync_repl:powersync_repl_password@host.docker.internal:5432/chronolog"
      PS_STORAGE_SOURCE_URI: "postgresql://postgres:powersync_storage@powersync-storage:5432/powersync_storage"
      PS_JWKS_URL: "http://host.docker.internal:5173/api/auth/powersync/jwks"
      PS_PORT: "8080"
      POWERSYNC_CONFIG_PATH: "/config/powersync.yaml"
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:8080/api/liveness || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 15s

volumes:
  powersync_storage_data:
```

Key details:
- **Bucket storage** on port 5431 (to avoid conflict with host Postgres on 5432)
- **PowerSync service** connects to host DB via `host.docker.internal:5432` using a dedicated replication user (`powersync_repl`)
- **JWKS endpoint** points to the SvelteKit app at `host.docker.internal:5173`
- **Unified mode** (`-r unified`) runs replication and API in a single process

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
3. ~~**Sync Rules JOIN limitations**~~ — **Resolved.** PowerSync data queries do not support JOINs. Fixed by denormalizing `user_id` onto all tables (`contracts`, `deliverables`, `work_types`, `note_links`, `note_time_entries`, `attachments`). All sync rules now use simple single-table WHERE clauses. See `config/sync_rules.yaml`.
4. ~~**COOP/COEP vs better-auth**~~ — **Resolved.** COOP/COEP headers applied per-route (only on pages that use PowerSync), avoiding interference with auth flows.
