# Weekly Time Entry Components

Components for displaying and editing time entries, used by the layout panels.

## Components

- **WeekStrip.svelte** — Sticky horizontal week strip showing Mon-Sun with day numbers, a compact hours/minutes total per day, a per-client colour bar, today highlight, prev/next week navigation and the weekly status (opens WeekStatusMenu). Tapping a day scrolls TimeEntriesPanel to that day.
- **WeekStatusMenu.svelte** — Keyboard-accessible menu for the week status: Unsubmitted, Draft ready, Submitted.
- **week-strip-segments.ts** — Pure helper for WeekStrip's per-day colour bar: aggregates minutes per client into one segment per client (keyed by `clientId`, ordered by first appearance). Unit-tested in `week-strip-segments.test.ts`.
- **TimerIndicator.svelte** — Compact timer display for the AppShell top bar. Shows elapsed time and active contract; pulses when running. When the desktop sidebar is collapsed and its timer is mounted, it shows a "Timer" pill that opens the sidebar. Reads from shared `timer-state` store.
- **TimeEntryCard.svelte** — Individual time entry card with description-first layout and a left border coloured by client. Inline editors for description, contract, deliverable / work type and time. Enter (or leaving the field) saves and Escape cancels in every editor. Delete is visible on hover, keyboard focus and touch. "Add deliverable…" shows only when the contract has deliverables, or on hover/focus. Descriptions clamp to three lines with Show more. Save errors appear inline. Supports `[[NOTE_ID]]` wiki-link syntax; a click on a rendered link calls `onNoteLinkClick` (TimeEntriesPanel opens the note in notes mode).
- **NewEntryRow.svelte** — Card-style inline form for adding a time entry, matching TimeEntryCard. Contract, deliverable and work type selects, plus a time input supporting duration and range formats. Inline errors: "Pick a contract", the parser hint, and "Couldn't save". On phone the contract sits on its own row.
- **WikiLinkRenderer.svelte** — Renders `[[NOTE_ID]]` patterns as clickable inline link spans. Used in TimeEntryCard read mode.
- **WikiLinkInput.svelte** — Plain text input with `[[` autocomplete dropdown for note search. Used in TimeEntryCard edit mode. Focuses on mount through an effect rather than the autofocus attribute.
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
