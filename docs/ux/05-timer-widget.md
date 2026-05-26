# Timer Widget

## Overview

The `TimerWidget` is a persistent component at the bottom of the contracts sidebar. It lets users start, pause, stop, and save timed work sessions. It also provides an "Add Entry" button for manual time entry creation.

## States

The timer has four states: `idle`, `running`, `paused`, and `stopped`.

### Idle State

```
+-----------------------------+
|  [Start Timer] [Add Entry]  |
+-----------------------------+
```

- **Start Timer** (green): Creates a draft time entry on the server immediately, then starts counting.
- **Add Entry** (white/gray border): Opens the `AddTimeEntryModal` for manual entry.

### Running State

```
+-----------------------------+
|  01:23:45     [Pause] [Stop]|
|  Started: 09:30             |
|                             |
|  Contract:                  |
|  [Select contract... v]     |
|                             |
|  Description:               |
|  [What are you working on?] |
+-----------------------------+
```

- **Timer display**: `TimerDisplay.svelte` -- large monospace `HH:MM:SS`, updates every second via `setInterval`.
- **Pause** (gray border): Switches to paused state (stops the interval).
- **Stop** (red): Calls `dataService.stopTimer()` to freeze end time, transitions to stopped state.
- **Started time**: Shows the start time from the server (first 5 chars, i.e., `HH:MM`).
- **Contract select**: `ContractSelect.svelte` in compact mode. Changes are persisted immediately to the server via `dataService.updateTimeEntry()`.
- **Description**: Textarea with debounced save (1500ms). Persisted to server on debounce.

### Paused State

Same as running but:
- Timer display shows "(paused)" suffix in gray
- Timer numbers are gray (`text-gray-400`)
- "Pause" button becomes "Resume" button

Note: Pause only stops the client-side counter. No server call is made. The elapsed time continues to accumulate visually when resumed.

### Stopped State

```
+-----------------------------+
|  09:30 - 10:53    1h 23m   |
|                             |
|  Contract: *                |
|  [Select contract... v]     |
|                             |
|  Deliverable:               |
|  [Select deliverable... v]  |
|                             |
|  Work Type:                 |
|  [Select work type... v]    |
|                             |
|  Description:               |
|  [What did you work on?]    |
|                             |
|  [Save]         [Discard]   |
+-----------------------------+
```

The `TimerCompletionForm.svelte` renders:
- **Time display**: Start - End time and formatted duration
- **CascadingSelects**: Contract (required, marked with *), Deliverable (shown if contract has deliverables), Work Type (shown if deliverable has work types)
- **Description**: Textarea, pre-filled from draft description
- **Save**: Disabled until a contract is selected. Calls `dataService.saveTimer()`.
- **Discard**: Calls `dataService.discardTimer()` to delete the draft entry.

## Cascading Selects

`CascadingSelects.svelte` provides three dependent dropdowns:

1. **Contract** (required): Fetched via `dataService.getContracts()`. Each option shows `clientShortCode / contractName`.
2. **Deliverable** (optional): Fetched via `dataService.getDeliverables(contractId)` when a contract is selected. Only shown if the contract has deliverables.
3. **Work Type** (optional): Fetched via `dataService.getWorkTypes(deliverableId)` when a deliverable is selected. Only shown if the deliverable has work types.

Changing a parent resets and reloads all children.

## Contract Select

`ContractSelect.svelte` is a standalone contract dropdown used in the running/paused timer state and in `NewEntryRow`. It has a `compact` prop that reduces padding/font size. Options show `clientName -- contractName`.

## Add Time Entry Modal

`AddTimeEntryModal.svelte` is a centered overlay modal for creating manual time entries:

```
+-------------------------------+
|  Add Time Entry               |
|                               |
|  Date:                        |
|  [2026-05-26]                 |
|                               |
|  Duration (HH:MM):           |
|  [1:30]                       |
|                               |
|  Contract: *                  |
|  [Select contract... v]       |
|                               |
|  Description:                 |
|  [What did you work on?]      |
|                               |
|  [Create]         [Cancel]    |
+-------------------------------+
```

- **Date**: Defaults to today. Standard date input.
- **Duration**: Text input accepting `HH:MM` or `H:MM` format. Parsed via `parseDurationToMinutes()`.
- **Contract**: Required. Uses `ContractSelect`.
- **Description**: Optional textarea.
- **Validation**: Create button disabled until contract + date + valid positive duration.
- **Dismiss**: Click backdrop or press Escape.

## Server Timer API

The timer communicates with the server through the DataService:

| Method | Purpose |
|--------|---------|
| `getTimerStatus()` | Check for an existing running/stopped timer on page load |
| `startTimer()` | Create a draft time entry with start time |
| `stopTimer()` | Set end time and calculate duration |
| `saveTimer()` | Finalize the entry with contract/deliverable/work type/description |
| `discardTimer()` | Delete the draft entry |
| `updateTimeEntry()` | Persist contract/description changes while running |

## Timer Recovery

On component mount, `checkExistingTimer()` is called to restore any in-progress timer. If a timer entry exists on the server:
- With no `endTime`: Resumes as `running`, calculates elapsed from start time
- With an `endTime`: Shows as `stopped` with the completion form

## Files

| File | Purpose |
|------|---------|
| `src/lib/components/timer/TimerWidget.svelte` | Main timer orchestrator |
| `src/lib/components/timer/TimerDisplay.svelte` | HH:MM:SS display |
| `src/lib/components/timer/TimerCompletionForm.svelte` | Stopped state form |
| `src/lib/components/timer/CascadingSelects.svelte` | Contract > Deliverable > Work Type |
| `src/lib/components/timer/ContractSelect.svelte` | Standalone contract dropdown |
| `src/lib/components/timer/AddTimeEntryModal.svelte` | Manual entry creation modal |
| `src/lib/components/timer/timer-api.ts` | Direct fetch helpers (legacy, used by some paths) |
