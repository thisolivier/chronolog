# Sprint 028 — CL: API tokens, CLI and the laptop skill

**Status:** active
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
_Fill in._
