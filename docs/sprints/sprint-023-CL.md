# Sprint 023 — CL: Device access key gate and encryption at rest

**Status:** active
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

_Fill in._
