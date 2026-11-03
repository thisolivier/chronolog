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

### Mobile (<768px, single panel push/pop)

```
Level 0: sidebar (contracts + timer widget)   top bar: "Chronolog"
Level 1: note list (notes mode)               top bar: Back | TimerIndicator
         time entries (time mode)
Level 2: note editor (notes mode only)        top bar: Back | TimerIndicator
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

## Breakpoints

- **<768px**: single-panel mobile drill-down.
- **768–1023px** (tablet, half-screen laptop): two panels. In notes mode the sidebar becomes an overlay over the note list.
- **>=1024px**: sidebar, list and editor side by side.

Tablet and desktop share one DOM branch, so crossing 1024px never remounts the editor.

## Components

### AppShell.svelte

Mode-aware layout container. It picks the branch from the breakpoints above. On desktop the top bar always shows the hamburger sidebar toggle and the TimerIndicator; in time mode Panel 2 is hidden (sidebar + content), in notes mode the three-panel layout with a resizable Panel 2 is shown. On mobile a permanent top bar shows "Chronolog" at level 0 and a Back button plus the TimerIndicator at deeper levels; level 1 renders Panel 2 only in notes mode and goes straight to Panel 3 (time entries) in time mode. Tapping the mobile TimerIndicator returns to level 0 where the timer widget lives. `ConnectionStatus` is rendered here, showing the offline banner.

### ConnectionStatus.svelte

Offline banner, rendered by AppShell and by `SettingsShell`. It reads `src/lib/stores/connectivity.svelte.ts` and takes the current mode, so the message says what does and does not work offline (time entries, notes, or neither).

### ContractsSidebar.svelte

Panel 1 sidebar content. Shows app header, navigation items, and contracts grouped under their client headings (`src/lib/utils/group-contracts-by-client.ts`). Each contract displays a colored dot matching its client color. Note counts refresh on `notes-changed` and `note-moved` window events. Timer widget pinned to bottom.

### TimeEntriesPanel.svelte

Main content panel for time entries mode. Integrates WeekStrip as a sticky header for week/day navigation. Shows a single-week view with today emphasis, empty day states with "add entry" prompts, and month dividers between weeks. Each day section contains TimeEntryCard components.

### NoteListPanel.svelte

Panel 2 content in notes mode. Lists notes for the selected contract with title, pin indicator, date, and word count. Listens for the window events `note-saved` (updates a note's preview in place) and `note-moved` (removes the note, clears the selection and shows a transient "Moved to Client / Contract" status line, `data-testid="move-feedback"`).

### NoteEditorPanel.svelte

Panel 3 content in notes mode. TipTap rich-text editor with auto-save, backlinks section, linked time entries, export and "Move to..." actions. Dispatches the window events `note-saved` and `note-moved` (detail: `noteId`, `fromContractId`, `toContractId`, `toContractName`, `toClientName`); move success is confirmed by NoteListPanel because clearing the selection unmounts this panel's header, so only the failure message is shown here.

## Navigation State

All layout components use the navigation context from `$lib/stores/navigation.svelte.ts`:

- `mode`: 'time-entries' | 'notes'
- `selectedContractId` / `selectedClientId`: Active contract context
- `selectedWeek`: ISO Monday date string for the current week view
- `selectedNoteId`: Active note (notes mode)
- `panel1Collapsed`: Sidebar visibility (desktop)
- `mobileNavigationLevel`: 0 / 1 / 2 push depth (mobile)

## Dependencies

- `$lib/stores/navigation.svelte.ts`: Navigation state management
- `$lib/stores/timer-state.svelte.ts`: Shared timer display state (for TimerIndicator)
- `$lib/utils/client-colors.ts`: Client color palette (for ContractsSidebar dots)
- `$lib/components/timer/TimerWidget.svelte`: Timer widget in sidebar
- `$lib/components/weekly/WeekStrip.svelte`: Sticky week strip (used by TimeEntriesPanel)
- `$lib/components/weekly/TimerIndicator.svelte`: Top bar timer (used by AppShell)
- `$lib/components/notes/NoteEditor.svelte`: TipTap rich-text editor component
