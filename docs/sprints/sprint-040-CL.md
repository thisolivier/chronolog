# Sprint 040 — CL: Checkbox task lists in notes, `chronolog todos`

**Status:** ready for review
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

**2026-11-04, implemented on `sprint-040-CL/task-lists`, rebased onto `main` (`433795e`, after the sprint 041 merge; `cli/chronolog.mjs`, `cli/CHANGELOG.md` and the skill conflicted with 041 and were resolved by keeping both). Status: ready for review, not merged.**

### What was done

1. **Editor.** The official TipTap `TaskList` / `TaskItem` from `@tiptap/extension-list` 3.19 (already installed as a StarterKit dependency; now declared in `package.json`, no new package). `src/lib/components/notes/extensions/task-list.ts` registers them as `TaskListExtensions` (one spread line in `NoteEditor.svelte`), `nested: true`. Typing `[ ] `, `[] ` or `[x] ` at the start of a bullet or numbered list item turns **that item** into a task item: the list is split around it and the new item joins a task list right before or after it. The stock rule would have nested a new task list inside the bullet. On a plain line the stock rule starts a task list. The toolbar has a ☑ button (`toggleTaskList`, active state shown). Tab / Shift-Tab nest and un-nest. A click on a checkbox is an ordinary transaction: autosave as for any edit, with the same 409 rules. Done items are struck through and muted.
   - **Bug found and fixed in QA (WebKit):** the stock checkbox handler runs `focus()` then sets `checked` in one command chain. In an unfocused editor, Safari focuses the DOM synchronously inside that chain and TipTap dispatches its focus transaction there. The chain's own transaction then failed with "Applying a mismatched transaction" and the tick was lost: no save, or a save without the tick. Fix: a capture-phase `mousedown` listener (a plugin `view()` hook, because ProseMirror does not pass that event to `handleDOMEvents`) focuses the editor before the change event. Proven by the Playwright CLI-note test, which failed 4 out of 4 times in WebKit before the fix and passed 5 out of 5 after it.
2. **Markdown round-trip.** tiptap-markdown's own task-list spec does the parsing (markdown-it-task-lists). Three changes:
   - Task lists serialise tight, so `- [ ] a\n- [x] b` stays one item per line instead of having blank lines between items. This uses a `tight` attribute that is not rendered; JSON from before this sprint without the attribute serialises tight too.
   - A task list next to a bullet list uses the `*` marker (`taskListMarker`). Otherwise markdown-it merges `- a` and `- [ ] b` into one list when it reads them back. Without this, a bullet list followed by a task list came back with a spurious empty task item.
   - A parse hook (`task-list-dom.ts` `splitMixedTaskLists`) splits a hand-written or CLI-written list that mixes plain and task items into consecutive bullet and task lists.
   - Round-trip unit tests cover: plain, nested to three levels, beside bullet lists, mixed, nested under a bullet, with headings + wiki-links (`[[id]]` and `[[id|label]]`) + code blocks (a `- [ ]` inside code stays code), uppercase `[X]`, and older JSON. Each one checks that a second pass gives the same text.
   - Word count: both counters already strip `[-*+] [ ]` markers. New tests prove it in `note-word-count.test.ts`, and `scripts/script-lib.test.ts` has a task-list fixture so the two counters still agree.
