# Note-Time Entry Linking: UX Specification

Sprint 012-UX / CL-8. Inline wiki-link approach for connecting time entries and notes.

---

## 1. Overview

Note-time linking lets a consultant trace from a time entry to the note(s) where the detail lives, and from a note back to the billable entries it relates to. The approach is deliberately minimal: time entry descriptions remain plain text input fields, and users reference notes by typing `[[NOTE_ID]]` directly in the description -- the same wiki-link syntax already used inside notes. On save the description is parsed for links; in read mode those links render as clickable spans. No rich text editor, no picker modals, no card-level indicators. This is simpler than the approach explored in `notes-integration-design.md` (picker modals, preview popovers, card-level note rows) and is preferred because the user's primary need is a lightweight reference, not an embedded preview.

---

## 2. Time Entry to Note: Inline Wiki-Links

### 2.1 Writing Links

The description field on `TimeEntryCard` and `NewEntryRow` remains a plain `<input type="text">`. When the user types `[[`, an autocomplete dropdown appears below the input showing matching notes. As the user continues typing (e.g., `[[BIG`), the dropdown filters results by querying the existing notes search endpoint. Selecting a result inserts `[[NOTE_ID]]` at the cursor position and closes the dropdown. The user can also type `[[NOTE_ID]]` manually without using autocomplete -- the link is recognised on save regardless.

### 2.2 Autocomplete Dropdown

Triggered by detecting `[[` in the input value at the cursor position. The dropdown is a simple floating list, not TipTap's Suggestion utility.

**Behaviour:**
- Appears below the input, aligned with the `[[` position
- Each item shows: note ID (monospace) + note title
- Arrow keys navigate items, Enter selects, Escape dismisses
- Selecting inserts `[[NOTE_ID]]` replacing the `[[partial` text
- Clicking outside the dropdown dismisses it
- Maximum 8 items shown; no pagination

```
+-----------------------------------------------------------+
| Reviewed API design [[BIG                                 |
|              +-------------------------------------+      |
|              | BIGCH.20260519.001 -- API Review     |      |
|              | BIGCH.20260519.002 -- Design Docs    |      |
|              | BIGCH.20260518.003 -- Sprint Retro   |      |
|              +-------------------------------------+      |
+-----------------------------------------------------------+
```

**Rationale:** TipTap's Suggestion plugin manages cursor position within a ProseMirror document. The description field is a plain `<input>`, so a simpler approach is needed: detect `[[` via the input's `selectionStart`, show a positioned dropdown, and splice the selected ID into the string. This is roughly 100 lines of component code vs. TipTap's full rich-text stack.

### 2.3 Parsing Links on Save

When the description is saved (on blur or debounce, matching existing behaviour), the text is parsed for `[[...]]` patterns.

**Steps:**
1. Extract all `[[...]]` substrings using a regex: `/\[\[([^\]]+)\]\]/g`
2. For each match, call the existing `parseWikiLinkText()` from `wiki-link.ts` to get `{ noteId, headingAnchor, label }`
3. Fetch current links via `getNoteTimeEntries(noteId)` or a reverse lookup
4. Reconcile: diff parsed links against existing `note_time_entry_link` records
   - New link found in text but not in DB --> `linkNoteTimeEntry(noteId, timeEntryId, headingAnchor)`
   - Link in DB but removed from text --> `unlinkNoteTimeEntry(noteId, timeEntryId)`
   - Link unchanged --> no action
5. Invalid note IDs (no matching note in DB) are silently ignored -- no link record created, text left as-is

**Rationale:** Parse-on-save is natural because the description already saves on blur/debounce. No separate "link" action is needed. The reconciliation ensures links stay in sync with the description text -- if the user removes `[[NOTE_ID]]` from the text, the link is removed from the DB.

### 2.4 Rendering Links in Read Mode

In the non-editing state of `TimeEntryCard`, the description is currently shown as plain text inside a `<button>` element. This is replaced with a renderer that:

1. Splits the description text on `[[...]]` patterns
2. Plain text segments render as-is
3. `[[NOTE_ID]]` segments render as clickable `<span>` elements styled as links
4. The link text shows the note title (fetched from the link record or a lookup) with the note ID as fallback
5. If the note ID does not exist, the text renders as plain text (no link styling)

Clicking a rendered link navigates to the note: `navigationContext.selectContract(contractId)` then `navigationContext.selectNote(noteId)`.

```
Read mode with a rendered link:
+-----------------------------------------------------------+
| Client / Contract / Deliverable          9:00-11:00       |
| Reviewed API design [[API Review Notes]]     2h 0m        |
|                                                     x     |
+-----------------------------------------------------------+
                        ^^^^^^^^^^^^^^^^^
                        clickable, styled as inline link
```

