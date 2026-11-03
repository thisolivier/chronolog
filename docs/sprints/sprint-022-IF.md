# Sprint 022 — IF: Production stack on the Mac mini

**Status:** signed-off (2026-11-03, awaiting merge)
**Type:** Infrastructure
**Depends on:** 021-CL (merged). Independent of 019-CL / 020-CL (touches no `src/` files).
**Branch:** `sprint-022-IF/production-stack`
**Worktree:** `.claude/worktrees/sprint-022-IF`
**Source of truth:** `docs/decisions.md` (2026-11-03), `docs/review/2026-11-03-infra-state.md` §2, §3, §4, §6

## Objective

A production stack that can be brought up on this machine with one command, backed up nightly, and
reachable through the existing Cloudflare tunnel once the owner adds the DNS route. Fetch mode only:
app + Postgres.

## Tasks

1. **`docker-compose.prod.yml`:** app + postgres only; project name `chronolog-prod` and volume names
   that cannot collide with the dev stack; app published on `127.0.0.1:3123` only; postgres with no
   `ports:`; pinned image tags; healthchecks; `restart: unless-stopped`; env from `.env.prod`;
   `ORIGIN`, `BETTER_AUTH_URL`, `TRUSTED_ORIGINS`, `ALLOW_REGISTRATION`, `ENCRYPTION_KEY`,
   `BETTER_AUTH_SECRET`, `DATABASE_URL`. Migrations run on container start (entrypoint runs
   `drizzle-kit migrate` or an equivalent node script against the built app) and are idempotent.
2. **`Dockerfile`:** review the multi-stage build against current `package.json` (021 removed deps);
   `npm ci`, non-root user, only the `build/` output and production deps in the final image.
3. **Dev compose:** bind Postgres to `127.0.0.1:5432`.
4. **`.env.prod.example`** rewritten for the above, with generation commands for secrets.
5. **Backups:** `scripts/backup-postgres.sh` (`docker exec … pg_dump -Fc`, dated file in
   `~/Backups/chronolog/`, keep 14 daily + 8 weekly, mirror to `/Volumes/Rabbit4TB/Backups/chronolog/`
   when mounted, log to a file, non-zero exit on failure); `scripts/restore-postgres.sh <dump>`
   into a named database; a launchd plist under `scripts/launchd/` for 03:30 daily with install and
   uninstall instructions. Follow the precedent of the music-library backup daemon on this machine
   (look for `musiclibrary-db-backup` under `~/Library/LaunchAgents` or `/Library/LaunchDaemons`).
6. **Cloudflare:** do not touch the live `cloudflared` config (root-owned). Produce the exact ingress
   snippet for `chronolog.throb.online → http://localhost:3123`, the DNS CNAME step, and recommended
   rate-limit rules for `/login`, `/unlock`, `/api/auth/*`, in `docs/DEPLOYMENT.md`.
7. **`scripts/deploy-prod.sh`:** build image, bring stack up, wait for health, print the URL and the
   first-account procedure (temporarily `ALLOW_REGISTRATION=true`, register, set back to false).
8. **Docs:** rewrite `docs/DEPLOYMENT.md` end to end for this setup; create `docs/ONBOARDING.md`
   skeleton with sections for new browser, new laptop CLI, new Tauri install, restoring from backup
   (the device-key and API-token sections get filled by sprints 023 and 024); keep `docs/ports.md`
   accurate.

## Boundaries

Do NOT edit anything under `src/` except, if unavoidable, a migration-runner script under
`scripts/`. Do NOT edit `CLAUDE.md`. Do NOT modify `/etc/cloudflared`, LaunchDaemons, or any
non-chronolog container. Do NOT leave the production stack running at the end.

## Verification

- `docker compose -f docker-compose.prod.yml config` valid; image builds; with a throwaway `.env.prod`
  the stack comes up healthy on `127.0.0.1:3123`, migrations apply on a fresh volume, registration
  works with the flag on and is refused with it off, login works, `/api/*` unauthenticated → 401.
- Backup script produces a dump; restore script restores it into a scratch database and a row count
  matches. Launchd plist passes `plutil -lint`.
