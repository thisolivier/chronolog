# Layout Components

Components that make up the panel layout for Chronolog. The layout is mode-aware: time mode uses a two-panel layout (sidebar + content), while notes mode uses a three-panel layout (sidebar + list + editor).

## Architecture

The panels are hosted by `src/routes/(workspace)/+layout.svelte`, which covers `/`, `/time/<week>`, `/notes/<contract>` and `/notes/<contract>/<note|new>`. Moving between those URLs never remounts a panel: the route pages are empty and the navigation store reads the URL.

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
Level 1: note list (notes mode)               top bar: "← <Back label>" <context title> | TimerIndicator
         time entries (time mode)
Level 2: note editor (notes mode only)        top bar: "← <Back label>" <context title> | TimerIndicator
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

Mode-aware layout container. It picks the branch from the breakpoints above. On desktop the top bar always shows the hamburger sidebar toggle and the TimerIndicator; in time mode Panel 2 is hidden (sidebar + content), in notes mode the three-panel layout with a resizable Panel 2 is shown. On mobile a permanent top bar shows "Chronolog" at level 0. Deeper levels show "← <where Back goes>" (for example "← Week 45" or "← Acme Corp · Rocket Build"), then a context title (for example "Acme Corp · Rocket Build" or "Time entries · Week 45"), then the TimerIndicator. Back uses the in-app history when it can (see `$lib/stores/README.md`). Level 1 renders Panel 2 only in notes mode and goes straight to Panel 3 (time entries) in time mode. Tapping the mobile TimerIndicator returns to level 0 where the timer widget lives. `ConnectionStatus` is rendered here, showing the offline banner.

### ConnectionStatus.svelte

Offline banner, rendered by AppShell and by `SettingsShell`. It reads `src/lib/stores/connectivity.svelte.ts` and takes the current mode, so the message says what does and does not work offline (time entries, notes, or neither). It subscribes to the browser's `online`/`offline` events in `onMount`, not `$effect`: the subscription reads connectivity state, so an effect would re-run on each request failure and reset the banner to "Back online".

### ContractsSidebar.svelte

Panel 1 sidebar content. Shows app header, navigation items, and contracts grouped under their client headings (`src/lib/utils/group-contracts-by-client.ts`). Each contract displays a colored dot matching its client color. Note counts refresh on `notes-changed` and `note-moved` window events. The contract open in the URL is highlighted (`aria-current`) and its client heading turns blue. On the phone home nothing is highlighted, including Time Entries. Timer widget pinned to bottom.

### TimeEntriesPanel.svelte

Main content panel for time entries mode. Integrates WeekStrip as a sticky header for week/day navigation. Shows a single-week view with today emphasis, empty day states with "add entry" prompts, and month dividers between weeks. Each day section contains TimeEntryCard components. Each week keeps its scroll position (the day at the top and the offset into it) in the navigation store, so returning restores it. A day asked for by `navigation.showTimeEntryDay` (after a timer or Add Entry save, or a linked entry opened from a note) scrolls to the top of the list and is highlighted briefly.

### NoteListPanel.svelte

Panel 2 content in notes mode. Lists notes for the selected contract with first-line title, pin indicator, date, and word count. The header names the selected client and contract, so it reads correctly with the sidebar collapsed. Also provides:
- A search field that searches all contracts (`dataService.searchNotes`); each result shows its contract prefix
- A sort toggle (modified / created, persisted)
- New Note, which opens a draft in the editor at `/notes/<contract>/new`; the list only gains the note once the first save creates it

It listens for the window events `note-created` and `note-saved` (updates a note's preview in place), `note-moved` (removes the note from this contract's list and shows a transient "Moved to Client / Contract" status line, `data-testid="move-feedback"`, tied to the destination contract) and `note-deleted` (removes the note). The moved note itself stays open in the editor, which then follows the note to its new contract.

### NoteEditorPanel.svelte

Panel 3 content in notes mode. Opens whatever the URL names (a note, a `/notes/<contract>/new` draft, or nothing) and binds an editor session to it: the TipTap editor, save status (via `NoteEditorHeader` and `SaveStatusIndicator`), a Reload action on conflict, backlinks, linked time entries, export and "Move to..." actions. Delete lives in the editor header and asks for an inline confirmation. A draft becomes a note on its first save without remounting the editor. Before a move or delete it flushes pending saves and waits for in-flight saves of the note. It dispatches the window events `note-created`, `note-saved`, `note-moved` (detail: `noteId`, `fromContractId`, `toContractId`, `toContractName`, `toClientName`) and `note-deleted`. Move failures are shown in the editor header. The header names the note's client and contract. A note opened under the wrong contract in the URL is re-opened under its own contract with a replace, so the URL, sidebar and list agree.

### navigation-labels.ts

Pure helpers that name workspace places. `labelForPath` gives the phone's Back label (a history entry, or the level above; settings and admin read as "Settings"), `labelForRoute` gives short labels such as "Week 45" or the note's title, and `titleForRoute` gives the phone title bar text. They read `navigation-routes.ts`, the contract directory and the note title cache.

## Navigation State

The URL is the state. All layout components read the navigation context from `$lib/stores/navigation.svelte.ts`, which parses the URL (see `$lib/stores/README.md`):

- `mode`: 'time-entries' | 'notes'
- `selectedContractId` / `selectedClientId`: Active contract context
- `selectedWeek`: ISO Monday date string for the current week view
- `selectedNoteId`: Active note (notes mode)
- `panel1Collapsed`: Sidebar visibility (desktop)
- `mobileNavigationLevel`: 0 / 1 / 2 push depth (mobile), derived from the route

## Dependencies

- `$lib/stores/navigation.svelte.ts`: Navigation state management
- `$lib/stores/navigation-routes.ts`: URL <-> workspace route parsing (used by AppShell and navigation-labels)
- `$lib/components/layout/navigation-labels.ts`: Back and title labels (used by AppShell)
- `$lib/stores/timer-state.svelte.ts`: Shared timer display state (for TimerIndicator)
- `$lib/utils/client-colors.ts`: Client color palette (for ContractsSidebar dots)
- `$lib/components/timer/TimerWidget.svelte`: Timer widget in sidebar
- `$lib/components/weekly/WeekStrip.svelte`: Sticky week strip (used by TimeEntriesPanel)
- `$lib/components/weekly/TimerIndicator.svelte`: Top bar timer (used by AppShell)
- `$lib/components/notes/NoteEditor.svelte`: TipTap rich-text editor component
