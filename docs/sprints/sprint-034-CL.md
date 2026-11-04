# Sprint 034 — CL: CLI edits and deletes notes

**Status:** in progress
**Branch:** `sprint-034-CL/cli-note-edit-delete` · **Worktree:** `.claude/worktrees/sprint-034-CL` · **Port:** 5212
**Sources:** owner request 2026-11-04; sprint 028 (CLI, `note new`, `note show`), 024 (autosave, `expectedUpdatedAt` and the 409 conflict), 029 (`api-request` helpers, `chronolog undo`).

## Objective

The laptop secretary can change a note's title, body or contract, append to a note, and delete a note, without ever corrupting a note the owner edited in the browser.

## Facts to build on

- A note has `content` (markdown) and `contentJson` (TipTap). The browser editor saves both on every autosave, so `content` is always current markdown. A note created over the API has `content` only; the editor loads from markdown when `contentJson` is null and writes both on its first save.
- `PUT /api/notes/[noteId]` accepts `title`, `content`, `contentJson`, `contractId`, `expectedUpdatedAt` and returns 409 `conflict` with the server's `updatedAt` when `expectedUpdatedAt` is stale. `DELETE /api/notes/[noteId]` exists and hard-deletes via `deleteNoteForUser`.
- `updateNoteForUser` ignores `contentJson` when it is `undefined`. It must treat an explicit `null` as "clear it".

## Tasks

1. **API.** When a `PUT` changes `content` and the body does not carry `contentJson`, set `contentJson` to null and recompute `wordCount` from the markdown, so the editor reloads from the new markdown instead of showing the stale TipTap document. Keep the existing behaviour when both are sent (the browser). Add `PATCH /api/notes/[noteId]` with the same fields for partial changes, requiring `expectedUpdatedAt`, with the same 409. Changing `contractId` goes through the existing move logic (note ID keeps its prefix; see backlog journeys P-07) and the ownership check from sprint 029. `DELETE` returns the deleted note's `id`, `title` and `contractId`.
2. **CLI.**
   - `chronolog note edit <id> [--title "..."] [--contract <ref>] [--file body.md | body on stdin]` replaces the body when a body is given. `chronolog note append <id> [--file | stdin]` adds a blank line and the text to the end. Both fetch the note first, send `expectedUpdatedAt`, and on 409 exit 7 with "note changed on the server since it was read; re-run" (no retry).
   - `chronolog note delete <id>`: shows the title, contract and word count, asks y/N in a terminal, refuses without `--yes` when there is no terminal (as sprint 031's `remove`). Before deleting, write the note's markdown with a header (id, title, contract, updatedAt) to `~/.config/chronolog/trash/<id>.md`, mode 600, and print that path. `chronolog note restore <id>` recreates it from the trash file as a new note on the same contract (new id, since IDs are date-sequenced) and removes the trash file.
   - `chronolog note show <id> --json` must include `updatedAt` and `wordCount` (check; add if missing).
3. **Skill.** Add a "Changing a note" section (stay under 190 lines): read before edit, prefer `append` for status updates, never delete without the owner saying so in this conversation, the trash path. Update the CLI readme and the `docs/LAPTOP-SETUP.md` quick reference (one or two lines).
4. **Tests.** Unit: the `PUT` clearing `contentJson`, `PATCH` with and without `expectedUpdatedAt`, `DELETE` response. API e2e: `note new` → `note append` → `note show` reflects it → browser-style `PUT` with both fields → `note edit` sees 409 when stale and succeeds when fresh → `note delete --yes` → trash file exists → `note restore` → the note is back on the contract. Playwright: a note edited by the CLI after being edited in the browser opens in the editor showing the CLI's text (proves task 1).

## Boundaries

Owns `src/routes/api/notes/[noteId]/+server.ts`, `src/lib/server/db/queries/notes.ts` (update and delete only), `cli/`, the skill, the two docs. Sprint 033 runs in parallel and owns the sidebar and the contract directory store; do not touch them. No schema change.

## Working rules

Worktree only. Dev server port 5212 with `BETTER_AUTH_URL=http://localhost:5212` and `ALLOW_REGISTRATION=true`; shared dev Postgres 127.0.0.1:5432, users `qa-034-*`, no reset, no seed. `npm run check` 0 errors, `npm test`, `npm run lint`, API e2e and Playwright green; rebase onto `main` before sign-off. Do not merge.

## Verification

Transcript of the e2e sequence above in `docs/review/screenshots/sprint-034/transcript.md` and one screenshot of the editor showing CLI-edited text. Sign-off at the bottom with what was done, what was left, test counts.
