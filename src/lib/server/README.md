# Server Module

Server-side code for Chronolog, including authentication and database access.

## Architecture

### Authentication (`auth.ts`)

Uses [Better Auth](https://www.better-auth.com/) for authentication with the following configuration:

- **Email/password** authentication enabled
- **TOTP 2FA** via Better Auth's two-factor plugin (issuer: "Chronolog")
- **PostgreSQL** database via Drizzle adapter
- **30-day sessions** with daily refresh

The auth instance exports a `Session` type used for typing `event.locals` across the app.

### Database (`db/`)

- `db/index.ts` -- Drizzle ORM connection using `postgres` driver
- `db/schema.ts` -- Application schema (time entries, notes, clients, etc.)
- `db/auth-schema.ts` -- Better Auth schema (user, session, account, verification, two_factor tables)

### Auth Flow

1. `hooks.server.ts` populates `event.locals.session` and `event.locals.user` on every request
2. Unauthenticated users are redirected to `/login` for all non-public routes
3. Better Auth API routes are handled via a catch-all at `/api/auth/[...all]`
4. Public routes: `/login`, `/register`, `/api/auth/*`

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/server/auth.ts` | Better Auth server configuration |
| `src/lib/auth-client.ts` | Better Auth client (browser-side) |
| `src/hooks.server.ts` | Auth guard and session population |
| `src/routes/api/auth/[...all]/+server.ts` | Better Auth API route handler |
| `src/routes/login/+page.svelte` | Login page with 2FA support |
| `src/routes/register/+page.svelte` | Registration page |
| `src/routes/settings/two-factor/+page.svelte` | 2FA enrollment and management |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Secret for signing sessions (generate with `openssl rand -base64 32`) |
| `BETTER_AUTH_URL` | Base URL for the application (e.g., `http://localhost:5173`) |
