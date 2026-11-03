# Sprint 020 — CL: Stabilise notes and the editor

**Status:** active
**Type:** Client — bug fixes
**Depends on:** nothing (merges after 021-CL; rebase onto main when 021 lands)
**Branch:** `sprint-020-CL/notes-editor-bugs`
**Worktree:** `.claude/worktrees/sprint-020-CL`
**Source of truth for each bug:** `docs/review/2026-11-03-qa-state.md` §4 and `docs/review/2026-11-03-code-state.md` §4 (hunks 6, 7)

## Objective

Make notes, wiki-links and the editor trustworthy. Every item was confirmed live in the QA review.

## Tasks

1. **Backlinks from the editor (QA bug 2).** The `WikiLink` TipTap node has no `tiptap-markdown`
   serializer, so saved content contains an HTML span and `note_links` stays empty. Add the markdown
   `serialize` (and parse rule) so content round-trips as `[[id]]` / `[[id|label]]`. Check the Markdown
   export and raw mode show `[[id]]`. Test: save a note with a link, backlinks endpoint returns it.
2. **Raw ↔ Rich toggle (QA bug 3).** `{#if}` unmounts the TipTap element; toggling back leaves an empty
   editor and raw keystrokes throw `querySelectorAll of null`. Keep the editor element mounted and
   hidden; make `editorElement` reactive state. No page errors on toggle.
3. **Duplicate `link` extension (QA §5).** StarterKit v3 bundles Link; the editor registers it twice and
   logs `Duplicate extension names found: ['link']` eight times. Configure `link: false` on StarterKit
   or drop the separate extension.
4. **Richer `[[` autocomplete (code review §4 hunks 6 and 7).** Salvage from branch
   `wip/2026-05-27-debug-session`: `searchNotesForUser` returns `firstLine` / `secondLine`
   (fix the missing `extractPreviewLines` import), `SuggestionDropdown` shows them, and matching also
   searches content, not just title. Do not merge the branch; cherry-pick the hunks by hand.
5. **Move feedback (QA bug 10).** `moveMessage` renders in a header that unmounts when the note leaves
   the list; show the confirmation somewhere that survives (the list panel or a toast).
6. **`/login` when already authenticated (QA bug 11)** redirects to `/`.
7. **Lint:** `note-export.ts` prefer-const, `WikiLinkInput.svelte` unused `event`, `WikiLinkRenderer.svelte`
   each-without-key.
8. Update `src/lib/components/notes/README.md` for anything you changed.

## Boundaries

Do NOT touch: `src/routes/+page.svelte`, `src/routes/+layout.svelte`, `src/hooks.server.ts`,
`AppShell.svelte`, anything under `src/lib/storage`, `src/lib/powersync`, `src/routes/spike`, or the
timesheet components (`weekly/*`, `timer/*`, `TimeEntriesPanel`) — owned by 019-CL and 021-CL. Task 6
touches `src/routes/login` only. Follow-ups go in the sign-off.

## Verification

- `npm run check` (0 errors), `npm run lint` (no new errors in files you touched), `npm test` green
  (Postgres on localhost:5432).
- Real UI: `npm run dev -- --port 5192` in the worktree; drive link creation → backlink visible, raw/rich
  toggle, export, move. Screenshots into `docs/review/screenshots/sprint-020/`.

## Sign-off

_Team PM fills in._
