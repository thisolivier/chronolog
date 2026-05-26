# Docker Compose Stack

Local development stack for Chronolog with PowerSync offline-sync infrastructure.

## Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `app` | Built from repo Dockerfile | 5173 | SvelteKit dev server + REST API |
| `postgres` | postgres:17 | 5432 | Source database (wal_level=logical) |
| `bucket-storage` | postgres:17 | (internal) | PowerSync bucket state |
| `powersync` | journeyapps/powersync-service | 8080 | Sync service (unified mode) |

## Quick Start

```bash
# Start the full stack
docker compose up -d

# Or start infrastructure only (run app locally)
docker compose up -d postgres bucket-storage powersync

# Run migrations (from host)
DATABASE_URL="postgresql://chronolog:chronolog@localhost:5432/chronolog" npx drizzle-kit migrate

# Run app locally (connecting to containerised Postgres)
DATABASE_URL="postgresql://chronolog:chronolog@localhost:5432/chronolog" \
ENCRYPTION_KEY="dev-encryption-key-for-docker-stack-000" \
BETTER_AUTH_SECRET="dev-auth-secret-for-docker-stack-0000" \
BETTER_AUTH_URL="http://localhost:5173" \
npm run dev
```

## Stopping

```bash
docker compose down          # stop services, keep data
docker compose down -v       # stop services AND delete volumes (fresh start)
```

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Connection to source Postgres |
| `ENCRYPTION_KEY` | App encryption key for auth |
| `BETTER_AUTH_SECRET` | BetterAuth session secret |
| `BETTER_AUTH_URL` | BetterAuth base URL |
| `PS_DATA_SOURCE_URI` | PowerSync → source Postgres connection (uses replication role) |
| `PS_STORAGE_SOURCE_URI` | PowerSync → bucket storage connection |
| `PS_PORT` | PowerSync service port |

## Network

All services are on the `chronolog` bridge network. No host-networking (`host.docker.internal`, `network_mode: host`, etc.). Services reference each other by Docker service name (`postgres`, `bucket-storage`, `powersync`, `app`).

## Dev Workflow Notes

- **Infrastructure only mode**: Start `postgres`, `bucket-storage`, `powersync` in Docker; run the app locally with `npm run dev`. This gives you hot-reload for app development.
- **Full stack mode**: `docker compose up -d` starts everything including the app. Useful for integration testing.
- Source Postgres exposes port 5432 to the host for local tools (Drizzle CLI, psql, etc.).
- PowerSync exposes port 8080 for the sync WebSocket endpoint.
- When starting fresh, you may need to wipe volumes (`docker compose down -v`) to re-run the Postgres init scripts (replication role, publication).

## JWT Auth

PowerSync authenticates client connections using JWTs signed by the app server.

**Endpoints:**
- `GET /api/powersync/jwks` — public JWKS endpoint (no auth required). PowerSync fetches this to verify client tokens.
- `GET|POST /api/powersync/token` — returns a signed JWT for an authenticated user.

**How it works:**
- The app generates an RSA key pair in-memory on first use (cached for server lifetime).
- PowerSync is configured with `jwks_uri` pointing to the app's JWKS endpoint (`http://app:5173/api/powersync/jwks` on the Docker network).
- Keys rotate on app restart; PowerSync re-fetches JWKS automatically.
- Single-user simplification: no per-user token scoping. All tokens use subject `chronolog-user`.

**Infrastructure-only mode note:** When running only the infrastructure containers (without the `app` container), PowerSync cannot fetch JWKS from the app. This is fine — JWKS is only needed when a client connects to sync, not for replication.
