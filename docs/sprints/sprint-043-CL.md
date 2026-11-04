# Sprint 043 — CL: Notes and editor follow-ups

**Status:** planned (starts after 039–042 merge)
**Branch:** `sprint-043-CL/notes-followups` · **Worktree:** `.claude/worktrees/sprint-043-CL` · **Port:** 5221
**Sources:** "Carried-over follow-ups / Notes / editor" in `docs/backlog.md`. Runs in parallel with 044-CL; wave rules in `docs/sprints/_wave-rules.md` apply (no migration in this sprint).

**Owns:** notes components, editor, note list, preview extraction, wiki-link rendering. 044 owns auth, CLI, desktop, admin colours and the root layout.

## Tasks

1. **Trash view.** A "Trash" entry (at the bottom of the note list or in the sidebar's Archived area; pick the quieter one and say why) lists the user's trashed notes from `GET /api/notes/trash` with deleted date and days left before the 30-day purge, and a Restore button per row. URL is the state (`/notes/trash`).
2. **Previews and titles.** The note list preview shows link text, not raw markdown, for attachment links (`extract-preview-lines`). Wiki-link text no longer drops out of titles and previews ("Beta note links to" → "Beta note links to Alpha note"; use the target's title or the id when unknown).
3. **Deleted attachment links.** A link to a deleted attachment gets the same "missing" styling as a missing image and does not open a tab that closes again.
4. **Split `NoteEditorPanel.svelte`** (over 500 lines after 040 and 042) into focused components/modules under ~200 lines each, no behaviour change; the existing Playwright note specs prove it.
5. **Toolbar `disabled` states** become reactive like the active highlights (020 follow-up).
6. **Phone.** "Linked time entries": the date no longer wraps into the duration. The Undo toast after a delete survives the panel unmount (move it to a shell-level toast host) so Undo works on a phone too. Landscape phone: the editor gets at least half the height (collapse the linked panels by default in landscape).
7. **Tests.** Unit where logic changes (preview extraction, title extraction); Playwright: trash view restore, phone-viewport Undo after delete, deleted-attachment styling (chromium and webkit).

## Verification

Screenshots: trash view; previews with link text; phone Undo toast; phone linked entries. Sign-off as per the wave rules.

## Sign-off

(pending)
