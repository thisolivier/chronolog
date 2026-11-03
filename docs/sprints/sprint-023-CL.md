# Sprint 023 — CL: Device access key gate and encryption at rest

**Status:** signed-off
**Type:** Client/Server — security
**Depends on:** 019, 020, 021, 022 (all merged)
**Branch:** `sprint-023-CL/device-key-and-encryption`
**Worktree:** `.claude/worktrees/sprint-023-CL`
**Source of truth:** `docs/decisions.md` (2026-11-03 security posture), `docs/SPEC.md` security section,
`docs/review/2026-11-03-code-state.md` §1 "Auth, security, data protection"

## Objective

Two of the three gates from the decisions log. After this sprint, a stranger on the internet sees a
401 wall, and a database dump contains ciphertext for every sensitive field.

## Part A — Device access key

1. **Key and hash.** `scripts/generate-device-key.mjs` prints a 32-byte base64url key and its
   `scrypt` hash (node:crypto, no new deps) in the form the env expects. Env var
   `DEVICE_ACCESS_KEY_HASH`. In production (`NODE_ENV=production`) it is required at boot; in
   development, if unset the gate is disabled with a loud boot warning.
2. **Check in the hooks**, before session lookup and before the public-route allowlist: accept
   `X-Device-Key: <raw key>` (compared via scrypt, constant-time) or the cookie set by the unlock
   page. Unauthorised page requests redirect to `/unlock`; unauthorised `/api/*` get 401 JSON.
   Exempt: `/unlock` (GET and POST), the static assets the unlock page needs, `/manifest.webmanifest`
   and the service worker file. Nothing else.
3. **Unlock page** at `/unlock`: one input, one button, minimal styling consistent with the login
   page. On success set an HttpOnly, `Secure` (when the request is https), `SameSite=Lax` cookie
   `chronolog_device` holding an HMAC of the key with the hash as HMAC key, 365-day expiry, then
   redirect to `/`. The raw key is never stored in the cookie.
4. **Lockout and logging:** per client IP (use `CF-Connecting-IP` when present, else the socket
   address) 5 failures → 15-minute lock, in-memory map; every failure and every lockout logged with
   IP and path. Successful unlocks logged once.
5. **Docs:** fill the device-key sections of `docs/ONBOARDING.md` (new browser, laptop CLI via the
   header, Tauri via the header, rotating the key), add the env var to `docs/DEPLOYMENT.md`,
   `.env.example`, `.env.prod.example`, and the deploy script's pre-flight.

## Part B — Encryption at rest

6. **Envelope:** AES-256-GCM via node:crypto. Key from `ENCRYPTION_KEY` (base64, 32 bytes; validate
   length at boot in `env.ts`). Per-value random 12-byte IV. Stored form is a prefixed string
   `enc1:<iv b64>:<tag b64>:<ciphertext b64>` so text columns stay text, plaintext rows are
   recognisable (no prefix), and a future `enc2` can coexist. Attachment bytes use the same envelope
   on the `bytea` column.
7. **Fields:** note `content`, `content_json`, `title`; time entry `description`; contract `name`,
   `description`; client `name`; attachment `data` and `filename`. Put encrypt/decrypt in one module
   (`src/lib/server/crypto/field-encryption.ts`) and apply it in the query modules, never in routes
   or components.
8. **Search over encrypted fields:** notes search, wiki-link autocomplete, backlink title lookups and
   any `ILIKE` on an encrypted column move to "load the user's rows, decrypt, filter in memory". Keep
   the API contracts unchanged. Note IDs (`INTL.2026…`) stay plaintext; they are structure, not content.
9. **Migration:** `scripts/encrypt-existing.mjs` walks every table and encrypts plaintext values
   (idempotent thanks to the prefix); document it as the one-time step for a database that predates
   this sprint. Fresh production needs nothing.
10. **Tests:** round-trip, tamper detection (modified tag fails), wrong key fails, prefix detection,
    search over encrypted notes, and the existing query tests still passing against Postgres.
11. **Docs:** `docs/DEPLOYMENT.md` key generation and the warning that losing the key loses the data;
    `docs/ONBOARDING.md` restore section mentions the key; backlog entry for key rotation.