3. **CLI and export.** `note show` prints the markdown as-is, and `note edit` / `append` keep the syntax byte for byte. This is proved by unit tests (`cli/commands/todos.test.mjs`) and by the API e2e test. The Markdown export writes the stored markdown, so the syntax is kept (unit test). PDF/print: each checkbox prints as ☐ / ☑ (`printTaskItemsAsBoxes` in `note-print.ts`), because an `<input>`'s checked state does not survive copying the HTML. There are print styles for it, and a Playwright step checks the real print frame.
4. **Stretch: `chronolog todos [contract] [--all] [--json]`: done, server side.** The new route `GET /api/notes/todos[?contractId][&all=1]` reads items from each note's decrypted **markdown** with `extractTaskItems` (`src/lib/utils/task-items.ts`), skipping fenced code and empty items. Markdown is never stale: the editor saves it together with the JSON, and the CLI writes markdown only. Doing the work in the CLI would have meant fetching every note, because `GET /api/notes` returns no bodies, so it was not cheap. Output is one line per item, `<id>  <title>  <item>`, with nested items indented and a blank line between notes. Across contracts the title gets `(SHORT/Contract)`. `--all` prefixes `[ ]` / `[x]`. `--json` returns the route's payload plus a `contract` label. Trashed notes are never read.
5. **Tests.**
   - Unit: `extensions/task-list.test.ts` (12: round-trips, input rules through `handleTextInput`, toolbar toggle), `note-print-tasks.test.ts` (2), `utils/task-items.test.ts` (5), `cli/commands/todos.test.mjs` (7: format, `--all`, the route call, show/edit/append preservation, the CLI word count), plus the word-count additions.
   - API e2e: `src/e2e/todos-cli.e2e.test.ts` (4).
   - Playwright: `e2e-playwright/task-lists.spec.ts` (2 tests, chromium and webkit).
     - Editor test: type a nested list, tick two items, reload, still ticked, PDF boxes, untick saves.
     - CLI test: a CLI `- [ ]` note opens with checkboxes beside a plain bullet; `chronolog todos` lists its items, and an item ticked in the browser drops off.
   - Docs updated: the notes components, extensions, utils, notes API, CLI, e2e and Playwright readmes; `cli/CHANGELOG.md` (`## Unreleased`); a 5-line skill paragraph.

### Verification

After the rebase onto `main` at `433795e` (sprint 041 merged): `npm run check` 0 errors (the 3 existing warnings in `src/routes/+layout.svelte`), `npm run lint` clean, `npm test` **924 passed in 91 files**, API e2e against `http://localhost:5218` (`E2E_USER_PREFIX=qa-040-e2e`) **114 passed in 18 files**, the full Playwright suite (`qa-040-pw`, chromium and webkit) **106 passed, 5 skipped** (the existing chromium-only offline tests). Before the rebase: 895 / 87, 110 / 17, 98 + 5 skipped. `task-lists.spec.ts` was also run 5 times in a row in both browsers (21 of 21 passed).

Screenshots in `docs/review/screenshots/sprint-040/`: `01-nested-tasks-some-ticked.png` (nested tasks, two ticked, after a reload), `02-cli-note-opens-with-checkboxes.png` (CLI markdown note), `03-pdf-export-boxes.png` (the print document), `04-cli-todos-transcript.txt` (`chronolog todos` and `todos General --all` for a `qa-040-demo` user).

### Left, and notes

- No schema change. No CLI version bump (changelog under `## Unreleased`).
- The editor writes `* [ ]` (not `- [ ]`) for a task list that directly touches a bullet list. This is deliberate (see 2) and documented in `cli/readme.md`; `extractTaskItems` and the CLI read both markers.
- A task list nested directly under a bullet item reports depth 0 in `todos` (depth counts task levels only).
- The JSON word counter still ignores words inside lists, task lists included. That is older behaviour, unchanged here; the markdown counter does count them.
- `NoteEditor.svelte` grew by about 60 lines of task-list CSS (now about 700 lines, mostly global styles); moving the editor CSS into its own stylesheet would be a good follow-up.
- In readonly mode the checkboxes cannot be clicked (stock behaviour).
- QA users `qa-040-*` and their notes remain in the shared dev database.

**Merge risk with 039/041/042:**
- `src/routes/api/notes/README.md`, `cli/readme.md`, `cli/CHANGELOG.md` (`## Unreleased`), the skill, and the e2e/Playwright readmes: other sprints will append to the same files, so expect trivial text conflicts.
- `cli/chronolog.mjs` changes are one import, one usage line and one `COMMANDS` entry.
- The new route `api/notes/todos` uses `listNotesForUser` unchanged. If 039 changes its ordering or filters, todos follows.
- `NoteEditorPanel.svelte` is untouched.
