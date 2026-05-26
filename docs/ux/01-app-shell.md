# App Shell & Layout

## Overview

The main application uses a three-panel Apple Notes-inspired layout on desktop, with a single-panel push/pop navigation on mobile. The layout is implemented in `AppShell.svelte` and composed in the root `+page.svelte`.

## Desktop Layout (>= 1024px)

```
+-------------------+--------------------+-------------------------------+
|  Panel 1          |  Panel 2           |  Panel 3                      |
|  ContractsSidebar |  (varies by mode)  |  (varies by mode)             |
|  240px fixed      |  280px resizable   |  flex (fills remaining)       |
|  collapsible      |  200-500px range   |                               |
|                   |                    |                               |
|  [Time Entries]   |  WeekListPanel     |  TimeEntriesPanel             |
|  ----             |  -- or --          |  -- or --                     |
|  Contracts:       |  NoteListPanel     |  NoteEditorPanel              |
|  [Client: Cont]   |                    |                               |
|  [Client: Cont]   |                    |                               |
|                   |                    |                               |
|  ----             |                    |                               |
|  [New Contract]   |                    |                               |
|  [Settings]       |                    |                               |
|  ----             |                    |                               |
|  [Timer Widget]   |                    |                               |
+-------------------+--------------------+-------------------------------+
```

### Panel Details

- **Panel 1** (ContractsSidebar): Fixed 240px width; collapses to 0px via `toggleSidebar()`. Contains the "Time Entries" nav button, the flat contracts list, action buttons ("New Contract", "Settings"), and the TimerWidget at the bottom.
- **Panel 2**: Resizable from 200px to 500px via a drag handle on the right edge. Shows `WeekListPanel` when in time-entries mode or `NoteListPanel` when in notes mode.
- **Panel 3**: Fills remaining horizontal space. Shows `TimeEntriesPanel` when in time-entries mode or `NoteEditorPanel` when in notes mode.

### Resize Handle

A 1px-wide invisible handle on the right edge of Panel 2. Becomes blue on hover, darker on active. Mouse drag resizes Panel 2 between 200px and 500px.

## Mobile Layout (< 1024px)

Uses a media query `(max-width: 1023px)` to detect mobile. Displays a single panel at a time based on `mobileNavigationLevel`:

```
Level 0: Panel 1 (ContractsSidebar)
    |  tap contract or "Time Entries"
    v
Level 1: Panel 2 (WeekListPanel or NoteListPanel)
    |  tap week or note
    v
Level 2: Panel 3 (TimeEntriesPanel or NoteEditorPanel)
```

A "Back" button appears in a header bar when `mobileNavigationLevel > 0`, calling `goBackMobile()` to decrement the level.

## Mode Switching

The navigation context tracks two modes:

- **time-entries**: Triggered by clicking "Time Entries" in the sidebar. Shows `WeekListPanel` in Panel 2 and `TimeEntriesPanel` in Panel 3.
- **notes**: Triggered by clicking any contract in the sidebar. Shows `NoteListPanel` in Panel 2 and `NoteEditorPanel` in Panel 3.

The default mode on page load is `time-entries` with the current week selected.

## Sidebar Collapse

Panel 1 can be collapsed/expanded via `SidebarToggle.svelte`, a small floating button in the top-left corner. It renders a chevron-left (collapse) or chevron-right (expand) SVG icon. The panel transitions with a 300ms CSS animation.

## Authentication Guard

The `hooks.server.ts` middleware redirects unauthenticated users to `/login` for all routes except: `/login`, `/register`, `/api/auth/*`, `/api/powersync/jwks`, and `/spike`.

When a user is authenticated, the root layout (`+layout.svelte`) initializes:
1. `NavigationState` via Svelte context
2. `DelegatingDataService` wrapping a `FetchDataService`

If not authenticated, neither is initialized and the page renders the child route directly (which will be the login/register page).

## Files

| File | Purpose |
|------|---------|
| `src/routes/+layout.svelte` | Root layout: imports CSS, initializes nav context and data service |
| `src/routes/+layout.server.ts` | Passes session/user to client |
| `src/routes/+page.svelte` | Main page: composes AppShell with three panels |
| `src/lib/components/layout/AppShell.svelte` | Three-panel layout with mobile/desktop modes |
| `src/lib/components/layout/SidebarToggle.svelte` | Collapse/expand button for Panel 1 |
| `src/hooks.server.ts` | Auth guard, user provisioning, COOP/COEP headers for spike |
