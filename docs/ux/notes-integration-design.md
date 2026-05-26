# Note-Time Entry Integration Design

Sprint 012-UX / UX-3: Design specification for linking notes and time entries.

---

## 1. Summary of Integration Approach

Notes and time entries serve different roles in a consultant's workflow: time entries record *what was done and for how long*; notes record *the detail, context, and thinking behind the work*. The integration should let a consultant trace from a time entry ("Reviewed API design -- 2.5h") to the note where the review details live, and from a note back to the billable entries it relates to. The design philosophy is **lightweight references, not embedded content**. A time entry card shows a subtle indicator that a linked note exists, with the note content accessible on demand through a popover or inline expansion -- never by switching modes or losing timesheet context. Linking is an intentional action (not automatic) because the consultant decides which notes are worth cross-referencing. Most entries will have zero linked notes; the design must not waste space on the empty case.

---

## 2. Time Entry Card with Linked Notes

### Design Principles

- **Zero notes = zero visual footprint.** No placeholder, no empty icon, no "link a note" affordance on every card. The card looks exactly as it does today.
- **One note = a small indicator.** A note icon with the note title appears as a subtle row below the description, only when a link exists.
- **Multiple notes = a count indicator that expands.** A note icon with a count badge, expandable to show all linked note titles.
- **The indicator is interactive.** Clicking a linked note title opens a popover with a note preview. The user never leaves the timesheet.

### Card Layout (Redesigned Description-First Format)

The integration extends the redesigned card from the timesheet layout work. The linked notes row sits between the description and the contract metadata, visually subordinate to both.

```
0 linked notes (default -- most entries):

+-----------------------------------------------------------+
|  Reviewed API design feedback                     2h 0m   |
|  * Client A -- API Contract                               |
+-----------------------------------------------------------+


1 linked note:

+-----------------------------------------------------------+
|  Reviewed API design feedback                     2h 0m   |
|  [note] BIGCH.20260519.001 -- API Review Notes            |
|  * Client A -- API Contract                               |
+-----------------------------------------------------------+


3 linked notes:

+-----------------------------------------------------------+
|  Reviewed API design feedback                     2h 0m   |
|  [note] BIGCH.20260519.001 -- API Review Notes            |
|  [note] BIGCH.20260519.002 -- Design Decisions            |
|  [note] BIGCH.20260518.003 -- Sprint Retro                |
|  * Client A -- API Contract                               |
+-----------------------------------------------------------+
```

### Visual Specification

| Element | Style | Rationale |
|---------|-------|-----------|
| Note icon | Small document icon (12px), `text-stone-400` | Recognisable but unobtrusive; consistent with the warm stone palette |
| Note ID | Monospace `text-xs text-stone-400` | Matches existing note ID convention; monospace for scannability |
| Note title | `text-xs text-stone-500` after a ` -- ` separator | Readable but does not compete with the entry description |
| Heading anchor | Appended as `# heading-name` after the note ID when present | Shows the specific section reference |
| Row spacing | `py-0.5` per linked note row, `mt-1` above the group | Compact; the row should feel like metadata, not content |
| Click target | Entire note row is clickable | Opens note preview popover |

### Rationale

Showing note titles inline (rather than just a count badge or icon) is a deliberate choice. A consultant scanning their timesheet needs to see *which* note is linked, not just *that* a note is linked. "API Review Notes" tells them something; a badge saying "1" does not. Since most entries have 0 linked notes and the remainder typically have 1, the vertical cost is one line per linked entry -- acceptable.

A hoverable tooltip was considered and rejected. Tooltips require precise cursor positioning, disappear on mouse-out, and are invisible on touch devices. Inline display is more accessible and works on mobile.

---

## 3. Note Linking Interaction

### 3.1 Linking from a Time Entry (Primary Flow)

This is the expected primary direction: the consultant finishes a time entry and wants to attach the relevant note.

**Step 1: Trigger.** Right-click the time entry card (desktop) or tap a "..." overflow menu to reveal a context action "Link Note". Alternatively, when the card is in edit mode (description is focused), a small "Link Note" button appears in the card footer alongside the existing delete "x".

**Step 2: Note picker modal.** A compact modal opens with:

