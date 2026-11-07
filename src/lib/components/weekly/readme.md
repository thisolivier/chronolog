# Weekly Time Entry Components

Components for displaying and editing time entries, used by the layout panels.

## Components

- **WeekStrip.svelte** — Sticky horizontal week strip showing Mon-Sun with day numbers, a compact hours/minutes total per day, a per-client colour bar, today highlight, prev/next week navigation, a Today button (sprint 041-CL: `onToday`, disabled on the current week; the panel calls `navigation.showTimeEntryDay(today)`, so the week goes in the URL and today's section is scrolled to and highlighted) and the weekly status (opens WeekStatusMenu). Tapping a day scrolls TimeEntriesPanel to that day.
- **WeekStatusMenu.svelte** — Keyboard-accessible menu for the week status: Unsubmitted, Draft ready, Submitted.
- **week-strip-segments.ts** — Pure helper for WeekStrip's per-day colour bar: aggregates minutes per client into one segment per client (keyed by `clientId`, ordered by first appearance). Unit-tested in `week-strip-segments.test.ts`.
- **TimerIndicator.svelte** — The app bar's reflection of the capture (sprint 053-DR, SH-04), shown only when AppShell's `reflection` says no timer widget is on screen. The capture's own identity (ContractMark, contract first, client under it; never the browsed contract). Running: the clock (ticking from the shared start, so it keeps time with no widget mounted) and the pulsing dot at the top right. Stopped: "Finish entry" and the frozen duration, no running light. `data-testid="timer-indicator"`, `data-state="running|finish"`. With no capture and the desktop sidebar hidden it keeps the old "Timer" access (`timer-indicator-collapsed`). Reads from the shared `timer-state` store.
- **TimeEntryCard.svelte** — Individual time entry card with description-first layout and a left border coloured by client. Inline editors for description, contract, deliverable / work type and time. Enter (or leaving the field) saves and Escape cancels in every editor. Delete is visible on hover, keyboard focus and touch. "Add deliverable…" shows only when the contract has deliverables, or on hover/focus. Descriptions clamp to three lines with Show more. Save errors appear inline. Supports `[[NOTE_ID]]` wiki-link syntax; a click on a rendered link calls `onNoteLinkClick` (TimeEntriesPanel opens the note in notes mode and focuses its editor). "Formerly: …" lines render as their own muted line. A contract change always clears the deliverable and work type; when there was one, the pickers open on the new contract at none with a one-line notice. The card is focusable (`tabindex=-1`, `data-entry-id`) so a save can focus it, and editors closed from the keyboard give focus back to their control. Attach note (049-UI, under Delete, shown the same way) makes a note and links it; `onNoteAttached` then opens it (TimeEntriesPanel: `openNote(…, { focusEditor: 'new-note' })`, which focuses the editor on touch screens too).
- **AttachNoteButton.svelte** — The card's "Attach note" icon button (sprint 049-UI): tooltip, `aria-disabled` with the reason as tooltip when the entry has no contract, and one note per click (a press while one is running is ignored).
- **attach-note.ts** — `appendWikiLinkToDescription` (adds `[[NOTE_ID]]` after a space at the end of the text, before any "Formerly" lines; no duplicate), `attachNoteBlockedReason`, and `attachNewNoteToEntry` (an empty note on the entry's contract through the data service, then the entry saved with the link, so offline both go through the outbox). Tested.
- **NewEntryRow.svelte** — Card-style inline form for adding a time entry, matching TimeEntryCard. Contract, deliverable and work type selects, plus a time input supporting duration and range formats. Inline errors: "Pick a contract", the parser hint, and "Couldn't save". On phone the contract sits on its own row.
- **WikiLinkRenderer.svelte** — Renders `[[NOTE_ID]]` patterns as clickable inline link spans. Used in TimeEntryCard read mode.
- **WikiLinkInput.svelte** — Plain text input with `[[` autocomplete dropdown for note search. Used in TimeEntryCard edit mode. Focuses on mount through an effect rather than the autofocus attribute.
- **formerly-lines.ts** — `splitFormerlyLines(description)` separates the "Formerly: …" lines (from `appendFormerlyLine`) from the description. Tested.
- **entry-focus.ts** — `focusSavedEntry(root, entryId, date)`: focus the saved entry's card, else the day's "+" (`data-add-entry`). Used by TimeEntriesPanel after a save. Tested.
- **time-entry-events.ts** — `time-entry-saved` window event (constant, dispatch and read helpers) used by the sidebar TimerWidget / Add Entry modal to tell TimeEntriesPanel to refresh its loaded weeks.

## Data Flow

Components receive data as props from the parent layout panel (`TimeEntriesPanel`). Mutations (create, update, delete) go through the `DataService` from context within each component, with `onUpdated`/`onEntryCreated` callbacks to trigger parent re-fetches.

TimeEntriesPanel (in `components/layout`) shows all seven days of the selected week, future days included. Older weeks are appended under "Show the week before". A week has no month divider inside it. When no sidebar TimerWidget is mounted, the panel renders a footer TimerWidget.

## Related Files

- `src/lib/utils/iso-week.ts` — ISO week calculation and formatting utilities
- `src/lib/utils/duration.ts` — Duration parsing and formatting for time inputs and totals
- `src/lib/utils/client-colors.ts` — Client color palette (left-border, dot and background classes)
- `src/lib/stores/timer-state.svelte.ts` — Shared timer display state
- `src/lib/server/db/queries/time-entries-weekly.ts` — Weekly grouped query functions
- `src/lib/server/db/queries/weekly-statuses.ts` — Weekly status CRUD operations
- `src/lib/components/layout/TimeEntriesPanel.svelte` — Panel hosting these components
