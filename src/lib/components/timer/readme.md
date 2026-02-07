# Timer Components

Interactive timer widget for time tracking with start/stop/pause/save workflow, plus manual time entry creation.

## Architecture

The timer widget is split across several files:

- **TimerWidget.svelte** -- Main component managing timer state (idle, running, paused, stopped). Renders sub-components based on state. In idle state shows "Start Timer" and "Add Entry" buttons. While running/paused, shows a draft contract select and description textarea that auto-save to the server.
- **TimerDisplay.svelte** -- Formats and displays elapsed time as HH:MM:SS.
- **TimerCompletionForm.svelte** -- Form shown after stopping the timer. Allows selecting contract/deliverable/work type and entering a description before saving. Accepts optional `initialContractId` and `initialDescription` props to pre-populate from the running-state draft.
- **ContractSelect.svelte** -- Reusable dropdown showing "Contract -- Client" for each option. Fetches from `/api/contracts` on mount. Supports a `compact` prop for smaller inline variant. Uses `$bindable()` for two-way binding of `selectedContractId`.
- **AddTimeEntryModal.svelte** -- Modal overlay for creating manual time entries. Includes date picker, HH:MM duration input, contract select, and description. Calls `apiCreateManualEntry` on submit.
- **CascadingSelects.svelte** -- Reusable cascading select component for contract -> deliverable -> work type hierarchy. Fetches options from API endpoints.
- **timer-api.ts** -- API client functions for timer operations (start, stop, save, discard, status check, draft update, manual entry creation) and time calculation utilities.

## State Flow

1. **Idle** -- "Start Timer" and "Add Entry" buttons side by side. Start creates a draft time entry via API. Add Entry opens the manual entry modal.
2. **Running** -- Timer ticks every second via `$effect` with `setInterval`. Shows contract select and description textarea (draft fields auto-save). Can pause or stop.
3. **Paused** -- Timer frozen, draft fields still visible and editable. Can resume or stop.
4. **Stopped** -- Shows completion form with cascading selects, pre-populated with draft contract and description. Can save (requires contract) or discard.

## Draft Persistence

While the timer is running or paused, the user can select a contract and type a description. These are persisted to the server as draft updates:
- Contract changes are saved immediately via `apiUpdateDraft`.
- Description changes are debounced at 1.5 seconds before saving.
- On stop, any pending description update is flushed before stopping the timer.

## API Dependencies

- `GET /api/timer/status` -- Check for existing running timer
- `POST /api/timer/start` -- Start new timer
- `POST /api/timer/stop` -- Stop running timer
- `POST /api/timer/save` -- Save completed entry
- `POST /api/timer/discard` -- Discard draft entry
- `PUT /api/time-entries/:id` -- Update draft entry (contract, description)
- `POST /api/time-entries` -- Create manual time entry
- `GET /api/contracts` -- Load contracts for contract select and cascading select
- `GET /api/deliverables?contractId=...` -- Load deliverables
- `GET /api/work-types?deliverableId=...` -- Load work types
