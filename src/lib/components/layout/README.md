# Layout Components

This directory contains the components that make up the Apple Notes-inspired three-panel layout for Chronolog.

## Architecture

The layout uses a full-viewport three-panel design that is always visible on desktop. Each panel scrolls independently and has distinct responsibilities.

### Panel Structure

```
┌─────────────┬──────────────────┬──────────────────────────────┐
│  Panel 1    │  Panel 2         │  Panel 3                     │
│  (sidebar)  │  (list)          │  (content)                   │
│  240px      │  280px           │  flex-grow                   │
│  collapsible│  resizable       │                              │
└─────────────┴──────────────────┴──────────────────────────────┘
```

## Components

### AppShell.svelte

The main layout container that manages the three-panel structure.

**Props:**
- `panel1` (Snippet): Content for the left sidebar
- `panel2` (Snippet): Content for the middle list panel
- `panel3` (Snippet): Content for the right content panel

**Features:**
- Full viewport height (h-screen)
- Independent scrolling for each panel
- Panel 1 collapsible (smooth transition)
- Panel 2 resizable via drag handle (200-500px range)
- Panel 3 takes remaining space

**Usage:**
```svelte
<AppShell panel1={sidebar} panel2={list} panel3={content}>
  {#snippet sidebar()}
    <ContractsSidebar userName={data.user.name} userEmail={data.user.email} />
  {/snippet}
  {#snippet list()}
    <!-- Panel 2 content -->
  {/snippet}
  {#snippet content()}
    <!-- Panel 3 content -->
  {/snippet}
</AppShell>
```

### ContractsSidebar.svelte

The content for Panel 1 (left sidebar).

**Props:**
- `userName` (string): User's display name
- `userEmail` (string): User's email address

**Features:**
- App header with brand, user info, and sign out button
- "Time Entries" navigation item
- Contracts list grouped by client
- Settings link
- Timer widget pinned to bottom

**Data Loading:**
- Fetches contracts from `/api/contracts-by-client`
- Groups contracts hierarchically under client headers
- Highlights selected contract or time entries mode

**Navigation:**
- Uses `getNavigationContext()` to access navigation state
- Calls `selectTimeEntries()` or `selectContract(contractId, clientId)` on click

### SidebarToggle.svelte

A small toggle button that collapses/expands Panel 1.

**Features:**
- Shows chevron-left when expanded, chevron-right when collapsed
- Absolutely positioned (typically on Panel 2's left edge)
- Uses `navigationContext.toggleSidebar()` to control state

### WeekListPanel.svelte

The content for Panel 2 when in "time entries" mode. Shows a scrollable list of weeks.

**Features:**
- Header with "Time Entries" title and "Add Entry" button
- Scrollable list of recent weeks (initial load: 12 weeks)
- Each week shows: week number, date range, total hours, status badge
- Highlighted row for currently selected week
- Infinite scroll: "Load More" button to fetch older weeks
- Click a week to navigate Panel 3 to that week

**Data Loading:**
- Fetches weeks from `/api/weeks?count=12&before=YYYY-MM-DD`
- Loads additional weeks on demand (12 at a time)
- Caches loaded weeks in component state

**Navigation:**
- Uses `getNavigationContext()` to access/update `selectedWeek`
- Calls `navigationContext.selectWeek(weekStart)` on click
- Highlights the selected week with `bg-blue-50 border-l-2 border-blue-600`

**Status Colors:**
- Unsubmitted: gray dot
- Draft ready: yellow dot
- Submitted: green dot

### TimeEntriesPanel.svelte

The content for Panel 3 when in "time entries" mode. Shows a continuous vertical scroll of time entries organized by week.

**Features:**
- Header with "Time Entries" title and "Add Entry" button
- Continuous scroll of weeks (newest at top)
- Initial load: current week + 3 previous weeks (4 weeks total)
- Infinite scroll: "Load more weeks" button fetches 4 more weeks going back in time
- Each week section shows: WeekSectionHeader + DaySection for each day
- Each week section has a `data-week-start` attribute for scroll navigation
- Auto-scrolls to selected week when `navigation.selectedWeek` changes

**Data Loading:**
- Fetches weeks from `/api/time-entries/weekly?weeks=YYYY-MM-DD,YYYY-MM-DD,...` (batch API)
- Fetches statuses from `/api/time-entries/weekly-statuses` (if needed)
- Updates status via POST to `/api/time-entries/weekly-statuses`
- Deletes entries via DELETE to `/api/time-entries/[id]`

**Navigation:**
- Uses `getNavigationContext()` to watch `selectedWeek`
- Scrolls the corresponding week section into view when `selectedWeek` changes
- Uses `$effect()` to react to navigation changes

**Components Used:**
- `WeekSectionHeader.svelte`: Week title, total hours, status dropdown (API-based)
- `DaySection.svelte`: Day header and entry list (reused from single week view)
- `TimeEntryCard.svelte`: Individual entry card with API-based delete

## Navigation State

All layout components use the navigation context from `$lib/stores/navigation.svelte.ts`:

- `mode`: 'time-entries' | 'notes'
- `selectedContractId`: Currently selected contract ID
- `selectedClientId`: Client owning the selected contract
- `panel1Collapsed`: Whether the sidebar is collapsed

## Styling

- Tailwind v4 utility classes only
- Color scheme: white panels, gray-50 backgrounds, gray-200 borders
- Selected items: bg-blue-50, text-blue-700
- Hover states on interactive items
- Smooth transitions for collapse/expand

## Dependencies

- `$lib/stores/navigation.svelte.ts`: Navigation state management
- `$lib/components/timer/TimerWidget.svelte`: Timer widget in sidebar
- `/api/contracts-by-client`: API endpoint for grouped contracts data
- `/api/weeks`: API endpoint for weekly summaries (used by WeekListPanel)
