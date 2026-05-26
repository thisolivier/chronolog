# Contracts Sidebar (Panel 1)

## Overview

The contracts sidebar (`ContractsSidebar.svelte`) is the leftmost panel in the three-panel layout. It serves as the primary navigation hub, letting users switch between time-entries mode and notes mode (by contract), create new contracts, access admin settings, and use the timer.

## Layout

```
+-------------------+
|  [Time Entries]   |   <-- nav button, highlighted blue when active
|                   |
|  CONTRACTS        |   <-- section header (uppercase, gray)
|  [emoji Client]   |   <-- contract buttons, flat list
|  [CODE: Contract] |
|  [CODE: Contract] |
|                   |
|  ...scrollable... |
|                   |
|  ─────────────    |
|  [New Contract]   |   <-- action link
|  [Settings]       |   <-- link to /admin
|  ─────────────    |
|  ┌───────────┐    |
|  │  Timer    │    |   <-- TimerWidget component
|  │  Widget   │    |
|  └───────────┘    |
+-------------------+
```

## Contracts List

Contracts are fetched via `dataService.getContractsByClient()` which returns a flat list of contracts with their client details. Each contract button shows:

- **Client emoji** (if set) followed by contract name, OR
- **Client short code** (gray, colon-separated) followed by contract name
- **Inactive indicator**: `(inactive)` text + 50% opacity when `isActive` is false
- **Note count** (right-aligned, gray, only shown if > 0)

The currently selected contract is highlighted with `bg-blue-50 text-blue-700`.

Clicking a contract calls `navigationContext.selectContract(contractId, clientId)` which switches to notes mode.

## Time Entries Button

A full-width button at the top. Highlighted with `bg-blue-50 text-blue-700` when `isTimeEntriesMode` is true.

## Action Buttons

Below the scrollable contracts list, separated by a border-top:

- **New Contract**: Opens the `ContractCreateModal` overlay
- **Settings**: Links to `/admin`

## Contract Create Modal

`ContractCreateModal.svelte` is a full-screen overlay modal with:

- **Client dropdown**: Populated from `dataService.getClients()`
- **Contract name**: Required text input
- **Description**: Optional textarea
- **Active checkbox**: Checked by default
- **Create / Cancel buttons**

On successful creation, the contracts list and clients list are both reloaded.

## Timer Widget

The `TimerWidget` component sits at the bottom of the sidebar in a bordered section. See `05-timer-widget.md` for full documentation.

## Data Loading

On mount (via `$effect`), two parallel fetches occur:
1. `dataService.getContractsByClient()` -- for the contracts list
2. `dataService.getClients()` -- for the "New Contract" modal's client dropdown

## States

| State | Display |
|-------|---------|
| Loading | "Loading..." centered text |
| Error | Red error box with message |
| Empty | "No contracts found" centered text |
| Loaded | Scrollable list of contract buttons |

## Files

| File | Purpose |
|------|---------|
| `src/lib/components/layout/ContractsSidebar.svelte` | Main sidebar component |
| `src/lib/components/admin/ContractCreateModal.svelte` | Modal for creating contracts |
