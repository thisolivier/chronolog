# Weekly View Components

Components for the weekly time overview dashboard, the primary time-tracking view.

## Architecture

The weekly view displays time entries organized by ISO week (Monday-Sunday), with navigation between weeks and per-week status tracking.

Data flows from the `/time` page server load through props:
- Page server fetches weekly summary and status
- `WeekHeader` receives week metadata and navigation callbacks
- `DaySection` receives a day's entries grouped by date
- `WeeklyEntryRow` receives individual time entry data

## Components

- **WeekHeader.svelte** -- Week title (e.g., "Week 6 -- Feb 3-9, 2026"), navigation buttons (previous/next/current week), weekly total hours, and editable status dropdown.
- **DaySection.svelte** -- Day header with name and daily total, plus a list of entry rows. Shows "Add entry" link when empty.
- **WeeklyEntryRow.svelte** -- Individual time entry card showing time range, client/contract/work type context, description, duration, and edit/delete actions.

## Related Files

- `src/lib/utils/iso-week.ts` -- ISO week calculation and formatting utilities
- `src/lib/server/db/queries/time-entries-weekly.ts` -- Weekly grouped query functions
- `src/lib/server/db/queries/weekly-statuses.ts` -- Weekly status CRUD operations
- `src/routes/time/+page.server.ts` -- Page server load and form actions
