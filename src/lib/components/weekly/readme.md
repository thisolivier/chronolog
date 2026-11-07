# Weekly Time Entry Components

Components for displaying and editing time entries, used by the layout panels.

## Components

- **WeekStrip.svelte** — Week overview (057-DR, TR-01), sticky above the timesheet scroller (`data-testid="week-strip"`): ‹ › (titles name the neighbouring week numbers, no wrap at 52), "Week 45 · 2–8 Nov 2026", Today (041-CL), week total and status in one row (phone: total and status below the days, with the panel's `phoneActions`). Seven day cells: "Mon 2", duration, a thin segmented client-colour bar from the actual entries (`flex-grow` by share). A cell scrolls to that day's heading; it is not a filter. Today's cell keeps `bg-ochre-100`. A failed status save shows under the status (`statusError`).
- **WeekStatusMenu.svelte** — Menu for the week status: Unsubmitted, Draft ready, Submitted. Recordkeeping only; the Submitted hint says nothing is sent.
- **week-labels.ts** — Week heading, week span ("28 Dec 2026 – 3 Jan 2027"), neighbouring week numbers, day headings ("Thursday, 5 November"), strip day ("Mon 2"). Tested.
- **day-jump.ts** — `dayJumpScrollTop`: where to scroll so a day's heading sits under the week controls (replaces the fixed 8px offset). Tested.
- **missing-detail.ts** — `missingDetailFor`: the local "Add deliverable" / "Add work type" cue whenever the contract (or deliverable) has options and the field is empty (TR-05). Tested. **work-type-options.ts** caches "does this deliverable have work types?".
- **week-strip-segments.ts** — Pure helper for WeekStrip's per-day colour bar: aggregates minutes per client into one segment per client (keyed by `clientId`, ordered by first appearance). Unit-tested in `week-strip-segments.test.ts`.
- **TimerIndicator.svelte** — The app bar's reflection of the capture (sprint 053-DR, SH-04), shown only when AppShell's `reflection` says no timer widget is on screen. The capture's own identity (ContractMark, contract first, client under it; never the browsed contract). Running: the clock (ticking from the shared start, so it keeps time with no widget mounted) and the pulsing dot at the top right. Stopped: "Finish entry" and the frozen duration, no running light. `data-testid="timer-indicator"`, `data-state="running|finish"`. With no capture and the desktop sidebar hidden it keeps the old "Timer" access (`timer-indicator-collapsed`). Reads from the shared `timer-state` store.
- **TimeEntryCard.svelte** — One entry row (057-DR, TR-03..TR-06). Grid: identity (ContractMark `sm` + contract name, client smaller beneath; stable `--size-entry-identity` column), description with "Formerly" lines and the classification (deliverable > work type, or the missing-detail cue) beneath, right-aligned duration and time range (none invented for a duration-only entry), then Delete / Attach note / outbox marker. A container query on the day's list reflows it on a narrow panel: identity and time on one line, description full width beneath. Separators start at the contract name's left edge (`--spacing-entry-rule-start`, one token for the owner's layout review, O04) and run to the right edge. No background wash. Inline editing (settled semantics kept): click a field to edit, Enter saves, Escape cancels, blur saves description and time, selects save on pick, focus returns to the field. The row keeps its height while editing: the description editor is a textarea that grows to the text (`WikiLinkInput multiline`), the classification line and time column reserve their editor heights, the time preview / error line sits in reserved space, the contract-change notice is one truncated line. A failed description or time save reopens the editor with the typed value. Other behaviour unchanged: wiki links, Show more, contract change clears the deliverable chain with a notice, Attach note (049-UI), `tabindex=-1` + `data-entry-id` for focus after save.
- **AttachNoteButton.svelte** — The card's "Attach note" icon button (sprint 049-UI): tooltip, `aria-disabled` with the reason as tooltip when the entry has no contract, and one note per click (a press while one is running is ignored).
- **attach-note.ts** — `appendWikiLinkToDescription` (adds `[[NOTE_ID]]` after a space at the end of the text, before any "Formerly" lines; no duplicate), `attachNoteBlockedReason`, and `attachNewNoteToEntry` (an empty note on the entry's contract through the data service, then the entry saved with the link, so offline both go through the outbox). Tested.
- **NewEntryRow.svelte** — Inline form (explicit Save / Cancel, unchanged in 057-DR) for adding a time entry, matching TimeEntryCard. Contract, deliverable and work type selects, plus a time input supporting duration and range formats. Inline errors: "Pick a contract", the parser hint, and "Couldn't save". On phone the contract sits on its own row.
- **WikiLinkRenderer.svelte** — Renders `[[NOTE_ID]]` patterns as clickable inline link spans. Used in TimeEntryCard read mode.
- **WikiLinkInput.svelte** — Text input (or, with `multiline`, a textarea that grows to its text) with `[[` autocomplete for notes. Used by TimeEntryCard (multiline) and NewEntryRow. Focuses on mount through an effect rather than the autofocus attribute.
- **formerly-lines.ts** — `splitFormerlyLines(description)` separates the "Formerly: …" lines (from `appendFormerlyLine`) from the description. Tested.
- **entry-focus.ts** — `focusSavedEntry(root, entryId, date)`: focus the saved entry's card, else the day's "+" (`data-add-entry`). Used by TimeEntriesPanel after a save. Tested.
- **time-entry-events.ts** — `time-entry-saved` window event (constant, dispatch and read helpers) used by the sidebar TimerWidget / Add Entry modal to tell TimeEntriesPanel to refresh its loaded weeks.

## Data Flow

Components receive data as props from the parent layout panel (`TimeEntriesPanel`). Mutations (create, update, delete) go through the `DataService` from context within each component, with `onUpdated`/`onEntryCreated` callbacks to trigger parent re-fetches.

TimeEntriesPanel (in `components/layout`) shows all seven days of the selected week, future days included, each under a bark-brown heading bar (date, local Add entry, day total; square ends) that is sticky inside its own day section, so the next day's heading replaces it at the boundary. Days with no entries get a quieter bar; today an ochre marker and "Today" tag, with no tint over the day. Older weeks are appended under "Show the week before". Phone: no footer timer bar (the header pill from 053-DR shows a running or stopped capture); with no capture the week controls offer Start timer (opens the capture screen) and Add Entry (the Add Entry modal).

## Related Files

- `src/lib/utils/calendar-week.ts` — Week numbering (Week 1 contains 1 January) and keys
- `src/lib/utils/iso-week.ts` — Week dates and formatting
- `src/lib/utils/duration.ts` — Duration parsing and formatting for time inputs and totals
- `src/lib/utils/client-colors.ts` — Client color palette (left-border, dot and background classes)
- `src/lib/stores/timer-state.svelte.ts` — Shared timer display state
- `src/lib/server/db/queries/time-entries-weekly.ts` — Weekly grouped query functions
- `src/lib/server/db/queries/weekly-statuses.ts` — Weekly status CRUD operations
- `src/lib/components/layout/TimeEntriesPanel.svelte` — Panel hosting these components
