# Weekly Time Entry Components

Components for displaying time entries organized by week and day.

## Components

- **WeekHeader.svelte** — Navigation header with previous/next/current week buttons, week title, total hours, and status dropdown with form-based updates. Used by the legacy `/time` page.
- **WeekSectionHeader.svelte** — Compact week header for the continuous-scroll layout. Shows formatted week range, total hours, and an inline status text input with debounced save.
- **DaySection.svelte** — Day header (day name, date, daily total) with a list of time entry cards and an inline add-entry form.
- **TimeEntryCard.svelte** — Individual time entry card with inline editing for description, duration (HH:MM), and contract. Supports API-based updates and delete with confirmation.
- **InlineAddEntry.svelte** — Compact inline form for quickly adding a time entry within a day section. Includes duration input, contract select, and description.
- **WeeklyEntryRow.svelte** — Simpler entry row used in the week list panel view, with form-based deletion.

## Data Flow

Components receive data as props from the parent layout panels (`TimeEntriesPanel`, `WeekListPanel`). Mutations (create, update, delete) are handled via API calls within each component, with `onUpdated`/`onEntryCreated` callbacks to trigger parent re-fetches.

## Related Files

- `src/lib/utils/iso-week.ts` — ISO week calculation and formatting utilities
- `src/lib/server/db/queries/time-entries-weekly.ts` — Weekly grouped query functions
- `src/lib/server/db/queries/weekly-statuses.ts` — Weekly status CRUD operations
- `src/lib/components/layout/TimeEntriesPanel.svelte` — Panel 3 continuous scroll component
