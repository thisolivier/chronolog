# Sprint 042 — CL: Global search and find in page

**Status:** in progress
**Branch:** `sprint-042-CL/search` · **Worktree:** `.claude/worktrees/sprint-042-CL` · **Port:** 5220
**Sources:** owner requests 2026-11-04 in `docs/backlog.md`: global search, find in page (Cmd+F). Wave rules: `docs/sprints/_wave-rules.md`.

**Owns:** new `/search` route and `GET /api/search`, new search-bar and find-bar components, `AppShell.svelte`. Edits to `NoteEditorPanel.svelte`, `TimeEntriesPanel.svelte` and the time page are a mount line each (040 and 041 work there). Do not touch `ContractsSidebar.svelte` or `NoteListPanel.svelte` (039 owns them); the per-contract "Search all notes" box stays (decision: the two coexist).

## Tasks

1. **Search API.** `GET /api/search?q=&limit=` searches the user's notes (title, body) and time entries (description) across all clients, extending the in-memory decrypted search behind `notes/search` to time entries. Excludes trashed notes. Returns hits grouped by type with id, client, contract, date, and a snippet with match offsets. Minimum query length 2; sensible limit; tests for ranking basics (title hits above body hits), another user's data never returned, trashed notes excluded.
2. **Search bar and results page.** A search field at the top left of the shell, above the sidebar (in `AppShell.svelte`, not in the sidebar component). Enter opens `/search?q=` (URL is the state; back/forward and reload work). Results grouped Notes / Time entries, each hit with client/contract, date and a highlighted snippet. Clicking a note hit opens the note (the usual `openNote()`); clicking an entry opens its week with the entry selected/focused. Keyboard: `/` or Cmd+K focuses the search field (pick one, not conflicting with the editor); arrow keys move through hits. Phone (< 768 px): reachable from the shell header.
3. **Find in page (Cmd+F).** On a note (editor) or a timesheet week, Cmd+F (Ctrl+F elsewhere) opens a find bar at the top of that panel: highlights every match in the current page only, next/prev (Enter / Shift+Enter, buttons), a count "3 of 12", Escape closes and clears highlights. Browser find is intercepted only while focus is inside that panel. In the editor use decorations (ProseMirror) rather than DOM mutation, so the document is not changed or autosaved. The desktop app gets the same shortcut (check the Tauri menu does not swallow Cmd+F; note it if it does).
4. **CLI.** `chronolog search <query> [--json]` printing the same groups.
5. **Tests.** Unit for the API and snippet/highlight; Playwright: global search from the shell, open a note hit and an entry hit; Cmd+F in a note with next/prev and count, Escape clears, the note is not marked edited; Cmd+F on a week (chromium and webkit). API e2e for `chronolog search`.

## Verification

Screenshots: the search bar; a results page; the find bar in a note and on a week. Sign-off as per the wave rules.

## Sign-off

(pending)
