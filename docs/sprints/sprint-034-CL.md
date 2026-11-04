# Sprint 034 — CL: CLI edits and deletes notes

**Status:** ready for review
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

## Sign-off

**2026-11-04, implemented on `sprint-034-CL/cli-note-edit-delete`, rebased onto `main` (`9d2a71b`, after the sprint 033 merge). Status: ready for review, not merged.**

### What was done

1. **API.** `updateNoteForUser` clears `contentJson` and recounts `wordCount` from the markdown when `content` arrives without `contentJson`; an explicit `contentJson: null` also clears it; the browser's content-plus-JSON save is unchanged. Word counters live in `queries/note-word-count.ts` (the markdown counter strips headings, list markers, emphasis, link targets and fences, and agrees with the TipTap count for the same text). `PUT` and the new `PATCH /api/notes/[noteId]` share `note-changes.ts`. `PATCH` requires `expectedUpdatedAt` (400 `expected_updated_at_required`) and gives the same 409 `conflict`. A `contractId` on either verb goes through the existing move (the ID keeps its prefix) and now checks ownership (`contractBelongsToUser`, 403 `contract_forbidden`); the UI's Move used to skip that check. `DELETE` returns `{ success, id, title, contractId }`; `deleteNoteForUser` now runs in a transaction and only drops the links of the caller's own note (before, it deleted `note_time_entries` for the ID before the ownership check).
2. **CLI** (`cli/commands/note-changes.mjs`, `cli/lib/note-body.mjs`, `cli/lib/trash.mjs`):
   - `note edit <id> [--title] [--contract] [--file | stdin]` and `note append <id> [--file | stdin]` read the note, then `PATCH` with the `updatedAt` they read. A 409 exits **7** with "note changed on the server since it was read; re-run" and no retry. An edit body replaces the text but keeps the `# title` heading unless the body has its own; `--title` rewrites the heading so the app's first-line title agrees. **Addition:** `--expected-updated-at T` pins the copy the secretary showed the owner from an earlier `note show`. Without it, the window for a conflict is only the milliseconds between GET and PATCH. The skill tells the secretary to use it, and the e2e uses it to prove exit 7 through the real CLI.
   - `note delete <id>` shows the title, contract and word count, asks y/N on a terminal and refuses (exit 2) without `--yes` otherwise, using `confirm.mjs`, which now takes a custom question and refusal. Before the DELETE it writes `trash/<id>.md` next to the config (`~/.config/chronolog/trash/`; directory 700, file 600) and prints the path. If the DELETE fails, the file is removed again. `note restore <id> [--contract X]` posts the markdown as a new note on the same contract and removes the file. `note restore` with no id lists the trash. Ids are checked against a safe pattern, so `../config` is refused.
   - `note show --json` already included `updatedAt` and `wordCount` (the whole row is spread); nothing needed adding.
3. **Skill.** A "Changing a note" section (read first and pass `--expected-updated-at`, prefer `append`, never delete unless the owner asked in this conversation, the trash path and restore), a 7 `note_changed` row in the failure table, and the two backdating lines. The skill is 186 lines. Also updated: `cli/readme.md` (commands, exit 7, trash, module layout), `docs/LAPTOP-SETUP.md` quick reference (three lines), `src/routes/api/notes/README.md` (PUT clearing, PATCH, DELETE response, `createdAt`) and `src/e2e/readme.md`.
4. **Tests.** Unit: `src/routes/api/notes/[noteId]/note-route.test.ts` (14 tests: PUT with both fields, PUT markdown-only clearing `contentJson` and counting words, title-only, explicit null, foreign-contract move 403; PATCH without `expectedUpdatedAt` 400, fresh then stale 409, move keeping the ID, 403/404; DELETE response, 404 twice and for another user's note; backdated POST), `note-word-count.test.ts` (3), `local-calendar.test.ts` (+2), `cli/commands/note-changes.test.mjs` (14). API e2e: `src/e2e/note-changes-cli.e2e.test.ts` (5 tests, the full sequence from the spec plus backdating). Playwright: `e2e-playwright/cli-note-edit.spec.ts` (chromium and webkit). A note typed in the browser (JSON saved) and then rewritten by `note edit` opens in the editor with the CLI's heading, H2 and bullet and none of the browser text.
6. **Backdated notes (owner request, added mid-sprint).** `POST /api/notes` accepts `createdAt: "YYYY-MM-DD"`. The ID carries that date (allocation under the same advisory lock, keyed on the prefix). `created_at` is noon of that day in the caller's timezone (`X-Timezone` / `?tz=`, via the new `noonInTimezone`), and `updated_at` stays the database's now. Today is the same as no date, so a note is never stamped with a future noon. A future day or a non-calendar value (`2026-02-30`, `yesterday`, a number) is 400 `invalid_date`. `chronolog note new … --date <YYYY-MM-DD|today|yesterday|weekday>` resolves the word with `cli/lib/dates.mjs` against `GET /api/me`'s today. The creation date cannot be changed on edit; the CLI readme and the notes API README say so. **List order:** `GET /api/notes` sorts pinned first, then `updated_at` (left as is). The note list's "Created" sort (sprint 024 toggle, `note-sort.ts`) uses `createdAt`, so it places a backdated note by its date. The default "Modified" sort puts it at the top, as a just-written note.

### Verification

- `npm run check`: 0 errors (the 3 existing warnings in `src/routes/+layout.svelte`). `npm run lint`: clean. `npm test`: **777 passed** in 73 files.
- API e2e (`E2E_USER_PREFIX=qa-034-e2e E2E_BASE_URL=http://localhost:5212 BETTER_AUTH_URL=http://localhost:5212 npm run test:e2e`): **91 passed** in 13 files.
- Playwright (`PLAYWRIGHT_BASE_URL=http://localhost:5212 E2E_USER_PREFIX=qa-034-pw npx playwright test`): **88 passed, 5 skipped** (the existing chromium-only offline tests under webkit).
- `docs/review/screenshots/sprint-034/transcript.md`: the spec's sequence through the real CLI, including the exit 7, the trash file listing and both backdating cases. `01-editor-shows-cli-edit.png`: the editor showing the CLI-edited text.

### Left / follow-ups

- A restored note gets a newly allocated id for today. If the deleted note was the newest of that day, the same id comes back (the CLI says so); otherwise `[[old-id]]` links in other notes and entries stay dangling. Restoring onto the old id or date is not offered, because it would need the server to accept a chosen id.
- `POST /api/notes` still stores `wordCount` 0 for a markdown-only note, because the create path was outside this sprint's boundary. The first CLI edit or append, or the first save in the editor, sets it. `note delete` counts words locally from the markdown, so its prompt is right either way.
- The trash keeps one copy per id: deleting a restored note that got the same id again overwrites the earlier copy, which was already consumed by the restore.
- QA users `qa-034-*` (unit-test users are cleaned up; the e2e, Playwright and transcript users and their notes remain) are in the shared dev database.
