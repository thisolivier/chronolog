# Timer Components

Timer widget (start/stop/save) and manual time entry creation, plus the shared time, contract and deliverable inputs used by every entry form. Duration parsing and formatting live in `src/lib/utils/duration.ts`.

## Architecture

- **TimerWidget.svelte** -- Main component, states idle / running / stopped (no pause: the server cannot store paused time). `placement` is `'sidebar'` or `'footer'`; the footer copy is shown on phone only while no sidebar widget is mounted (see `timer-widget-registry.svelte.ts`). Idle shows "Start Timer" and "Add Entry". Running shows the draft contract select and description (auto-saved) and a Stop button. On mount it restores the draft from `GET /api/timer/status`. After a save or modal create it dispatches `time-entry-saved` (`src/lib/components/weekly/time-entry-events.ts`) and calls `navigation.showTimeEntryDay()`, so the timesheet shows the saved day.
- **TimerDisplay.svelte** -- Formats and displays elapsed time as HH:MM:SS.
- **TimerCompletionForm.svelte** -- Shown after stopping. Fields: Description, Contract, Deliverable, Work type, Time. An edited Time adjusts the saved duration. Buttons: Discard, then Save.
- **AddTimeEntryModal.svelte** -- Modal for manual entries. Fields: Date, Description, Contract, Deliverable, Work type, Time. Buttons: Cancel, then Save. Shows inline errors and reports the created entry's id and date. It preselects the contract being viewed (notes mode) and a day of the viewed week in the timesheet (today when today is in that week).
- **DurationField.svelte** -- Shared time input (bindable `value`) with a parsed preview, a long-entry warning and an error message.
- **ContractSelect.svelte** -- Bindable `selectedContractId`. Labels come from `contract-label.ts` ("Client / Contract"). Props: `compact`, `id`, `invalid`, `autofocus`, `onkeydown`.
- **DeliverableSelect.svelte** -- Bindable `selectedDeliverableId`. Renders only when deliverables exist unless `alwaysRender` is set. Props include `onChange`.
- **WorkTypeSelect.svelte** -- Bindable `selectedWorkTypeId`; exposes bindable `hasWorkTypes` so parents can hide their label. Renders nothing when the deliverable has no work types.
- **contract-label.ts** -- `formatContractLabel()`, the one contract label format ("Client / Contract"). Tested in `contract-label.test.ts`.
- **save-error.ts** -- `describeSaveError()` turns a failed save into "Couldn't save: ...", keeping only the server's own message. Tested in `save-error.test.ts`.
- **local-date.ts** -- Browser-local date and time strings, sent to `/api/timer/start` and `/stop`. Tested in `local-date.test.ts`.
- **deliverable-cache.ts** -- Per-contract "has deliverables" lookup cached for 60 seconds, used by time entry cards.
- **pending-timer.ts** -- A timer started with no contract is kept in localStorage until the user picks one. Tested in `pending-timer.test.ts`.
- **timer-api.ts** -- Elapsed helpers (`calculateElapsedFromStartTime`, `secondsBetweenTimes`) and the `TimerSaveData` type. Tested in `timer-api.test.ts`.
- **timer-widget-registry.svelte.ts** -- Tracks whether the sidebar TimerWidget is mounted, so only one timer widget is live.

## State Flow

1. **Idle** -- Start creates a draft time entry via `DataService.startTimer()`. Add Entry opens the manual entry modal.
2. **Running** -- Timer ticks every second via `$effect` with `setInterval`. Draft fields auto-save. Stop ends the timer.
3. **Stopped** -- Shows the completion form, pre-filled from the draft. Can save (requires a contract) or discard.

The timer never picks a contract by itself. Start Timer uses the contract open in the sidebar (notes mode). Otherwise the timer runs with no contract, held in the browser by `pending-timer.ts`. Once the user picks a contract, the server draft is created with the original local start time.

## Draft Persistence

While the timer is running, the user can select a contract and type a description. These are persisted to the server as draft updates:
- Contract changes are saved immediately via `DataService.updateTimeEntry()`.
- Description changes are debounced at 1.5 seconds before saving.
- On stop, any pending description update is flushed before stopping the timer.
- While no server draft exists yet (pending), changes go to localStorage only.

## API Dependencies

All calls are made through `DataService` (see `src/lib/services/readme.md`); the underlying routes are:

- `GET /api/timer/status` -- Check for existing running timer
- `POST /api/timer/start` -- Start new timer
- `POST /api/timer/stop` -- Stop running timer (duration computed from full seconds and rounded up to at least 1 minute, see `src/lib/server/db/queries/timer-duration.ts`)
- `POST /api/timer/save` -- Save completed entry
- `POST /api/timer/discard` -- Discard draft entry
- `PUT /api/time-entries/:id` -- Update draft entry (contract, description)
- `POST /api/time-entries` -- Create manual time entry
- `GET /api/contracts` -- Load contracts for contract select
- `GET /api/deliverables?contractId=...` -- Load deliverables
- `GET /api/work-types?deliverableId=...` -- Load work types