```
+---------------------------------------------+
|  Link a Note                            [x] |
|                                              |
|  [Search notes... ___________________]       |
|                                              |
|  Same contract (API Contract):               |
|  +- BIGCH.20260519.001 -- API Review Notes   |
|  +- BIGCH.20260519.002 -- Design Decisions   |
|  +- BIGCH.20260518.003 -- Sprint Retro       |
|                                              |
|  Same date (May 19):                         |
|  +- OTHCL.20260519.001 -- Onboarding Call    |
|                                              |
|  Recent notes:                               |
|  +- BIGCH.20260517.001 -- Weekly Summary     |
|  +- OTHCL.20260516.002 -- Invoice Draft      |
|                                              |
+---------------------------------------------+
```

**Step 3: Selection.** The consultant clicks a note to select it. If the note has headings (H1/H2/H3), a secondary step appears:

```
+---------------------------------------------+
|  Link to specific section?              [x]  |
|                                              |
|  BIGCH.20260519.001 -- API Review Notes      |
|                                              |
|  ( ) Entire note                             |
|  ( ) # api-endpoints                         |
|  ( ) # authentication-flow                   |
|  ( ) # design-review           <-- selected  |
|  ( ) # open-questions                        |
|                                              |
|  [Link]                           [Cancel]   |
+---------------------------------------------+
```

If the note has no headings, the link is created immediately on click (skip step 3).

**Step 4: Confirmation.** The link is created via `dataService.linkNoteTimeEntry(timeEntryId, noteId, headingAnchor?)`. The note row appears on the card immediately (optimistic update). No page reload.

### 3.2 Linking from a Note (Secondary Flow)

From the note editor panel, the existing "Linked Time Entries" section gains an "Add" button:

```
Linked Time Entries                    [+]
+- May 19 -- Reviewed API design -- 2h 0m    x
+- May 18 -- Sprint planning -- 1h 30m       x
```

Clicking [+] opens a time entry picker:

```
+---------------------------------------------+
|  Link a Time Entry                      [x] |
|                                              |
|  Same contract, this week (May 19-25):       |
|  +- Mon 19: Reviewed API design -- 2h 0m    |
|  +- Mon 19: Client call -- 0h 30m           |
|  +- Tue 20: Sprint planning -- 1h 30m       |
|                                              |
|  Same contract, last week (May 12-18):       |
|  +- Wed 14: Code review -- 3h 0m            |
|  +- Fri 16: Documentation -- 1h 0m          |
|                                              |
+---------------------------------------------+
```

The picker groups entries by week, showing only entries for the same contract as the current note. This narrows the list significantly (a solo consultant with 3-5 contracts will have ~5-15 entries per contract per week).

### 3.3 Unlinking

- **From time entry card:** Right-click > "Unlink Note" or hover over the linked note row to reveal an "x" button. Clicking it removes the link immediately (no confirmation modal -- the link is metadata, not content; nothing is deleted).
- **From note editor:** The existing "x" button on each linked entry row already calls `unlinkNoteTimeEntry()`. This stays as-is.

### 3.4 Considered and Rejected Approaches

| Approach | Why rejected |
|----------|-------------|
| **Wiki-link syntax in description** (`[[BIGCH.20260519.001]]`) | Time entry descriptions are plain text, not rich text. Adding a parser for descriptions adds complexity. The description field should remain a simple string. Wiki-links belong in notes (TipTap), not in time entry descriptions. |
| **Auto-suggestion** (auto-link notes on same date/contract) | Creates noise. A consultant may have 3 notes and 5 entries on the same contract/date; auto-linking all of them produces false connections. Linking should be intentional. |
| **Drag-and-drop** (drag note onto entry) | Requires both notes and entries to be visible simultaneously, which is the split-view problem. Also imprecise on touch devices. Not a primary interaction. Could be added later as a shortcut. |
| **Inline link creation** (type a note ID in the description) | Conflates the description field with a linking mechanism. The description is for human-readable text, not structured references. |

### 3.5 API Surface Required

The current DataService interface supports `getNoteTimeEntries()` and `unlinkNoteTimeEntry()` but is missing:

| Method | Signature | Purpose |
|--------|-----------|---------|
| `linkNoteTimeEntry` | `(noteId: string, timeEntryId: string, headingAnchor?: string) => Promise<void>` | Create a link |
| `getTimeEntryNotes` | `(timeEntryId: string) => Promise<NoteTimeEntryLink[]>` | Get linked notes for a time entry (reverse direction) |
| `searchNotes` | `(query: string, contractId?: string) => Promise<NotePreview[]>` | Search notes for the picker |

