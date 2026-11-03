# Sprint 028 — CL: API tokens, CLI and the laptop skill

**Status:** ready for review (not merged)
**Branch:** `sprint-028-CL/api-token-cli-skill` · **Worktree:** `.claude/worktrees/sprint-028-CL` · **Port:** 5206
**Sources:** `docs/decisions.md` ("Laptop Claude access"), `docs/ONBOARDING.md`, `docs/sprints/sprint-023-CL.md` (device key header), BACKLOG.md Task 12 (the MCP idea, deferred).

## Objective

A Claude Code session on the owner's laptop can log time, write notes and read the week for any client
through Chronolog's REST API, using a long-lived personal API token plus the device key header, with a
small CLI and a project skill that teaches Claude the workflow. No MCP server.

## Tasks

1. **Personal API tokens.** Check whether Better Auth's API-key plugin fits (context7); otherwise a
   `api_tokens` table (id, user_id, name, token_hash, created_at, last_used_at, revoked_at) with scrypt
   hashes. `Authorization: Bearer <token>` on `/api/*` resolves to the user exactly like a session.
   Tokens are created, listed and revoked on the `/settings` page; the raw token is shown once.
2. **API hygiene for machine clients.** Every `/api/*` route returns JSON errors with a stable shape
   (`{ error, code }`), 401 for missing auth, 403 for revoked tokens, 429 after 60 failures per minute
   per IP on the auth paths. `GET /api/me` returns the user, today's date in the user's timezone, and
   the current ISO week. `GET /api/time-entries?from=&to=` and `GET /api/notes?contractId=&updatedSince=`
   exist or are extended so a client never needs the UI's week-shaped endpoints.
3. **CLI** at `cli/chronolog.mjs` (Node, no new deps, runnable with `npx` from the repo or installed
   globally): `clients`, `contracts [client]`, `week [iso-week]`, `log <contract> <duration> "<desc>"
   [--date] [--deliverable] [--note <id>]`, `note new <contract> "<title>"` (reads body from stdin or
   `--file`), `note show <id>`, `notes <contract> [--since]`, `search "<q>"`, `status <iso-week> <state>`.
   Config from `~/.config/chronolog/config.json` (`baseUrl`, `apiToken`, `deviceKey`) or env vars;
   `chronolog init` writes it after prompting. Human-readable output by default, `--json` for Claude.
4. **Project skill** at `.claude/skills/chronolog-secretary/SKILL.md`: when to use the CLI, how to find
   the right contract, how to log time with a note reference, how to write a status note, how to
   summarise a client's week, the duration formats, and the rule that it never guesses a contract. Keep
   it under 150 lines. Add a copy-ready section to `docs/ONBOARDING.md` for "new laptop" (install, init,
   first call).
5. **Tests:** token hashing and lookup, bearer resolution in hooks, revoked token 403, CLI commands
   against the API e2e harness (`src/e2e/`).

## Boundaries
Owns `src/hooks.server.ts` (bearer resolution only, after the device gate), `src/lib/server/auth*`,
`src/lib/server/db/schema/api-tokens.ts` + migration, `src/routes/api/me`, `src/routes/api/tokens`,
`src/routes/settings/**`, `cli/`, `.claude/skills/chronolog-secretary/`, docs named above. Sprint 027
(navigation) is running in parallel and owns the navigation store, routes under `src/routes/(app)` or
equivalent, AppShell and panels; do not touch those. Rebase onto main when 027 lands.

## Verification
check 0 errors, tests green, lint clean; a transcript in `docs/review/screenshots/sprint-028/` showing:
create a token in settings, `chronolog init`, `chronolog clients`, `chronolog log … --note …`, the
entry visible in the UI with the note linked, `chronolog note new` then the note visible, revoke the
token and the next call getting 403. Never print token or key values.

## Sign-off

**2026-11-03, implemented on `sprint-028-CL/api-token-cli-skill` (not merged).**

