# Sprint 004 — CL: Wire PowerSyncDataService

**Status:** active
**Type:** standard
**Backlog items:** CL-2
**Depends on:** Sprint 002-CL (DataService abstraction — merged), Sprint 003-IF (sync rules + auth — merged)
**Branch:** (to be filled by Team PM)
**Working tree:** (to be filled by Team PM)

## Objectives

Implement `PowerSyncDataService` — the second DataService implementation that uses PowerSync's
local SQLite for reads and the connector's `uploadData()` for writes back to the REST API.
Wire it into the app alongside the existing FetchDataService with an env var toggle.

After this sprint, the app can run in PowerSync mode: reads are instant/offline-capable from
local SQLite, writes queue locally and sync back through the existing API.

## Tasks

1. **Study the spike's PowerSync implementation** on `origin/powersync-spike`:
   - `src/lib/powersync/powersync-data-service.ts` (369 lines — the PowerSync DataService impl)
   - `src/lib/powersync/mutations.ts` (553 lines — write operations)
   - `src/lib/powersync/queries-read.ts` (263 lines — read queries)
   - `src/lib/powersync/queries-time.ts` (76 lines — time entry queries)
   - `src/lib/powersync/connector.ts` (172 lines — BackendConnector with uploadData)
   Use `git diff main...origin/powersync-spike -- src/lib/powersync/` to see the full code.
   Adapt to the current DataService interface (from sprint 002-CL) — the spike predates it
   so method signatures may differ. Strip any `user_id` references.

2. **Implement `PowerSyncDataService`** implementing the DataService interface from
   `src/lib/services/data-service.ts`. It must:
   - Use PowerSync's local SQL for all read operations (getClients, getNotes, etc.)
   - Use `uploadData()` via the BackendConnector for all write operations
   - Support reactive queries via `db.watch()` where the interface expects it
   - Connect to the PowerSync service using the JWT from `/api/powersync/token`

3. **Implement the BackendConnector** with:
   - `fetchCredentials()` — calls `/api/powersync/token`, returns JWT + PowerSync endpoint URL
   - `uploadData()` — takes queued local writes and POSTs them to the existing REST API endpoints
   The connector bridges local writes back to the server through the same API the FetchDataService uses.

4. **Add env var toggle**: `PUBLIC_SYNC_MODE=powersync|fetch` (default: `fetch`).
   Update the layout's DataService initialization to check this var and instantiate either
   `FetchDataService` or `PowerSyncDataService`. The `DelegatingDataService` wrapper should
   work with either implementation.

5. **Update the PowerSync schema** (`src/lib/powersync/schema.ts`) to match the current
   database schema on main. The spike's schema may be outdated. Cross-reference with
   `drizzle/` migrations and `src/lib/server/db/schema.ts`.

6. **Write tests**:
   - Unit tests for PowerSyncDataService (mock the PowerSync database)
   - Unit tests for the BackendConnector (mock fetch for uploadData)
   - Verify the env var toggle works (both modes instantiate correctly)

7. **Verify with the Docker stack**:
   - Start the stack: `docker compose up -d`
   - Set `PUBLIC_SYNC_MODE=powersync` in `.env`
   - Start the dev server: `npm run dev`
   - The app should load, PowerSync should connect and sync
   - Create a record — it should appear in local SQLite immediately and sync to Postgres
   - Check PowerSync logs for successful sync cycles

## Contracts

- DataService interface: `docs/contracts/data-service-interface.md`
- Docker stack: `docs/contracts/docker-stack.md`
- Epic context: `docs/EPIC-OFFLINE-SYNC.md` (sections 3, 4, 6 Phase D)

## Verification

- `npm run test` — all existing + new tests pass
- `npm run check` — no new TypeScript errors
- `npm run build` — builds successfully
- With `PUBLIC_SYNC_MODE=fetch`: app works exactly as before (FetchDataService)
- With `PUBLIC_SYNC_MODE=powersync` + Docker stack: app loads, syncs, CRUD operations work

## Acceptance Criteria

- [ ] `PowerSyncDataService` implements the full DataService interface
- [ ] `BackendConnector` with `fetchCredentials()` and `uploadData()`
- [ ] Env var toggle between Fetch and PowerSync modes
- [ ] PowerSync schema matches current database schema
- [ ] All existing tests pass + new tests for PowerSync components
- [ ] `npm run check` passes (no new errors)
- [ ] `npm run build` succeeds
- [ ] With Docker stack + powersync mode: app connects, syncs, CRUD works
- [ ] No `user_id` denormalisation from the spike

## Notes

**The Docker stack is on main.** Start with `docker compose up -d`. JWT auth endpoints are at
`/api/powersync/token` and `/api/powersync/jwks` (NOT `/api/auth/powersync/*` — Better Auth
conflict, see sprint-003-IF notes).

**The DataService interface is at `src/lib/services/data-service.ts`.** Your implementation
must match this interface exactly. The `FetchDataService` at `src/lib/services/fetch-data-service.ts`
is the reference for what each method should do.

**PowerSync database init** is already on main from sprint-001-GK at `src/lib/powersync/database.ts`
and `src/lib/powersync/schema.ts`. You may need to update the schema but the init code should work.

**Spike files to reference** (read via git show, don't merge the branch):
- `git show origin/powersync-spike:src/lib/powersync/powersync-data-service.ts`
- `git show origin/powersync-spike:src/lib/powersync/connector.ts`
- `git show origin/powersync-spike:src/lib/powersync/mutations.ts`
- `git show origin/powersync-spike:src/lib/powersync/queries-read.ts`

**uploadData pattern**: The connector receives a batch of local writes (CRUDs). For each,
it should POST/PUT/DELETE to the same API endpoints that FetchDataService uses. This keeps
the server-side logic unchanged.

(Team PM: write progress notes here.)

## Sign-off

(Team PM fills this when done)
