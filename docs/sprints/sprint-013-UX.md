# Sprint 013 — UX: Note-Time Entry Linking UX (UX-3)

**Status:** signed-off
**Type:** research / design
**Backlog items:** UX-3
**Depends on:** Sprint 011-UX (app documentation — merged)
**Branch:** `sprint-013-UX/note-time-linking-ux`
**Working tree:** `/Users/olivier/sites/chronolog/.claude/worktrees/sprint-012-UX`

## Objectives

Design the interaction for linking time entries to notes and vice versa. The data model
already supports this (many-to-many `note_time_entry_link` table in the spec with optional
`heading_anchor`). The challenge is UX: how do users create and navigate these links?

This is a **design sprint** — the deliverable is a UX specification, not code.

## Context

### Data Model (from SPEC.md)

```
note_time_entry_link
  note_id       FK
  time_entry_id FK
  heading_anchor TEXT (nullable, e.g., "design-review")
```

### Existing Features

- Notes already support `[[wiki-links]]` to other notes
- Notes have a "Linked Time Entries" section (rendered by `LinkedTimeEntries.svelte`)
- Time entries have a `description` field (text)
- The app stores notes as markdown with wiki-link syntax

### User's Direction

"The time entry to notes doesn't need to be anything visual, we could do inline links,
but we would need a way to reference notes from a time entry description."

## Tasks

### 1. Read existing code

Read thoroughly:
- `docs/ux/notes-integration-design.md` (from sprint 012-UX)
- `src/lib/components/notes/LinkedTimeEntries.svelte`
- `src/lib/components/notes/extensions/wiki-link.ts`
- `src/lib/components/weekly/TimeEntryCard.svelte` (description field)
- `docs/SPEC.md` (note-time entry links section)

### 2. Design: Time entry → Note reference

How does a user reference a note from a time entry description?

Options to evaluate:
- **Inline wiki-link syntax**: `[[NOTE_ID]]` in the description text, same as notes
- **Autocomplete**: Type `[[` in the description field to trigger note search
- **Manual link picker**: Button next to description that opens a note search modal
- **Drag-and-drop**: Drag a note from the sidebar onto a time entry (stretch)

Consider:
- The description field is currently a plain `<textarea>`. Adding wiki-link syntax
  means either making it a mini-editor or parsing the links on save.
- The simplest approach: plain text with `[[NOTE_ID]]` syntax, parsed on save to
  create `note_time_entry_link` records. Render the links as clickable in read mode.

### 3. Design: Note → Time entry view

How does a user see and manage time entries linked to a note?

The `LinkedTimeEntries.svelte` component already exists. Consider:
- Should it show a summary or full details of each linked entry?
- Can users unlink entries from this view?
- Can users create a new time entry pre-linked to this note?

### 4. Design: Heading anchors

The spec supports `heading_anchor` — linking to a specific heading within a note.
Is this worth implementing? Consider:
- `[[NOTE_ID#heading-slug]]` syntax already works for note-to-note links
- For time entries: `[[NOTE_ID#design-review]]` could link to a specific section
- Is this too complex for v1? Recommend phasing if so.

### 5. Write the UX specification

File: `docs/ux/note-time-linking-spec.md`

Include:
- Interaction design for both directions (time entry → note, note → time entry)
- Wireframes for the modified time entry card and description field
- Wireframes for the linked time entries section in notes
- Syntax specification (if using inline links)
- Component changes needed (which existing components, which new)
- Phasing recommendation (what's v1, what's stretch)

## Acceptance Criteria

- [x] Time entry → note linking interaction designed
- [x] Note → time entry view designed
- [x] Heading anchor recommendation (include or defer)
- [x] Wireframes for modified components
- [x] Syntax specification for inline links
- [x] UX spec document at `docs/ux/note-time-linking-spec.md`
- [x] Phasing recommendation (v1 vs stretch)

## Notes

**Keep it simple.** The user explicitly said "doesn't need to be anything visual" and
"we could do inline links." Don't over-engineer the UX. Plain text with parsed links
is a valid and preferred approach.

**Wiki-link syntax is already established.** The notes editor uses `[[NOTE_ID]]`. Reusing
this syntax in time entry descriptions creates consistency.

## Progress Notes

- **Task 1 (Read existing code):** Complete. Read wiki-link.ts (parseWikiLinkText, Suggestion, all syntax forms), TimeEntryCard.svelte (plain text input, click-to-edit), LinkedTimeEntries.svelte (truncated IDs, unlink only), NoteEditorPanel.svelte, DataService interface (getNoteTimeEntries, unlinkNoteTimeEntry — linkNoteTimeEntry missing), notes-integration-design.md (prior complex approach).
- **Task 2 (Time entry → note design):** Complete. Inline `[[NOTE_ID]]` in plain text descriptions with autocomplete dropdown, parse-on-save reconciliation, clickable rendered links in read mode.
- **Task 3 (Note → time entry design):** Complete. Redesigned LinkedTimeEntries to show date/description/duration/contract. Added [+] time entry picker. Click-to-navigate to timesheet.
- **Task 4 (Heading anchors):** Complete. Deferred to v2 — stored in data model but navigation is note-level only in v1. Parser already handles the syntax.
- **Task 5 (UX specification):** Complete. 255-line spec at `docs/ux/note-time-linking-spec.md`.

## Sign-off

All 7 acceptance criteria met. Spec committed to branch `sprint-013-UX/note-time-linking-ux`. This is a simpler, more pragmatic approach than the sprint 012-UX `notes-integration-design.md` (which explored picker modals, preview popovers, card-level indicators). The user's direction ("doesn't need to be anything visual, inline links") guided the design toward plain-text `[[NOTE_ID]]` syntax reusing the existing wiki-link parser.

**Key decisions:**
1. Plain text `<input>` with autocomplete, not TipTap for descriptions
2. `[[NOTE_ID]]` syntax reusing `parseWikiLinkText()` — no new parser
3. Parse-on-save reconciliation — links stay in sync with description text
4. Heading anchors deferred to v2 (stored but not navigated)
5. [+] picker only for note→entry direction (entry IDs are UUIDs, not typeable)
6. Redesigned LinkedTimeEntries with useful context (date, description, duration)
