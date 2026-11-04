# Deploying Chronolog

Production runs on the **Mac mini** (OrbStack) as a two-container Docker Compose stack, reached from
the internet through the **existing Cloudflare Tunnel**. Decisions behind this are in
[decisions.md](decisions.md) (2026-11-03); the review that led to it is
[review/2026-11-03-infra-state.md](review/2026-11-03-infra-state.md).

```
browser / Tauri / CLI
        │ https://chronolog.throb.online
        ▼
Cloudflare edge (TLS, rate-limit rules)
        │ tunnel
        ▼
cloudflared (root LaunchDaemon on the Mac mini)
        │ http://localhost:3123
        ▼
chronolog-prod-app  (127.0.0.1:3123 → :3000, node user, adapter-node)
        │ compose network chronolog-prod-internal
        ▼
chronolog-prod-postgres  (no published port, volume chronolog-prod-postgres-data)
```

Fetch mode only: there is no sync service. Offline support is a later cache + outbox sprint.

## Files

| File | Purpose |
|---|---|
| `docker-compose.prod.yml` | App + Postgres. Project `chronolog-prod`; containers `chronolog-prod-app` / `chronolog-prod-postgres`; volume `chronolog-prod-postgres-data`. None of these can collide with the dev stack (project `chronolog`). |
| `Dockerfile` | Multi-stage build on `node:22.23.4-alpine3.24`: `npm ci` + `vite build`, then a runtime stage with `build/`, `drizzle/`, `scripts/migrate.mjs` and production dependencies only, running as `node`. Build argument `BUILD_COMMIT` becomes `CHRONOLOG_BUILD_COMMIT` (see Updating). |
| `scripts/migrate.mjs` | Applies pending Drizzle migrations on every container start (idempotent), before `node build`. |
| `.env.prod.example` | Template for `.env.prod` (gitignored, excluded from the build context). |
| `scripts/deploy-prod.sh` | Validate, build, start, wait for health, print the URL and first-account steps. |
| `scripts/backup-postgres.sh`, `scripts/restore-postgres.sh` | Nightly `pg_dump -Fc` and restore into a named database. |
| `scripts/launchd/` | LaunchAgent for the 03:30 backup, with install/uninstall steps. |

## Where to deploy from

Deploy from a **dedicated clone** that only ever tracks `main`, so sprint worktrees and dev edits
never rebuild production (the lisbonTiles / lisbonTiles-staging precedent):

```bash
git clone <origin-url> ~/sites/chronolog-prod
cd ~/sites/chronolog-prod
cp .env.prod.example .env.prod && chmod 600 .env.prod   # then fill it in, see below
```

Any checkout works technically: the compose project name is fixed, so running the deploy from
another checkout updates the same stack. Keep it to one.

## Environment (`.env.prod`)

Compose reads `.env.prod` through `--env-file` and passes each container only what it needs.