## Boundaries

Do NOT edit Svelte components under `src/lib/components/` except to add the unlock page under
`src/routes/unlock/`. Do NOT change API shapes. A UX fix sprint runs in parallel and owns the
components; if a component must change for search (unlikely), note it as a follow-up.

## Verification

- `npm run check` 0 errors, `npm test` green with Postgres, `npm run build` green.
- Real UI on port 5197 (`BETTER_AUTH_URL=http://localhost:5197 ALLOW_REGISTRATION=true` with a
  generated hash): fresh browser → `/` redirects to `/unlock`; wrong key five times → locked, logged;
  right key → cookie set → login page → full login → app works; reload keeps the unlock; `curl`
  without key → 401 on `/api/clients`, with `X-Device-Key` header → 401 Unauthorized from auth (not
  the gate). Screenshots and transcripts into `docs/review/screenshots/sprint-023/`.
- `psql` transcript showing `enc1:` prefixes in `notes.content`, `time_entries.description`,
  `contracts.name`, `clients.name` after creating data through the UI, and the UI still showing
  plaintext; notes search and `[[` autocomplete still find notes by content.
- Run `scripts/encrypt-existing.mjs` against the dev database and show it idempotent.

## Sign-off

**Status:** signed-off 2026-11-03 on branch `sprint-023-CL/device-key-and-encryption` (not merged).

### What changed

- **Device gate** (`src/lib/server/device-gate/`): `device-key.ts` (pure: key generation, scrypt hash
  `scrypt:N:r:p:salt:hash` with colons so dotenv/compose never expand it, constant-time verify, cookie
  HMAC), `lockout.ts` (per-IP, 5 failures → 15 min, in memory), `gate.ts` (`enforceDeviceGate` runs
  first in `hooks.server.ts`; exempt `/unlock`, `/_app/*`, `/manifest.webmanifest`, `/sw.js`; exempt
  paths also skip the session lookup, so a locked-out device never causes a DB query). Header checks
  memoise a SHA-256 fingerprint of a verified key so scrypt runs once per key per process.
- **Unlock page** `src/routes/unlock/` (plain form POST, login-page styling); cookie
  `chronolog_device`, HttpOnly, SameSite=Lax, Secure on https, 365 days. Logs: every failure, every
  lockout, each successful unlock, with IP + path only.
- **Env** (`env.ts`): `ENCRYPTION_KEY` must be base64 of 32 bytes; `DEVICE_ACCESS_KEY_HASH` required
  when `NODE_ENV=production`, malformed hash rejected; dev without it boots with a loud warning.
- **Encryption** (`src/lib/server/crypto/`): `field-encryption.ts` pure AES-256-GCM envelope
  (`encrypt`/`decrypt`/`isEncrypted`/`encryptBytes`/`decryptBytes`), errors name `table.column`;
  `server-cipher.ts` binds it to the env key. Applied only in query modules: clients, contracts,
  time-entries, notes, note-links, attachments, and the new `queries/app-user.ts` (ensureAppUser
  moved out of hooks; its default Internal/General names are encrypted). Contract list queries moved
  from `api/contracts` and `api/contracts-by-client` routes into `queries/contracts.ts` (API shapes
  unchanged). Name ordering is now in memory (`localeCompare`); notes search / `[[` autocomplete /
  backlinks decrypt in memory, search still newest-first by `updated_at` and capped at `limit`.
- **Scripts:** `scripts/generate-device-key.mjs`, `scripts/encrypt-existing.mjs` (one transaction,
  idempotent, `--dry-run`, refuses to run when existing ciphertext does not open with the given key).
  Both import the pure `.ts` modules via Node's type stripping (Node 22.18+).
- **Config/docs:** `.env.example`, `.env.prod.example`, `docker-compose.prod.yml` (`:?` guard),
  `scripts/deploy-prod.sh` pre-flight, `docker-compose.yml` dev key replaced with a valid 32-byte dev
  value, `docs/DEPLOYMENT.md`, `docs/ONBOARDING.md`, `docs/backlog.md` (IF-4 key rotation, IF-5 device
  key tooling), `src/lib/server/README.md`, `scripts/readme.md`.

### Deviations from the spec (deliberate)

