# Building & Deploying Chronolog

Chronolog has two deployment targets: a Tauri desktop app (macOS) and a server-hosted PWA.

The production server stack is deliberately small: **the SvelteKit app + PostgreSQL**. There is no
sync service, no second database and no extra configuration directory. Offline support is deferred
to a future cache + outbox sprint and will not add server components.

## Desktop App (Tauri)

### Building

```bash
npm run tauri:build
```

This runs both the SvelteKit build (with `adapter-static` for local file serving) and the Rust/Tauri build. The output is a macOS `.app` bundle and `.dmg` installer in `src-tauri/target/release/bundle/`.

### Requirements

- Rust toolchain (`rustup`)
- Xcode Command Line Tools (macOS)
- Node.js 20+

### Distribution

- **macOS**: The `.dmg` in `src-tauri/target/release/bundle/dmg/` can be distributed directly.
- **Code signing & notarisation**: Required for distribution outside the Mac App Store. Configure signing identity in `src-tauri/tauri.conf.json` under `bundle > macOS`.
- **Auto-updates**: Planned via `tauri-plugin-updater`. Requires hosting an update manifest (JSON file) at a public URL.

## Server / PWA

### Building

```bash
npm run build
```

This produces a Node.js server build (via `adapter-auto` / `adapter-node`) in the `build/` directory.

### Running in production

```bash
node build
```

The server listens on port 3000 by default. Set the `PORT` environment variable to change it.

### Environment variables

Copy `.env.prod.example` to `.env.prod` and fill in real values. The app **refuses to boot** without
`BETTER_AUTH_SECRET` and `ENCRYPTION_KEY` — there is no hard-coded fallback.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | yes | PostgreSQL connection string (the compose file builds it from `POSTGRES_*`) |
| `ENCRYPTION_KEY` | yes | 256-bit key for AES-256-GCM encryption at rest (`openssl rand -base64 32`) |
| `BETTER_AUTH_SECRET` | yes | Session signing secret (`openssl rand -base64 32`) |
| `BETTER_AUTH_URL` | yes | Public URL of the app (e.g. `https://chronolog.example.com`); also used as `ORIGIN` |
| `ALLOW_REGISTRATION` | no | Default `false`: the `/register` page shows "Registration is closed on this instance" and the sign-up API refuses. See below |
| `TRUSTED_ORIGINS` | no | Comma-separated extra origins Better Auth accepts in addition to `BETTER_AUTH_URL` (e.g. a Tailscale IP or LAN address you also open the app from) |
| `POSTGRES_PASSWORD` | yes (compose) | Password for the bundled Postgres; `POSTGRES_USER` / `POSTGRES_DB` default to `chronolog` |
| `APP_PORT` | no | Host port mapped to the app container (default `3000`) |

#### Creating the first account

Chronolog is a single-account-per-instance app and registration is closed by default. To create
your account:

1. Set `ALLOW_REGISTRATION=true` in `.env.prod` and start (or restart) the app.
2. Open `/register`, create the account and enrol 2FA.
3. Set `ALLOW_REGISTRATION=false` (or remove the line) and restart the app. The register page and
   API are closed again; the existing account keeps working.

### Docker deployment

The repo ships a production `Dockerfile` (multi-stage Node 20 build; the container runs
`drizzle-kit migrate` and then `node build`) and `docker-compose.prod.yml` with two services:

| Service | Image | Purpose |
|---------|-------|---------|
| `app` | built from `Dockerfile` | SvelteKit server on port 3000 (host port `APP_PORT`) |
| `postgres` | `postgres:17` | Application database, volume `postgres_data`, healthcheck gates app start |

```bash
cp .env.prod.example .env.prod   # fill in the secrets
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Migrations run automatically on every app container start, so there is no separate migration step.
Put a reverse proxy with HTTPS (Caddy, Traefik, or Coolify's built-in proxy) in front of port 3000
and make sure `BETTER_AUTH_URL` matches the public URL it serves.

### Recommended hosting: Coolify on Hetzner

The planned production setup (see [SPEC.md](SPEC.md) for details):

- **Hetzner CX22 VPS** (~EUR 4-6/month)
- **Coolify** for deployment management (web UI, git-push deploys)
- **Automatic HTTPS** via Let's Encrypt
- **PostgreSQL backups** to S3-compatible storage (built into Coolify)

### Alternative: Docker Compose + Caddy

For a simpler self-hosted setup (for example on the Mac mini), run `docker-compose.prod.yml` as
above and add a Caddy container in front of it for automatic HTTPS:

```yaml
  caddy:
    image: caddy:2
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
    networks:
      - chronolog
```

with a `Caddyfile` of `chronolog.example.com { reverse_proxy app:3000 }`.

### Database migrations in production

The app container runs `drizzle-kit migrate` before starting. If you run the Node build outside
Docker, run migrations yourself before starting the app:

```bash
npm run db:migrate
```

### Backups

Back up the `postgres_data` volume (or `pg_dump` the `chronolog` database) before upgrades. It is
the only state the stack holds.