**Rationale:** Rendering inline keeps the description compact (one line). No extra card rows, no icons, no indicators. The link is visible in context -- "Reviewed API design [[API Review Notes]]" reads naturally.

---

## 3. Note to Time Entry: Redesigned LinkedTimeEntries

### 3.1 Current Problems

The existing `LinkedTimeEntries.svelte` component is nearly useless:
- Shows only truncated entry IDs (`te-abc123...`) -- not human-readable
- No description, date, duration, or contract information
- No way to create new links from the note side
- No navigation to the linked entry in the timesheet

### 3.2 Redesigned Display

Each linked entry shows enough context to be self-explanatory:

```
Linked Time Entries                         [+]
+-----------------------------------------------+
| Mon, May 19 -- Reviewed API design      2h 0m |
| Client A / API Contract                    x  |
+-----------------------------------------------+
| Tue, May 20 -- Sprint planning          1h 30m |
| Client A / API Contract                    x  |
+-----------------------------------------------+
```

| Element | Content | Style |
|---------|---------|-------|
| Date | Abbreviated: "Mon, May 19" | `text-xs font-medium text-stone-500` |
| Description | Entry description, truncated if long | `text-sm text-stone-700` |
| Duration | Formatted: "2h 0m" | `text-xs text-stone-400`, right-aligned |
| Contract | Client + contract name | `text-xs text-stone-400` |
| Unlink | "x" button | `text-stone-300 hover:text-red-500` |

Entries sorted by date descending (most recent first). Entire row is clickable for navigation.

### 3.3 Navigation from Notes to Timesheet

Clicking a linked entry navigates to the timesheet:
1. Switches to time-entries mode
2. Selects the week containing that entry
3. Scrolls to the specific entry (brief highlight animation to draw the eye)

### 3.4 Creating Links from Notes

The [+] button opens a minimal time entry picker showing recent entries for the same contract, grouped by week. Clicking an entry creates the link immediately.

```
+---------------------------------------------------+
|  Link a Time Entry                           [x]  |
|                                                   |
|  THIS WEEK (May 19-25):                           |
|  +----------------------------------------------+ |
|  | Mon, May 19 -- Reviewed API design    2h 0m  | |
|  | Mon, May 19 -- Client call            0h 30m | |
|  | Tue, May 20 -- Sprint planning        1h 30m | |
|  +----------------------------------------------+ |
|                                                   |
|  LAST WEEK (May 12-18):                           |
|  +----------------------------------------------+ |
|  | Wed, May 14 -- Code review            3h 0m  | |
|  | Fri, May 16 -- Documentation          1h 0m  | |
|  +----------------------------------------------+ |
+---------------------------------------------------+
```

**Rationale:** The [+] picker is necessary here because time entry IDs are UUIDs -- unlike note IDs (e.g., `BIGCH.20260519.001`), they are not human-typeable. A picker scoped to the same contract keeps the list short (5-15 entries per week for a typical consultant).

---

## 4. Heading Anchors: Deferred to v2

The `[[NOTE_ID#heading]]` syntax is already parsed by `parseWikiLinkText()` and the data model supports it (`headingAnchor` field on `note_time_entry_link`). However, implementing heading-level navigation requires resolving heading slugs to scroll positions, handling renamed/deleted headings, and showing headings in the autocomplete. The UI cost is high relative to the value for v1 -- most links are note-level.

**v1 behaviour:** If a user types `[[NOTE_ID#heading]]`, the link record is created with the heading anchor stored, but navigation goes to the top of the note. The anchor is preserved for future use.

**v2 adds:** Heading-aware navigation (scroll to heading), heading picker in autocomplete, stale anchor detection.

---

## 5. Syntax Specification

| Syntax | Behaviour | Version |
|--------|-----------|---------|
| `[[NOTE_ID]]` | Links to note, displays note title in read mode | v1 |
| `[[NOTE_ID\|label]]` | Links to note, displays custom label in read mode | v1 stretch |
| `[[NOTE_ID#heading]]` | Links to heading in note (navigation deferred) | v1 store, v2 navigate |
| `[[NOTE_ID#heading\|label]]` | Heading link with custom label | v2 |

**Parsing rules:**
- `[[` opens a link, `]]` closes it
- Interior text is parsed by `parseWikiLinkText()` (existing function, no new parser)
- Multiple links per description are allowed
- Links can appear anywhere in the description (beginning, middle, end)
- Nested brackets are not supported: `[[a [[b]] c]]` is undefined
- Non-matching note IDs render as plain text, not as broken links
- Empty links (`[[]]`) are ignored