The first two are straightforward additions to the existing `note_time_entry_link` table queries. The third may already exist in some form for the note list panel.

---

## 4. Navigation Flow

### 4.1 From Timesheet to Note (Primary Direction)

**Interaction:** The consultant clicks a linked note row on a time entry card.

**Behaviour:** A **popover** appears anchored to the clicked row, showing a note preview (see Section 5). The popover contains a "Open in editor" link.

```
+-----------------------------------------------------------+
|  Reviewed API design feedback                     2h 0m   |
|  [note] BIGCH.20260519.001 -- API Review Notes  <-- click |
|  * Client A -- API Contract                               |
+---+-------------------------------------------------------+
    |  +----------------------------------------------+
    |  |  BIGCH.20260519.001                          |
    |  |  API Review Notes                            |
    |  |                                              |
    |  |  ## Design Review                            |
    |  |  The API endpoints follow REST conventions   |
    |  |  but the auth flow needs rework. Key issues: |
    |  |  - Token refresh is not handled...           |
    |  |  ...                                         |
    |  |                                              |
    |  |  [Open in editor]                            |
    |  +----------------------------------------------+
    +
```

**"Open in editor" behaviour:** Navigates to notes mode with the linked note selected. This is a full context switch (`navigationContext.selectContract(contractId)` + `navigationContext.selectNote(noteId)`). The browser's back button (or a keyboard shortcut) returns to the timesheet.

**Rationale for popover instead of split view:**

A split view (timesheet + note side-by-side) was considered seriously. It would let the consultant read a note while viewing their timesheet. However:

1. **Screen real estate.** The redesigned timesheet uses a 2-panel layout (sidebar + content). Splitting the content panel further creates two narrow columns, both too cramped for comfortable reading.
2. **Frequency of use.** Most linked note views are quick reference checks ("which note was this about?"), not sustained reading. A popover handles the 80% case. The 20% case (deep reading) warrants a full mode switch.
3. **Complexity.** A split view requires a new layout mode, resize handles, state management for the split, and mobile considerations. The popover requires one component.

### 4.2 From Note to Timesheet (Secondary Direction)

**Interaction:** The consultant clicks a linked time entry in the note editor's "Linked Time Entries" section.

**Behaviour:** Navigates to time entries mode with the corresponding week selected and the day scrolled into view (`navigationContext.selectTimeEntries()` + `navigationContext.selectWeek(weekStart)`, then scroll to the specific entry). The entry briefly highlights (a subtle pulse or background flash) so the user can spot it.

### 4.3 Back Navigation

The standard browser/app back navigation handles returning to the previous context. Both directions (timesheet-to-note and note-to-timesheet) push to the navigation history. No custom "back" button is needed beyond what the app shell already provides for mobile (the existing back button in the mobile push/pop navigation).

### 4.4 Keyboard Navigation

| Shortcut | Action | Context |
|----------|--------|---------|
| `Escape` | Dismiss note preview popover | Timesheet with popover open |
| `Enter` | Open note in editor (when popover is focused) | Timesheet with popover open |

No additional keyboard shortcuts are proposed. The linking interaction happens through the picker modal, which follows standard modal keyboard patterns (Escape to close, Tab to navigate, Enter to select).

---

## 5. Note Preview Specifications

### What Is Shown in the Popover

The note preview popover displays:

```
+----------------------------------------------+
|  BIGCH.20260519.001                    [x]   |   <-- note ID + close
|  API Review Notes                            |   <-- note title (H2 weight)
|                                              |
|  ## Design Review                            |   <-- heading anchor target
|  The API endpoints follow REST conventions   |   <-- first ~200 chars of content
|  but the auth flow needs rework. Key issues: |      from the heading anchor
|  - Token refresh is not handled              |      (or from the start if no anchor)
|  - Session expiry returns 500...             |
|                                              |
|  [Open in editor]                            |   <-- navigation link
+----------------------------------------------+
```

### Content Rules

| Scenario | What is shown |
|----------|--------------|
| Link with no heading anchor | Note title + first ~200 characters of note content (plain text, stripped of formatting) |
| Link with heading anchor | Note title + heading text + first ~200 characters after that heading |
| Note has been deleted | Note ID shown with "(deleted)" label in gray. No preview. No "Open in editor" link. |
| Note content is empty | Note title + "(empty note)" in gray italic |

