# PowerSync Migration — Unexpected Accommodations

This document tracks unexpected changes, workarounds, and architectural accommodations required during the migration from the custom sync engine to PowerSync.

---

## 1. Schema Denormalization: `user_id` on 6 Child Tables

**Impact**: Database schema change + migration + backfill
**Effort**: High

PowerSync sync rules can only `SELECT` from a single table — no JOINs, subqueries, or aggregation are supported. This is an architectural limitation: PowerSync processes WAL (Write-Ahead Log) rows individually during CDC (Change Data Capture), so cross-table lookups are impossible at the replication layer.

Previously, ownership was inferred through FK chains (e.g., `work_types → deliverables → contracts → clients.user_id`). PowerSync requires `user_id` directly on every synced table.

**Tables affected**:
- `contracts` (was: inferred via `client_id → clients.user_id`)
- `deliverables` (was: inferred via `contract_id → contracts → clients`)
- `work_types` (was: inferred via `deliverable_id → deliverables → contracts → clients`)
- `note_links` (was: inferred via `source_note_id → notes.user_id`)
- `note_time_entries` (was: inferred via `note_id → notes.user_id`)
- `attachments` (was: inferred via `note_id → notes.user_id`)

**What changed**:
- Added `user_id` column (nullable, FK to users) to all 6 tables
- Migration backfills existing rows by traversing FK chains
- All INSERT paths (API routes, admin pages, seed data, hooks) updated to populate `user_id`
- All tests updated to include `user_id` in test data

**Trade-off**: Adds denormalized data that must be kept consistent, but PowerSync's sync rules become trivial (`WHERE table.user_id = bucket.user_id`).

---

## 2. Infrastructure: Native Postgres vs Docker Postgres

**Impact**: Docker Compose redesign
**Effort**: Medium

Initial assumption was that the development database ran in Docker. Discovery via `lsof -i :5432` revealed a **native Postgres** (installed via Homebrew/Postgres.app) on port 5432. The Docker Postgres container was shadowed and never actually used by the app.

**What changed**:
- Removed Docker Postgres service for the source database
- PowerSync Docker service connects to host via `host.docker.internal:5432`
- Required `ALTER SYSTEM SET wal_level = logical` on native Postgres
- Required `ALTER SYSTEM SET listen_addresses = '*'` for Docker container access
- Required `pg_hba.conf` edits for the replication user from Docker's network
- Docker Compose only runs: PowerSync service + PowerSync bucket storage Postgres (port 5431)

---

## 3. WAL Logical Replication Setup

**Impact**: Postgres configuration change + user/publication setup
**Effort**: Medium

PowerSync requires logical replication, which is not the default Postgres configuration.

**What changed**:
- `wal_level` changed from `replica` to `logical` (requires Postgres restart)
- Created dedicated `powersync_repl` role with `REPLICATION` privilege
- Created `powersync` publication for the 10 synced tables
- Granted `SELECT` on all public tables to the replication user
- init-db.sql script made idempotent for safe re-runs

---

## 4. RSA Key Pair for JWT Authentication

**Impact**: New auth infrastructure
**Effort**: Low-Medium

PowerSync authenticates clients via JWT tokens verified against a JWKS endpoint. The existing better-auth setup uses session cookies, not JWTs. A separate RSA-based JWT signing system was needed.

**What changed**:
- New RSA key pair generated at runtime (ephemeral, development only)
- Two new API endpoints: `/api/auth/powersync/jwks` (public key) and `/api/auth/powersync/token` (signed JWT)
- JWT includes `sub` (user ID) and `aud: "powersync"` claims
- PowerSync service configured to validate tokens against the JWKS endpoint

**Note**: For production, the RSA key pair should be persisted (environment variable or secrets manager) rather than regenerated on each server restart.

---

## 5. COOP/COEP Headers for WASM + SharedArrayBuffer

**Impact**: Server configuration
**Effort**: Low

PowerSync's web SDK uses WASM with `SharedArrayBuffer`, which requires Cross-Origin Isolation headers. These headers affect the entire page's security context.

**What changed**:
- Added `Cross-Origin-Opener-Policy: same-origin` header
- Added `Cross-Origin-Embedder-Policy: require-corp` header
- Currently scoped to the `/spike` route; needs expansion to all authenticated routes

**Trade-off**: COEP `require-corp` means all cross-origin resources (images, scripts, etc.) must explicitly opt-in via `Cross-Origin-Resource-Policy` headers, which could break third-party embeds.

---

## 6. PowerSync Sync Rules: No JOIN Support

**Impact**: Architecture constraint
**Effort**: N/A (addressed by accommodation #1)

PowerSync sync rules documentation suggests SQL-like syntax, but the actual capabilities are severely limited:
- No JOINs in data queries
- No JOINs in parameter queries
- No subqueries anywhere
- No aggregation functions
- Must `SELECT` from exactly one table per data query

This took 3 iterations to discover (JOINs → parameter JOINs → subqueries → all rejected). The PowerSync team acknowledges this as a known limitation with "Sync Streams" (alpha) as a future solution.

**Lesson**: PowerSync sync rules are closer to per-table row filters than SQL views. Design the schema around this constraint from the start.

---

## 7. SQLite Boolean Representation

**Impact**: Query layer adaptation
**Effort**: Low

PowerSync's client-side storage is SQLite (via WASM/OPFS), which has no native boolean type. Booleans from Postgres are stored as integers (0/1).

**What changed**:
- Added `toBoolean()` helper in queries-read.ts for converting SQLite integers
- All boolean fields in query results explicitly converted
- PowerSync client schema uses `column.integer` for boolean columns

---

## Summary

| Accommodation | Severity | Reversible? |
|---|---|---|
| Schema denormalization (user_id) | High | Yes (drop columns) |
| Native Postgres discovery | Medium | N/A (one-time) |
| WAL logical replication | Medium | Yes (revert wal_level) |
| RSA JWT infrastructure | Low-Medium | Yes (remove endpoints) |
| COOP/COEP headers | Low | Yes (remove headers) |
| No JOIN in sync rules | Architectural | No (PowerSync limitation) |
| SQLite boolean conversion | Low | N/A (inherent to SQLite) |

Most accommodations are reasonable trade-offs for gaining automatic real-time sync with offline support. The schema denormalization (#1) is the most significant and permanent change — it should be considered carefully for production, particularly around data consistency if the denormalized `user_id` could drift from the FK-chain-derived owner.
