# Sprint 037 — CL: Server-side trash for notes; word count on create

**Status:** in progress
**Branch:** `sprint-037-CL/note-trash` · **Worktree:** `.claude/worktrees/sprint-037-CL` · **Port:** 5215
**Sources:** owner request 2026-11-04; sprint 034 sign-off (restored notes get a new ID, links dangle; CLI notes store word count 0); backlog journeys A-10 (wiki-links to deleted notes do nothing).

## Objective

Deleting a note, from the browser or the CLI, moves it to a server-side trash where it keeps its ID, its wiki-links, its backlinks and its time-entry links. Restoring brings everything back exactly. Trash empties itself after 30 days. A note created over the API has a correct word count from the start.

## Design (decided)

- `notes.deleted_at timestamptz null`, with a partial index on `(user_id) where deleted_at is not null`. One Drizzle migration. No rows are ever hard-deleted by the app except by the purge.
- Every read query that lists, searches, titles, previews, autocompletes or resolves a note excludes `deleted_at is not null` unless a caller passes `includeDeleted`. Audit `queries/notes.ts`, `queries/note-links.ts`, the search and titles routes, the backlinks route and the time-entry "linked notes" reads; list each one in the sign-off.
- `note_links` and `note_time_entries` rows are left alone on delete, so restore is a single `update ... set deleted_at = null`. The wiki-link renderer treats a link to a trashed note as a muted "deleted" link that, on click, offers to restore it (a small inline confirm); the backlinks panel hides trashed sources.
- Purge: `deleteNoteForUser` (now a soft delete) also hard-deletes this user's rows with `deleted_at` older than 30 days, in the same transaction, cascading links. No scheduler. `scripts/purge-note-trash.mjs` exists for a manual run and is documented.
- The CLI's local trash files from sprint 034 are dropped: `note delete` calls the API, prints the ID and "restore with `chronolog note restore <id>` within 30 days". `note restore <id>` calls `POST /api/notes/[noteId]/restore`; with no id it lists the server trash (`GET /api/notes/trash`). Remove the trash-file code and its tests; migrate nothing (the files, if any, stay on disk and are mentioned in the readme once).
- `POST /api/notes` computes `word_count` from `contentJson` when present, else from markdown (`calculateWordCountFromMarkdown` already exists from 034).

## Tasks

1. Migration, schema, and the read-path audit with tests proving trashed notes are invisible to list, search, titles, backlinks and the week's linked notes.
2. `DELETE /api/notes/[noteId]` soft-deletes and purges; `POST /api/notes/[noteId]/restore` (404 if not trashed or not yours; 409 `id_taken` cannot happen since the row keeps its ID, but a restore onto an archived contract is allowed and reported); `GET /api/notes/trash` lists id, title, contract, deletedAt, purge date. The browser's Delete button uses the same route and the editor panel shows a short "Moved to trash. Undo" toast for ten seconds that calls restore (keep it small; it lives in `NoteEditorPanel.svelte`).
3. CLI changes per the design; skill: replace the trash-path line with the 30-day rule (stay under 200 lines); CLI readme, `docs/LAPTOP-SETUP.md` reference, `cli/CHANGELOG.md` entry.
4. Wiki-link rendering for trashed targets (A-10) and the inline restore; backlinks hide trashed sources.
5. Word count on create (API). Backfill existing rows with `word_count = 0` and non-empty content with `scripts/backfill-note-word-counts.mjs`. **It must run inside the production container**: `docker exec chronolog-prod-app node scripts/backfill-note-word-counts.mjs --dry-run` then `--apply`. The image copies only `scripts/migrate.mjs` (Dockerfile line 41) and has no `src/`, so the script is plain `.mjs` with no `.ts` imports: it uses the `postgres` package and Node `crypto` to open the `enc1:` envelope (copy the envelope logic from `scripts/encrypt-existing.mjs` into a shared `scripts/lib/envelope.mjs` and make `encrypt-existing.mjs` import it too), counts words from `content_json` when present else from `content` with the same rules as the app (port the two counters; unit-test that they agree with the TypeScript ones on fixtures), and updates `word_count` only. Add the script and `scripts/lib/` and `scripts/purge-note-trash.mjs` to the Dockerfile's copied files. `--dry-run` prints the count and five sample IDs; `--apply` prints the count updated. Run it on dev and report the count.
6. Tests: unit for every route and the purge window; API e2e: create via CLI (word count > 0), link note B to A, delete A, B's render shows "deleted", restore A, links intact, time-entry link intact; Playwright: delete in the browser, Undo toast restores, and the sidebar/list reflect both.

## Boundaries

Owns `drizzle/` (one migration), `src/lib/server/db/schema/notes.ts`, `queries/notes.ts`, `queries/note-links.ts`, `src/routes/api/notes/**`, the wiki-link renderer and backlinks components under `src/lib/components/notes/**`, the Delete/Undo in `NoteEditorPanel.svelte`, `cli/**`, the skill, docs named, two scripts. Sprint 036 must be merged first (it edits the CLI and the notes extensions); if 035 is still running it owns `src-tauri/**` and the timer store only.

## Working rules

Worktree only. Dev server port 5215 with `BETTER_AUTH_URL=http://localhost:5215` and `ALLOW_REGISTRATION=true`; shared dev Postgres 127.0.0.1:5432 (the migration runs against it; it is additive and safe for the other worktree), users `qa-037-*`, no reset, no seed. `npm run check` 0 errors, `npm test`, `npm run lint`, API e2e and Playwright green; rebase onto `main` before sign-off. Do not merge.

## Verification

Transcript in `docs/review/screenshots/sprint-037/transcript.md` of the e2e sequence through the CLI, a screenshot of a "deleted" wiki-link and of the Undo toast. Sign-off with the read-path audit list, what was done, what was left, test counts, the dev backfill count.
