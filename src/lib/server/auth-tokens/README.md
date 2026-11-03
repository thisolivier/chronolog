# Auth Tokens

Personal API tokens let scripts and the laptop CLI call `/api/*` as a signed-in user, without a browser cookie. People create, list and revoke them at Settings, API tokens (`/settings/api-tokens`).

## Token Format

`clg_<32 hex>_<43 chars>`: the first part is the token row id without dashes, so lookup is a primary-key read. The second part is 32 random bytes, base64url. Only an scrypt hash of the secret is stored, in `api_tokens.token_hash`, in the same `scrypt:N:r:p:salt:hash` format as the device key. The raw token is returned once, at creation.

## Resolution Order (`hooks.server.ts`)

1. Device gate first: `X-Device-Key` or the device cookie. A failure on `/api/*` is 401 `device_not_authorised` or 429 `device_locked`.
2. Bearer token: `Authorization: Bearer clg_…` on `/api/*` except `/api/auth/*`. It sets `locals.user` and `locals.session = null`, and the cookie session is not read.
3. Cookie session (Better Auth), as before. No session on `/api/*` gives 401 `unauthorized`.

## Responses

| Status | Code | When |
|--------|------|------|
| 401 | `invalid_token` | Wrong format, unknown id, or wrong secret |
| 403 | `token_revoked` | The row has `revokedAt` set (checked on every request) |
| 429 | `rate_limited` | The per-IP failure window is full; valid tokens are refused too |
| 403 | `session_required` | Token used on `/api/tokens`: managing tokens needs a browser session |

Failures are counted per client IP: 60 per minute, in memory per process. Bad tokens share this limit with failed sign-ins and 2FA checks on `/api/auth/sign-in` and `/api/auth/two-factor/`. `last_used_at` is written at most once a minute. Revoking keeps the row, so the token answers 403 rather than 401.

## Modules

| File | Purpose |
|------|---------|
| `token-format.ts` | Generate, parse and verify tokens; read the Bearer header (pure) |
| `resolve-token.ts` | Resolution with injected storage: valid, revoked or invalid; last-used throttle |
| `token-store.ts` | Database access: create, list, revoke; wires the resolver to the table |
| `bearer.ts` | `authenticateBearer` for the hook: limiter, error responses, sets `locals.user` |
| `failure-limiter.ts` | Sliding-window failure counter per IP |

Every `/api/*` response outside `/api/auth` uses the shape `{ error, code, message }` (`src/lib/server/api-errors.ts`). `message` repeats `error` for the UI's fetch helpers.
