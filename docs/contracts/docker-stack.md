# Contract: Docker Compose Stack

## Services

The production Docker Compose must run these four services on the internal Docker network:

| Service | Image | Purpose |
|---------|-------|---------|
| `app` | SvelteKit (built from repo) | App server + REST API |
| `postgres` | `postgres:17` | Source database (app truth) |
| `powersync` | `journeyapps/powersync-service` | Sync service (unified mode) |
| `bucket-storage` | `postgres:17` | PowerSync bucket state |

## Source Postgres Requirements

- `wal_level=logical` (required for PowerSync CDC)
- Containerised (not native/host — avoids host-networking hacks)
- Must preserve existing Drizzle migration compatibility

## Network

- All services on a single Docker Compose internal network
- No `host.docker.internal`, no `listen_addresses` surgery
- PowerSync connects to source Postgres via Docker service name
- App server connects to source Postgres via Docker service name

## PowerSync Config

- Unified mode (single service handles both sync and API)
- Sync rules reference: `docs/EPIC-OFFLINE-SYNC.md` section 4
- JWT auth: single signing identity (single-user simplification)

## Existing State

The spike's `docker-compose.yml` adds PowerSync services but uses host-networking.
Phase A must replace that with a fully containerised stack.
