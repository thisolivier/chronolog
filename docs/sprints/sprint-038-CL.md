# Sprint 038 — CL: Batch create and update for notes and time entries, `chronolog import`

**Status:** in progress
**Branch:** `sprint-038-CL/batch-import` · **Worktree:** `.claude/worktrees/sprint-038-CL` · **Port:** 5216
**Sources:** owner request 2026-11-04 (the laptop secretary is back-filling history one call at a time). Runs in parallel with 037 (note trash), which owns `queries/notes.ts`, the single-note routes, the wiki-link renderer and the CLI trash commands: **do not edit those files**; add new files and keep shared-file edits to one registration line each.

## Objective

One request creates or updates up to 200 notes, and one request creates up to 500 time entries, with a per-item result, so the secretary imports a month of history with one command per file.

## Tasks

1. **`POST /api/notes/batch`** (new file `src/routes/api/notes/batch/+server.ts`). Body `{ items: [...], atomic?: boolean }`, at most 200 items. Each item is either a create `{ contractId, title?, content?, createdAt? }` (same fields and validation as `POST /api/notes`, including the user-timezone backdating from 034) or an update `{ id, title?, content?, append?: string, expectedUpdatedAt? }` (same semantics as `PATCH /api/notes/[noteId]`; `append` adds a blank line and the text; without `expectedUpdatedAt` an update is applied unconditionally, and the response says so). Response `200 { results: [{ index, ok, id?, updatedAt?, error?, code? }], created, updated, failed }`. With `atomic: true`, run in one transaction and roll back on the first failure, returning that item's error plus `code: "batch_rolled_back"` for the others. Call the existing query functions (`createNoteForUser`, `updateNoteForUser`) rather than duplicating them; if you need a transaction-aware variant, add a thin wrapper in a **new** file `queries/notes-batch.ts`.
2. **`POST /api/time-entries/batch`** (new file). Items have the fields of `POST /api/time-entries` (contractId, date, duration or start/end, description, deliverableId?, workTypeId?, noteId?), at most 500, validated through `assertEntryReferences` (032) per item, same response shape and `atomic` option.
3. **CLI `chronolog import notes <file>` and `chronolog import entries <file>`** (new file `cli/commands/import.mjs`, one registration line in `cli/chronolog.mjs`). Input is JSON Lines or a JSON array. Items use the CLI's human references, not ids: `contract` (`ACME/Website`), `deliverable`, `workType`, `note` (note id), `date` (`YYYY-MM-DD`, `yesterday`, …), `duration` (the usual forms). The CLI resolves references once per distinct value (one `contracts --json` call, one deliverables call per contract touched), rejects the whole file before sending anything if any reference is ambiguous or unknown (exit 3 listing the bad lines), then sends in chunks of 100 (notes) or 200 (entries). `--dry-run` resolves and prints what would be sent. `--atomic` passes the flag through per chunk. Output: one line per item (`ok 12 ACME.20261004.003` / `fail 7 invalid_date …`), then a summary; `--json` prints the raw results. Exit 0 if all ok, 1 if any failed. Record created entries in the undo history as a list so `chronolog undo --last-import` deletes them all (confirm per the 031 rule).
4. **Docs and skill.** CLI readme, `cli/CHANGELOG.md` (1.1.0; bump `package.json` to 1.1.0), `docs/LAPTOP-SETUP.md` reference. Skill: a short "Importing history" paragraph (append to the end of `SKILL.md`, under 15 lines, to minimise merge conflicts with 037): build the file, show the owner the dry run, import, keep the file.
5. **Tests.** Unit: both routes (validation, per-item errors, atomic rollback, limits), the CLI resolver on a fixture file with one bad reference. API e2e: import 30 notes (some backdated, one update by id with append) and 60 entries from fixture files via the CLI, verify counts and that `week` shows them; `undo --last-import` removes the entries. No Playwright needed; the existing suite must stay green.

## Boundaries

New files only except: one line in `cli/chronolog.mjs`, one appended paragraph in the skill, the readme, changelog, `package.json` version, `docs/LAPTOP-SETUP.md`. Do not touch `queries/notes.ts`, `queries/time-entries.ts`, the single routes, the editor, or the sidebar.

## Working rules

Worktree only. Dev server port 5216 with `BETTER_AUTH_URL=http://localhost:5216` and `ALLOW_REGISTRATION=true`; shared dev Postgres 127.0.0.1:5432 (sprint 037 may add a `deleted_at` column meanwhile; that is fine), users `qa-038-*`, no reset, no seed. `npm run check` 0 errors, `npm test`, `npm run lint`, API e2e green; rebase onto `main` before sign-off. Do not merge.

## Verification

Transcript in `docs/review/screenshots/sprint-038/transcript.md` of a dry run, an import of notes and entries, and the undo. Sign-off with what was done, what was left, test counts.