| Variable | Required | Notes |
|---|---|---|
| `ENCRYPTION_KEY` | yes | `openssl rand -base64 32`: base64 of exactly 32 random bytes, checked at boot. Encrypts data at rest. Keep a copy off the box (password manager); a backup is only restorable with the key that was live when it was taken. See the warning below. |
| `BETTER_AUTH_SECRET` | yes | `openssl rand -base64 32`. Rotating it signs everyone out. |
| `DEVICE_ACCESS_KEY_HASH` | yes | The `DEVICE_ACCESS_KEY_HASH=scrypt:…` line from `node scripts/generate-device-key.mjs` (Node 22.18+, run from a checkout). Gates every page and API route; browsers unlock at `/unlock`. The raw `DEVICE_ACCESS_KEY` is for the password manager only. Rotation: [ONBOARDING.md](ONBOARDING.md#rotating-the-device-key). |
| `POSTGRES_PASSWORD` | yes | `openssl rand -hex 24` (hex: URL-safe in `DATABASE_URL`). Applied only when the volume is first created. |
| `BETTER_AUTH_URL` | yes | `https://chronolog.throb.online`. Better Auth base URL and trusted origin. |
| `ORIGIN` | no | adapter-node CSRF origin for form actions. Defaults to `BETTER_AUTH_URL`. |
| `TRUSTED_ORIGINS` | no | Comma-separated extra origins Better Auth accepts (e.g. the Tauri app origin). |
| `ALLOW_REGISTRATION` | no | Default `false`. `true` only while creating the first account. |
| `APP_PORT` | no | Host port, default `3123` (bound to `127.0.0.1`). See [ports.md](ports.md). |
| `POSTGRES_USER`, `POSTGRES_DB` | no | Default `chronolog`. |

`DATABASE_URL` is assembled by the compose file from the `POSTGRES_*` values. A missing required
variable stops `docker compose` with an explicit message before anything starts. `scripts/deploy-prod.sh`
also refuses to run when `DEVICE_ACCESS_KEY_HASH` is missing or empty.

> **Losing `ENCRYPTION_KEY` loses the data.** Encrypted fields in the database and in every backup
> cannot be read without the exact key that wrote them. Keep the key in the password manager, stored
> separately from the dumps, and check that the copy there matches `.env.prod` before you rely on
> it. There is no recovery path, and key rotation is not supported yet.

Because `ORIGIN` is the public https origin, admin form actions only work through
`https://chronolog.throb.online`; `http://127.0.0.1:3123` is for health checks and curl.

## First deploy

```bash
cd ~/sites/chronolog-prod
scripts/deploy-prod.sh
```

The script refuses to run without `.env.prod` or when port 3123 belongs to something else. It then
builds the image, starts Postgres, waits for it to be healthy, starts the app (which migrates the
database), waits for the app healthcheck (`GET /login` → 200) and prints the URLs.

### First account

Registration is closed by default and the instance holds a single account.

1. Set `ALLOW_REGISTRATION=true` in `.env.prod` and run `scripts/deploy-prod.sh`. Only the app
   container is recreated; the database is untouched.
2. Open `https://chronolog.throb.online/register`, create the account, then enrol 2FA under Settings.
3. Set `ALLOW_REGISTRATION=false` and run `scripts/deploy-prod.sh` again.
4. Check that `/register` says "Registration is closed on this instance."

Do steps 1 to 3 back to back: while the flag is on, anyone who finds the URL can register.
Forgotten password: there is no tested production path yet. `npm run db:reset-password` needs a
`DATABASE_URL` that reaches the database, production Postgres has no host port, and the runtime image
does not ship `tsx` or that script. This is a follow-up from sprint 022.

## Updating

```bash
cd ~/sites/chronolog-prod
scripts/backup-postgres.sh          # take a dump first (see Backups)
git pull --ff-only
scripts/deploy-prod.sh
```

Migrations run automatically on start. Run a single app replica only, because migrations are not
coordinated between replicas.

**Build commit.** `scripts/deploy-prod.sh` passes `git rev-parse HEAD` as the `BUILD_COMMIT` build
argument; the image keeps it as `CHRONOLOG_BUILD_COMMIT` and `GET /api/me` reports it as
`serverCommit` (044-CL). The laptop CLI compares it with its own checkout once a day and says
`run git pull` when they differ. `.git` is not in the build context, so a plain
`docker compose ... up --build` without the script reports `dev`, and the CLI then says nothing.
The script warns when the checkout has uncommitted changes (the image then reports a commit it
does not exactly match). Check it with
`curl -s -H 'X-Device-Key: …' -H 'Authorization: Bearer …' https://chronolog.throb.online/api/me` or
`chronolog me` (both commits in brackets).

**Rollback:** `git checkout <previous commit> && scripts/deploy-prod.sh`. If the update included a
migration, restore the pre-update dump as well (see Restore). Drizzle migrations only go forward.

## Encrypting a database that predates sprint 023

A database created before sprint 023 holds plaintext in the encrypted columns. A fresh production
database needs nothing; this one-time script is only for an older database. It encrypts every
plaintext value in those columns with `ENCRYPTION_KEY`.

1. Take a backup first: `scripts/backup-postgres.sh`.
2. Rehearse on a restored copy: restore the dump into a scratch database (see Restore), then run the
   script with `DATABASE_URL` pointing at that scratch database. Check the app reads the data.
3. Run it against the live database, from a checkout that holds `.env.prod`. `.env.prod` has no
   `DATABASE_URL`, and production Postgres has no host port, so export both values for the run:
   ```bash
   DATABASE_URL=postgresql://chronolog:…@<reachable host>:<port>/chronolog \
   ENCRYPTION_KEY=… node scripts/encrypt-existing.mjs
   ```
   Replace the placeholders from `.env.prod` and the reachable host. Do not print them into logs.
   This route to production Postgres is not yet tested; a tested path is a follow-up.
4. Sign in and spot-check notes, time entries and contracts.

The script is idempotent: values already carrying the `enc1:` prefix are skipped, so it is safe to
re-run after an interruption. A database seeded with `npm run db:seed` on dev is plaintext until
this script runs; the app still reads it.

## Cloudflare Tunnel (owner, in the Cloudflare dashboard)

The tunnel is the existing `cloudflared` root LaunchDaemon
(`/Library/LaunchDaemons/com.cloudflare.cloudflared.plist`, `cloudflared tunnel run --token …`). It
is **dashboard-managed**: there is no local `config.yml`, and nothing on the box needs editing.
cloudflared runs on the host, so `localhost:3123` reaches the loopback-bound app.

### Public hostname (ingress)

Zero Trust → Networks → Tunnels → *the Mac mini tunnel* → Public Hostname → **Add a public hostname**:

| Field | Value |
|---|---|
| Subdomain | `chronolog` |
| Domain | `throb.online` |
| Path | *(empty)* |
| Service | `HTTP` → `localhost:3123` |

The equivalent ingress rule for a locally managed tunnel (`config.yml`), for reference only:

```yaml
ingress:
  - hostname: chronolog.throb.online
    service: http://localhost:3123
  # ... existing book/beat/soul/blip rules ...
  - service: http_status:404
```

### DNS

Saving the public hostname in the dashboard creates the DNS record automatically: a **proxied CNAME**
`chronolog` → `<tunnel-id>.cfargotunnel.com` in the `throb.online` zone. Check that it appears under
DNS → Records and is orange-clouded. If it does not (for example the hostname was added via the API),
add that record by hand. For a locally managed tunnel the CLI equivalent is
`cloudflared tunnel route dns <tunnel-name-or-id> chronolog.throb.online`.

Do not enable Cloudflare Access on this hostname: the Tauri app cannot carry Access credentials. The
gate is the device access key (sprint 023) plus the login.

### Rate-limit rules (optional, skipped 2026-11-04)

The owner's Cloudflare plan has no WAF rate limiting, so this rule is not in place. The app's own
limits cover it: Better Auth's production rate limit on `/api/auth/*`, the device gate's five-wrong-keys
lockout per IP for 15 minutes, and the API token limiter (60 failures per minute per IP). If the plan
changes, the rule below is the one to add.

Security → WAF → Rate limiting rules → **Create rule**. Count only `POST`, so page loads and session
reads are never throttled:

| Setting | Value |
|---|---|
| Name | `chronolog auth endpoints` |
| Expression | `(http.host eq "chronolog.throb.online" and http.request.method eq "POST" and (http.request.uri.path in {"/login" "/unlock"} or starts_with(http.request.uri.path, "/api/auth/")))` |
| Characteristics | IP |
| Rate | 10 requests per 1 minute (or per 10 seconds if the plan only offers that period) |
| Action | Block, for 10 minutes (or the longest duration the plan allows) |

Lower-tier plans limit how many rate-limiting rules you can have, and which periods and durations are
available. That is why everything above sits in one rule. Better Auth also applies its own
in-memory rate limit to `/api/auth/*` in production; the Cloudflare rule stops floods before they
reach the box. `/unlock` belongs to the device-key gate (sprint 023); including it now is harmless.

After the hostname is live:

```bash
curl -sI https://chronolog.throb.online/login | head -1          # HTTP/2 200
curl -s  https://chronolog.throb.online/api/clients              # {"error":"Unauthorized"}
```

## Backups

`scripts/backup-postgres.sh` runs nightly at 03:30 from a user LaunchAgent. Install it once; the
steps are in [scripts/launchd/readme.md](../scripts/launchd/readme.md).

- `docker exec chronolog-prod-postgres pg_dump -Fc` → `~/Backups/chronolog/daily/chronolog-<UTC>.dump`
  (mode 600), verified with `pg_restore --list` before it is kept.
- Sundays (UTC) are copied to `weekly/`. Retention is 14 daily and 8 weekly.
- Mirrored to `/Volumes/Rabbit4TB/Backups/chronolog/` when that volume is mounted; skipped with a
  warning otherwise.
- Log: `~/Backups/chronolog/logs/backup-YYYY-MM.log`. Exit code 0 means ok, 1 a dump, verify or
  mirror failure, 2 a database container that is not running.

Dumps contain the auth tables (password hashes, sessions) as well as application data. Data
encrypted at rest stays encrypted in the dump. Store `ENCRYPTION_KEY` separately from the dumps.

### Restore

```bash
# Drill: restore into a scratch database while the app keeps running, then drop it
scripts/restore-postgres.sh ~/Backups/chronolog/daily/<file>.dump chronolog_restore_check
docker exec chronolog-prod-postgres psql -U chronolog -d postgres -c 'drop database chronolog_restore_check'

# Real restore over the live database
docker stop chronolog-prod-app
scripts/restore-postgres.sh --replace ~/Backups/chronolog/daily/<file>.dump chronolog
docker start chronolog-prod-app
```

The script prints exact row counts per table. It refuses to overwrite an existing database without
`--replace`, and it refuses to replace the live database while the app container runs. On a new
machine, bring the stack up first with the **same** `ENCRYPTION_KEY`, then restore with `--replace`.

## Operations

```bash
P="docker compose -p chronolog-prod -f docker-compose.prod.yml --env-file .env.prod"
$P ps                         # status and health
$P logs -f app                # app logs (migrations print at the top)
$P restart app
$P down                       # stop; the data volume is kept
# $P down -v                  # DESTROYS the database volume. Back up first.
```

The containers use `restart: unless-stopped`, so they come back after an OrbStack restart or a
power cut once OrbStack starts at login.

## Security posture

- The app is published on `127.0.0.1:3123` only. Postgres has no host port. The dev Postgres is
  bound to `127.0.0.1:5432`.
- `.env.prod` should be mode 600, is never committed, and is excluded from the Docker build context.
- The image runs as the unprivileged `node` user and carries no dev tooling.
- Registration is closed unless `ALLOW_REGISTRATION=true`.
- Device access key gate: every page and `/api/*` route needs the key (cookie from `/unlock`, or the
  `X-Device-Key` header) before the login check. Lockout and rotation: [ONBOARDING.md](ONBOARDING.md).
- Notes, time entries, contracts, client names and attachments are encrypted at rest (AES-256-GCM,
  `ENCRYPTION_KEY`).
- Coming next: API tokens for the laptop CLI (sprint 024).

## Running without Docker

```bash
npm ci && npm run build
DATABASE_URL=... node scripts/migrate.mjs
DATABASE_URL=... ENCRYPTION_KEY=... DEVICE_ACCESS_KEY_HASH=... BETTER_AUTH_SECRET=... BETTER_AUTH_URL=... ORIGIN=... PORT=3123 HOST=127.0.0.1 node build
```

## Desktop app (Tauri)

`npm run tauri:build` produces a macOS `.app` / `.dmg` under `src-tauri/target/release/bundle/`
(Rust toolchain, Xcode Command Line Tools and Node 22 are required). Pointing the shell at the
production origin, and signing it for other Macs, are covered by later sprints; see
[ONBOARDING.md](ONBOARDING.md).