**Token design.** I did not use Better Auth's API-key plugin. In 1.4 it ships inside
`better-auth/plugins`, and current docs move it to a separate `@better-auth/api-key` package, so
adopting it means a migration later. It needs a 21-column `apikey` table and a per-key rate limit
that defaults to 10 requests a day and has to be switched off. A revoked (disabled) key and an
unknown key also fail the same way unless you map its error codes. Instead there is a small
`api_tokens` table (`id, user_id → user.id, name, token_hash, created_at, last_used_at,
revoked_at`, migration `0008_api_tokens.sql`). The token is `clg_<row id hex>_<32 random bytes
base64url>`. Only the scrypt hash of the secret is stored, using the device key's primitives, so the
lookup is a primary-key read. A verified token is memoised per process, so scrypt runs once.
Revocation is read from the row on every request. Tokens are created, listed and revoked at
`/settings/api-tokens` (the raw token is shown once). Managing tokens needs a browser session: a
bearer token gets 403 `session_required` on `/api/tokens`.

**Hooks order.** Device gate, then `Authorization: Bearer` on `/api/*` (not `/api/auth/*`), which
sets `locals.user` and `locals.session = null`, then the cookie session as before. Every `/api/*`
response outside Better Auth's own routes is normalised to `{ error, code, message }` (`message`
stays because the UI reads it). Codes: 401 `unauthorized` / `invalid_token` /
`device_not_authorised`, 403 `token_revoked`, 429 `rate_limited`. Bad tokens, failed sign-ins and
failed 2FA checks share a per-IP limit of 60 failures a minute.

**API.** `GET /api/me` returns the user, how the request was authenticated, and `today`, `isoWeek`,
`weekStart` and `weekEnd` in the caller's timezone (`?tz=` or `X-Timezone`; the CLI sends the
laptop's). `GET /api/time-entries?from=&to=[&contractId=]`. `GET /api/notes` now takes optional
`contractId` and `updatedSince`, returns `title`/`displayTitle`, and previews notes that have only
markdown (otherwise a CLI note shows as "Untitled" in the list). `POST /api/time-entries` accepts
`duration` (the UI's parser) and `noteId` (checked, then linked as `[[id]]`, the app's own linking
mechanism). Week status values are validated.

**CLI** `cli/chronolog.mjs` (bin `chronolog`, Node 20+, no dependencies): `init`, `me`, `clients`,
`contracts`, `week`, `log`, `note new`, `note show`, `notes`, `search`, `status`, with `--json`.
Exit codes: 2 usage, 3 unknown or ambiguous reference, 4 auth, 5 conflict, 6 rate limited. A
contract reference is resolved only when it matches exactly one contract. Otherwise the CLI exits 3
and lists the candidates.

**Skill** `.claude/skills/chronolog-secretary/SKILL.md` (113 lines). `docs/ONBOARDING.md` has the
"New laptop CLI" section.

**Verification.** `docs/review/screenshots/sprint-028/transcript.md` plus screenshots 01-06, run
with the device gate on. Results: check 0 errors, 504 unit tests green, lint clean, e2e 64/64,
checklist driver 65/0.

**Outside the listed boundaries (small, API-only):** `src/routes/api/time-entries/+server.ts`,
`src/routes/api/notes/+server.ts`, `.../weekly-statuses/+server.ts`, and query helpers in
`db/queries/{notes,time-entries}.ts`, all required by Task 2. Also `package.json` (`bin`),
`vite.config.ts` (CLI tests included in `npm test`), `src/hooks.server.test.ts` (old exact-body
assertions updated, bearer cases added), and `src/lib/server/README.md`. No navigation, AppShell or
panel files were touched.

**Follow-ups.**
- Opening a CLI note in the editor autosaves it as TipTap JSON. This is harmless, but the first
  open counts as an edit.
- `getNextNoteId` stamps note ids with the UTC date, so evening notes on the laptop get tomorrow's
  date (this was already the case).
- `POST /api/notes` and `POST /api/time-entries` do not check that the contract belongs to the user
  (this was already the case; the instance has one user).
- The failure limiter is in memory and per process. Better Auth's own rate limit is still only on
  in production.
- The CLI cannot edit or delete entries (corrections are made in the app). Candidates: `chronolog
  edit` or `chronolog undo`.
- The ONBOARDING restore section still mentions sprint 024.
