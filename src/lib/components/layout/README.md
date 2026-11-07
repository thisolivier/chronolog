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
  Top bar: hamburger toggle | Chronolog | ‹ › ........ TimerIndicator (only while no timer widget is on screen) | search field (far right)
```

### Mobile (<768px, single panel push/pop)

```
Level 0: sidebar (contracts + timer widget)   top bar: "Chronolog"
Level 1: note list (notes mode)               top bar: "← <Back label>" [›] <context title> | TimerIndicator (no widget on screen)
         time entries (time mode, footer timer widget: no TimerIndicator)
Level 2: note editor (notes mode only)        top bar: "← <Back label>" <context title> | TimerIndicator (no widget on screen)
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

Mode-aware layout container. It picks the branch from the breakpoints above. On desktop the top bar always shows the hamburger sidebar toggle and the TimerIndicator; in time mode Panel 2 is hidden (sidebar + content), in notes mode the three-panel layout with a resizable Panel 2 is shown. On mobile a permanent top bar shows "Chronolog" at level 0. Deeper levels show "← <where Back goes>" (for example "← Week 45" or "← Acme Corp · Rocket Build"), then a context title (for example "Acme Corp · Rocket Build" or "Time entries · Week 45"), then the TimerIndicator. Back uses the in-app history when it can (see `$lib/stores/README.md`). Level 1 renders Panel 2 only in notes mode and goes straight to Panel 3 (time entries) in time mode. Tapping the mobile TimerIndicator returns to level 0 where the timer widget lives. `ConnectionStatus` is rendered here, showing the offline banner. The top bar also holds Back / Forward (`HistoryButtons`, sprint 050-UI) by the app name and, at the far right of the bar (SH-05, sprint 053-DR), the global search field (`$lib/components/search/GlobalSearchField.svelte`, sprint 042-CL); the phone bar adds a › after "← Back" when a step is ahead; on a phone a search icon in the header links to `/search`. iPhone (sprint 047-QA): both branches are `h-dvh` (not 100vh, which runs under Safari's toolbar) with `.safe-area-shell` padding (notch, home indicator; `app.html` has `viewport-fit=cover`); on the week or a note the phone title bar also has a Find button (the touch route to find in page, see `$lib/components/find/README.md`). Touch screens get 44 px targets through Tailwind's `pointer-coarse:` variant here and in the sidebar, note list, week and editor components; the global phone rules (16 px fields, safe areas, the stacked Settings table) are in `src/app.css`.

**One visible timer (sprint 053-DR, SH-04).** The TimerIndicator shows only while no TimerWidget is on screen: `headerReflectionFor(status, presentation)` in `$lib/components/timer/timer-visibility.ts` decides from the layout mode, the desktop hide preference (`panel1Collapsed`), the tablet overlay state and the number of mounted widgets (`timer-widget-registry`), never from "mounted" alone (a hidden sidebar is 0px wide with its widget still mounted). Clicking it on desktop or tablet shows the sidebar (`openSidebar`; chosen over a popover as the simpler path); on a phone it opens the capture screen (home, level 0). A phone opened straight on a note has no widget, so AppShell reads the capture once, read-only, through `timer-reflection.ts`. AppShell also writes `shell-presentation.svelte.ts` (`layoutMode`, `sidebarOnScreen`, `timerWidgetOnScreen`) for components outside the shell; the notes list and editor headers decide who names the client / contract from `sidebarOnScreen` (`note-context-ownership.ts`), so they and the timer reflection follow one record of what is on screen.

### shell-presentation.svelte.ts

Read-only (outside AppShell) record of what the shell presents: `sidebarOnScreen` is false with the desktop sidebar hidden, the tablet overlay closed, or a phone screen other than home; `timerWidgetOnScreen` mirrors the SH-04 rule. Written by AppShell only.

### HistoryButtons.svelte

Back / Forward through this tab's journey (sprint 050-UI), for the Mac app and the installed PWA, which have no browser buttons. `variant="desktop"` (AppShell's top bar, and on md+ screens the Search, Trash and Settings headers) shows ‹ › right before the search field, the unavailable one disabled, with "Back to {label}" / "Forward to {label}" as accessible label and tooltip (labels from `navigation-labels.ts`, note titles from the title cache). `variant="phone"` shows only a › next to the phone's labelled "← Back", and only when a step is ahead (at home, next to the app name). Both call `navigation.goBack()` / `goForward()` and listen for Cmd+[ / Cmd+] (Ctrl elsewhere) and Alt+← / Alt+→ through `history-shortcuts.ts`, which ignores keys typed in a field or the editor.