- Tear down with volumes removed (`chronolog-prod` project only). Confirm the dev stack is untouched.
- Screenshots or terminal transcripts into `docs/review/screenshots/sprint-022/`.

## Sign-off

**Status:** signed-off 2026-11-03. Branch `sprint-022-IF/production-stack` is pushed and not merged.

### What changed

- **`docker-compose.prod.yml`**: `name: chronolog-prod`; containers `chronolog-prod-app` /
  `chronolog-prod-postgres`; volume `chronolog-prod-postgres-data` and network
  `chronolog-prod-internal`, all with explicit names. App on `127.0.0.1:${APP_PORT:-3123}` only;
  Postgres has no `ports:`. Images pinned to `postgres:17.11-alpine3.24` and an app image built on
  `node:22.23.4-alpine3.24`. Healthchecks on both (app: `GET /login` via node fetch),
  `restart: unless-stopped`, `init: true`. Values come from `.env.prod` via `--env-file`, and each
  container gets only its own variables. Required variables use `${VAR:?…}`, so a missing secret
  stops compose before anything starts.
- **`Dockerfile`**: three stages (build, then production-deps `npm ci --omit=dev --omit=optional
  --ignore-scripts`, then runtime), running as the `node` user. The CMD runs `node scripts/migrate.mjs && exec node build`.
  The image is 240 MB (dev image 4.4 GB; first attempt 357 MB); runtime `node_modules` is 92 MB and
  carries no vite, vitest, drizzle-kit, typescript or Kit.
- **`scripts/migrate.mjs`** (new): drizzle-orm postgres-js migrator, idempotent, needs runtime deps
  only. It replaces `npx drizzle-kit migrate`.
- **`package.json`**: `@sveltejs/adapter-node` moved to devDependencies (build-time only; it pulled
  Kit, vite and typescript into the runtime tree). The lockfile change is flags only, with the same
  versions. `--omit=optional` is needed because better-auth declares Kit, svelte, vitest and
  drizzle-kit as optional peers.
- **`docker-compose.yml`** (dev): Postgres on `127.0.0.1:5432`.
- **`.dockerignore`**: excludes `.env.*`, `.claude`, `docs`, e2e and test output, so `.env.prod` can
  never enter the build context.
- **`.env.prod.example`** rewritten, with a generation command for each secret.
- **Backups**: `scripts/backup-postgres.sh` (pg_dump -Fc, `pg_restore --list` verification, 14 daily
  and 8 weekly, Rabbit4TB mirror only when actually mounted, monthly UTC log, exit 0/1/2),
  `scripts/restore-postgres.sh [--replace] <dump> <db>` (refuses to overwrite without `--replace`
  and refuses the live db while the app runs; prints row counts), and
  `scripts/launchd/com.olivier.chronolog-db-backup.plist` (user LaunchAgent, 03:30) with
  install/uninstall steps in `scripts/launchd/readme.md`. These follow the
  `com.olivier.musiclibrary-db-backup` precedent: script copy in `~/Backups/<name>/bin`, absolute
  docker path, guarded pruning.
- **`scripts/deploy-prod.sh`**: checks the env file and port, validates, builds, brings the stack up,
  waits for health, then prints the URLs and the first-account procedure.
- **Docs**: `docs/DEPLOYMENT.md` rewritten end to end (including the Cloudflare public hostname,
  DNS CNAME and rate-limit rule); `docs/ONBOARDING.md` skeleton; `docs/ports.md` and
  `docs/docker-stack.md` corrected; `scripts/readme.md`.
- No files under `src/` were touched.

### Verification

Transcripts are in `docs/review/screenshots/sprint-022/`. All runs used a throwaway `.env.prod` with
random secrets, deleted afterwards, and no secret value appears in any transcript (checked with grep).

