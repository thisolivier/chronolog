# Epic: Offline Sync via Self-Hosted PowerSync (Single-User)

**Status**: Planned
**Created**: 2026-05-26
**Owner**: Olivier
**Execution environment**: Remote machine (self-hosted PowerSync stack runs there, not on the dev laptop)
**Supersedes**: The custom sync engine on `task-11-offline-sync` (~2,300 lines) — abandoned.
**Builds on**: `powersync-spike` branch (Phases 0–4 spike work).

---

## 1. Summary

Make Chronolog fully usable offline on both Tauri desktop (primary) and the PWA (mobile), with
automatic sync when connectivity returns. We will do this with **self-hosted PowerSync** rather than
a hand-rolled sync engine: PowerSync streams changes from the source Postgres into an on-device
SQLite database via its sync service, and client writes flow back through our existing REST API.

Two product facts shape this epic and make PowerSync a clean fit:

1. **Single account per instance.** No multi-tenant partitioning is required. This deletes the
   single largest accommodation the spike incurred (denormalising `user_id` onto 6 child tables)
   and collapses PowerSync sync rules to flat, whole-table syncs.
2. **Self-hosting is acceptable.** Running the PowerSync service and its bucket-storage database as
   containers alongside the app is a normal compose footprint and explicitly fine for this project.

---

## 2. Background & Decision

### What happened

- **Task 11 (PR #4)** implemented a custom offline sync engine: push/pull cycles, a mutation queue,
  last-write-wins conflict resolution, and dual online/offline read routing (~2,300 lines). It
  worked but represented a large, bespoke body of sync infrastructure to own and maintain
  indefinitely. This is what stalled the project.
- A **PowerSync spike** (`powersync-spike`) replaced that engine with ~280 lines of config +
  connector code. The spike passed 10/10 client tests in Chrome. See
  [`POWERSYNC_MIGRATION.md`](./POWERSYNC_MIGRATION.md) and
  [`POWERSYNC_ACCOMMODATIONS.md`](./POWERSYNC_ACCOMMODATIONS.md) for the full record.

### Why PowerSync, and why now

PowerSync's client integration is genuinely small; its complexity lives entirely on the server side
(a sync service that computes/streams "buckets" plus a storage database for that bucket state). The
spike's friction came from two sources, both now resolved or acceptable:

| Spike friction | Resolution |
|---|---|
| Schema denormalisation (`user_id` on 6 tables) for per-user buckets | **Eliminated** — single-user means one global bucket, no per-user filtering, no denormalisation |
| "No JOINs in sync rules" constraint | **Moot** — sync rules become flat `SELECT * FROM <table>` |
| Self-hosting two extra containers (service + bucket storage) | **Accepted** — normal compose footprint, runs on the remote machine |
| Source Postgres ran natively → host-networking surgery (`listen_addresses`, `pg_hba`, `host.docker.internal`) | **Designed out** — containerise the source Postgres so the whole stack talks over the internal Docker network |
| Separate JWT/JWKS auth for the PowerSync connection | **Trivialised** — single user means a single, effectively static signing identity |

### Decision

Adopt **self-hosted PowerSync, single-user**, executed on the remote machine. Keep the `DataService`
abstraction from the spike's Phase 1 (it decouples the 15 UI components from the sync backend via a
28-method interface, so the sync backend stays swappable). Do not resurrect the custom engine.

---

## 3. Target Architecture

```
┌─────────────────────────── Remote machine (Docker Compose) ───────────────────────────┐
│                                                                                        │
│   ┌──────────────┐   WAL/CDC    ┌──────────────────┐   bucket state   ┌──────────────┐ │
│   │  Source      │─────────────▶│  PowerSync       │─────────────────▶│  Bucket      │ │
│   │  Postgres    │              │  Service         │                  │  Storage     │ │
│   │ (app truth)  │◀──REST API───│  (unified mode)  │                  │  Postgres    │ │
│   └──────────────┘      │       └──────────────────┘                  └──────────────┘ │
│          ▲              │                 │ WebSocket (bucket ops)                      │
│          │              │                 │                                             │
│   ┌──────────────┐      │                 │                                             │
│   │  SvelteKit   │──────┘                 │                                             │
│   │  app server  │  (uploadData writes    │                                             │
│   │  + API routes│   land here)           │                                             │
│   └──────────────┘                        │                                             │
└───────────────────────────────────────────┼─────────────────────────────────────────────┘
                                             │
                  ┌──────────────────────────┴───────────────────────────┐
                  ▼                                                       ▼
         ┌──────────────────┐                                  ┌──────────────────┐
         │ Tauri desktop    │                                  │ PWA (mobile)     │
         │ WebKit + OPFS    │                                  │ OPFS / IndexedDB │
         │ local SQLite     │                                  │ local SQLite     │
         └──────────────────┘                                  └──────────────────┘
```

**Four services** (two are new vs. what we run today):
1. **App server** (SvelteKit) — serves the app and the REST API. PowerSync writes flow *through*
   here via the connector's `uploadData()`; PowerSync does not write to Postgres directly.
2. **Source Postgres** — the app's source of truth. *Containerised* (change from spike).
3. **PowerSync service** — `journeyapps/powersync-service`, unified mode. *(new)*
4. **Bucket storage Postgres** — PowerSync's internal operation-log/bucket state, separate from
   source data so the service keeps a low memory footprint. *(new)*

