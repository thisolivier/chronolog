# Docker Compose Stack

Local development stack for Chronolog (`docker-compose.yml`): PostgreSQL plus an optional
containerised app. The production stack is the same shape (`docker-compose.prod.yml`); see
[DEPLOYMENT.md](DEPLOYMENT.md).

## Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `postgres` | postgres:17 | 5432 | Application database (volume `postgres_data`, healthcheck) |
| `app` | Built from `Dockerfile.dev` | 5173 | SvelteKit dev server with hot reload (`src/`, `static/` bind-mounted); runs `drizzle-kit migrate` on start |

## Quick Start

```bash
# Infrastructure only (usual dev loop): Postgres in Docker, app on the host
docker compose up -d postgres
npm run db:migrate
npm run dev            # reads .env — copy it from .env.example first

# Or the full stack, including the containerised app on http://localhost:5173
docker compose up -d
```

The `app` service carries its own dev-only values for `ENCRYPTION_KEY`, `BETTER_AUTH_SECRET`,
`BETTER_AUTH_URL` and `ALLOW_REGISTRATION=true`; when running the app on the host, those come from
`.env` instead (see the environment variables table in the [README](../README.md)).

## Stopping

```bash
docker compose down          # stop services, keep data
docker compose down -v       # stop services AND delete volumes (fresh start)
```

## Network

Both services are on the `chronolog` bridge network and reference each other by service name
(`postgres`, `app`). Postgres exposes port 5432 to the host for local tools (Drizzle CLI, psql,
Drizzle Studio).
