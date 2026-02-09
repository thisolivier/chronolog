# Weekly Components

Components for weekly time entry viewing, editing, status tracking, and navigation.

## Components

- **WeekHeader.svelte** — Week navigation buttons (previous/next/current), ISO week number, formatted date range, total hours, and status dropdown.
- **WeekSectionHeader.svelte** — Collapsible week section header with inline status input field (debounced save).
- **TimeEntryCard.svelte** — Displays a time entry with contract/deliverable info; switches to edit mode for modification.
- **InlineAddEntry.svelte** — Quick-add row for creating new time entries without a modal.
- **EditableTimeEntryRow.svelte** — Editable row with CascadingSelects for contract/deliverable/work-type, description textarea, save/cancel buttons.

## Key Patterns

- **Status management**: Status tracking via `currentStatus` prop with `onStatusChange()` callback for async save.
- **Inline editing**: TimeEntryCard toggles between display and edit modes; edit state stored locally in component.
- **Navigation**: WeekHeader calls `onNavigatePrevious()`, `onNavigateCurrent()`, `onNavigateNext()` to change active week.
- **Grouping**: Entries are grouped by date (Monday-Sunday) in parent container.