| Check | Result | Transcript |
|---|---|---|
| `compose config` valid; missing env fails loudly | pass | `01-compose-config.txt` |
| Image builds; stack healthy on `127.0.0.1:3123` | pass (lsof shows `127.0.0.1:3123` only; Postgres publishes nothing) | `02-build-and-deploy.txt`, `03-runtime-checks.txt` |
| Migrations on a fresh volume | 7 migrations, 16 public tables; restart says "up to date" (idempotent) | `03`, `04` |
| `/api/*` unauthenticated → 401 | `/api/clients`, `/api/time-entries`, `/api/notes`, `/api/timer` all 401; `/` → 303 `/login` | `03` |
| Registration with flag on | sign-up 200, sign-in 200, session reads `/api/clients` 200 | `03` |
| Registration with flag off | sign-up 400 `EMAIL_AND_PASSWORD_SIGN_UP_IS_NOT_ENABLED`, `/register` says closed, still one user; login 200 | `04-registration-closed.txt` |
| Backup → restore, row counts match | dump verified, identical counts across 17 tables in `chronolog_restore_check`; retention pruned 16 seeded dumps to 14; weekly promotion; mirror copied; unmounted `/Volumes` mirror skipped; missing container exits 2; restore refusals work | `05-backup-restore.txt` |
| `plutil -lint` plist | OK | `05` |
| Teardown, dev untouched | `down -v --rmi local` for `chronolog-prod` only; port 3123 free; `chronolog-postgres-1` / `chronolog-bucket-storage-1` have the same IDs and StartedAt as before | `06-teardown.txt` |
| `npm test` / `npm run check` after the package.json change | 269/269 pass; svelte-check 0 errors | n/a |

### Needs the owner at the keyboard

1. **Cloudflare dashboard**: add public hostname `chronolog.throb.online` → `HTTP localhost:3123`
   on the Mac mini tunnel, confirm the proxied CNAME `chronolog` → `<tunnel-id>.cfargotunnel.com`,
   and create the rate-limit rule. Exact values are in `docs/DEPLOYMENT.md` ("Cloudflare Tunnel").
   No change to `/etc/cloudflared` or the LaunchDaemon is needed, because the tunnel is
   dashboard-managed.
2. **Real `.env.prod`**: generate secrets on the box and store `ENCRYPTION_KEY` in the password manager.
3. **Deploy checkout**: decide whether to use a dedicated `~/sites/chronolog-prod` clone (recommended)
   or the main checkout. Then run `scripts/deploy-prod.sh` and do the first-account steps.
4. **Install the backup LaunchAgent** (`scripts/launchd/readme.md`). It is a user agent, no sudo.
   Full Disk Access for `/bin/bash` may be needed for the Rabbit4TB mirror, as with musicLibrary.

### Follow-ups

- The dev Postgres is still published on `0.0.0.0:5432` until the container is recreated
  (`docker compose up -d postgres` in the main checkout). It was deliberately not recreated here,
  because the dev stack had to stay untouched. The `chronolog-bucket-storage-1` container and the
  `chronolog_bucket_storage_data` volume are leftovers from PowerSync (no longer in the dev
  compose) and can be removed.
- Password reset against production has no tested path (no host port; the image lacks `tsx`). Add
  a small runtime script or document a `docker run` on `chronolog-prod-internal`.
- Tailscale access: the app is loopback-only, so the tailnet IP does not reach it. The earlier
  `ports.md` note said "Tailscale" and has been corrected. If tailnet access is wanted, it needs
  `tailscale serve` or a second binding, which is an owner decision.
- `getClientAddress()` sees the cloudflared peer, not the user. Sprint 023 (lockout logging) should
  read `CF-Connecting-IP`, for example via adapter-node `ADDRESS_HEADER=cf-connecting-ip`, but only
  once everything arrives through the tunnel.
- `ORIGIN` is the public https origin, so admin form actions do not work via `http://127.0.0.1:3123`.
  This is intended; noted in DEPLOYMENT.md.
- Encryption at rest is not implemented yet (notes were stored in plaintext in the test). That work
  belongs to its own sprint. Backups will carry ciphertext once it lands.
- Commit trailer: this sprint's commits use the `Claude Opus 5.5` co-author line (the model that
  did the work) rather than the `Claude Fable 5.1` line in the dispatch brief.
- `CLAUDE_MEMORIES.md` still says "Better Auth uses adapter-auto"; the app uses adapter-node.
