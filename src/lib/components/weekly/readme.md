# Weekly Time Entry Components

Components for displaying and editing time entries, used by the layout panels.

## Components

- **WeekStrip.svelte** — Sticky horizontal week strip showing Mon-Sun with day numbers, total hours per day, a per-client colour bar, today highlight, prev/next week navigation and the weekly status chip (cycled inline). Tapping a day scrolls TimeEntriesPanel to that day.
- **week-strip-segments.ts** — Pure helper for WeekStrip's per-day colour bar: aggregates minutes per client into one segment per client (keyed by `clientId`, ordered by first appearance). Unit-tested in `week-strip-segments.test.ts`.
- **TimerIndicator.svelte** — Compact timer display for the AppShell top bar. Shows elapsed time and active contract; pulses when running. Reads from shared `timer-state` store.
- **TimeEntryCard.svelte** — Individual time entry card with description-first layout and a left border colored by client. Inline editing for description, contract, deliverable / work type, and time with debounced auto-save. Supports `[[NOTE_ID]]` wiki-link syntax; a click on a rendered link calls `onNoteLinkClick` (TimeEntriesPanel opens the note in notes mode).
- **NewEntryRow.svelte** — Card-style inline form for adding a time entry. Description-first layout matching TimeEntryCard, with contract, deliverable and work type selects and a time input supporting duration and range formats.
- **WikiLinkRenderer.svelte** — Renders `[[NOTE_ID]]` patterns as clickable inline link spans. Used in TimeEntryCard read mode.
- **WikiLinkInput.svelte** — Plain text input with `[[` autocomplete dropdown for note search. Used in TimeEntryCard edit mode.
- **time-entry-events.ts** — `time-entry-saved` window event (constant, dispatch and read helpers) used by the sidebar TimerWidget / Add Entry modal to tell TimeEntriesPanel to refresh its loaded weeks.

## Data Flow

Components receive data as props from the parent layout panel (`TimeEntriesPanel`). Mutations (create, update, delete) go through the `DataService` from context within each component, with `onUpdated`/`onEntryCreated` callbacks to trigger parent re-fetches.

## Related Files

- `src/lib/utils/iso-week.ts` — ISO week calculation and formatting utilities
- `src/lib/utils/time-parse.ts` — Time input parsing (durations and ranges)
- `src/lib/utils/client-colors.ts` — Client color palette (left-border, dot and background classes)
- `src/lib/stores/timer-state.svelte.ts` — Shared timer display state
- `src/lib/server/db/queries/time-entries-weekly.ts` — Weekly grouped query functions
- `src/lib/server/db/queries/weekly-statuses.ts` — Weekly status CRUD operations
- `src/lib/components/layout/TimeEntriesPanel.svelte` — Panel hosting these components
