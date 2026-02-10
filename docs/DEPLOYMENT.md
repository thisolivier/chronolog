# Building & Deploying Chronolog

Chronolog has two deployment targets: a Tauri desktop app (macOS) and a server-hosted PWA.

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

Copy `.env.example` and configure for production:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `ENCRYPTION_KEY` | 256-bit key for AES-256-GCM encryption at rest |
| `BETTER_AUTH_SECRET` | Secret for session signing (generate with `openssl rand -base64 32`) |
| `BETTER_AUTH_URL` | Public URL of the app (e.g. `https://chronolog.example.com`) |

### Docker deployment

A minimal Docker setup for production:

```dockerfile
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-slim
WORKDIR /app
COPY --from=build /app/build ./build
COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev
EXPOSE 3000
CMD ["node", "build"]
```

### Recommended hosting: Coolify on Hetzner

The planned production setup (see [SPEC.md](SPEC.md) for details):

- **Hetzner CX22 VPS** (~EUR 4-6/month)
- **Coolify** for deployment management (web UI, git-push deploys)
- **Automatic HTTPS** via Let's Encrypt
- **PostgreSQL backups** to S3-compatible storage (built into Coolify)

### Alternative: Docker Compose + Caddy

For a simpler self-hosted setup, use Docker Compose with Caddy as a reverse proxy for automatic HTTPS:

```yaml
services:
  app:
    build: .
    environment:
      DATABASE_URL: postgresql://chronolog:chronolog@postgres:5432/chronolog
      # ... other env vars
    ports:
      - "3000:3000"

  postgres:
    image: postgres:17
    environment:
      POSTGRES_USER: chronolog
      POSTGRES_PASSWORD: <strong-password>
      POSTGRES_DB: chronolog
    volumes:
      - postgres_data:/var/lib/postgresql/data

  caddy:
    image: caddy:2
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile

volumes:
  postgres_data:
```

### Database migrations in production

Run migrations before starting the app:

```bash
npm run db:migrate
```

Or include it in your deployment pipeline / Docker entrypoint.