### Preview Dimensions

- **Max width:** 400px
- **Max height:** 300px (content scrollable beyond this)
- **Position:** Below the clicked note row, left-aligned with the note icon. Flips above if insufficient space below.
- **Dismiss:** Click outside, press Escape, or click the [x] button.

### Rationale: Why Not Inline Expansion?

An inline expansion (accordion-style, expanding the card to show note content) was considered. It would push subsequent cards down, disrupting the visual flow of the timesheet. A consultant scanning a day's entries does not want the layout to shift when they peek at a note. The popover overlays without reflow.

---

## 6. Linked Entries in Notes (Redesigned)

### Current State

The existing `LinkedTimeEntries.svelte` shows only truncated entry IDs (`te-abc123...`) with unlink buttons. This is nearly useless -- the consultant cannot tell which entry is which without clicking through.

### Redesigned Layout

The linked entries section adopts the description-first format used in the timesheet:

```
Linked Time Entries                              [+]

+-------------------------------------------------------+
|  Mon, May 19 -- Reviewed API design feedback   2h 0m  |
|  * Client A -- API Contract                        x  |
+-------------------------------------------------------+
+-------------------------------------------------------+
|  Tue, May 20 -- Sprint planning session        1h 30m |
|  * Client A -- API Contract                        x  |
+-------------------------------------------------------+
```

### Specification

| Element | Content | Style |
|---------|---------|-------|
| Date | Abbreviated day + date (e.g., "Mon, May 19") | `text-xs font-medium text-stone-500` |
| Description | Entry description text | `text-sm text-stone-700` (primary text) |
| Duration | Formatted as `Xh Ym` | `text-xs text-stone-400`, right-aligned |
| Contract | Client name + contract name with colour dot | `text-xs text-stone-400` |
| Unlink button | "x" on hover | `text-stone-300 hover:text-red-500`, right of contract line |
| Click action | Entire card is clickable | Navigates to the entry in the timesheet (see 4.2) |

### Sort Order

Linked entries are sorted by date descending (most recent first), matching the timesheet's natural ordering.

### Rationale

Showing the description, date, and duration makes each linked entry self-explanatory. The consultant can see "this note relates to the 2-hour API review I did on Monday" without leaving the note editor. The format mirrors the timesheet card so the visual language is consistent across modes.

---

## 7. Edge Cases

### 7.1 Linked Note Is Deleted