**Read path**: PowerSync streams source-DB changes (via logical replication / WAL) into each
client's local SQLite. UI reads are local SQL queries — instant, offline-capable, reactive via
`db.watch()`.

**Write path**: client writes go to local SQLite immediately, are queued, and uploaded via
`BackendConnector.uploadData()` → existing REST API → source Postgres. PowerSync then picks the
change up over WAL and streams it back to all connected clients.

---

## 4. Single-User Simplifications (vs. the spike)

- **Sync rules**: one global bucket containing whole tables — no `request.user_id()` parameter, no
  per-table `WHERE user_id = ...`.
  ```yaml
  bucket_definitions:
    global:
      data:
        - SELECT * FROM clients
        - SELECT * FROM contracts
        - SELECT * FROM deliverables
        - SELECT * FROM work_types
        - SELECT * FROM time_entries
        - SELECT * FROM notes
        - SELECT * FROM note_links
        - SELECT * FROM note_time_entries
        - SELECT * FROM weekly_statuses
        - SELECT id, note_id, filename, mime_type, size_bytes, created_at FROM attachments
  ```
- **Schema**: the denormalised `user_id` columns added on `powersync-spike` (contracts,
  deliverables, work_types, note_links, note_time_entries, attachments) are **not needed**. Decide
  per-migration whether to drop them or leave them inert (see Open Questions).
- **Auth**: single signing identity for the PowerSync JWT; no per-user token scoping. The
  `/api/auth/powersync/token` + JWKS endpoints from the spike are reused, simplified.

---

## 5. Validation Gates (must pass before "done")

The spike validated the **client SDK in Chrome only**. The deferred, decisive unknown is the
**primary platform**:

- **GATE A — Tauri/WebKit OPFS sync.** PowerSync's wa-sqlite + OPFS local database must work
  reliably inside Tauri's macOS WebKit webview: schema init, local read/write, `db.watch()`
  reactivity, and a full connected sync cycle. This is the single highest-risk item in the epic and
  blocks everything downstream. There is a known WebKit OPFS timeout report (PowerSync issue #808)
  to watch for.
- **GATE B — End-to-end sync round trip.** Create/edit offline on one client → reconnect → change
  appears in source Postgres and on a second client.
- **GATE C — Attachment strategy.** Binary blobs are excluded from bucket sync; confirm the
  lazy-load-from-server (or alternative) path works offline-degraded gracefully.

---

## 6. Phased Plan (→ Backlog Task 11)

- **Phase A — Remote stack, containerised.** Single Docker Compose on the remote machine: source
  Postgres + bucket storage Postgres + PowerSync service (+ app). Source Postgres containerised with
  `wal_level=logical`; all services on the internal Docker network (removes host-networking
  accommodations #2/#3 from the report).
- **Phase B — Single-user sync rules + schema.** Global bucket sync rules; resolve the denormalised
  `user_id` columns; reconcile migrations on a clean DB.
- **Phase C — Land the `DataService` abstraction on `main`.** Cherry-pick Phase 1 from the spike as
  a standalone PR so the UI is decoupled from the backend regardless of sync outcome.
- **Phase D — Wire `PowerSyncDataService`.** Local SQL reads, connector `uploadData()` → REST,
  reactive sync-status surface, simplified JWT auth.
- **Phase E — GATE A: Tauri/WebKit validation.** Full Tauri build; confirm OPFS-backed sync in the
  webview. **Blocking.**
- **Phase F — PWA offline.** Service worker / app-shell caching, OPFS-with-IndexedDB fallback,
  online/offline indicator, session-expiry-on-reconnect handling.
- **Phase G — GATES B & C + E2E.** Offline scenarios on both platforms; attachment strategy.

---

## 7. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| PowerSync unreliable in Tauri WebKit (OPFS) | **High** | Front-loaded as GATE A / Phase E; abort criteria below |
| No native Tauri PowerSync SDK yet (web SDK in webview only) | Medium | Web SDK works in WebKit per community templates; revisit when native SDK ships |
| Attachment binary sync excluded | Medium | Lazy-load from server; offline-degraded acceptable |
| Bucket-storage / WAL operational upkeep on remote | Low | Accepted; standard compose ops |
| Ephemeral RSA key regenerated per restart | Low | Persist key via env/secret for the remote deployment |

**Abort criteria**: if GATE A cannot be made reliable in Tauri's webview, reconsider — either
PowerSync Cloud, or a minimal single-user LWW push/pull against the app's own server. The
`DataService` abstraction (Phase C) ensures this pivot costs no UI changes.

---

## 8. Out of Scope

- Multi-user / multi-tenant sync (explicitly not a requirement).
- Real-time collaborative editing (CRDT) within a single note.
- Attachment binary synchronisation (kept server-fetched).

---

## 9. Open Questions

1. **Denormalised `user_id` columns** — drop them (clean schema) or leave inert (less migration
   churn)? Leaning drop, since single-user is now a firm constraint.
2. **Client-side ID generation** — notes currently use `shortCode.YYYYMMDD.SEQ`. With client-side
   inserts, generate a UUID locally and let the server assign the display ID on sync?
3. **RSA key persistence** — persist the PowerSync JWT signing key on the remote machine
   (env/secret) rather than regenerating on restart.
