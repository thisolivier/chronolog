# Sprint 022 — IF: Production stack on the Mac mini

**Status:** active
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

_Fill in: what changed, verification transcript, follow-ups._