- **Cookie value:** the spec says "HMAC of the key with the hash as HMAC key". The server never holds
  the raw key after unlock, so it could not re-verify such a cookie. The cookie is
  HMAC-SHA256(key = configured hash, message = fixed label): verifiable from the hash alone, holds
  neither key nor hash, and every cookie dies when the key is rotated.
- **Attachment bytes envelope** is the binary form of the same envelope (`enc1:` bytes + IV + tag +
  ciphertext) rather than base64 text, to avoid a 33% size increase on `bytea`.
- **`/_app/*`** is exempt (the unlock page's JS/CSS). In production adapter-node serves static files
  before hooks anyway; they contain no data.

### Verification

- `npm run check`: 0 errors (23 pre-existing warnings, none in changed files). `npm test`: 29 files,
  **335 passed** against Postgres (new: `field-encryption.test.ts` 11, `device-key.test.ts` 6,
  `encryption-at-rest.test.ts` 4, hooks gate 6, env 4). `npm run build`: green.
- Transcripts and screenshots in `docs/review/screenshots/sprint-023/`:
  - `01-prod-boot-requires-hash.txt`: production build refuses to boot without the hash.
  - `02-curl-gate.txt`: no key → 401 `Device not authorised` on `/api/clients` (and `/api/auth/*`);
    with `X-Device-Key` → 401 `Unauthorized` from the auth guard; pages 303 → `/unlock` / `/login`.
  - `03-unlock-page.png`, `04a-wrong-key.png`, `04b-locked-out.png`, `05-login-after-unlock.png`,
    `06-app-after-login.png`, `07-after-reload.png`, `03-unlock-lockout-login-transcript.txt`: fresh
    browser → `/unlock`; five wrong keys → locked (6th also locked), logged with IP + path; right key
    → cookie (HttpOnly, Lax, 365 d, no key in value) → `/login`; register + full email/password login
    in a browser holding only the device cookie → app; reload keeps the unlock. The wrong-key browser
    used a simulated `CF-Connecting-IP` so the local IP was not locked for the rest of the run.
  - `08`–`11` PNGs: client, contract, note and time entry created through the UI render plaintext;
    `[[wombat licensing` (note body text, not title) offers the note in autocomplete.
  - `12-psql-ciphertext.txt`: `enc1:` in `clients.name`, `contracts.name/description`,
    `time_entries.description`, `notes.title/content/content_json`; note IDs plaintext; SQL `ILIKE
    '%wombat%'` finds 0 rows while `/api/notes/search` finds the note by content.
  - `13-encrypt-existing-idempotent.txt`: dry run, run (274 values), second run (0), wrong key refused
    with nothing changed, 0 plaintext rows left, 299 values decrypt with the app module. Run on a
    `pg_dump` clone of the shared dev DB (dropped afterwards), not on `chronolog` itself, because other
    sessions' dev servers on pre-023 code share that database and would have read ciphertext.

### Follow-ups

1. **Before merging/running on main:** the main checkout's `.env` `ENCRYPTION_KEY` is not base64 of 32
   bytes (39 chars) and will now fail boot. Replace it with `openssl rand -base64 32` output, then run
   `node --env-file=.env scripts/encrypt-existing.mjs` on the dev DB once all sessions are on 023 code.
   QA rows created in this sprint (`qa-023-*@chronolog.test`) are encrypted with this worktree's key
   and will not decrypt under a different key; delete that user's data or reuse the worktree key.
2. `npm run db:seed` still writes plaintext (reads fine; run `encrypt-existing.mjs` after seeding).
3. Running `encrypt-existing.mjs` against production Postgres (no host port) has no tested route yet;
   not needed for the fresh production DB.
4. Notes created in the editor store an empty `title` (existing behaviour); autocomplete shows the note
   ID only. UX sprint territory.
5. `GET /api/attachments/:id` sends `Cache-Control: public, max-age=31536000`; with a gate in front,
   `private` would be more appropriate (Cloudflare must not cache decrypted attachments).
6. Key rotation (IF-4) and per-device keys (IF-5) are on the backlog. Cloudflare rate-limit rules on
   `/unlock` and `/api/auth/*` still need to be configured in the dashboard.
