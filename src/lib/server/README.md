# Server Module

Server-side code for Chronolog, including authentication and database access.

## Architecture

### Authentication (`auth.ts`)

Uses [Better Auth](https://www.better-auth.com/) for authentication with the following configuration:

- **Email/password** authentication enabled; sign-up is disabled unless `ALLOW_REGISTRATION=true`
- **TOTP 2FA** via Better Auth's two-factor plugin (issuer: "Chronolog")
- **PostgreSQL** database via Drizzle adapter
- **30-day sessions** with daily refresh

The auth instance exports a `Session` type used for typing `event.locals` across the app.

### Environment (`env.ts`)

Server-only module that reads `$env/dynamic/private` at runtime (not build time).
`getServerEnvironment()` parses the variables once and throws a clear Error naming any missing
required secret; `hooks.server.ts` calls it at module scope so a misconfigured server refuses to boot.
During `vite build` the secrets are optional (the Docker image is built without a `.env`).
`parseServerEnvironment()` is the pure, testable core.

### Field encryption (`crypto/`)

- `crypto/field-encryption.ts` -- pure AES-256-GCM envelope, `enc1:<iv>:<tag>:<ciphertext>` (base64
  parts). Values without the prefix read through as plaintext, so pre-023 rows still load.
- `crypto/server-cipher.ts` -- key-bound helpers that read the key from `env.ts`. Only the query
  modules in `db/queries/` import it.

Encrypted: notes title/content/content_json, time entry description, contract name/description,
client name, attachment filename and bytes. Notes search and `[[` autocomplete decrypt in memory,
so there is no SQL ILIKE on encrypted columns.

### Device access gate (`device-gate/`)

- `device-gate/device-key.ts` -- key generation, scrypt hashing and constant-time verification of
  `DEVICE_ACCESS_KEY_HASH`, and the HMAC unlock cookie value (keyed by the hash).
- `device-gate/lockout.ts` -- in-memory per-IP lockout: 5 wrong keys lock the IP for 15 minutes.
  Resets on restart.
- `device-gate/gate.ts` -- the check `hooks.server.ts` runs before the session lookup. Accepts the
  `X-Device-Key` header or the `chronolog_device` cookie; exempt paths are `/unlock`, `/_app/*`,
  the manifest and `sw.js`.

### API tokens and error shape (`auth-tokens/`, `api-errors.ts`)

- `auth-tokens/` -- personal API tokens for the CLI (sprint 028-CL): `clg_<id>_<secret>`, scrypt
  hash in `api_tokens`, `Authorization: Bearer` resolved in `hooks.server.ts` after the device gate,
  401 `invalid_token` / 403 `token_revoked` / 429 `rate_limited`. See `auth-tokens/README.md`.
- `api-errors.ts` -- every `/api/*` error outside `/api/auth` is `{ error, code, message }`.

### Database (`db/`)

- `db/index.ts` -- Drizzle ORM connection using `postgres` driver
- `db/schema.ts` -- Application schema (time entries, notes, clients, etc.)
- `db/auth-schema.ts` -- Better Auth schema (user, session, account, verification, two_factor tables)

### Auth Flow

1. `hooks.server.ts` runs the device gate first (`device-gate/gate.ts`): a request without a valid
   device key or cookie gets a 303 to `/unlock` (pages) or `401 { "error": "Device not authorised" }` (`/api/*`)
2. On `/api/*` (not `/api/auth/*`) an `Authorization: Bearer` API token sets `event.locals.user`
   (`session` stays null) and skips the cookie lookup
3. Otherwise `hooks.server.ts` populates `event.locals.session` and `event.locals.user` from the cookie
4. Unauthenticated page requests are redirected (303) to `/login`; unauthenticated `/api/*`
   requests get `401 { "error", "code": "unauthorized" }`
3. A throwing `auth.api.getSession` is logged and treated as "no session"
4. Better Auth API routes are handled via a catch-all at `/api/auth/[...all]`
5. Public routes: `/login`, `/register`, `/api/auth/*`

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/server/auth.ts` | Better Auth server configuration |
| `src/lib/server/env.ts` | Runtime env validation (fail-fast on missing secrets) |
| `src/lib/server/crypto/field-encryption.ts` | AES-256-GCM envelope for fields at rest (pure) |
| `src/lib/server/crypto/server-cipher.ts` | Key-bound encrypt/decrypt helpers for the query modules |
| `src/lib/server/device-gate/gate.ts` | Device key check run by `hooks.server.ts` before the session lookup |
| `src/lib/server/device-gate/device-key.ts` | Device key generation, hashing, verification and unlock cookie |
| `src/lib/server/device-gate/lockout.ts` | Per-IP wrong-key lockout (in memory) |
| `src/lib/auth-client.ts` | Better Auth client (browser-side) |
| `src/hooks.server.ts` | Device gate, bearer tokens, auth guard, session population, API error shape |
| `src/lib/server/auth-tokens/token-store.ts` | Create, list, revoke API tokens; resolver wired to the table |
| `src/routes/settings/api-tokens/+page.svelte` | Create (shown once), list and revoke API tokens |
| `src/routes/api/auth/[...all]/+server.ts` | Better Auth API route handler |
| `src/routes/login/+page.svelte` | Login page with 2FA support |
| `src/routes/register/+page.svelte` | Registration page (shows "closed" message unless allowed) |
| `src/routes/settings/two-factor/+page.svelte` | 2FA enrollment and management |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Required. Secret for signing sessions (generate with `openssl rand -base64 32`) |
| `ENCRYPTION_KEY` | Required. Base64 of exactly 32 bytes (`openssl rand -base64 32`) for encryption at rest; validated at boot. Losing it loses the encrypted data |
| `DEVICE_ACCESS_KEY_HASH` | Required when `NODE_ENV=production`. scrypt hash of the device access key (`node scripts/generate-device-key.mjs`). Unset in development disables the gate with a boot warning |
| `BETTER_AUTH_URL` | Base URL for the application (default `http://localhost:5173`); always a trusted origin |
| `ALLOW_REGISTRATION` | `true` opens sign-up; anything else closes it (default closed) |
| `TRUSTED_ORIGINS` | Optional comma-separated extra origins for Better Auth CSRF checks (e.g. a Tailscale IP) |