**Scenario:** A note is deleted (via the note list panel's Delete button) while time entries still reference it.

**Behaviour:** The link row on the time entry card shows the note ID with a "(deleted)" label in gray. The note preview popover shows "This note has been deleted." No "Open in editor" link. The unlink action remains available so the consultant can clean up stale references.

**Data:** The `note_time_entry_link` row is not cascade-deleted when the note is deleted. This is intentional -- the consultant should see that a link existed and explicitly clean it up. If the link rows were silently removed, the consultant would lose the signal that supporting documentation once existed.

**Alternative considered:** Cascade delete (remove link rows when a note is deleted). Rejected because silent data loss is worse than a stale reference. The stale reference is low-cost (one gray line on a card) and self-documenting.

### 7.2 Linked Time Entry Is Deleted

**Scenario:** A time entry is deleted while notes still reference it.

**Behaviour:** The linked entry row in the note editor shows "(deleted entry)" in gray. The click-to-navigate action is disabled. The unlink "x" remains available.

**Data:** Same principle -- no cascade delete on the link table. The note's "Linked Time Entries" section shows the orphaned reference until manually unlinked.

### 7.3 Many Links (>5 per entry)

**Scenario:** A time entry has more than 5 linked notes (unusual but possible for a long working session with extensive notes).

**Behaviour:** After 3 linked notes, the remaining notes are collapsed behind a "+N more" toggle:

```
+-----------------------------------------------------------+
|  Full-day workshop -- API architecture           8h 0m    |
|  [note] BIGCH.20260519.001 -- Workshop Agenda             |
|  [note] BIGCH.20260519.002 -- Architecture Decisions      |
|  [note] BIGCH.20260519.003 -- Action Items                |
|  +4 more notes...                                         |
|  * Client A -- API Contract                               |
+-----------------------------------------------------------+
```

Clicking "+4 more notes..." expands to show all linked notes inline.

**Rationale:** 3 is the threshold because it adds 3 lines of height to the card, which is roughly the height of a short description. Beyond that, the note list starts to dominate the card. The threshold is not configurable -- it is a fixed design constant.

### 7.4 Duplicate Link Attempt

**Scenario:** The consultant tries to link a note that is already linked to the same time entry.

**Behaviour:** The picker modal shows the already-linked note with a checkmark icon and grays it out. It cannot be selected again. No error message needed -- the state is visually clear.

### 7.5 Linking to a Note on a Different Contract

**Scenario:** The consultant links a note from Contract B to a time entry on Contract A.

**Behaviour:** Allowed without restriction. Cross-contract links are valid (e.g., a process note applicable to multiple clients). The picker's "Same contract" section will not show it, but the search field will find it. No warning.

### 7.6 Heading Anchor Becomes Invalid

**Scenario:** A linked note references heading anchor `#design-review`, but the heading is later renamed or deleted in the note.

**Behaviour:** The link still works -- it opens the note. If the heading anchor no longer exists in the note content, the popover shows the note from the beginning (graceful fallback). The heading anchor text is still displayed in the link row (it was valid when the link was created). No automatic cleanup -- the anchor is a hint, not a hard reference.

---

## 8. Layout Accommodation

### How Notes Fit in the 2-Panel Timesheet Layout

The redesigned timesheet uses a 2-panel layout in time mode:

```
+------------------+--------------------------------------------+
|  SIDEBAR         |  WEEK STRIP  (compact nav, ~48px tall)     |
|  (Panel 1)       |  [Mon] [Tue] [Wed*] [Thu] [Fri]            |
|                  |============================================|
|  Contracts       |                                            |
|  (colour-coded)  |  SCROLLABLE DAY SECTIONS                   |
|                  |                                            |
|  - Client A      |  Wednesday, May 21 -- TODAY       5.5 hrs  |
|  - Client B      |  +-------------------------------------+  |
|                  |  | Reviewed API design           2.0h  |  |
|  [Timer]         |  | [note] BIGCH...001 -- API Review     |  |
|                  |  | * Client A -- API Contract           |  |
|                  |  +-------------------------------------+  |
|                  |  +-------------------------------------+  |
|                  |  | Wrote onboarding guide         1.5h  |  |
|                  |  | * Client B -- Onboarding             |  |
|                  |  +-------------------------------------+  |
|                  |                                            |
+------------------+--------------------------------------------+
```

### Key Layout Rules

1. **Linked note rows are part of the card.** They sit between the description and the contract metadata row. They do not break the card boundary or add padding beyond `py-0.5` per row.

2. **The popover overlays, it does not reflow.** When a note preview popover opens, it appears as a floating layer above the timesheet content. No cards shift. The scroll position is preserved.

3. **The picker modal is app-level.** The note linking picker is a standard modal (backdrop + centered content), not anchored to the card. This avoids positioning issues with cards near the viewport edge.

4. **Mobile layout:** On mobile (single-panel push/pop), the note preview popover becomes a bottom sheet (slides up from the bottom of the screen). The "Open in editor" link performs a standard push navigation to the note editor. The back button returns to the timesheet.

5. **No split view.** The content panel is never divided between timesheet and note editor. The 2-panel layout (sidebar + content) is maintained at all times in time mode.

### Vertical Space Budget

For a typical day with 3-5 entries:

| Entry state | Card height (approx.) |
|-------------|----------------------|
| No linked notes | ~52px (description + contract row) |
| 1 linked note | ~70px (+18px for note row) |
| 3 linked notes | ~106px (+54px for note rows) |
| 3 notes + collapsed overflow | ~118px (+66px for 3 rows + "+N more") |

The 1-linked-note case (the most common linked scenario) adds roughly one line of text. This is an acceptable cost for the information it provides.

---

## 9. Wireframes

### 9.1 Time Entry Card Variants

```
CARD: 0 linked notes
+-----------------------------------------------------------+
|  Reviewed API design feedback                     2h 0m   |
|  * Client A -- API Contract                               |
+-----------------------------------------------------------+

CARD: 1 linked note
+-----------------------------------------------------------+
|  Reviewed API design feedback                     2h 0m   |
|  [doc] BIGCH.20260519.001 -- API Review Notes             |
|  * Client A -- API Contract                               |
+-----------------------------------------------------------+

CARD: 1 linked note with heading anchor
+-----------------------------------------------------------+
|  Reviewed API design feedback                     2h 0m   |
|  [doc] BIGCH.20260519.001#design-review -- API Review...  |
|  * Client A -- API Contract                               |
+-----------------------------------------------------------+

CARD: 3 linked notes
+-----------------------------------------------------------+
|  Full-day architecture workshop                   8h 0m   |
|  [doc] BIGCH.20260519.001 -- Workshop Agenda              |
|  [doc] BIGCH.20260519.002 -- Architecture Decisions       |
|  [doc] BIGCH.20260519.003 -- Action Items                 |
|  * Client A -- API Contract                               |
+-----------------------------------------------------------+

CARD: 5 linked notes (overflow)
+-----------------------------------------------------------+
|  Full-day architecture workshop                   8h 0m   |
|  [doc] BIGCH.20260519.001 -- Workshop Agenda              |
|  [doc] BIGCH.20260519.002 -- Architecture Decisions       |
|  [doc] BIGCH.20260519.003 -- Action Items                 |
|  +2 more notes...                                         |
|  * Client A -- API Contract                               |
+-----------------------------------------------------------+

CARD: 1 linked note (deleted)
+-----------------------------------------------------------+
|  Reviewed API design feedback                     2h 0m   |
|  [doc] BIGCH.20260519.001 (deleted)                       |
|  * Client A -- API Contract                               |
+-----------------------------------------------------------+
```

### 9.2 Note Linking Picker Modal

```
+---------------------------------------------------+
|  Link a Note                                 [x]  |
|                                                   |
|  [Search notes... ________________________]       |
|                                                   |
|  SAME CONTRACT (API Contract):                    |
|  +----------------------------------------------+|
|  | [doc] BIGCH.20260519.001                      ||
|  |       API Review Notes                        ||
|  +----------------------------------------------+|
|  | [doc] BIGCH.20260519.002                      ||
|  |       Design Decisions                        ||
|  +----------------------------------------------+|
|  | [check] BIGCH.20260518.003  (already linked)  ||
|  |         Sprint Retro                          ||
|  +----------------------------------------------+|
|                                                   |
|  SAME DATE (May 19):                              |
|  +----------------------------------------------+|
|  | [doc] OTHCL.20260519.001                      ||
|  |       Onboarding Call Notes                   ||
|  +----------------------------------------------+|
|                                                   |
|  RECENT NOTES:                                    |
|  +----------------------------------------------+|
|  | [doc] BIGCH.20260517.001                      ||
|  |       Weekly Summary                          ||
|  +----------------------------------------------+|
|  | [doc] OTHCL.20260516.002                      ||
|  |       Invoice Draft                           ||
|  +----------------------------------------------+|
|                                                   |
+---------------------------------------------------+
```

### 9.3 Heading Anchor Selection (Sub-Step)

```
+---------------------------------------------------+
|  Link to specific section?                   [x]  |
|                                                   |
|  BIGCH.20260519.001 -- API Review Notes           |
|                                                   |
|  (*) Entire note                                  |
|  ( ) # api-endpoints                              |
|  ( ) # authentication-flow                        |
|  ( ) # design-review                              |
|  ( ) # open-questions                             |
|                                                   |
|           [Link]              [Cancel]            |
+---------------------------------------------------+
```

### 9.4 Note Preview Popover

```
               linked note row is clicked
                        |
                        v
+-----------------------------------------------------------+
|  Reviewed API design feedback                     2h 0m   |
|  [doc] BIGCH.20260519.001 -- API Review Notes   <-- here  |
|  * Client A--+-- API Contract                             |
+--------------+--------------------------------------------+
               |                                            |
               |  +--------------------------------------+  |
               |  |  BIGCH.20260519.001             [x]  |  |
               |  |  API Review Notes                    |  |
               |  |                                      |  |
               |  |  ## Design Review                    |  |
               |  |                                      |  |
               |  |  The API endpoints follow REST       |  |
               |  |  conventions but the auth flow       |  |
               |  |  needs rework. Key issues:           |  |
               |  |                                      |  |
               |  |  - Token refresh is not handled      |  |
               |  |  - Session expiry returns 500        |  |
               |  |    instead of 401                    |  |
               |  |  - Rate limiting headers are...      |  |
               |  |                                      |  |
               |  |  [Open in editor]                    |  |
               |  +--------------------------------------+  |
               |                                            |
               +--------------------------------------------+
```

### 9.5 Note Editor -- Linked Time Entries (Redesigned)

```
+--------------------------------------------------------------+
|  [B] [I] | [H1] [H2] [H3] | [*] [1.] | [--] [Link] |Att|  |
+--------------------------------------------------------------+
|                                                               |
|  # API Review Notes                                           |
|                                                               |
|  ## Design Review                                             |
|                                                               |
|  The API endpoints follow REST conventions but the auth       |
|  flow needs rework...                                         |
|                                                               |
+--------------------------------------------------------------+
|                                                               |
|  Linked from                                                  |
|  [BIGCH.20260520.001 * Follow-up Notes]                       |
|                                                               |
|  Linked Time Entries                                    [+]   |
|  +--------------------------------------------------------+  |
|  |  Mon, May 19 -- Reviewed API design feedback    2h 0m  |  |
|  |  * Client A -- API Contract                          x |  |
|  +--------------------------------------------------------+  |
|  +--------------------------------------------------------+  |
|  |  Tue, May 20 -- Sprint planning session         1h 30m |  |
|  |  * Client A -- API Contract                          x |  |
|  +--------------------------------------------------------+  |
|                                                               |
|  Attachments                                                  |
|  [IMG] api-diagram.png  1.2 MB  x                            |
+--------------------------------------------------------------+
```

### 9.6 Time Entry Picker (from Note Editor)

```
+---------------------------------------------------+
|  Link a Time Entry                           [x]  |
|                                                   |
|  THIS WEEK (May 19-25):                           |
|  +----------------------------------------------+|
|  | Mon, May 19                                   ||
|  | Reviewed API design feedback          2h 0m   ||
|  +----------------------------------------------+|
|  | Mon, May 19                                   ||
|  | Client call -- kickoff                0h 30m  ||
|  +----------------------------------------------+|
|  | Tue, May 20                                   ||
|  | Sprint planning session               1h 30m  ||
|  +----------------------------------------------+|
|                                                   |
|  LAST WEEK (May 12-18):                           |
|  +----------------------------------------------+|
|  | Wed, May 14                                   ||
|  | Code review -- auth module            3h 0m   ||
|  +----------------------------------------------+|
|  | Fri, May 16                                   ||
|  | Documentation -- API spec             1h 0m   ||
|  +----------------------------------------------+|
|                                                   |
|  [Load earlier weeks]                             |
|                                                   |
+---------------------------------------------------+
```

---

## 10. Implementation Notes

This section is not a build plan but captures technical observations for the implementing sprint (CL-8).

### Data Service Additions

```typescript
// New methods required on the DataService interface:
linkNoteTimeEntry(noteId: string, timeEntryId: string, headingAnchor?: string): Promise<void>;
getTimeEntryNotes(timeEntryId: string): Promise<NoteTimeEntryLink[]>;
searchNotes(query: string, contractId?: string): Promise<NotePreview[]>;
```

The `getTimeEntryNotes()` method is the reverse of the existing `getNoteTimeEntries()`. It queries the same `note_time_entry_link` table but joins to `notes` for title data instead of to `time_entries`.

### Data Loading Consideration

The timesheet currently loads entries via `getWeeklyTimeEntries()`, which returns `WeekData` containing `TimeEntryDisplay` objects. To show linked notes on each card, the `TimeEntryDisplay` type needs extending:

```typescript
export type TimeEntryDisplay = {
  // ... existing fields ...
  linkedNotes: LinkedNotePreview[];  // NEW
};

export type LinkedNotePreview = {
  noteId: string;
  noteTitle: string;
  headingAnchor: string | null;
  isDeleted: boolean;
};
```

This data should be loaded eagerly with the time entry (JOIN query), not lazily per-card. Loading linked notes for each card individually would create N+1 query problems when scrolling through weeks with many entries.

### Component Impact

| Component | Change |
|-----------|--------|
| `TimeEntryCard.svelte` | Add linked note rows below description; add popover trigger; add context menu "Link Note" action |
| `LinkedTimeEntries.svelte` | Redesign to show description-first format; add [+] button; add click-to-navigate |
| New: `NoteLinkingPicker.svelte` | Modal component for searching/selecting notes to link |
| New: `TimeEntryLinkingPicker.svelte` | Modal component for selecting time entries to link (from note editor) |
| New: `NotePreviewPopover.svelte` | Popover component for inline note preview |
