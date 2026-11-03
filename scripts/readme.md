# scripts/

Operational scripts. Nothing here is imported by the app.

| Script | Purpose |
|---|---|
| `deploy-prod.sh` | Build and (re)start the production stack (`docker-compose.prod.yml`, project `chronolog-prod`), refuse to run without `DEVICE_ACCESS_KEY_HASH` in `.env.prod`, wait for health, print URL and first-account steps. |
| `generate-device-key.mjs` | `node scripts/generate-device-key.mjs`: prints a new device access key (password manager only) and the `DEVICE_ACCESS_KEY_HASH` line for `.env` or `.env.prod`. Needs Node 22.18+. Run it on a laptop, not on the server. |
| `encrypt-existing.mjs` | One-time: encrypts plaintext values in the encrypted columns of a database that predates sprint 023 (`node --env-file=.env scripts/encrypt-existing.mjs`). Idempotent and safe to re-run; take a backup first. |
| `migrate.mjs` | Apply Drizzle migrations from `drizzle/` against `DATABASE_URL`. Runs on every production container start; plain JS so it needs only runtime dependencies. |
| `backup-postgres.sh` | `pg_dump -Fc` of the production database with retention (14 daily / 8 weekly) and a Rabbit4TB mirror. Settings can be overridden with `CHRONOLOG_*` environment variables. |
| `restore-postgres.sh` | Restore a dump into a named database (`--replace` to overwrite) and print row counts. |
| `launchd/` | User LaunchAgent that runs the backup at 03:30, plus install/uninstall steps. |
| `reset-password.ts` | `npm run db:reset-password`: reset the account password from the shell. |

Shell scripts are bash, `set -euo pipefail` (the backup uses explicit checks and exit codes instead
of `-e`), and never print secret values. See [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md).
