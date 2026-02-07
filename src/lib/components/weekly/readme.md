# Weekly View Components

Components for the weekly time overview dashboard, the primary time-tracking view.

## Architecture

The weekly view displays time entries organized by ISO week (Monday-Sunday), with navigation between weeks and per-week status tracking.

Two display modes are supported:

1. **Single Week View** (legacy `/time` page): Data flows from the page server load through props. Navigation uses prev/next buttons and form-based actions.

2. **Continuous Scroll View** (new Panel 3 component): Data flows from API endpoints. Navigation uses infinite scroll with lazy loading. Status updates use API calls instead of forms.

## Components

### Single Week View Components

- **WeekHeader.svelte** -- Week title (e.g., "Week 6 -- Feb 3-9, 2026"), navigation buttons (previous/next/current week), weekly total hours, and editable status dropdown with form-based updates.
- **DaySection.svelte** -- Day header with name and daily total, plus a list of entry rows. Shows "Add entry" link when empty.
- **WeeklyEntryRow.svelte** -- Individual time entry card showing time range, client/contract/work type context, description, duration, and edit/delete actions. Uses form POST for deletion.

### Continuous Scroll View Components

- **WeekSectionHeader.svelte** -- Simplified week header without navigation buttons. Week title, weekly total hours, and editable status dropdown with API-based updates.
- **TimeEntryCard.svelte** -- API-based time entry card (similar to WeeklyEntryRow but uses fetch DELETE instead of form POST).

## Related Files

- `src/lib/utils/iso-week.ts` -- ISO week calculation and formatting utilities
- `src/lib/server/db/queries/time-entries-weekly.ts` -- Weekly grouped query functions
- `src/lib/server/db/queries/weekly-statuses.ts` -- Weekly status CRUD operations
- `src/routes/time/+page.server.ts` -- Page server load and form actions (single week view)
- `src/routes/api/time-entries/weekly/+server.ts` -- Batch week data API endpoint
- `src/routes/api/time-entries/weekly-statuses/+server.ts` -- Batch status GET/POST API endpoint
- `src/routes/api/time-entries/[id]/+server.ts` -- Delete entry API endpoint
- `src/lib/components/layout/TimeEntriesPanel.svelte` -- Panel 3 continuous scroll component