---

## 6. Component Changes

| Component | Change |
|-----------|--------|
| `TimeEntryCard.svelte` | Wiki-link rendering in read mode; autocomplete in edit mode |
| `NewEntryRow.svelte` | Autocomplete dropdown for `[[` in description field |
| `LinkedTimeEntries.svelte` | Redesign: show description/date/duration/contract; add [+] picker; add click-to-navigate |
| New: `WikiLinkInput.svelte` | Reusable text input with `[[` autocomplete (shared by TimeEntryCard and NewEntryRow) |
| New: `WikiLinkRenderer.svelte` | Renders plain text with `[[...]]` patterns as clickable link spans |
| New: `TimeEntryPicker.svelte` | Minimal modal for linking time entries from notes |
| `data-service.ts` | Add `linkNoteTimeEntry(noteId, timeEntryId, headingAnchor?)` method |
| `types.ts` | Add `LinkedNoteDisplay` type for resolved note title + metadata |

---

## 7. Phasing

### v1 -- This Sprint (CL-8)

- `[[NOTE_ID]]` syntax in time entry descriptions
- Autocomplete dropdown triggered by `[[`
- Parse-on-save link reconciliation (create/remove link records)
- Clickable link rendering in read mode with note title resolution
- Redesigned `LinkedTimeEntries` showing description, date, duration, contract
- `linkNoteTimeEntry()` in DataService
- Navigation: note links in time entries open the note; linked entries in notes navigate to the timesheet

### v2 -- Future

- `[[NOTE_ID#heading]]` heading-level navigation
- `[[NOTE_ID|label]]` custom label display
- Time entry picker [+] from notes (may ship as v1 stretch)
- Stale link detection (deleted notes/entries)
- Cross-contract link indicators

---

## 8. Rationale for Key Decisions

**Why plain text input, not TipTap for descriptions?**
Descriptions are short -- typically one line. TipTap adds ~200KB of JS, complex state management, and ProseMirror abstractions that are overkill for a single-line text field. A plain input with autocomplete delivers 90% of the value at 10% of the complexity.

**Why inline links, not card-level note indicators?**
The previously explored design (`notes-integration-design.md`) added dedicated note rows below the description on each time entry card. That approach is visually clean but heavier: it requires eager-loading linked note metadata with every time entry, adds vertical space to cards, and introduces popover preview components. Inline `[[...]]` links in the description are zero-cost when no links exist and self-documenting when they do -- the link text is part of the description the user wrote.

**Why parse-on-save, not real-time link tracking?**
The description already saves on blur/debounce. Parsing at save time is the natural integration point. Maintaining a separate real-time link state would require tracking cursor position, partial `[[` input, and intermediate states -- complexity with no user benefit.

**Why reuse `parseWikiLinkText()`?**
It already handles `NOTE_ID`, `NOTE_ID|label`, `NOTE_ID#heading`, and `NOTE_ID#heading|label`. Writing a second parser for the same syntax in a different context would be duplication.

**Why defer heading anchors to v2?**
The data model and parser already support headings -- zero work is thrown away. But heading-level navigation requires resolving slugs to scroll positions, handling renamed headings, and adding a heading picker to autocomplete. That is significant UI complexity for a feature most users will not need in v1 (note-level links cover the common case). Storing the anchor in v1 means upgrading to v2 is seamless.

**Why a [+] picker for note-to-entry links but not for entry-to-note links?**
Note IDs (e.g., `BIGCH.20260519.001`) are human-readable and typeable -- users can type `[[BIGCH...]]` in a description. Time entry IDs are UUIDs (`te-a1b2c3d4...`) -- not typeable. The picker is necessary only where manual input is impractical.

---

## 9. Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| Note is deleted while linked from a time entry | `[[NOTE_ID]]` renders as plain text (no link styling). Link record remains in DB for cleanup. |
| Time entry is deleted while linked from a note | Linked entry row shows "(deleted)" in gray. Unlink button remains. |
| Description has `[[INVALID_ID]]` | Rendered as plain text. No link record created. |
| User types `[[` but abandons (no `]]`) | No parsing occurs. Text saved as-is. |
| Same note linked twice in one description | Only one link record created. Second `[[NOTE_ID]]` renders as a link too. |
| Description exceeds reasonable length with many links | No limit enforced. Reconciliation handles any count. |
| Autocomplete returns no results | Dropdown shows "No matching notes" and dismisses on further typing or Escape. |
