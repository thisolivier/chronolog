# Chronolog infrastructure state review — 2026-11-03

**Scope:** read-only review of hosting docs, compose files, env (key names only), Tauri config, PowerSync auth routes, and the current state of this machine (MistyMacMini, macOS 26.2, Docker 29.8.2 via OrbStack).
**Project last touched:** 2026-05-27 (plus a `wip/2026-05-27-debug-session` branch committed today, 2026-11-03, preserving that session's uncommitted edits).
**Nothing was started, stopped or modified.** See "Observed during review" at the end for two chronolog Postgres containers that another session started while this review ran.

---

## 1. Hosting decision history

Three hosting ideas appear in the docs, in this order:

| Era | Where the server runs | Source |
|---|---|---|
| Original spec (pre-May 2026) | **Coolify on a Hetzner CX22 VPS**; alternative "Docker Compose + Caddy on any VPS" | `docs/SPEC.md` §Deployment: *"Server / PWA: Coolify on a Hetzner CX22 VPS (~EUR 4-6/mo) — Automatic HTTPS via Let's Encrypt — Built-in scheduled PostgreSQL backups to S3-compatible storage — Git-push deploys"*. Repeated in `docs/DEPLOYMENT.md` ("Recommended hosting: Coolify on Hetzner"). |
| Offline-sync epic (2026-05-26) | **"Remote machine"** = this Mac mini, running the full stack in Docker Compose | `docs/EPIC-OFFLINE-SYNC.md`: *"Execution environment: Remote machine (self-hosted PowerSync stack runs there, not on the dev laptop)"* and *"Adopt self-hosted PowerSync, single-user, executed on the remote machine."* `CLAUDE_MEMORIES.md`: *"The PowerSync stack … runs on the **remote machine**, not the dev laptop."* `BACKLOG.md` Task 11: *"PowerSync stack runs on the **remote machine**."* The memory file `user_environment.md` ("Remote machine environment — OrbStack") confirms the remote machine is this Mac mini. |
| Tauri desktop | Tauri is the **client**, never a hosting option. Desktop keeps a local SQLite (OPFS via PowerSync) and talks to the server. `docs/SPEC.md`: *"Desktop (Tauri): Built with cargo tauri build, distributed as macOS .app bundle"*. | — |

**Was the containerised-on-Mac-mini plan abandoned?** No evidence of abandonment, and no evidence of a later decision either. It was executed through Phase A/B/D/F/G:

- Sprint 002-IF (signed off 2026-05-26): *"All 4 services (app, postgres, bucket-storage, powersync) run on the chronolog bridge network with no host-networking workarounds."* The dev stack `docker-compose.yml` is this deliverable.
- Sprint 003-IF (signed off 2026-05-26): JWT/JWKS auth, sync rules verified end-to-end.
- Commit `fef6284` (2026-05-26): *"Add production Docker stack, password reset CLI"* — `docker-compose.prod.yml`, `Dockerfile`, `.env.prod.example`, `scripts/reset-password.ts`.
- `.env.prod` was created the same day (13:42) but is filled with **localhost** URLs (resolved compose shows `BETTER_AUTH_URL: http://localhost:3000`, `VITE_POWERSYNC_URL: http://localhost:8080`), i.e. it was never pointed at a real address. No container was ever built from `Dockerfile` (prod) on this machine — the only `chronolog-app` image is the 4.4 GB dev image built from `Dockerfile.dev`.
- The stack was then left running until **2026-07-05 22:12 UTC**, when postgres/bucket-storage/powersync all exited cleanly (exit 0, "Exiting" in PowerSync logs — a host reboot or `docker compose stop`). The app container had already died on 2026-05-27 with `Cannot find module '@tiptap/extension-code-block-lowlight'` (image predates Sprint 012-CL's new dependency).

**Conclusion:** the plan stalled, it was not abandoned. The dev stack ran on this machine for ~6 weeks; the production variant was written but never deployed. The SPEC/DEPLOYMENT docs still describe Hetzner/Coolify and are stale relative to the epic.

One thing that *did* regress silently: the PowerSync runtime switch was lost in a merge. Sprint 004-CL added `import.meta.env.PUBLIC_SYNC_MODE === 'powersync'` → swap to `PowerSyncDataService` in `src/routes/+layout.svelte` (commit `1b30741`). Merge `c155e2c` (sprints 016/017, timesheet redesign) removed that block; current `main` always constructs `FetchDataService` and **never instantiates `PowerSyncDataService`** (`grep "new PowerSyncDataService" src` finds nothing outside tests). PowerSync is therefore dead code at runtime on `main`, even though `hooks.server.ts` still emits COOP/COEP headers when `PUBLIC_SYNC_MODE=powersync`.

---

## 2. Stack inventory

### 2a. Dev stack — `docker-compose.yml` (project name `chronolog`)

| Service | Image | Host port | Volumes | Key env | Healthcheck |
|---|---|---|---|---|---|
| `app` | built from `Dockerfile.dev` (node:20-alpine, `npm ci`, `drizzle-kit migrate && npm run dev --host`) | 5173 | bind-mounts `./src`, `./static`, `vite.config.ts`, `svelte.config.js` | `DATABASE_URL` (postgres svc), `ENCRYPTION_KEY`/`BETTER_AUTH_SECRET` (hard-coded dev values), `BETTER_AUTH_URL=http://localhost:5173` | none |
| `postgres` | `postgres:17`, `-c wal_level=logical` | **5432** | `postgres_data`; `config/init-db.sql` → initdb (creates `powersync_repl` role + `powersync` publication) | user/pass/db `chronolog` | `pg_isready` |
| `bucket-storage` | `postgres:17` | none | `bucket_storage_data` | `powersync` / `powersync_storage` | `pg_isready` |
| `powersync` | `journeyapps/powersync-service:latest`, `start -r unified` | **8080** | `config/powersync.yaml`, `config/sync_rules.yaml` | `PS_DATA_SOURCE_URI` (repl role), `PS_STORAGE_SOURCE_URI`, `PS_PORT=8080`, `PS_JWKS_URI=http://app:5173/api/powersync/jwks` | node http probe on `/probes/liveness` |

Network: single bridge `chronolog`. Volumes: `chronolog_postgres_data`, `chronolog_bucket_storage_data`.

### 2b. Prod stack — `docker-compose.prod.yml` (resolved with `.env.prod`)

| Service | Differences from dev |
|---|---|
| `app` | built from `Dockerfile` (multi-stage: `npm ci` → `npm run build` → copies `build/`, `drizzle/`, `drizzle.config.ts` and the **entire dev `node_modules`**; CMD `npx drizzle-kit migrate && node build`). Port `${APP_PORT:-3000}:3000`. Env adds `PUBLIC_SYNC_MODE=powersync`, `VITE_POWERSYNC_URL`, `ORIGIN=${BETTER_AUTH_URL}`. No bind mounts. |
| `postgres` | identical, but **no host port** (good). Password from `${POSTGRES_PASSWORD}`. |
| `bucket-storage` | identical; password from `${BUCKET_STORAGE_PASSWORD:-powersync_storage}` (defaults to the dev value). |
| `powersync` | identical; port `${POWERSYNC_PORT:-8080}:8080`; `PS_JWKS_URI=http://app:3000/api/powersync/jwks`; repl password defaults to `powersync_repl_password` (dev value, and `init-db.sql` hard-codes the same). |

`.env.prod` keys present: `ENCRYPTION_KEY`, `BETTER_AUTH_SECRET`, `POSTGRES_PASSWORD`, `BETTER_AUTH_URL`, `VITE_POWERSYNC_URL` (values not inspected; the URL ones resolve to localhost).

### 2c. Problems and fragilities found

1. **Same compose project name and volume names as dev.** `docker compose -f docker-compose.prod.yml config` resolves to `name: chronolog`, volumes `chronolog_postgres_data` / `chronolog_bucket_storage_data`, container names `chronolog-postgres-1` etc. Running the prod file in this directory would *adopt* the existing dev containers/volumes. Worse: the dev volume was initialised with password `chronolog`; Postgres ignores `POSTGRES_PASSWORD` on an existing data directory, so the prod `DATABASE_URL` (built from `.env.prod`'s password) would fail auth. Fix: `name: chronolog-prod` (or `-p`) and distinct volume names, or deliberately reuse the dev volume with its credentials.
2. **`VITE_POWERSYNC_URL` can never reach the client.** `src/lib/powersync/connector.ts` reads `import.meta.env.VITE_POWERSYNC_URL` — a *build-time* substitution. `Dockerfile` has no `ARG`/`ENV` for it and `.dockerignore` excludes `.env`, so the built bundle always contains the fallback `http://localhost:8080`. Setting it as a runtime `environment:` in compose is a no-op. Same applies to `PUBLIC_SYNC_MODE` as read via `import.meta.env` in the (now removed) layout switch. Needs a build arg (`ARG VITE_POWERSYNC_URL` + `ENV` before `npm run build`) or a runtime-injected config.
3. **`PUBLIC_SYNC_MODE` on the server side** is read via `process.env` in `hooks.server.ts` (fine), but the dev compose never sets it, so the containerised dev app never sent COOP/COEP headers; only the host `.env` did.
4. **`journeyapps/powersync-service:latest`** in both files. PowerSync docs (context7, "Service release channels"): *"The `latest` tag tracks the most recent stable build but is recommended for development only, since it can move across major versions. Pin a version tag for production."* The cached local image is 5 months old; a `pull` would jump versions. Pin e.g. `journeyapps/powersync-service:1`. (Also `postgres:17` is fine but consider `17.x`.)
5. **`ORIGIN=${BETTER_AUTH_URL}`** is correct in shape (adapter-node needs the public origin for CSRF checks), but with the current `.env.prod` it is `http://localhost:3000`, which rejects every form POST from a non-localhost browser. Behind a TLS-terminating proxy, set it to the public `https://…` origin (or use `PROTOCOL_HEADER`/`HOST_HEADER`, which adapter-node documents for trusted proxies).
6. **Better Auth `trustedOrigins` is hard-coded** to `http://100.110.206.54:5173` in `src/lib/server/auth.ts` (this machine's Tailscale IP, dev port). It needs to include whatever production origin is chosen, otherwise Better Auth rejects sign-in POSTs from that origin.
7. **JWKS reachability:** `PS_JWKS_URI=http://app:3000/api/powersync/jwks` is reachable only on the compose network — correct, and `/api/powersync/jwks` is in `hooks.server.ts` `publicRoutes`. But the signing key is generated **in memory per app process** (`powersync-auth.ts`: "keys rotate on restart"). Every app restart invalidates all client tokens until PowerSync re-fetches JWKS (cached up to `Cache-Control: max-age=3600`) — expect sync auth failures for up to an hour after each deploy. The epic's open question 3 ("persist the RSA key") was never done; `config/dev-jwk.json` / `dev-public.pem` exist but are unused.
8. **Secrets defaulting to dev values** in prod: `BUCKET_STORAGE_PASSWORD`, `PS_REPL_PASSWORD` (and `init-db.sql` hard-codes `powersync_repl_password`, so changing the env var without editing the SQL breaks replication). Acceptable because neither Postgres is host-exposed, but worth knowing.
9. **Prod image carries full dev `node_modules`** (Playwright, vitest, tauri CLI…). Works, but it is why the dev image is 4.4 GB. `npm ci --omit=dev` in the final stage (as `docs/DEPLOYMENT.md`'s sample Dockerfile does) would shrink it; `drizzle-kit` would then need to be a runtime dependency.
10. **Open registration.** `/register` is a public route with no "first user only" guard. On a reachable instance anyone who finds the URL can create an account (and `ensureAppUser` will seed data for them). Mitigate by exposure method (tailnet-only / Cloudflare Access) or by a guard.
11. **Migrations run on every container start** (`CMD npx drizzle-kit migrate && node build`). Fine for a single instance; avoid `replicas > 1`.
12. **Stale artefacts on this machine:** 4 exited `chronolog-*` containers (dev stack), 6 volumes (`chronolog_*` with data ~66 MB each; `sprint-002-if_*`, `sprint-003-if_*` ~49 MB each, unused), images `chronolog-app` (4.4 GB) and `sprint-003-if-app`. 16 stale worktrees under `.claude/worktrees/`. `.claude/scheduled_tasks.lock` dates from 2026-05-26.

---

## 3. What else runs on this machine, and port conflicts

### 3a. `docker ps -a` (28 containers; all "Up 7 days" unless noted)

| Container | Image | Host ports |
|---|---|---|
| metadata-sidecar-prod / -qa | services-metadata-sidecar-* | 8789 / 8790 |
| soulseek-navi-server / -qa | services-soulseek-navi-server* | none |
| gateway / gateway-qa | services-gateway* | 5040 / 5041 |
| slskd | slskd/slskd:latest | 5030, 50300 |
| navidrome / navidrome-qa | navidrome-fork:folders-v2-rebase-a822e565 | 4533 / 4534 |
| lisbontiles-web / lisbontiles-web-staging | web-web / lisbontiles-staging-web | 8453 / 8456 (→3000 inside) |
| lisbontiles-watcher / -staging | web-watcher / lisbontiles-staging-watcher | none |
| adjacency-sidecar / -qa | services-adjacency-sidecar* | 8787 / 8788 |
| gigs-sidecar-prod / -qa | services-gigs-sidecar* | 8791 / 8792 |
| graphnotes-couchdb | couchdb:3 | 127.0.0.1:5984 and **100.110.206.54:5984** |
| graphnotes-bridge / -autocommit / -backup | graphnotes-bridge / alpine/git / restic/restic | none |
| download-pipeline | spotifydeparture-pipeline | none |
| bgutil-provider | brainicism/bgutil-ytdlp-pot-provider | none (4416 internal) |
| audiobookshelf-audiobookshelf-1 | ghcr.io/advplyr/audiobookshelf:latest | 13378 |
| chronolog-app-1 | chronolog-app (dev) | — Exited (143) 2026-05-27 |
| chronolog-powersync-1 | journeyapps/powersync-service:latest | — Exited (0) 2026-07-05 |
| chronolog-postgres-1 | postgres:17 | 5432 — was Exited (0) 2026-07-05; **running since 12:59 UTC today, started by another session** (see end) |
| chronolog-bucket-storage-1 | postgres:17 | — same |

Compose projects (`docker compose ls -a`): `services` (13, `/Volumes/Rabbit4TB/services/docker-compose.yml`), `graphnotes` (4), `web` (lisbonTiles prod, 2), `lisbontiles-staging` (2), `spotifydeparture` (2), `audiobookshelf` (1), `chronolog` (exited 4).

### 3b. Port conflicts for chronolog

| Chronolog port | Status on host | Verdict |
|---|---|---|
| **8080** (PowerSync) | **Taken by UniFi Network Application** — `/Applications/UniFi.app … java`, PID 764, listening on `*:8080` (also 8443, 8843, 8880, 6789, mongod 27117). | **Hard conflict.** `docker compose up` of either compose file will fail to bind. Set `POWERSYNC_PORT` to something free (e.g. 8460), and the client URL must follow. |
| **3000** (prod app) | Free on the host. lisbonTiles containers use 3000 *inside* their containers only (mapped to 8453/8456). | OK, but the house convention is a memorable high port (8453 "TILE", 8456); `APP_PORT` is already parameterised. |
| **5432** (dev Postgres) | Free until today; now bound by `chronolog-postgres-1`. Prod compose does not publish it. | OK for prod. If dev and prod stacks coexist, only one can publish 5432. |
| 5173 (dev app) | Free. | OK. |

Other listeners (not Docker): Tailscale, UniFi, Android emulator/netsim (5554/5555/6402/8554, dev tooling), OrbStack control ports (32222, 49202).

### 3c. How existing services are exposed

- **No reverse proxy container** (no caddy/traefik/nginx in `docker ps`; binaries not installed). Containers publish ports directly on `0.0.0.0`.
- **Tailscale** is running (`/usr/local/bin/tailscale`): this host is `mistymacmini` **100.110.206.54**; peers `slim-thick-boss` (macOS, active), two iPhones. Several stacks rely on it: lisbonTiles compose comments *"Bound on all interfaces so the app is reachable from the tailnet at http://100.110.206.54:8453"*; graphNotes compose binds CouchDB to `100.110.206.54:5984` and states the **house pattern**: *"plain HTTP on the tailnet static IP + custom port. No tailscale-serve HTTPS / ts.net names — public cert issuance would put this host in certificate-transparency registries."* Chronolog's own `auth.ts` `trustedOrigins` already references `http://100.110.206.54:5173`, so the dev server was previously used over the tailnet.
- **Cloudflare Tunnel** (`cloudflared 2026.3.0`, Homebrew binary) runs as a root **LaunchDaemon** `/Library/LaunchDaemons/com.cloudflare.cloudflared.plist` (`cloudflared tunnel run --token …`, KeepAlive). It is a dashboard-managed tunnel (no local config file), currently serving at least `book.throb.online`, `beat.throb.online`, `soul.throb.online`, `blip.throb.online` (from `/Library/Logs/com.cloudflare.cloudflared.err.log`). This is the precedent for **public HTTPS** exposure: add a public hostname in the Cloudflare Zero Trust dashboard → `http://localhost:<port>`.
- **launchd user agents** (`launchctl list | grep -iv com.apple`): `com.olivier.musiclibrary-db-backup`, `com.olivier.musiclibrary-playlist-shadow`, `com.olivier.libation-rotate`, `uk.olivier.seashell-backup`, Tailscale, OrbStack (MacVirt), UniFi, Google updater. No chronolog entries.
- **Homebrew services:** only `cloudflared` listed, status `none` (it is run by the LaunchDaemon, not brew).
- **lisbonTiles-staging precedent** (`~/sites/lisbonTiles-staging/web/compose.staging.yaml`): pinned `name:`, explicit `container_name`, `restart: unless-stopped`, host port → 3000, absolute bind-mounted data dir, `ORIGIN` deliberately unset so adapter-node derives origin from the request ("so both localhost:8453 and the tailnet address work"), deploy via `scripts/deploy-staging.sh`. No .env files, no proxy, no TLS — tailnet plain HTTP.

---

## 4. Data persistence and backups

- **Where Postgres data lives:** named Docker volumes inside the OrbStack VM — `chronolog_postgres_data` and `chronolog_bucket_storage_data` (`/var/lib/docker/volumes/<name>/_data` in the VM; visible on the host at `~/OrbStack/docker/volumes/<name>`). Created 2026-05-26, ~66 MB each. They hold whatever the dev stack had in May (a sibling session ran `select … from "user"`, `count(*) from notes` against it today, so someone is checking). The musicLibrary notes (`~/Backups/musicLibrary/bin/db-backup.sh`) record why **named volumes, not `/Volumes/Rabbit4TB` bind mounts, are the right choice for databases** on OrbStack: bind-mounted SQLite WAL was not coherent and corrupted. Postgres on a bind mount is similarly discouraged. Keep the named volume.
- **Existing backup patterns on this machine:**
  - `com.olivier.musiclibrary-db-backup` (launchd, daily 04:00): bash script stages DB files out of a named volume via a throwaway alpine container, verifies, stores under `~/Backups/musicLibrary` on the internal disk, retention 14 daily / 12 weekly / 18 monthly, logs under `~/Backups/musicLibrary/logs`.
  - `graphnotes-backup` container (`restic/restic`, hourly loop `docker/scripts/backup-loop.sh`): two repos (local `backups/restic-local` + `/Volumes/Rabbit4TB/graphNotesBackups/restic`, skipped if the drive is absent), daily forget+prune, weekly `restic check`.
  - `uk.olivier.seashell-backup` (launchd hourly python).
  - No `crontab`, no Time Machine destination (`tmutil destinationinfo`: none). No `pg_dump` script exists anywhere under `~/sites`, `~/Backups` or `/Volumes/Rabbit4TB/services`.
- **Minimal approach that fits the house style:** a launchd agent `com.olivier.chronolog-db-backup` (copy the musiclibrary plist, daily 04:10) running a ~30-line script:
  `docker exec chronolog-postgres-1 pg_dump -U chronolog -Fc chronolog > ~/Backups/chronolog/daily/chronolog-$(date +%F).dump` (+ `pg_dump -Fc powersync_storage` from bucket-storage is optional — it is derived state and can be rebuilt by PowerSync), then prune to 14 daily / 8 weekly, mirror to `/Volumes/Rabbit4TB/chronologBackups/` when mounted, log to `~/Backups/chronolog/logs`. Restore = `pg_restore -d chronolog` into a fresh volume. (Alternative: a `restic` sidecar like graphNotes, but pg_dump is simpler and produces a consistent logical snapshot.)

---

## 5. The Tauri desktop app

- `src-tauri/tauri.conf.json`: `build.devUrl = http://localhost:5173`, `build.frontendDist = ../build`, `beforeBuildCommand = npm run build`, CSP `null`, no window `url` (defaults to `index.html` from `frontendDist`). Rust side only registers `tauri-plugin-sql` (SQLite); there are no capabilities files and no IPC commands.
- **The production build is non-functional as configured.** `svelte.config.js` uses `@sveltejs/adapter-node`, so `build/` contains `index.js`, `handler.js`, `server/`, `client/` — a Node server, not a static site. There is no `build/index.html` for Tauri to load. `docs/DEPLOYMENT.md`'s claim that `npm run tauri:build` uses adapter-static is stale (`CLAUDE_MEMORIES.md`: "Task 3 switched from adapter-static to adapter-auto (needed for server routes)"). GATE A was validated with `tauri dev`, i.e. a native window around the Vite dev server on localhost:5173.
- **The app cannot be made static anyway**: all client calls are relative (`/api/...`, `/api/powersync/token`) through `fetch-helpers.ts`; there is no API-base-URL setting, and Better Auth, the JWKS/token endpoints and the REST write path are server routes. So the realistic production shape is **Tauri as a thin shell pointed at the hosted app**: set the window `url` to the server origin (Tauri 2 supports remote URLs in `app.windows[].url`), keep `tauri-plugin-sql` only if still used (the storage adapter checks `window.__TAURI__`, which Tauri only injects for remote origins listed in `app.security.dangerousRemoteDomainIpcAccess`; with PowerSync/OPFS the SQLite plugin is probably unnecessary).
- **What the desktop app would need to reach the Mac mini:**
  - *URL:* the public origin, e.g. `https://chronolog.throb.online` (Cloudflare) or `http://100.110.206.54:<APP_PORT>` (tailnet).
  - *TLS / secure context:* PowerSync's web SDK uses OPFS + SharedArrayBuffer workers. Both require a **secure context** and cross-origin isolation (`hooks.server.ts` already sets COOP/COEP). `http://localhost` qualifies by browser exception; **`http://100.110.206.54:…` does not** — a plain-HTTP tailnet origin breaks OPFS (the SDK may fall back to IndexedDB-VFS, untested here). This is the main reason the tailnet-HTTP house pattern and the PowerSync design pull in different directions. HTTPS via the Cloudflare tunnel resolves it; the WebKit webview in Tauri treats a remote `https://` origin as secure.
  - *CORS:* none needed if the webview loads the app from the same origin as the API (relative fetches). The PowerSync service is a second origin (`VITE_POWERSYNC_URL`); PowerSync's HTTP/WebSocket endpoints accept cross-origin requests with a bearer token, so no server CORS change is needed, but the client URL must be baked at build time (see §2c-2).
  - *Auth:* Better Auth `baseURL` = `BETTER_AUTH_URL`, and `trustedOrigins` must include the origin the webview uses (currently only the dev tailnet URL). Cookies: Better Auth sets `Secure` cookies on https origins — fine; on plain http it uses non-secure cookies — also fine but weaker.
- **Does the current config support it?** No: `frontendDist` points at server output, no window URL, `trustedOrigins` dev-only, `VITE_POWERSYNC_URL` not baked, and the layout no longer switches to PowerSync. The pieces exist (auth routes, connector, service) but are not wired for a remote production origin.

---

## 6. Recommendation: minimal path to "production on the Mac mini"

Use `docker-compose.prod.yml` as the base, deployed from a dedicated checkout (e.g. `~/sites/chronolog-prod`, mirroring `lisbonTiles` vs `lisbonTiles-staging`) so dev worktrees never rebuild production.

| # | Step | Effort |
|---|---|---|
| 1 | **Restore the PowerSync switch** in `src/routes/+layout.svelte` (re-apply the 9 lines from `1b30741`) and decide whether `PUBLIC_SYNC_MODE` should be read via `$env/dynamic/public` (runtime) instead of `import.meta.env` (build-time). Run `npm test`. | 1 h |
| 2 | **Fix the compose/Dockerfile plumbing:** `name: chronolog-prod`; distinct volume names (`chronolog_prod_postgres_data`, …); `container_name`s; pin `journeyapps/powersync-service:1` (or exact tag); add `ARG VITE_POWERSYNC_URL` / `ARG PUBLIC_SYNC_MODE` to the build stage and pass them via `build.args` in compose; set `POWERSYNC_PORT` to a free port (8080 is UniFi's); optionally `npm ci --omit=dev` in the final stage. Update `.env.prod.example`. | 2–3 h |
| 3 | **Persist the PowerSync signing key:** load an RSA JWK from an env var or mounted file in `powersync-auth.ts` instead of `generateKeyPair()` per process (keep the in-memory path as dev fallback). Removes the up-to-1-hour auth outage after each restart. | 1–2 h |
| 4 | **Fix origins:** `auth.ts` `trustedOrigins` from env (`BETTER_AUTH_URL` + optional extras); `ORIGIN` = public https origin; if behind the Cloudflare tunnel, alternatively `PROTOCOL_HEADER=x-forwarded-proto HOST_HEADER=x-forwarded-host`. Add a "first user only" guard on `/register`. | 1–2 h |
| 5 | **Exposure (owner decision, see below).** Recommended: Cloudflare tunnel public hostnames `chronolog.throb.online` → `http://localhost:<APP_PORT>` and `chronolog-sync.throb.online` → `http://localhost:<POWERSYNC_PORT>`, with **Cloudflare Access** (email OTP) on both. Set `BETTER_AUTH_URL=https://chronolog.throb.online`, `VITE_POWERSYNC_URL=https://chronolog-sync.throb.online`. Note: the WebSocket sync stream must be allowed through Access (service token or bypass for the sync hostname with JWT auth as the gate). | 1 h dashboard + 1 h testing |
| 6 | **Env & secrets:** regenerate `ENCRYPTION_KEY`, `BETTER_AUTH_SECRET`, `POSTGRES_PASSWORD`, `BUCKET_STORAGE_PASSWORD`, `PS_REPL_PASSWORD` (and make `init-db.sql` read the password from env, or accept the dev default since Postgres is not host-exposed). | 0.5 h |
| 7 | **Bring-up & migration:** `docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build`; the app container runs `drizzle-kit migrate` on start (all migrations in `drizzle/`). Data: either start empty and register the single user (then `npm run db:reset-password` is the recovery path), or `pg_dump` the May dev volume (`chronolog_postgres_data`) and `pg_restore` into the new prod volume — note the dev DB predates sprints 014–017, so migrations will run forward on it. | 1–2 h |
| 8 | **Backups:** launchd agent + pg_dump script as in §4, daily, to `~/Backups/chronolog` with a Rabbit4TB mirror. Test one restore. | 1–2 h |
| 9 | **Tauri shell:** set `app.windows[0].url` to the public origin, drop `tauri-plugin-sql` if unused, build, confirm OPFS sync in the WebKit webview against the real origin (GATE A again, but on https). Code-signing/notarisation only if the .app leaves this machine. | 2–4 h |
| 10 | **Docs:** update `docs/SPEC.md` §Deployment and `docs/DEPLOYMENT.md` to describe the Mac mini stack (replace Hetzner/Coolify); add `docs/docker-stack.md` prod section; clean up stale worktrees/volumes (`sprint-00*-if_*`). | 1 h |

Total: roughly **2–3 working days**, most of it steps 2–5 and 9. Steps 1–4 and 6 are pure repo work and can be done before any exposure decision.

### Open decisions for the owner

1. **Exposure model:** (a) public HTTPS via the existing Cloudflare tunnel (+ Access) — gives a secure context, works from phone/PWA anywhere, but publishes a `throb.online` hostname and depends on Cloudflare; or (b) tailnet-only plain HTTP on `100.110.206.54:<port>` per the house pattern — private and simple, but **not a secure context**, so PowerSync OPFS/SharedArrayBuffer and the PWA service worker will not work as validated; needs either an IndexedDB fallback test or a locally trusted cert (e.g. Caddy with an internal CA installed on each client), which contradicts the "no ts.net certs" rule only if a public CA is used. (c) Hybrid: Cloudflare for the app, nothing else.
2. **Keep or drop PowerSync for v1.** Given the layout regression, the app currently works in plain `FetchDataService` mode (online-only, exactly what GATE B tested). Shipping that first on the Mac mini is a ~1-day job (steps 2, 4, 6, 7, 8 minus PowerSync parts); PowerSync can be re-enabled afterwards. The `DataService` abstraction was designed for exactly this.
3. **Data:** start fresh vs migrate the May dev volume.
4. **Port numbers:** pick `APP_PORT` / `POWERSYNC_PORT` in the house's memorable-high-port style (e.g. 8470/8471).
5. **Who owns the PowerSync version pin** and the UniFi port clash (move UniFi off 8080 is the other option, not recommended).
6. **Tauri distribution:** this machine only (no signing) vs other Macs (signing + notarisation + updater manifest hosting).

---

## Observed during review (not caused by this review)

- At **12:59:48 UTC** on 2026-11-03, while this read-only review was running, `chronolog-postgres-1` and `chronolog-bucket-storage-1` (the exited dev-stack containers) were **started by another process**, and `psql` queries were executed in `chronolog-postgres-1` (`select … from "user"`, `select count(*) from notes`, `select … from drizzle.__drizzle_migrations`) — visible in `docker events`. Four other `claude` processes are running on this machine (started 28 Oct, 29 Oct, and 3 Nov 02:18 / 04:43), and `~/sites/chronolog-prune-backup-2026-11-03.bundle` (1 MB git bundle) was written at 04:57 today, so a sibling session is actively working on this repo. This review did not start, stop or exec into anything. Consequence: host port 5432 is now in use by the dev Postgres.
- `docs/DEPLOYMENT.md`, `docs/SPEC.md` and `docs/docker-stack.md` are internally inconsistent about adapters (static/auto/node) and hosting; treat `svelte.config.js` (adapter-node) and the compose files as the truth.
