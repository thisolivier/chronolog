# Timer Components

Interactive timer widget for time tracking with start/stop/pause/save workflow, plus manual time entry creation.

## Architecture

The timer widget is split across several files:

- **TimerWidget.svelte** -- Main component managing timer state (idle, running, paused, stopped). Renders sub-components based on state. In idle state shows "Start Timer" and "Add Entry" buttons. While running/paused, shows a draft contract select and description textarea that auto-save to the server. On mount it restores the draft contract and description from `GET /api/timer/status`, so a reload mid-run or after Stop keeps the contract. After a timer save or a modal create it dispatches the `time-entry-saved` window event (`src/lib/components/weekly/time-entry-events.ts`) so `TimeEntriesPanel` refreshes without a reload.
- **TimerDisplay.svelte** -- Formats and displays elapsed time as HH:MM:SS.
- **TimerCompletionForm.svelte** -- Form shown after stopping the timer. Allows selecting contract/deliverable/work type and entering a description before saving. Accepts optional `initialContractId` and `initialDescription` props to pre-populate from the running-state draft.
- **ContractSelect.svelte** -- Reusable dropdown showing "Contract -- Client" for each option. Loads contracts via `DataService.getContracts()` on mount. Supports a `compact` prop for smaller inline variant. Uses `$bindable()` for two-way binding of `selectedContractId`.
- **DeliverableSelect.svelte** -- Reusable dropdown showing deliverables for a given contract. Loads via `DataService.getDeliverables(contractId)` and re-loads when contractId changes. Renders only when deliverables exist unless `alwaysRender` is set (then shows a disabled placeholder). Supports `compact`, `id` and `onChange` props. Uses `$bindable()` for `selectedDeliverableId`. Used by `NewEntryRow`, `AddTimeEntryModal` and `TimeEntryCard` (inline edit).
- **WorkTypeSelect.svelte** -- Sibling of DeliverableSelect for the work types of a deliverable (`DataService.getWorkTypes()`). Renders nothing when the deliverable has no work types; exposes bindable `hasWorkTypes` so parents can hide their label.
- **AddTimeEntryModal.svelte** -- Modal overlay for creating manual time entries. Includes date picker, HH:MM duration input, contract select, deliverable + work type selects, and description. Calls `DataService.createTimeEntry()` on submit.
- **CascadingSelects.svelte** -- Reusable cascading select component for contract -> deliverable -> work type hierarchy. Loads options via `DataService.getContracts()` / `getDeliverables()` / `getWorkTypes()`.
- **timer-api.ts** -- `calculateElapsedFromStartTime()` only (elapsed seconds from an `HH:MM:SS` start time). All data access goes through `DataService`.

## State Flow

1. **Idle** -- "Start Timer" and "Add Entry" buttons side by side. Start creates a draft time entry via `DataService.startTimer()`. Add Entry opens the manual entry modal.
2. **Running** -- Timer ticks every second via `$effect` with `setInterval`. Shows contract select and description textarea (draft fields auto-save). Can pause or stop.
3. **Paused** -- Timer frozen, draft fields still visible and editable. Can resume or stop.
4. **Stopped** -- Shows completion form with cascading selects, pre-populated with draft contract and description. Can save (requires contract) or discard.

## Draft Persistence

While the timer is running or paused, the user can select a contract and type a description. These are persisted to the server as draft updates:
- Contract changes are saved immediately via `DataService.updateTimeEntry()`.
- Description changes are debounced at 1.5 seconds before saving.
- On stop, any pending description update is flushed before stopping the timer.

## API Dependencies

All calls are made through `DataService` (see `src/lib/services/readme.md`); the underlying routes are:

- `GET /api/timer/status` -- Check for existing running timer
- `POST /api/timer/start` -- Start new timer
- `POST /api/timer/stop` -- Stop running timer (duration computed from full seconds and rounded up to at least 1 minute, see `src/lib/server/db/queries/timer-duration.ts`)
- `POST /api/timer/save` -- Save completed entry
- `POST /api/timer/discard` -- Discard draft entry
- `PUT /api/time-entries/:id` -- Update draft entry (contract, description)
- `POST /api/time-entries` -- Create manual time entry
- `GET /api/contracts` -- Load contracts for contract select and cascading select
- `GET /api/deliverables?contractId=...` -- Load deliverables
- `GET /api/work-types?deliverableId=...` -- Load work types
