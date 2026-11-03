# Onboarding a device

How to connect a new browser, laptop CLI or desktop install to the production instance at
`https://chronolog.throb.online`, and how to bring the instance back from a backup. Server setup
itself is in [DEPLOYMENT.md](DEPLOYMENT.md).

> Skeleton (sprint 022). The device-key sections are filled in by sprint 023 and the API-token and CLI
> sections by sprint 024.

## Before you start

- The instance is reachable: `curl -sI https://chronolog.throb.online/login` returns 200.
- You have the account's email, password and 2FA authenticator.
- *(sprint 023)* You have the device access key, or can create one on the box.

## New browser (desktop or phone)

1. *(sprint 023)* Open `https://chronolog.throb.online/unlock` and enter the device access key once.
   The browser keeps it as a long-lived HttpOnly cookie.
2. Sign in at `/login` with email, password and the 2FA code.
3. Optional on a phone: add to the home screen (PWA).

_To be completed by sprint 023: key issue/revoke procedure, lockout behaviour, cookie lifetime._

## New laptop CLI (Claude secretary)

_To be completed by sprint 024._

- Create a long-lived API token (where, scopes, expiry).
- Install the CLI and store the token and device key (header) on the laptop.
- Check with a read-only command.
- Revoke a lost laptop's token.

## New Tauri desktop install

_To be completed when the Tauri shell points at the production origin._

- Install the `.app` (build from `npm run tauri:build`, or a signed build when distribution exists).
- *(sprint 023)* Enter the device access key; the app sends it as a header.
- Sign in.

## Restoring from backup

Use this after data loss, or when moving the instance to a new machine. Full detail is in
[DEPLOYMENT.md](DEPLOYMENT.md#restore).

1. Find the dump: `~/Backups/chronolog/daily/` or `weekly/`, or the mirror under
   `/Volumes/Rabbit4TB/Backups/chronolog/`.
2. Get the `ENCRYPTION_KEY` that was live when the dump was taken (password manager). Without it,
   encrypted fields cannot be read.
3. On a new machine, clone the repo, write `.env.prod` with that key, and run
   `scripts/deploy-prod.sh`.
4. Restore it:
   ```bash
   docker stop chronolog-prod-app
   scripts/restore-postgres.sh --replace <dump> chronolog
   docker start chronolog-prod-app
   ```
5. Sign in and spot-check recent notes and time entries.
6. *(sprints 023/024)* Device keys and API tokens are stored in the database, so they come back with
   the restore. Revoke any that belonged to lost devices.
