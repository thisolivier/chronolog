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

**Status:** signed-off (2026-11-03). Branch `sprint-020-CL/notes-editor-bugs`, 7 commits on top of
`e3fabb9`, not merged. Rebase onto main after 021-CL lands; no files overlap with 021-CL's list except the
isolated lint commit noted under task 7.

### Per task

| # | Task | Result | What changed |
|---|------|--------|--------------|
| 1 | Backlinks from the editor | **Fixed** | `WikiLink` now has a `tiptap-markdown` spec (`addStorage().markdown`): `serialize` writes `[[id]]` / `[[id\|label]]` / `[[id#heading]]` via a shared `formatWikiLinkText`, and a markdown-it inline rule (`parse.setup`) turns `[[...]]` back into `wikiLink` nodes on `setContent(markdown)`. Saved `content` is `Beta note links to [[INTL…]]`, `note_links` populates, the Markdown export and raw mode show `[[id]]`. 11 new jsdom tests in `extensions/wiki-link.test.ts`. |
| 2 | Raw ↔ Rich toggle | **Fixed** | The TipTap mount `<div>` is always rendered and only hidden (`class` array with `hidden`) in raw mode; `editorElement` is `$state`; image resolution is guarded. Two toggle cycles with raw typing: content intact, 0 page errors. |
| 3 | Duplicate `link` extension | **Fixed** | `StarterKit.configure({ link: { openOnClick: false } })`, separate `@tiptap/extension-link` import removed. 0 console warnings across the whole probe run. `starter-kit-link.test.ts` asserts exactly one `link` extension. |
| 4 | Richer `[[` autocomplete | **Fixed** | Hunks 6 and 7 of `wip/2026-05-27-debug-session` copied by hand: `searchNotesForUser` selects `contentJson`, returns `firstLine`/`secondLine` (real `import` of `extractPreviewLines` added; the re-export kept) and also matches `ilike(notes.content)`; `SuggestionDropdown` shows ID, first line, second line. A query matching only body text ("zebra") finds the note in the browser. 3 new DB tests. The branch itself was not merged or deleted (021-CL deletes it). |
| 5 | Move feedback | **Fixed** | `note-moved` event carries `toContractName` / `toClientName`; `NoteListPanel` shows a 4s `role="status"` line (`data-testid="move-feedback"`, "Moved to Acme Corp / Rocket Build") under its header. The failure message stays in the editor header, which only unmounts on success. |
| 6 | `/login` when authenticated | **Fixed, with one revision** | New `src/routes/login/+page.server.ts` returns a 303 to `/` for document requests. First version redirected data requests too, which broke registration: Better Auth auto-signs-in after sign-up, the register page's `goto('/login')` followed the redirect client-side, and the root layout (which only creates the navigation context on initial mount with a user) threw "Navigation context not found". Data requests now get `alreadyAuthenticated: true` and the page does the same `window.location.replace('/')` full reload the login form already uses. 3 tests in `page.server.test.ts`. |
| 7 | Lint | **Fixed** | `note-export.ts` prefer-const (in the task-5/6 commit); `WikiLinkInput.svelte` unused `event`, `WikiLinkRenderer.svelte` each key — these two live under `weekly/*` (a boundary) so they are an isolated one-line-each commit `9565174`; drop it on rebase if it conflicts. |
| 8 | READMEs | **Done** | `notes/README.md` (StarterKit link, mounted editor div, 500ms autosave, toolbar counter, dropped the non-existent title props), `notes/extensions/README.md` (serializer/parse rule, preview lines), `layout/README.md` (`note-saved` / `note-moved` events). |
| + | Toolbar active state (QA §5 `state_unsafe_mutation`) | **Fixed (extra)** | The `editor = editor` hack in `onTransaction` was removed; it raised `state_unsafe_mutation` and was a no-op because the `Editor` instance never changes identity, so toolbar highlights never followed the selection. `NoteEditor` now bumps a `transactionCount` `$state` (via `queueMicrotask`) that `EditorToolbar.isActive()` reads. Touches `EditorToolbar.svelte`, which the spec did not name but nobody else owns. Verified in the browser (bold off → on → off). |

### Verification

- `npm run lint`: 11 → **8 errors**; the remaining 8 are `TimeEntriesPanel.svelte` ×2 (019-CL task 9),
  the four `NoteTimeEntryLink` imports and `routes/spike` ×2 (021-CL). 0 warnings.
- `npm run check`: **0 errors**, 23 → 22 warnings (the `non_reactive_update` for `editorElement` is gone).
- `npm test`: 23 files / 335 tests → **26 files / 354 tests**, all green against localhost:5432.
- Real UI on port 5192 (`BETTER_AUTH_URL=http://localhost:5192` must be exported on the dev command line —
  Better Auth only trusts its `baseURL` origin, and `npm run dev` does not load `.env` into `process.env`;
  the worktree `.env` was left unchanged). Probe script:
  `/private/tmp/claude-501/-Users-olivier-sites-chronolog/149f7782-2562-48b2-9904-8fe2b200ea3d/scratchpad/sprint-020/probe-020.mjs`,
  result **15/15 PASS, 0 page errors, 0 console warnings/errors**, QA user `qa-020-fe08uk@chronolog.test`
  (left in the dev database like the driver's users). Screenshots in `docs/review/screenshots/sprint-020/`:
  - `00-after-register-landed-on-root.png`, `01-login-redirected-to-root.png` — task 6
  - `02-autocomplete-content-match-preview.png` — task 4 (query "zebra" matches body text; preview lines shown)
  - `03-wiki-link-in-editor.png`, `04-linked-from-backlink.png` — task 1 (PUT body `[[id]]`, "Linked from" chip)
  - `05-raw-mode-shows-wikilink.png`, `06-after-toggle-back-to-rich.png` — task 2
  - `07-move-feedback.png` — task 5
  - `08-toolbar-bold-active-state.png` — extra toolbar fix
- Markdown export of the linking note contains `[[id]]` and no `<span` (probe `T1-export-markdown-has-wikilink`).

### Behaviour change to note

Registering now lands the new user signed-in on `/` instead of on `/login` (Better Auth's auto sign-in plus
the task-6 redirect). `e2e-playwright/manual-checklist/qa-driver.mjs` step `AUTH-register` waits for
`**/login` and will report a false FAIL until its expectation is updated (driver not touched: outside the
spec's file list).

### Follow-ups deferred

- Root layout only creates the navigation/timer contexts on initial mount (`+layout.svelte:14-29`,
  `state_referenced_locally` warnings); any client-side navigation from an unauthenticated page into `/`
  throws "Navigation context not found". Worked around in `/login` only; the proper fix is in
  `+layout.svelte` (021-CL territory / next sprint).
- Toolbar `disabled` expressions (`editor.can()…`) still evaluate once; only the active-state highlights are
  reactive. Harmless today (every command is always allowed) but worth folding into the same counter.
- `.claude/context7-registry.md`: `/svelte/svelte` no longer resolves (use `/websites/svelte_dev_svelte`) and
  `/ueberdosis/tiptap` redirects to `/ueberdosis/tiptap-docs`; update the registry.
- `[[` autocomplete still orders by recency and Enter picks the first item (QA §4.11); previews make the
  choice visible but do not change the ordering.
- The debug branch `wip/2026-05-27-debug-session` is still present locally and on origin (021-CL deletes it).
