# Sprint 002 — IF: Containerised Remote Stack

**Status:** active
**Type:** standard
**Backlog items:** IF-1
**Depends on:** Sprint 001-GK (GATE 0 — passed)
**Branch:** (to be filled by Team PM)
**Working tree:** (to be filled by Team PM)

## Objectives

Stand up a fully containerised Docker Compose stack for the Chronolog + PowerSync deployment.
All four services (app, source Postgres, PowerSync service, bucket-storage Postgres) on the
internal Docker network. No host-networking hacks. Source Postgres must have `wal_level=logical`
for PowerSync CDC replication.

## Tasks

1. Create a new `docker-compose.powersync.yml` (or update the existing `docker-compose.yml`) with
   all four services defined. Source Postgres must be configured with `wal_level=logical` via a
   custom postgres config or `command` override.
2. Create the PowerSync service configuration file (`config/powersync.yaml`) with placeholder
   sync rules (can be a simple `SELECT * FROM clients` to prove connectivity). Use unified mode.
3. Create a minimal JWT auth setup — a static RSA keypair for dev (can be generated and stored as
   files in `config/`), and a JWKS endpoint stub or static file that PowerSync can read.
4. Verify the stack starts cleanly: `docker compose up -d` should bring all four services up with
   no errors in logs. PowerSync service should connect to source Postgres and bucket-storage.
5. Verify Drizzle migrations run against the containerised source Postgres: `npm run db:migrate`
   should succeed.
6. Write a brief `docs/docker-stack.md` documenting: how to start/stop the stack, service ports,
   env vars, and any dev workflow notes.

## Contracts

- Stack shape: `docs/contracts/docker-stack.md`
- Epic context: `docs/EPIC-OFFLINE-SYNC.md` (sections 3, 4, 6 Phase A)

## Verification

- `docker compose up -d` starts all 4 services without errors
- `docker compose logs powersync` shows successful connection to source Postgres
- `npm run db:migrate` succeeds against the containerised Postgres
- `npm run dev` starts the app and it can connect to the containerised Postgres

## Acceptance Criteria

- [ ] Docker Compose defines all 4 services on an internal network
- [ ] Source Postgres has `wal_level=logical`
- [ ] PowerSync service starts and connects to both Postgres instances
- [ ] Drizzle migrations run cleanly on the containerised Postgres
- [ ] App server starts and can serve pages with data from containerised Postgres
- [ ] `docs/docker-stack.md` exists with startup/shutdown instructions
- [ ] No host-networking workarounds (`host.docker.internal`, `network_mode: host`, etc.)

## Notes

Reference the existing `docker-compose.yml` in the repo root for the current Postgres-only setup.
The spike branch (`origin/powersync-spike`) has a version with PowerSync services but uses
host-networking — use it as a reference for service config but replace the networking approach.

The `config/` directory may need to be created. Use `context7` to fetch the latest PowerSync
self-hosting documentation.

The existing `.env` / `.env.example` files define DATABASE_URL — ensure the new Compose setup
is compatible or document required env changes.

**GATE 0 confirmed:** PowerSync OPFS-backed SQLite works in Tauri's WebKit webview (10/10 tests).
The infrastructure investment is justified.

(Team PM: write progress notes here.)

## Sign-off

(Team PM fills this when done)