### ConnectionStatus.svelte

Offline banner, rendered by AppShell and by `SettingsShell`. It reads `src/lib/stores/connectivity.svelte.ts` and takes the current mode, so the message says what works offline (note and time entry changes are kept on the device and sent on reconnect, sprint 045-CL). It shows the offline outbox's queued count, stays up online while changes wait or are held, and its "Review" button opens `$lib/offline/OutboxHeldPanel.svelte`. `NoteListRow`, the note editor header and `TimeEntryCard` carry an `OutboxMarker` (queued / held / replayed). It subscribes to the browser's `online`/`offline` events in `onMount`, not `$effect`: the subscription reads connectivity state, so an effect would re-run on each request failure and reset the banner to "Back online".

### ContractsSidebar.svelte

Panel 1 sidebar content. One scrolling list (`sidebar-scroll`): Time Entries, the "Notes" heading (a button that opens all notes, `/notes/all`, `aria-current` while shown; sprint 051-UI), the contracts by client, the Archived item, then Trash and Settings (`SidebarUtilityLinks`). Below the list there is only the timer widget. New contracts are made in Settings → Clients and contracts (the 049 `+` next to the heading was removed in 051 at the owner's request; the no-contracts hint links there). It loads the contracts (archived ones included) into the contract directory store, which splits them into the active clients and the Archived section; the sidebar only draws them. Note counts refresh on `notes-changed` and `note-moved` window events, and the list reloads whenever the sidebar mounts again (coming back from Settings).

Hierarchy (sprint 033-CL; design r1 restyle in 053-DR, SH-02):
- A client with two or more active contracts is a pale tinted section (`bg-sunken`) holding its heading (the name, no colour dot) and its contracts. Each contract row is a ContractMark (`size="sm"`, client colour + initials), the name at the `gap-mark-gap` token (DS-05) and the note count at the right. The heading text and the child marks share one inset inside the section.
- A client with exactly one active contract is one flattened row at the outer inset (the owner-selected looser alignment: its mark sits left of the grouped marks): the mark, the contract name, and the client name beneath it in small muted text. Archived contracts do not count towards the one.
- The selected contract (and the viewed client's name) is a punch-out in the surface colour with a soft edge (`bg-surface shadow-panel ring-1 ring-divider`), not a blue or pine wash. Time Entries and the "Notes" heading use the sage `bg-selection` when current.
- **Muting (SH-03).** While Time Entries is selected, one wrapper (`sidebar-notes-section`, `data-muted`) sets 50% opacity on everything from the "Notes" heading to Settings; Time Entries and the timer stay at full opacity. Nothing inside uses opacity for its own muting while the wrapper is on (inactive contracts use `text-ink-fainter`; archived and inactive ContractMarks drop their own `muted` when `sectionMuted`), so nothing reaches 25%. Everything stays enabled, clickable and focusable.
- **Archived**, after the last active client and only when something is archived: a toggle button (`aria-expanded`, count badge of archived contracts, and a chevron in the same right-hand column as the client chevrons, 051-UI), collapsed by default and remembered per browser. It lists archived clients with their contracts and the archived contracts of active clients under their client's name, in the same grammar but muted.

Sprint 039-CL:
- A client heading is the client's name, which opens the client view (`aria-current` and the punch-out while it is shown), and a chevron (collapse) at the row's right edge; the client chevrons and the Archived chevron share one right inset and box size (`h-5 w-5`, `w-8` on touch), so they form one column (049-UI, 051-UI). Collapsing hides the client's contracts except the open one; the choice is remembered per browser in `client-collapse-state.ts` (`chronolog:sidebar-collapsed-clients`, never collapsed by default). A single-contract client has no chevron and no client-view entry (its row opens the contract).
- Active clients can be reordered: drag a client's name (or its single row) onto another client (native HTML5 drag and drop, drop line above or below), or Alt+ArrowUp / Alt+ArrowDown on it, announced in a polite live region (`sidebar-reorder-announcement`). `client-reorder.svelte.ts` applies the order to the directory store at once and saves it with `PATCH /api/clients/reorder`; a failed save reloads the list.

The contract open in the URL is highlighted (`aria-current`, the surface punch-out). When that contract is archived the Archived item expands (without changing the remembered choice), and a newly selected row is scrolled into view. On the phone home nothing is highlighted, including Time Entries.

Stable test hooks: `sidebar-scroll`, `sidebar-notes-heading`, `[data-testid="sidebar-client-group"]` (aria-label = client name, `data-client-id`) per active client, `sidebar-client-heading`, `sidebar-client-chevron`, `sidebar-client-name`, `[data-client-reorder-handle]`, `sidebar-single-contract-row`, `sidebar-row-client-name`, `sidebar-note-count`; `data-contract-id` on every contract button; `sidebar-archived-section`, `sidebar-archived-toggle`, `sidebar-archived-count`, `sidebar-archived-chevron` and `sidebar-archived-client-group`; `sidebar-trash-link`, `sidebar-settings-link`; `sidebar-time-entries`, `sidebar-notes-section` (053-DR) and `contract-mark` inside each contract row.

### SidebarClientGroup.svelte

One client in the sidebar: the tinted section with heading plus children, or the flattened single-contract row. `muted` quietens it by colour for the Archived section (no chevron, no client view, no reorder); `sectionMuted` says the Time Entries wrapper is already at 50%. Optional props add the chevron (`isCollapsed`, `onToggleCollapse`), the client view (`onOpenClient`, `viewedClientId`) and reordering (`reorder`, a `ClientReorderController`).

### SidebarArchivedSection.svelte

The Archived toggle and its list. The expanded preference is read and written through `archived-section-state.ts` (localStorage, guarded with try/catch, default collapsed).

### SidebarUtilityLinks.svelte

"Trash" (sprint 043-CL, the trash page `/notes/trash`) and "Settings" (sprint 051-UI, formerly a fixed footer above the timer) under the Archived item, in the same style as Archived (053-DR: sentence case, 16px icon and label, `text-ink-muted`). The sidebar was chosen for the trash over the foot of the note list because it spans every contract and is rarely needed.

### TimeEntriesPanel.svelte

Main content panel for time entries mode. Integrates WeekStrip as a sticky header for week/day navigation. Shows a single-week view with today emphasis, empty day states with "add entry" prompts, and month dividers between weeks. Each day section contains TimeEntryCard components. Each week keeps its scroll position (the day at the top and the offset into it) in the navigation store, so returning restores it. A day asked for by `navigation.showTimeEntryDay` (after a timer or Add Entry save, or a linked entry opened from a note) scrolls to the top of the list and is highlighted briefly. Its first child is the find bar (`$lib/components/find/FindBar.svelte`, `mode="dom"`, sprint 042-CL).

### NoteListPanel.svelte

Panel 2 content in notes mode. Lists notes for the selected contract, or in the client view (`/notes/client/<id>`, sprint 039-CL) every note of the client's contracts with each row's contract named, pinned notes first. In all notes (`/notes/all`, sprint 051-UI; `dataService.getAllNotes`, `GET /api/notes?all=true`) it lists every note of every contract, archived ones included, newest first by the sort toggle's time with pins not floated, each row naming "Client · Contract" on its own line; New Note there asks which active contract. Rows are `NoteListRow.svelte`: first-line title, date, second line, and a pin button on the right (`aria-pressed`; always shown when pinned, on hover or focus otherwise) that calls `PUT /api/notes/<id>/pin` and re-sorts in place. Selected row: quiet sage fill (`bg-moss-100`) with a narrow pine edge (054-DR). Header (054-DR, NT-01/NT-02): title and count (`note-list-count`), free space kept for the deferred repeat, the New note icon, and the sort toggle below. Who names the client / contract comes from `note-context-ownership.ts` (`data-owner` on `note-list-context`): with the sidebar beside it a contract's list says "Notes" (the contract only as screen-reader text); with the navigation hidden (desktop sidebar collapsed, tablet overlay closed, phone) it names client and contract with the mark; the client view and all notes name their scope, and their rows carry a `ContractMark` and the contract ("Client · Contract" in all notes). Also provides:
- A sort toggle (modified / created, persisted)
- New note (`NoteListNewNoteButton.svelte`; an icon button named and titled "New note" since 054-DR, 44 px on touch), which opens a draft in the editor at `/notes/<contract>/new`; in the client view a one-contract client uses its contract and otherwise a small menu asks which (the draft opens at `/notes/client/<client>/<contract>/new`). The list only gains the note once the first save creates it
- No search box of its own: search is the top bar's (the list's "Search all notes" box was removed in sprint 051-UI)

It listens for the window events `note-created` and `note-saved` (updates a note's preview in place), `note-moved` (removes the note from this contract's list and shows a transient "Moved to Client / Contract" status line, `data-testid="move-feedback"`, tied to the destination contract) and `note-deleted` (removes the note). The moved note itself stays open in the editor, which then follows the note to its new contract.

### note-context-ownership.ts (054-DR)

Pure NT-01 rule: given the layout mode, whether the shell has the sidebar on screen (`shellPresentation.sidebarOnScreen`, the same record the timer reflection uses; checkpoint A) and the list scope (`contract` / `client` / `all`), which header names the client / contract (`listHeader`), what each row names (`rowContext`, `rowMark`) and whether the editor header shows the context as text (`editorContextVisible`, phone only). Navigation counts as hidden on phone, on tablet while the overlay is closed and on desktop with the sidebar collapsed. Unit tested in `note-context-ownership.test.ts`.

### NoteEditorPanel.svelte

Panel 3 content in notes mode. Opens whatever the URL names (a note, a `/notes/<contract>/new` draft, or nothing) and binds an editor session to it: the TipTap editor, save status (via `NoteEditorHeader` and `SaveStatusIndicator`), a Reload action on conflict, backlinks, linked time entries, export and "Move to..." actions. Delete lives in the editor header and asks for an inline confirmation. A draft becomes a note on its first save without remounting the editor. Before a move or delete it flushes pending saves and waits for in-flight saves of the note. It dispatches the window events `note-created`, `note-saved`, `note-moved` (detail: `noteId`, `fromContractId`, `toContractId`, `toContractName`, `toClientName`) and `note-deleted`. Move failures are shown in the editor header. The header shows the note's contract mark; its client / contract text is visible in the single-column layout only (NT-01, `note-context-ownership.ts`), and the editor gets `compactToolbar` there. A note opened under the wrong contract in the URL is re-opened under its own contract with a replace, so the URL, sidebar and list agree. Its first child is the find bar (`mode="editor"`, decorations in the editor, sprint 042-CL). Since sprint 043-CL the component is the template and wiring only: its state is `NotePanelState`, saving is `note-editor-session.ts`, the header actions are `note-panel-actions.ts` (all in `$lib/components/notes/`), and the "Moved to trash. Undo" toast is `NoteTrashToastHost`, mounted by the workspace layout so it survives this panel unmounting on a phone.

### navigation-labels.ts

Pure helpers that name workspace places. `labelForPath` gives the phone's Back label and the ‹ › labels (a history entry, or the level above; settings and admin read as "Settings", `/search` as "Search", the trash as "Trash"), `noteIdOfPath` names the note an entry shows (to fetch its title), `labelForRoute` gives short labels such as "Week 45" or the note's title, and `titleForRoute` gives the phone title bar text. They read `navigation-routes.ts`, the contract directory and the note title cache.

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
- `$lib/components/identity/ContractMark.svelte`: Contract marks in the sidebar rows (client colour from `$lib/utils/client-colors.ts`)
- `$lib/components/timer/timer-visibility.ts`, `timer-widget-registry.svelte.ts`, `timer-reflection.ts`: the one-visible-timer rule (AppShell)
- `$lib/components/timer/TimerWidget.svelte`: Timer widget in sidebar
- `$lib/components/weekly/WeekStrip.svelte`: Sticky week strip (used by TimeEntriesPanel)
- `$lib/components/weekly/TimerIndicator.svelte`: Top bar timer (used by AppShell)
- `$lib/components/notes/NoteEditor.svelte`: TipTap rich-text editor component
