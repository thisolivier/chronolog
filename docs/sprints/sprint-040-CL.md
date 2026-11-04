# Sprint 040 — CL: Checkbox task lists in notes, `chronolog todos`

**Status:** in progress
**Branch:** `sprint-040-CL/task-lists` · **Worktree:** `.claude/worktrees/sprint-040-CL` · **Port:** 5218
**Sources:** owner request 2026-11-04 in `docs/backlog.md` ("Checkbox task lists in notes"). Wave rules: `docs/sprints/_wave-rules.md`.

**Owns:** the TipTap editor setup and extensions, the markdown serialiser/parser, the toolbar, note export, `cli/commands/todos.mjs` (new). Do not touch the sidebar, the note list, `NoteEditorPanel.svelte` beyond registration lines (042 adds a find bar there), the timer or the timesheet.

## Tasks

1. **Editor.** `- [ ]` and `- [x]` items render as clickable checkboxes (TipTap TaskList/TaskItem, the official extensions matching the installed TipTap version; check with context7). Typing `[ ] ` or `[] ` at the start of a list item makes a task item; a toolbar button toggles a task list. Nested task items work. Clicking a checkbox saves like any edit (autosave, 409 rules unchanged).
2. **Markdown round-trip.** The markdown serialiser writes `- [ ] text` / `- [x] text` and the parser reads them back (including notes written by the CLI as markdown only, which open from markdown). Round-trip unit tests: plain, nested, mixed with bullet lists, inside a note with wiki-links and code blocks. Word count: the checkbox marker is not a word (keep `scripts/lib/word-count.mjs` agreeing with the TS counter; `scripts/script-lib.test.ts` must stay green).
3. **CLI and export.** `note show` prints the markdown as-is; `note edit/append` preserve it (they are markdown already; prove with a test). Markdown export keeps the syntax; PDF/print export shows boxes (☐ / ☑ or styled checkboxes).
4. **Stretch: `chronolog todos [contract] [--all] [--json]`.** Lists open items across the user's notes (one line per item: note id, note title, the item text), grouped by note; `--all` includes done items. Server: a read route that extracts task items from decrypted note markdown (or from content JSON when markdown is stale), or do it client-side in the CLI from existing routes if that stays cheap; say which.
5. **Tests.** Unit for the serialiser/parser and the extractor; Playwright: create a task list in the editor, tick an item, reload, still ticked; CLI-created `- [ ]` note opens with checkboxes (chromium and webkit). API e2e for `todos`.

## Verification

Screenshots: a note with nested tasks, some ticked; CLI `todos` transcript. Sign-off as per the wave rules.

## Sign-off

(pending)
