# Sprint 003 — IF: Single-User Sync Rules + Schema

**Status:** signed-off
**Type:** standard
**Backlog items:** IF-2
**Depends on:** Sprint 002-IF (Docker stack — merged)
**Branch:** `sprint-003-IF/sync-rules-schema-auth`
**Working tree:** `/Users/olivier/sites/chronolog/.claude/worktrees/sprint-003-IF`

## Objectives

Finalize the PowerSync sync rules and database schema for single-user operation. The spike's
denormalised `user_id` columns are unnecessary (single account per instance). Sync rules become
flat whole-table syncs. JWT auth is simplified to a single signing identity.

This sprint prepares the server-side configuration so the PowerSync client can connect and sync.

## Tasks

1. **Update sync rules** (`config/sync_rules.yaml`): Replace any per-user bucket definitions with
   a single global bucket containing whole-table syncs. Reference the epic's section 4 for the
   exact tables:
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

2. **Review and clean Drizzle migrations**: Check all existing migrations (in `drizzle/`) for any
   `user_id` denormalisation columns that came from the spike. If they exist, create a new migration
   to drop them. If they don't exist on main, no action needed. Run `npm run db:generate` if schema
   changes are needed, then `npm run db:migrate` to verify.

3. **Implement the PowerSync JWT auth endpoints** on the SvelteKit server:
   - `POST /api/auth/powersync/token` — returns a signed JWT for the PowerSync connection
   - `GET /api/auth/powersync/jwks` — returns the JWKS public key for PowerSync to verify tokens
   Reference the spike branch for the implementation: `git show origin/powersync-spike:src/lib/server/powersync-auth.ts`
   and `git show origin/powersync-spike:src/routes/api/auth/powersync/token/+server.ts` etc.
   Simplify for single-user: no per-user token scoping needed.

4. **Update PowerSync config** (`config/powersync.yaml`): Ensure the JWKS URL points to the app
   server's endpoint (e.g., `http://app:5173/api/auth/powersync/jwks` on the Docker network).

5. **Verify end-to-end**: Start the Docker stack (`docker compose up -d`), run migrations, start
   the dev server, and confirm:
   - PowerSync service can read the sync rules
   - PowerSync service connects to source Postgres and bucket-storage
   - The token endpoint returns a valid JWT
   - The JWKS endpoint returns the public key
   - PowerSync logs show "replication active" or similar

6. **Update `docs/docker-stack.md`** with any new env vars or configuration changes.

## Contracts

- Stack shape: `docs/contracts/docker-stack.md`
- DataService interface: `docs/contracts/data-service-interface.md`
- Epic context: `docs/EPIC-OFFLINE-SYNC.md` (sections 4, 6 Phase B)

## Verification

- `docker compose up -d && docker compose logs powersync` shows healthy replication
- `curl http://localhost:5173/api/auth/powersync/token` returns a JWT
- `curl http://localhost:5173/api/auth/powersync/jwks` returns JWKS JSON
- `npm run db:migrate` succeeds (including any new migration)
- `npm run test` passes

## Acceptance Criteria

- [x] Sync rules use a single global bucket with whole-table syncs (no per-user filtering)
- [x] No unnecessary `user_id` denormalisation in the schema
- [x] `/api/powersync/token` endpoint returns a signed JWT (moved from `/api/auth/powersync/token` to avoid Better Auth catch-all conflict)
- [x] `/api/powersync/jwks` endpoint returns the public key (moved from `/api/auth/powersync/jwks` for same reason)
- [x] PowerSync service successfully connects and replicates with the new sync rules
- [x] All existing tests pass (202 passed, 10 skipped — DB integration tests skip without local Postgres)
- [x] `docs/docker-stack.md` updated with JWT auth documentation

## Notes

**The Docker stack from Sprint 002-IF is on main.** Start it with `docker compose up -d`.
The config files are in `config/`. The RSA private key needs to be generated locally —
see `docs/docker-stack.md` for instructions.

**Spike reference for auth**: The `powersync-spike` branch has working JWT auth at
`src/lib/server/powersync-auth.ts` and route handlers at `src/routes/api/auth/powersync/`.
Cherry-pick and simplify — strip multi-user token scoping.

**Single-user simplification**: The epic explicitly states no `request.user_id()` parameter
in sync rules, no per-table `WHERE user_id = ...`. One global bucket, one signing identity.

**Progress notes:**
- Sync rules already correct on main from sprint 002-IF — verified, no changes needed.
- Schema clean — no denormalized `user_id` columns from the spike were ever merged to main. No migration needed.
- JWT auth endpoints implemented using `jose` library with in-memory RSA key generation (keys rotate on restart, PowerSync re-fetches JWKS automatically).
- Endpoints moved from `/api/auth/powersync/*` to `/api/powersync/*` — Better Auth's `svelteKitHandler` intercepts all `/api/auth/*` routes before SvelteKit's router, causing 404s.
- Added `server.allowedHosts: ['app']` to vite.config.ts — Vite blocked requests from Docker service name hostname.
- PowerSync config switched from embedded static RSA key to `jwks_uri` pointing to app server.
- E2E verified: PowerSync fetches JWKS from app (HTTP 200), replication active, sync rules loaded.

## Sign-off

**Status:** signed-off
**Date:** 2026-05-26
**Branch:** `sprint-003-IF/sync-rules-schema-auth`
**Commit:** `2873773`

**Summary:**
All acceptance criteria met. PowerSync JWT auth endpoints implemented and verified end-to-end. Sync rules and schema were already clean on main (no changes needed). PowerSync service connects to source Postgres, loads sync rules, and replicates successfully. The app serves JWKS to PowerSync over the Docker network for token verification. 202 tests pass.

**Deviation from spec:** Auth endpoints placed at `/api/powersync/*` instead of `/api/auth/powersync/*` due to Better Auth route conflict. This is a better pattern anyway — keeps PowerSync API surface separate from the auth provider.
