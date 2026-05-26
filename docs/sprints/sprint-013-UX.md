# Sprint 013 — UX: Note-Time Entry Linking UX (UX-3)

**Status:** pending
**Type:** research / design
**Backlog items:** UX-3
**Depends on:** Sprint 011-UX (app documentation — merged)
**Branch:** `sprint-013-UX/note-time-linking-ux`

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

- [ ] Time entry → note linking interaction designed
- [ ] Note → time entry view designed
- [ ] Heading anchor recommendation (include or defer)
- [ ] Wireframes for modified components
- [ ] Syntax specification for inline links
- [ ] UX spec document at `docs/ux/note-time-linking-spec.md`
- [ ] Phasing recommendation (v1 vs stretch)

## Notes

**Keep it simple.** The user explicitly said "doesn't need to be anything visual" and
"we could do inline links." Don't over-engineer the UX. Plain text with parsed links
is a valid and preferred approach.

**Wiki-link syntax is already established.** The notes editor uses `[[NOTE_ID]]`. Reusing
this syntax in time entry descriptions creates consistency.
