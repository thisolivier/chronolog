# Sprint 024 — CL: Notes and editor rough edges

**Status:** pending (starts after 023-CL merges; both touch `queries/notes.ts`)
**Branch:** `sprint-024-CL/notes-rough-edges` · **Worktree:** `.claude/worktrees/sprint-024-CL` · **Port:** 5201
**Sources:** `docs/review/2026-11-03-ux-friction.md` (finding numbers below), `docs/review/2026-11-03-integration-qa.md` (R2, R3, R4), sprint 020 sign-off follow-ups.

## Tasks (friction finding numbers in brackets)

1. **Autosave never loses text [2].** Flush pending note saves on component destroy, note/contract switch, `visibilitychange`, `beforeunload` and layout-mode change; show a small saved / saving / unsaved indicator in the editor header.
2. **Lists render [4].** Bullets and numbers visible in the editor, rendered mode and print.
3. **Wiki-links show titles [5] and the current note is excluded from `[[` suggestions [6].** Everywhere a link renders (editor, cards via `WikiLinkRenderer`, "Linked from", linked time entries) show the note's title or first line with the ID as tooltip. Autocomplete ranks exact-ID matches first (integration R2).
4. **Note search UI [7].** A search field at the top of `NoteListPanel` using the existing search endpoint; results across contracts, each showing its contract prefix.
5. **Attachments [10].** Fix `chronolog://attachment/undefined` and the 500 on load; images render after reload.
6. **Export [11].** PDF/print export waits for the note to load and prints only the note (no app chrome).
7. **New Note [19].** Focus the editor on create, debounce the button, do not persist until the first keystroke or title.
8. **Links both ways [21], clickable linked entries, R4.** Linked time entries in a note are clickable (open that day in time mode); show the entry's description with the `[[id]]` replaced by the note title.
9. **Sidebar counts refresh [23]** after create, move and delete (use the existing note events).
10. **Raw mode shows markdown not entities [24].**
11. **Following a link into another contract updates the sidebar and list [R3].** Use `navigation.openNote`.
12. **Polish:** mobile editor toolbar and height [25], native `confirm()` → inline confirm, delete button placement [37], code-block top band and toolbar underline [38], note list sort by modified with a toggle [40], move message clears on contract switch [43], long first line should not become a giant H1 [45 notes part].

## Boundaries
Owns `src/lib/components/notes/**`, `NoteListPanel.svelte`, `NoteEditorPanel.svelte`, `queries/notes.ts`, `queries/note-links.ts`, `api/notes/**`, `api/attachments/**`. Do not touch `weekly/*`, `timer/*`, `TimeEntriesPanel`, admin, `AppShell`, `ContractsSidebar` (025/026 own them); if `TimeEntryCard` must render titles, change only `WikiLinkRenderer`.

## Verification
check 0 errors, tests green, lint clean; real UI on port 5201 for every task with screenshots in `docs/review/screenshots/sprint-024/`; do not regress "editor markdown shortcuts and export" from the friction report's works-well list.

## Sign-off
_Fill in._
