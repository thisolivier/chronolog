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

### Database (`db/`)

- `db/index.ts` -- Drizzle ORM connection using `postgres` driver
- `db/schema.ts` -- Application schema (time entries, notes, clients, etc.)
- `db/auth-schema.ts` -- Better Auth schema (user, session, account, verification, two_factor tables)

### Auth Flow

1. `hooks.server.ts` populates `event.locals.session` and `event.locals.user` on every request
2. Unauthenticated page requests are redirected (303) to `/login`; unauthenticated `/api/*`
   requests get `401 { "error": "Unauthorized" }`
3. A throwing `auth.api.getSession` is logged and treated as "no session"
4. Better Auth API routes are handled via a catch-all at `/api/auth/[...all]`
5. Public routes: `/login`, `/register`, `/api/auth/*`

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/server/auth.ts` | Better Auth server configuration |
| `src/lib/server/env.ts` | Runtime env validation (fail-fast on missing secrets) |
| `src/lib/auth-client.ts` | Better Auth client (browser-side) |
| `src/hooks.server.ts` | Auth guard and session population |
| `src/routes/api/auth/[...all]/+server.ts` | Better Auth API route handler |
| `src/routes/login/+page.svelte` | Login page with 2FA support |
| `src/routes/register/+page.svelte` | Registration page (shows "closed" message unless allowed) |
| `src/routes/settings/two-factor/+page.svelte` | 2FA enrollment and management |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Required. Secret for signing sessions (generate with `openssl rand -base64 32`) |
| `ENCRYPTION_KEY` | Required. 256-bit key for encryption at rest |
| `BETTER_AUTH_URL` | Base URL for the application (default `http://localhost:5173`); always a trusted origin |
| `ALLOW_REGISTRATION` | `true` opens sign-up; anything else closes it (default closed) |
| `TRUSTED_ORIGINS` | Optional comma-separated extra origins for Better Auth CSRF checks (e.g. a Tailscale IP) |
