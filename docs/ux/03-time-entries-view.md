# Time Entries View

## Overview

The time entries view is the default mode of the application. It consists of two panels:
- **Panel 2** (`WeekListPanel`): A scrollable index of weeks with summaries
- **Panel 3** (`TimeEntriesPanel`): A continuous scroll of weeks with day-by-day time entry breakdowns

## Week List Panel (Panel 2)

### Layout

```
+--------------------+
|  Time Entries      |   <-- mobile-only header
|                    |
|  [W23 May 19-25]   |   <-- week button (clickable)
|   3.5 hrs          |      right-aligned hours
|   * Unsubmitted    |      status badge (dot + text)
|                    |
|  [W22 May 12-18]   |   <-- highlighted blue if selected
|   8.0 hrs          |
|   * Submitted      |
|                    |
|  ...               |
|                    |
|  [Load More]       |   <-- pagination button
+--------------------+
```

### Behavior

- Loads 12 weeks per page via `dataService.getWeekSummaries()`
- Filters out empty weeks (0 minutes) EXCEPT the current week (always shown)
- Selected week has a blue left border + blue background
- Clicking a week calls `navigationContext.selectWeek(weekStart)` which scrolls Panel 3 to that week
- "Load More" button fetches older weeks using the oldest loaded week as a cursor

### Status Badges

| Status | Color |
|--------|-------|
| Submitted | Green dot |
| Draft ready | Yellow dot |
| Unsubmitted (default) | Gray dot |

## Time Entries Panel (Panel 3)

### Layout

```
+--------------------------------------------------------------+
|  Time Entries                                 (mobile header) |
+--------------------------------------------------------------+
|                                                               |
|  W23 -- May 19-25, 2026  *  3.5 hrs                          |
|  [Status text input _______________]       (right-aligned)    |
|                                                               |
|  Monday, May 19                                    2.0 hrs    |
|    +                                                          |
|    [NewEntryRow - collapsed or expanded]                       |
|    +---------------------------------------------------+      |
|    | Client / Contract / Deliv / WorkType    9:00-11:00 |      |
|    | Description text here                      2h 0m   |      |
|    |                                              x     |      |
|    +---------------------------------------------------+      |
|                                                               |
|  Tuesday, May 20                                   1.5 hrs    |
|    +                                                          |
|    +---------------------------------------------------+      |
|    | Client / Contract                          1h 30m  |      |
|    | Another entry                                x     |      |
|    +---------------------------------------------------+      |
|                                                               |
|  ─── (next week separator) ────                               |
|                                                               |
|  W22 -- May 12-18, 2026  *  8.0 hrs                          |
|  ...                                                          |
|                                                               |
|  [Load more weeks]                                            |
+--------------------------------------------------------------+
```

### Week Types

The panel renders three different week layouts:

1. **Current week** (always fully expanded):
   - Bold black heading with `WeekSectionHeader`
   - Shows all days from Monday up to today
   - Each day has a "+" button to add entries inline

2. **Non-empty past week**:
   - Bold black heading with `WeekSectionHeader`
   - Shows only days that exist in the data (up to today)
   - Each day has a "+" button

3. **Empty past week** (0 entries):
   - Gray heading, collapsible
   - Shows "No entries this week" when collapsed
   - Clicking expands to show day sections with "+" buttons

### Week Section Header

`WeekSectionHeader.svelte` displays:
- Week label (e.g., "W23 -- May 19-25, 2026")
- Total hours (e.g., "3.5 hrs")
- Editable free-text status input (right-aligned, inline text input with no visible border)
  - Debounced at 1000ms; also saves on blur
  - Persisted via `dataService.updateWeeklyStatus()`

### Day Section

Each day shows:
- **Header row**: Day name + date (e.g., "Monday, May 19") with hours total on the right
- **"+" button**: Toggles the `NewEntryRow` inline form
- **Entry cards**: Listed below the header

### Time Entry Card

`TimeEntryCard.svelte` renders each time entry as a bordered card with three inline-editable areas:

```
+-----------------------------------------------------------+
|  Client / Contract / Deliverable / WorkType  9:00-11:00   |
|  Description text                                2h 0m    |
|                                                     x     |
+-----------------------------------------------------------+
```

**Inline editing (click to edit):**

- **Contract**: Click the context label to show a `ContractSelect` dropdown. Selecting a new contract saves immediately.
- **Description**: Click to show an inline text input. Debounced save (1000ms), also saves on blur.
- **Time**: Click the time display to show a text input accepting formats like `2h30m` or `9:00-11:30`. Saves on Enter or blur. Shows red border on invalid input.

**Delete**: A small "x" button on the right. First click shows "Yes/No" confirmation. Confirming deletes via `dataService.deleteTimeEntry()` and refreshes the week.

### New Entry Row

`NewEntryRow.svelte` is an inline form that appears when the "+" button is clicked on a day:

```
+-----------------------------------------------------------+
|  [Contract dropdown v]              [Time input ___]   x  |
|  [Description ___________________________]                 |
+-----------------------------------------------------------+
```

- **Contract**: `ContractSelect` dropdown (compact mode)
- **Time input**: Accepts `2h30m`, `1:30`, `9:00-11:30` formats via `parseTimeInput()`
- **Description**: Plain text input
- **Submit**: Press Enter when contract + time are filled
- **Cancel**: Press Escape or click the "x" button

On creation, calls `dataService.createTimeEntry()` and refreshes all loaded weeks.

### Scrolling

When a week is selected in the WeekListPanel, the corresponding week section in TimeEntriesPanel is scrolled into view with `scrollIntoView({ behavior: 'smooth', block: 'start' })`.

### Data Loading

- Initial load: Fetches 4 weeks starting from the current week's Monday
- "Load more weeks": Fetches 4 more weeks before the oldest loaded week
- After any add/edit/delete: Calls `refreshWeeks()` which re-fetches all currently loaded week ranges

## Files

| File | Purpose |
|------|---------|
| `src/lib/components/layout/WeekListPanel.svelte` | Panel 2: week index with summaries |
| `src/lib/components/layout/TimeEntriesPanel.svelte` | Panel 3: continuous week/day/entry scroll |
| `src/lib/components/weekly/WeekSectionHeader.svelte` | Week heading with total + editable status |
| `src/lib/components/weekly/TimeEntryCard.svelte` | Inline-editable time entry card |
| `src/lib/components/weekly/NewEntryRow.svelte` | Inline form for adding entries to a day |
| `src/lib/components/weekly/DaySection.svelte` | Day header + entries (legacy, used by older route) |
| `src/lib/components/weekly/WeekHeader.svelte` | Alternative week header with nav buttons (legacy) |
| `src/lib/components/weekly/WeeklyEntryRow.svelte` | Read-only entry row with edit/delete (legacy) |
| `src/lib/components/time/TimeEntryRow.svelte` | Entry row for the /time route (legacy) |
