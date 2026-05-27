# Layout Components

Components that make up the panel layout for Chronolog. The layout is mode-aware: time mode uses a two-panel layout (sidebar + content), while notes mode uses a three-panel layout (sidebar + list + editor).

## Architecture

### Time Mode (2 panels)

```
┌─────────────┬───────────────────────────────────────────────┐
│  Panel 1    │  Panel 3                                      │
│  (sidebar)  │  (time entries)                               │
│  240px      │  flex-grow                                    │
│  collapsible│  WeekStrip + day sections                     │
└─────────────┴───────────────────────────────────────────────┘
  Top bar: hamburger toggle | TimerIndicator
```

### Notes Mode (3 panels)

```
┌─────────────┬──────────────────┬──────────────────────────────┐
│  Panel 1    │  Panel 2         │  Panel 3                     │
│  (sidebar)  │  (note list)     │  (editor)                    │
│  240px      │  280px           │  flex-grow                   │
│  collapsible│  resizable       │                              │
└─────────────┴──────────────────┴──────────────────────────────┘
```

## Components

### AppShell.svelte

Mode-aware layout container. In time mode, hides Panel 2 (WeekListPanel) and shows a top bar with hamburger sidebar toggle and TimerIndicator. In notes mode, shows the traditional three-panel layout with resizable Panel 2.

### ContractsSidebar.svelte

Panel 1 sidebar content. Shows app header, navigation items, and contracts grouped by client. Each contract displays a colored dot matching its client color. Timer widget pinned to bottom.

### SidebarToggle.svelte

Toggle button that collapses/expands Panel 1. Shows directional chevron.

### WeekListPanel.svelte

Panel 2 content in notes mode (hidden in time mode, replaced by WeekStrip). Shows a scrollable list of weeks with week number, date range, total hours, and status badge. Supports infinite scroll.

### TimeEntriesPanel.svelte

Main content panel for time entries mode. Integrates WeekStrip as a sticky header for week/day navigation. Shows a single-week view with today emphasis, empty day states with "add entry" prompts, and month dividers between weeks. Each day section contains TimeEntryCard components.

### NoteListPanel.svelte

Panel 2 content in notes mode. Lists notes for the selected contract with title, pin indicator, date, and word count.

### NoteEditorPanel.svelte

Panel 3 content in notes mode. TipTap rich-text editor with auto-save, backlinks section, and linked time entries.

## Navigation State

All layout components use the navigation context from `$lib/stores/navigation.svelte.ts`:

- `mode`: 'time-entries' | 'notes'
- `selectedContractId` / `selectedClientId`: Active contract context
- `selectedWeek`: ISO Monday date string for the current week view
- `selectedNoteId`: Active note (notes mode)
- `panel1Collapsed`: Sidebar visibility

## Dependencies

- `$lib/stores/navigation.svelte.ts`: Navigation state management
- `$lib/stores/timer-state.svelte.ts`: Shared timer display state (for TimerIndicator)
- `$lib/utils/client-colors.ts`: Client color palette (for ContractsSidebar dots)
- `$lib/components/timer/TimerWidget.svelte`: Timer widget in sidebar
- `$lib/components/weekly/WeekStrip.svelte`: Sticky week strip (used by TimeEntriesPanel)
- `$lib/components/weekly/TimerIndicator.svelte`: Top bar timer (used by AppShell)
- `$lib/components/notes/NoteEditor.svelte`: TipTap rich-text editor component
