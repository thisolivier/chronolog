# Weekly Time Entry Components

Components for displaying time entries organized by week and day.

## Components

- **WeekHeader.svelte** — Navigation header with previous/next/current week buttons, week title, total hours, and status dropdown with form-based updates. Used by the legacy `/time` page.
- **WeekSectionHeader.svelte** — Compact week header for the continuous-scroll layout. Shows "Week Starting..." label, total hours, and an inline status text input with debounced save.
- **DaySection.svelte** — Day header (day name, date, daily total) with a list of time entry cards and an inline add-entry form.
- **TimeEntryCard.svelte** — Individual time entry card. Layout: contract/description on the left, time display + delete on the right. Unified time editing supports duration ("2h30m") and time range ("09:00-11:30") formats via `parseTimeInput`. Inline editing for contract and description with debounced auto-save.
- **NewEntryRow.svelte** — Expandable inline form for adding a time entry. Matches TimeEntryCard layout with contract select, description input, and time input supporting both duration and range formats. Shown via "add entry" buttons on each day.
- **WeeklyEntryRow.svelte** — Simpler entry row used in the week list panel view, with form-based deletion.

## Data Flow

Components receive data as props from the parent layout panels (`TimeEntriesPanel`, `WeekListPanel`). Mutations (create, update, delete) are handled via API calls within each component, with `onUpdated`/`onEntryCreated` callbacks to trigger parent re-fetches.

The `TimeEntriesPanel` manages expandable state for "add entry" forms (per day) and collapsible empty weeks. Empty weeks show a clickable heading that expands to reveal each day with "add entry" buttons.

## Related Files

- `src/lib/utils/iso-week.ts` — ISO week calculation and formatting utilities
- `src/lib/utils/time-parse.ts` — Time input parsing (durations and ranges)
- `src/lib/server/db/queries/time-entries-weekly.ts` — Weekly grouped query functions
- `src/lib/server/db/queries/weekly-statuses.ts` — Weekly status CRUD operations
- `src/lib/components/layout/TimeEntriesPanel.svelte` — Panel 3 continuous scroll component
