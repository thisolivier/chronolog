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

Mode-aware layout container. It picks the branch from the breakpoints above. On desktop the top bar always shows the hamburger sidebar toggle and the TimerIndicator; in time mode Panel 2 is hidden (sidebar + content), in notes mode the three-panel layout with a resizable Panel 2 is shown. On mobile a permanent top bar shows "Chronolog" at level 0. Deeper levels show "← <where Back goes>" (for example "← Week 45" or "← Acme Corp · Rocket Build"), then a context title (for example "Acme Corp · Rocket Build" or "Time entries · Week 45"), then the TimerIndicator. Back uses the in-app history when it can (see `$lib/stores/README.md`). Level 1 renders Panel 2 only in notes mode and goes straight to Panel 3 (time entries) in time mode. Tapping the mobile TimerIndicator returns to level 0 where the timer widget lives. `ConnectionStatus` is rendered here, showing the offline banner. The top bar also holds the global search field (`$lib/components/search/GlobalSearchField.svelte`, sprint 042-CL) next to the app name; on a phone a search icon in the header links to `/search`. iPhone (sprint 047-QA): both branches are `h-dvh` (not 100vh, which runs under Safari's toolbar) with `.safe-area-shell` padding (notch, home indicator; `app.html` has `viewport-fit=cover`); on the week or a note the phone title bar also has a Find button (the touch route to find in page, see `$lib/components/find/README.md`). Touch screens get 44 px targets through Tailwind's `pointer-coarse:` variant here and in the sidebar, note list, week and editor components; the global phone rules (16 px fields, safe areas, the stacked Settings table) are in `src/app.css`.

### ConnectionStatus.svelte

Offline banner, rendered by AppShell and by `SettingsShell`. It reads `src/lib/stores/connectivity.svelte.ts` and takes the current mode, so the message says what works offline (note and time entry changes are kept on the device and sent on reconnect, sprint 045-CL). It shows the offline outbox's queued count, stays up online while changes wait or are held, and its "Review" button opens `$lib/offline/OutboxHeldPanel.svelte`. `NoteListRow`, the note editor header and `TimeEntryCard` carry an `OutboxMarker` (queued / held / replayed). It subscribes to the browser's `online`/`offline` events in `onMount`, not `$effect`: the subscription reads connectivity state, so an effect would re-run on each request failure and reset the banner to "Back online".

### ContractsSidebar.svelte

Panel 1 sidebar content. Shows Time Entries, the contracts (a `+` right of the "Contracts" heading opens New Contract, `ContractCreateModal`; sprint 049-UI), and the Archived item, then New Contract, Settings and the timer widget pinned to the bottom. It loads the contracts (archived ones included) into the contract directory store, which splits them into the active clients and the Archived section; the sidebar only draws them. Note counts refresh on `notes-changed` and `note-moved` window events, and the list reloads whenever the sidebar mounts again (coming back from Settings).

Hierarchy (sprint 033-CL):
- A client with two or more active contracts is a heading (colour dot + name) with its contracts indented under it.
- A client with exactly one active contract is one row at the client's indent: the dot, the contract name, and the client name beneath it in small muted text. Archived contracts do not count towards the one.
- **Archived**, after the last active client and only when something is archived: a toggle button (`aria-expanded`, count badge of archived contracts), collapsed by default and remembered per browser. It lists archived clients with their contracts and the archived contracts of active clients under their client's name, in the same grammar but muted.

Sprint 039-CL:
- A client heading is the client's name with its dot, which opens the client view (`aria-current` and blue while it is shown), and a chevron (collapse) at the row's right edge; the chevrons share the heading `+`'s right inset and box size, so they form one column under it (049-UI). Collapsing hides the client's contracts except the open one; the choice is remembered per browser in `client-collapse-state.ts` (`chronolog:sidebar-collapsed-clients`, never collapsed by default). A single-contract client has no chevron and no client-view entry (its row opens the contract).
- Active clients can be reordered: drag a client's name (or its single row) onto another client (native HTML5 drag and drop, drop line above or below), or Alt+ArrowUp / Alt+ArrowDown on it, announced in a polite live region (`sidebar-reorder-announcement`). `client-reorder.svelte.ts` applies the order to the directory store at once and saves it with `PATCH /api/clients/reorder`; a failed save reloads the list.

The contract open in the URL is highlighted (`aria-current`, blue) and the heading of the group holding it turns blue. When that contract is archived the Archived item expands (without changing the remembered choice), and a newly selected row is scrolled into view. On the phone home nothing is highlighted, including Time Entries.

Stable test hooks: `sidebar-new-contract` (the heading `+`), `[data-testid="sidebar-client-group"]` (aria-label = client name, `data-client-id`) per active client, `sidebar-client-heading`, `sidebar-client-chevron`, `sidebar-client-name`, `[data-client-reorder-handle]`, `sidebar-single-contract-row`, `sidebar-row-client-name`, `sidebar-note-count`; `data-contract-id` on every contract button; `sidebar-archived-section`, `sidebar-archived-toggle`, `sidebar-archived-count` and `sidebar-archived-client-group`.

### SidebarClientGroup.svelte

One client in the sidebar: the heading plus children, or the single-contract row. `muted` greys it for the Archived section (no chevron, no client view, no reorder). Optional props add the chevron (`isCollapsed`, `onToggleCollapse`), the client view (`onOpenClient`, `viewedClientId`) and reordering (`reorder`, a `ClientReorderController`).

### SidebarArchivedSection.svelte

The Archived toggle and its list. The expanded preference is read and written through `archived-section-state.ts` (localStorage, guarded with try/catch, default collapsed).

### SidebarTrashLink.svelte

"Trash" under the Archived item (sprint 043-CL), in the same muted style: a link to the trash page `/notes/trash`. The sidebar was chosen over the foot of the note list because the trash spans every contract and is rarely needed.

### TimeEntriesPanel.svelte

Main content panel for time entries mode. Integrates WeekStrip as a sticky header for week/day navigation. Shows a single-week view with today emphasis, empty day states with "add entry" prompts, and month dividers between weeks. Each day section contains TimeEntryCard components. Each week keeps its scroll position (the day at the top and the offset into it) in the navigation store, so returning restores it. A day asked for by `navigation.showTimeEntryDay` (after a timer or Add Entry save, or a linked entry opened from a note) scrolls to the top of the list and is highlighted briefly. Its first child is the find bar (`$lib/components/find/FindBar.svelte`, `mode="dom"`, sprint 042-CL).

### NoteListPanel.svelte

Panel 2 content in notes mode. Lists notes for the selected contract, or in the client view (`/notes/client/<id>`, sprint 039-CL) every note of the client's contracts with each row's contract named, pinned notes first. Rows are `NoteListRow.svelte`: first-line title, date, second line, and a pin button on the right (`aria-pressed`; always shown when pinned, on hover or focus otherwise) that calls `PUT /api/notes/<id>/pin` and re-sorts in place. The header names the selected client and contract (or the client and "All contracts"), so it reads correctly with the sidebar collapsed. Also provides:
- A search field that searches all contracts (`dataService.searchNotes`); each result shows its contract prefix
- A sort toggle (modified / created, persisted)
- New Note (`NoteListNewNoteButton.svelte`), which opens a draft in the editor at `/notes/<contract>/new`; in the client view a one-contract client uses its contract and otherwise a small menu asks which (the draft opens at `/notes/client/<client>/<contract>/new`). The list only gains the note once the first save creates it
- The search box's state lives in `note-list-search.svelte.ts` (debounced, latest answer wins)

It listens for the window events `note-created` and `note-saved` (updates a note's preview in place), `note-moved` (removes the note from this contract's list and shows a transient "Moved to Client / Contract" status line, `data-testid="move-feedback"`, tied to the destination contract) and `note-deleted` (removes the note). The moved note itself stays open in the editor, which then follows the note to its new contract.

### NoteEditorPanel.svelte

Panel 3 content in notes mode. Opens whatever the URL names (a note, a `/notes/<contract>/new` draft, or nothing) and binds an editor session to it: the TipTap editor, save status (via `NoteEditorHeader` and `SaveStatusIndicator`), a Reload action on conflict, backlinks, linked time entries, export and "Move to..." actions. Delete lives in the editor header and asks for an inline confirmation. A draft becomes a note on its first save without remounting the editor. Before a move or delete it flushes pending saves and waits for in-flight saves of the note. It dispatches the window events `note-created`, `note-saved`, `note-moved` (detail: `noteId`, `fromContractId`, `toContractId`, `toContractName`, `toClientName`) and `note-deleted`. Move failures are shown in the editor header. The header names the note's client and contract. A note opened under the wrong contract in the URL is re-opened under its own contract with a replace, so the URL, sidebar and list agree. Its first child is the find bar (`mode="editor"`, decorations in the editor, sprint 042-CL). Since sprint 043-CL the component is the template and wiring only: its state is `NotePanelState`, saving is `note-editor-session.ts`, the header actions are `note-panel-actions.ts` (all in `$lib/components/notes/`), and the "Moved to trash. Undo" toast is `NoteTrashToastHost`, mounted by the workspace layout so it survives this panel unmounting on a phone.

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
