# scripts/

Operational scripts. Nothing here is imported by the app.

| Script | Purpose |
|---|---|
| `deploy-prod.sh` | Build and (re)start the production stack (`docker-compose.prod.yml`, project `chronolog-prod`), refuse to run without `DEVICE_ACCESS_KEY_HASH` in `.env.prod`, wait for health, print URL and first-account steps. |
| `generate-device-key.mjs` | `node scripts/generate-device-key.mjs`: prints a new device access key (password manager only) and the `DEVICE_ACCESS_KEY_HASH` line for `.env` or `.env.prod`. Needs Node 22.18+. Run it on a laptop, not on the server. |
| `encrypt-existing.mjs` | One-time: encrypts plaintext values in the encrypted columns of a database that predates sprint 023 (`node --env-file=.env scripts/encrypt-existing.mjs`). Idempotent and safe to re-run; take a backup first. Imports the envelope from `lib/envelope.mjs`, so it also runs in the production image. |
| `backfill-note-word-counts.mjs` | Sprint 037: sets `notes.word_count` where it is 0 but the note has words (notes created over the API before the create path counted markdown). `--dry-run` prints the count and five sample IDs; `--apply` prints the count updated. Production: `docker exec chronolog-prod-app node scripts/backfill-note-word-counts.mjs --dry-run`, then `--apply` after a backup. Idempotent. |
| `purge-note-trash.mjs` | Sprint 037: hard-deletes every user's notes trashed more than 30 days ago (the app already does this per user on each delete). `--dry-run` / `--apply`; in production via `docker exec chronolog-prod-app node scripts/purge-note-trash.mjs …`. |
| `lib/` | Plain-JS helpers for scripts that run inside the production image (it has no `src/`): `envelope.mjs` (the `enc1:` AES-256-GCM envelope) and `word-count.mjs` (the app's word counters). `script-lib.test.ts` checks they agree with the TypeScript originals. |
| `check-entry-references.mjs` | `node --env-file=.env scripts/check-entry-references.mjs [--json]`: read-only report of time entries whose contract is not the owner's, whose deliverable is off the contract, or whose work type is missing a deliverable or under another one. Never fixes anything. Exit 1 when it finds some. |
| `migrate.mjs` | Apply Drizzle migrations from `drizzle/` against `DATABASE_URL`. Runs on every production container start; plain JS so it needs only runtime dependencies. |
| `backup-postgres.sh` | `pg_dump -Fc` of the production database with retention (14 daily / 8 weekly) and a Rabbit4TB mirror. Settings can be overridden with `CHRONOLOG_*` environment variables. |
| `restore-postgres.sh` | Restore a dump into a named database (`--replace` to overwrite) and print row counts. |
| `launchd/` | User LaunchAgent that runs the backup at 03:30, plus install/uninstall steps. |
| `reset-password.ts` | `npm run db:reset-password`: reset the account password from the shell. |

The production image (Dockerfile) carries `migrate.mjs`, `lib/`, `backfill-note-word-counts.mjs`,
`purge-note-trash.mjs` and `encrypt-existing.mjs`; anything run with `docker exec` must be plain JS
with production dependencies only.

Shell scripts are bash, `set -euo pipefail` (the backup uses explicit checks and exit codes instead
of `-e`), and never print secret values. See [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md).
