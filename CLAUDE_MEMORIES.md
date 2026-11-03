# Chronolog — Project Memories

> Portable export of cross-session memory, committed to the repo so it travels between machines
> (e.g. dev laptop ↔ remote machine). Last exported: 2026-05-26; direction updated 2026-11-03 (sprint 021-CL).
>
> ⚠️ Some entries are **machine-specific** (Docker context, DB host) and are flagged inline —
> verify them on each machine rather than assuming they carry over.

---

## Current Direction

- **Single account per instance** — multi-user/multi-tenant is not a requirement; do not reintroduce per-user partitioning.
- **PowerSync and the custom sync engine are both gone from `main`** (sprint 021-CL, 2026-11-03); git history keeps them (`powersync-spike`, `task-11-offline-sync`).
- **Production is fetch-mode only**: SvelteKit app + Postgres (`docker-compose.prod.yml`); registration is closed unless `ALLOW_REGISTRATION=true`.
- **Offline is deferred** to a future cache + outbox sprint; `docs/EPIC-OFFLINE-SYNC.md` is kept for history only.
- **`DataService` stays as the seam** — `FetchDataService` behind `DelegatingDataService` (`src/lib/services/`); a future offline backend implements the same interface.

---

## Tech Stack
- SvelteKit + Tauri 2.0 + Svelte 5 + TypeScript + Tailwind v4
- PostgreSQL via Drizzle ORM, Docker Compose for local dev
- Better Auth for authentication with TOTP 2FA

## Completed Tasks
- Task 1: Scaffolding (SvelteKit, Tauri, Tailwind v4, Drizzle, Docker)
- Task 2: Database schema (10 tables, modular files in `schema/`, relations, seed)
- Task 3: Auth (Better Auth, login/register, 2FA enrollment, auth guard)
- Task 4: Client/Contract/Deliverable CRUD (`/admin` routes, query modules, components)
- Task 5: Time entry recording (timer widget, API routes, cascading selects, daily view)
- Task 6: Weekly time overview (WeekHeader, DaySection, ISO week utils with 26 tests, weekly status)
- Task 6b: Three-panel layout (AppShell, ContractsSidebar, TimeEntriesPanel, mobile responsive; the WeekListPanel it added was removed in sprint 021-CL)
- Task 7: Note-taking with TipTap editor (NoteEditor, NoteListPanel, NoteEditorPanel, CRUD API)
- Task 8: Wiki-links & note linking (WikiLink extension, AnchoredHeading, backlinks index, time-entry linking)
- Task 9: File attachments (Image+FileHandler extensions, `chronolog://` URL resolver, attachment CRUD API, AttachmentList)
- Task 10: Storage abstraction (StorageAdapter, DexieAdapter, SqliteAdapter) — **removed in sprint 021-CL** (`src/lib/storage` deleted; offline will be redone as cache + outbox)
- Bugfix: User ID type mismatch (uuid→text for `users.id` and all `user_id` FKs, user sync hook, default Internal/General data)

## Architecture Notes
- Schema files split into `src/lib/server/db/schema/` (one per table)
- Relations in `src/lib/server/db/relations.ts`
- Auth schema separate: `src/lib/server/db/auth-schema.ts`
- Better Auth uses `adapter-auto` (not adapter-static) for server routes
- Better Auth `user` table has TEXT IDs; app `users` table also uses TEXT IDs (matched)
- User sync hook in `hooks.server.ts`: `ensureAppUser()` auto-creates app user + Internal client + General contract on first login
- Auth guard in `src/hooks.server.ts`; public routes: `/login`, `/register`, `/api/auth/*`
- Navigation state: Svelte 5 runes context in `src/lib/stores/navigation.svelte.ts`
- Layout: AppShell three-panel at `src/lib/components/layout/`
- API: contracts-by-client, time-entries/weekly, time-entries/weekly-statuses
- **DB connection**: `DATABASE_URL=postgresql://chronolog:chronolog@localhost:5432/chronolog` in
  `.env` (gitignored; `.env.example` lists every key). Docker Compose (`docker-compose.yml`) provides
  exactly these Postgres credentials. `BETTER_AUTH_SECRET` and `ENCRYPTION_KEY` are required — the
  app refuses to boot without them (no hard-coded fallback).

## Working Patterns
- Use git working trees in `.claude/worktrees/` for parallel branches
- Background agents for implementation, main agent as product manager
- Lock files (`.claude-session.lock`) in working trees
- Always run `npm install` after creating a new working tree
- `svelte-check` and `eslint` for verification before committing
- Single command for tests: `npm test` (vitest); type check: `npm run check`
- DB lifecycle: `docker compose up -d postgres` → `npm run db:migrate` → `npm run db:seed`
  (clean reset: `docker compose down -v` first)

## Sub-Agent Instructions (include in every implementation agent prompt)
- "Use the context7 MCP tools to look up library API docs before writing code that uses external
  libraries. Check `.claude/context7-registry.md` for cached context7 IDs. If the library isn't in
  the registry, use `resolve-library-id` first."
- Critical because sub-agents do the implementation but won't use context7 unless told explicitly.
  The main agent (product manager) doesn't write code, so it never naturally triggers doc lookups.

## Gotchas
- ⚠️ **Machine-specific**: On the original Mac, Docker needs `docker context use desktop-linux`.
  This machine uses OrbStack (provides the Docker daemon; `docker info` shows it). On the remote
  machine, verify which Docker provider/context is active rather than assuming either.
- Better Auth API routes need a catch-all `+server.ts`, not just hooks
- Drizzle migrations in `/drizzle` were initially gitignored — Task 2 unignored them
- Task 3 switched from adapter-static to adapter-auto (needed for server routes)
- `drizzle.config.ts` `schema` field needs an array with both the `schema/` dir and `auth-schema.ts`
- Drizzle barrel exports cause module eval-order issues with relations — import tables directly from
  their schema files in `relations.ts` and query files
- Use context7 proactively — check `.claude/context7-registry.md` for cached library IDs first
- Better Auth and app have SEPARATE user tables — `users.id` must be TEXT to match Better Auth
- App `users` table has NO `passwordHash` — Better Auth manages passwords in its own `account` table
- Tests that insert into `users` must provide an explicit text `id` (no default)
- **Migration `0003_curious_magma.sql` was rewritten 2026-05-26** to drop/re-add the four
  `*_user_id_users_id_fk` constraints around the uuid→text conversion. `db:migrate` + `db:seed` now
  run clean on a fresh DB (previously this migration only worked via manual SQL). General rule: when
  altering a column type that has FK constraints, DROP the constraints first, ALTER, then RE-ADD.
- Drizzle migration journal can get out of sync — may need manual registration with
  `INSERT INTO drizzle.__drizzle_migrations`

## Notes Editor — deferred work (see BACKLOG.md)
- Markdown export (editor already has `tiptap-markdown`; needs a download/save action)
- PDF export of notes
- Rich code-block syntax highlighting — NOT present today (StarterKit's plain code block, no
  `lowlight`); plan is `@tiptap/extension-code-block-lowlight` + `lowlight`
