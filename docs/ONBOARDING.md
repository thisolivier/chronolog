# Onboarding a device

How to connect a new browser, laptop CLI or desktop install to the production instance at
`https://chronolog.throb.online`, and how to bring the instance back from a backup. Server setup
itself is in [DEPLOYMENT.md](DEPLOYMENT.md).

> The device-key sections are filled in (sprint 023). The API-token and CLI sections are still to be
> completed by sprint 024.

## Before you start

- The instance is reachable: `curl -sI https://chronolog.throb.online/login` returns 200.
- You have the account's email, password and 2FA authenticator.
- You have the device access key (password manager). If there is none, rotate the key (see
  [Rotating the device key](#rotating-the-device-key)); the raw key is never stored on the box.

## New browser (desktop or phone)

1. Open `https://chronolog.throb.online/unlock` and enter the device access key once.
   The browser keeps it as a long-lived cookie: `chronolog_device`, HttpOnly, SameSite=Lax, Secure
   over https, valid for 365 days.
2. Sign in at `/login` with email, password and the 2FA code.
3. Optional on a phone: add to the home screen (PWA).

The cookie is bound to the current key hash. Clearing site data for the host, using a private
window, or a key rotation means the browser visits `/unlock` again. A wrong key is rejected with
the page's error message and counts towards the lockout below.

## Laptop CLI (Claude secretary)

The device key gets a request past the gate by sending it as a header. It does not sign you in:
until sprint 024 adds API tokens, data routes still need a signed-in session.

```bash
export CHRONOLOG_DEVICE_KEY='<paste the device access key from the password manager>'
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "X-Device-Key: $CHRONOLOG_DEVICE_KEY" \
  https://chronolog.throb.online/login          # expect 200
```

Without a valid key, `/api/*` answers `401 {"error":"Device not authorised"}` before any login check,
so that response means the key, not the login. Keep the key out of shell history and dotfiles.

_To be completed by sprint 024:_

- Create a long-lived API token (where, scopes, expiry).
- Install the CLI and store the token and device key (header) on the laptop.
- Check with a read-only command.
- Revoke a lost laptop's token.

## New laptop CLI (Claude secretary)

## New Tauri desktop install

_The shell is not yet pointed at the production origin; these steps apply once it is. The origin must
also be listed in `TRUSTED_ORIGINS` in `.env.prod`._

- Install the `.app` (build from `npm run tauri:build`, or a signed build when distribution exists).
- Enter the device access key once; the app sends it as the `X-Device-Key` header on every request
  (the same header as the CLI above). Keep the raw key in the password manager.
- Sign in.

## Rotating the device key

Use this when the key may have leaked, when a device carrying it is lost, or on a routine schedule.
Rotation replaces the one key for every device at once; per-device keys are not supported yet.

1. On a laptop with a checkout of the repo (Node 22.18+): `node scripts/generate-device-key.mjs`.
   Save the new `DEVICE_ACCESS_KEY` in the password manager, replacing the old entry.
2. On the box, in `.env.prod`, replace the `DEVICE_ACCESS_KEY_HASH=` line with the new hash line,
   then redeploy: `scripts/deploy-prod.sh`.
3. Every browser visits `/unlock` again, because the old cookies are invalid under the new hash.
   Update the `X-Device-Key` value in the CLI and the Tauri app.

Logs show `[device-gate] device unlocked ip=…` for each successful unlock, which helps confirm that
the expected devices have come back.

### Lockout

Five wrong keys from one client IP lock that IP out for 15 minutes. While locked, the gate returns
`429`, and the log shows `[device-gate] LOCKOUT ip=…`. Every failure is logged as
`[device-gate] wrong device key ip=… path=…`; the key itself is never logged. The client IP is the
`CF-Connecting-IP` header when present (the tunnel), otherwise the socket address.

To clear a lockout early, restart the app container; the lockout state is in memory only:

```bash
cd ~/sites/chronolog-prod
docker compose -p chronolog-prod -f docker-compose.prod.yml --env-file .env.prod restart app
```

Otherwise, wait 15 minutes.

## Restoring from backup

Use this after data loss, or when moving the instance to a new machine. Full detail is in
[DEPLOYMENT.md](DEPLOYMENT.md#restore).

1. Find the dump: `~/Backups/chronolog/daily/` or `weekly/`, or the mirror under
   `/Volumes/Rabbit4TB/Backups/chronolog/`.
2. Get the `ENCRYPTION_KEY` that was live when the dump was taken (password manager). A restore only
   works with that key: encrypted fields in the dump are unreadable with any other key, including
   the current one if it was rotated after the dump. Check the key's date against the dump's before
   you rely on it.
3. On a new machine, clone the repo, write `.env.prod` with that `ENCRYPTION_KEY` and the
   `DEVICE_ACCESS_KEY_HASH` line, and run `scripts/deploy-prod.sh`.
4. Restore it:
   ```bash
   docker stop chronolog-prod-app
   scripts/restore-postgres.sh --replace <dump> chronolog
   docker start chronolog-prod-app
   ```
5. Sign in and spot-check recent notes and time entries.
6. The device access key is not in the dump: its hash lives in `.env.prod`. Browsers keep their
   cookie only while the hash is unchanged, so a restore onto the same `.env.prod` does not need
   `/unlock` again. If the hash has changed since the dump, rotate the key (above).
7. *(sprint 024)* API tokens are stored in the database, so they come back with the restore. Revoke
   any that belonged to lost devices.
