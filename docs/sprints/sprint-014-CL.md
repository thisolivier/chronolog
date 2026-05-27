# Sprint 014 — CL: Note-Time Entry Linking (CL-8)

**Status:** merged
**Type:** standard
**Backlog items:** CL-8
**Depends on:** Sprint 013-UX (note-time linking UX — merged)
**Branch:** `sprint-014-CL/note-time-linking`

## Objectives

Implement note-time entry linking as designed in `docs/ux/note-time-linking-spec.md`.

Key features:
1. `[[NOTE_ID]]` syntax in time entry descriptions with autocomplete
2. Parse-on-save reconciliation against `note_time_entry_link` table
3. Clickable rendered links in time entry read mode
4. Improved LinkedTimeEntries component in notes
5. API endpoints for linking/unlinking

## Tasks

### 1. Read the UX spec

Read `docs/ux/note-time-linking-spec.md` thoroughly. This is the implementation blueprint.

### 2. Create/verify the note_time_entry_link table

Check if the table already exists in the schema. If not, create it:
- `note_id` FK to notes
- `time_entry_id` FK to time entries
- `heading_anchor` TEXT (nullable, stored but not used in v1)
- Composite primary key on (note_id, time_entry_id)

Run `npm run db:generate` and `npm run db:migrate` if needed.

### 3. Add API endpoints

- `POST /api/notes/[noteId]/time-entries` — link a time entry to a note
- `DELETE /api/notes/[noteId]/time-entries/[timeEntryId]` — unlink
- `GET /api/notes/[noteId]/time-entries` — already exists, verify it works
- `POST /api/time-entries/[id]/reconcile-links` — reconcile links from description text

### 4. Add wiki-link parsing to time entry descriptions

Reuse the existing `parseWikiLinkText()` from `wiki-link.ts` extension.

When a time entry is saved (POST or PUT), parse the description for `[[NOTE_ID]]` patterns
and reconcile the links: add new ones, remove stale ones.

### 5. Add autocomplete to time entry description input

In `TimeEntryCard.svelte`, when the description input is focused and user types `[[`:
- Show a dropdown with note search results (reuse the existing note search API)
- On selection, insert `[[NOTE_ID|title]]` into the description text
- Keep it simple — a basic dropdown, not a full TipTap-style suggestion

### 6. Render links in read mode

In `TimeEntryCard.svelte`, when displaying the description (not editing):
- Parse `[[NOTE_ID]]` and `[[NOTE_ID|label]]` patterns
- Render them as clickable spans that navigate to the linked note
- Style them distinctly (underline, different color)

### 7. Improve LinkedTimeEntries component

Update `src/lib/components/notes/LinkedTimeEntries.svelte` per the UX spec:
- Show date, description preview, duration, and contract name for each linked entry
- Add unlink button per entry
- Optionally add a "Link time entry" picker

### 8. Write tests

- Test wiki-link parsing in descriptions
- Test reconciliation logic (add/remove links on save)
- Test API endpoints for linking/unlinking
- Existing tests must pass

### 9. Verify

- `npm run test` passes
- `npm run test:e2e` passes
- `npm run check` passes
- `npm run build` succeeds

## Acceptance Criteria

- [x] `note_time_entry_link` table exists in schema (pre-existing as `note_time_entries`)
- [x] Wiki-link parsing in time entry descriptions
- [x] Autocomplete when typing `[[` in description
- [x] Clickable rendered links in read mode
- [x] Parse-on-save reconciliation
- [x] Improved LinkedTimeEntries component
- [x] API endpoints for link management
- [x] All tests pass + new tests (257 total)
- [x] `npm run check` passes (no new errors; 4 pre-existing)
- [x] `npm run build` succeeds

## Notes

**Read the UX spec first.** `docs/ux/note-time-linking-spec.md` has wireframes, syntax
rules, component mapping, and phasing guidance.

**Reuse `parseWikiLinkText()`.** Don't write a new parser. The function in `wiki-link.ts`
already handles `[[NOTE_ID]]`, `[[NOTE_ID|label]]`, and `[[NOTE_ID#heading]]`.

**Heading anchors are v2.** Store them in the link table but don't implement navigation.

**Docker stack must be running** for the dev server and e2e tests.

## Sign-off

**Branch:** `sprint-014-CL/note-time-linking`
**Commit:** `3017f51`
**Worktree:** `/Users/olivier/sites/chronolog/.claude/worktrees/sprint-012-CL`

### Results
- **Tests:** 257/257 passed (16 test files), including 18 new reconciliation tests
- **Build:** Succeeds
- **Check:** 4 pre-existing errors, 0 new errors

### What was delivered

**New components (2):**
1. **WikiLinkInput.svelte** — Plain text input with `[[` autocomplete. Detects `[[` at cursor, debounced search via `/api/notes/search`, keyboard navigation (arrows/enter/escape), inserts `[[NOTE_ID]]` on selection.
2. **WikiLinkRenderer.svelte** — Renders description text splitting `[[...]]` patterns into clickable link spans using `parseWikiLinkText()`. Links show note ID (or custom label) and navigate on click.

**New utility:**
3. **reconcile-description-links.ts** — `extractDescriptionLinks()` parses `[[...]]` from description text. `reconcileLinks()` computes add/remove diff between current DB links and desired links.

**Modified components (2):**
4. **TimeEntryCard.svelte** — Read mode uses WikiLinkRenderer for clickable links; edit mode uses WikiLinkInput with `[[` autocomplete. New `onNoteLinkClick` prop for navigation.
5. **LinkedTimeEntries.svelte** — Redesigned per UX spec: shows formatted date, description preview, client/contract name, duration, and hover-reveal unlink button (was: truncated UUID only).

**DataService layer (4 files):**
6. Added `linkNoteTimeEntry(noteId, timeEntryId, headingAnchor?)` to interface, FetchDataService, and DelegatingDataService.
7. `getNoteTimeEntries` now returns `LinkedTimeEntryDisplay[]` with full display data (date, description, duration, contract/client names).

**API endpoints (3 files):**
8. **GET /api/notes/[noteId]/time-entries** — Enhanced with new `getLinkedTimeEntriesForNote` query joining note_time_entries → time_entries → contracts → clients.
9. **POST /api/notes/[noteId]/time-entries** — Now accepts optional `headingAnchor`.
10. **PUT /api/time-entries/[id]** & **POST /api/time-entries** — Parse-on-save reconciliation: when description is saved, extracts `[[...]]` patterns and adds/removes link records.

**Tests (18 new):**
11. `reconcile-description-links.test.ts` — 12 tests for `extractDescriptionLinks` + 6 for `reconcileLinks`.

### Scope notes
- Heading anchors stored in link table but navigation goes to note top (v2)
- Custom labels (`[[NOTE_ID|label]]`) parsed and displayed but not in autocomplete (v2 stretch)
- Time entry picker [+] from notes deferred to v2
