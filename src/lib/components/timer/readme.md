# Timer Components

Timer widget (start/stop/save) and manual time entry creation, plus the shared time, contract and deliverable inputs used by every entry form. Duration parsing and formatting live in `src/lib/utils/duration.ts`.

## Architecture

- **TimerWidget.svelte** -- Main component, states idle / running / stopped (no pause: the server cannot store paused time). `placement` is `'sidebar'` or `'footer'`; the footer copy is shown on phone only while no sidebar widget is mounted (see `timer-widget-registry.svelte.ts`). Idle shows "Start Timer" and "Add Entry". Running and stopped start with `TimerIdentityHeader` (sprint 053-DR). Running shows the editable start (TimerStartField), the contract select (until a contract is chosen; afterwards behind the header's "Change"), the description (auto-saved) and a Stop button (text exactly "Stop": the Tauri tray clicks it). On desktop and tablet the sidebar widget has a collapse chevron (`timer-compact-preference.ts`, per browser): compact keeps the body mounted but `hidden`, so nothing is lost and a compact widget still counts as on screen. No chevron on a phone or in the footer. On mount it restores the draft from `GET /api/timer/status`. After a save or modal create it dispatches `time-entry-saved` (`src/lib/components/weekly/time-entry-events.ts`) and calls `navigation.showTimeEntryDay()`, so the timesheet shows the saved day.
- **TimerDisplay.svelte** -- Displays elapsed time as HH:MM:SS (`formatElapsedClock`, shared with the top-bar TimerIndicator).
- **TimerStartField.svelte** -- The running timer's "Started" time as a time input (sprint 041-CL), plus a date input when the timer started on another day. Enter or Save moves the start, Escape puts it back. A future start or one over 24 hours ago is refused in place; a start before the end of a saved entry shows the server's warning with "Save anyway". TimerWidget's `handleChangeStart` sends `PATCH /api/timer` for a server draft or rewrites the pending timer in localStorage; the elapsed clock, the top-bar pill and the desktop menu bar (which derives the start from the elapsed seconds) follow.
- **timer-start-edit.ts** -- Browser-side start checks (`localTimerStartProblem`) and reading the server's refusal (`startChangeResultFromError`). Tested in `timer-start-edit.test.ts`.
- **TimerCompletionForm.svelte** -- Shown after stopping ("Finish entry"). Fields: Description, Contract, Deliverable, Work type, Time, all bound to the shared capture store (`$lib/stores/capture-draft.svelte.ts`, sprint 053-DR) and written through to localStorage, so a remount (phone Back, /search, /settings, /notes/trash, the 768px crossing, a reload) restores them. An edited Time adjusts the saved duration. Buttons: Discard, then Save; both clear the store.
- **TimerIdentityHeader.svelte** -- (Toggling the chevron keeps keyboard focus on the chevron.) The capture's identity (TC-02): ContractMark `lg`, contract name first, client as subtitle on the client's wash, the pulsing running light at the top right (static under reduced motion; never on a stopped capture; no RECORDING text), the collapse chevron, and "Change" (running, contract chosen) which reveals the existing ContractSelect. Compact mode: small mark, contract / client, the clock, or "Finish entry" with the frozen duration.
- **TimerPulseDot.svelte** -- The running light, shared by the widget and the header TimerIndicator.
- **timer-visibility.ts** -- `headerReflectionFor(status, presentation)` and `isTimerWidgetOnScreen`: the SH-02 state matrix as a pure function (header shows the capture only while no widget is on screen). Tested in `timer-visibility.test.ts`.
- **timer-reflection.ts** -- Read-only load of the capture for the header when no widget has mounted (a phone opened on a note).
- **timer-compact-preference.ts** -- The collapsed preference (`chronolog:timer-compact`).
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
- **timer-api.ts** -- Elapsed helpers (`calculateElapsedFromStartTime(startTime, startDate, now)`, which uses the full local start timestamp so a timer running past midnight keeps counting, `secondsBetweenTimes`, `formatElapsedClock`) and the `TimerSaveData` type. The widget's tick recomputes from the start every second. Tested in `timer-api.test.ts`.
- **timer-widget-registry.svelte.ts** -- Tracks mounted widgets by placement: the footer renders only while no sidebar widget is mounted, so only one widget is live, and `mountedTimerWidgetCount()` feeds the header rule.

## State Flow

1. **Idle** -- Start creates a draft time entry via `DataService.startTimer()`. Add Entry opens the manual entry modal.
2. **Running** -- Timer ticks every second via `$effect` with `setInterval`. Draft fields auto-save. Stop ends the timer.
3. **Stopped** -- One unfinished capture. The widget opens the capture store (`captureDraft.open`, keyed by the draft id or the pending timer's start, plus an interval key), pre-filled from the draft; fields already stored for the same capture win, except the time text when the server's interval changed (split, resume, move). Can save (requires a contract) or discard; both clear the store. The frozen end stays on the server row (or the pending timer), as before.

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
- `POST /api/timer/start` -- Start new timer (the browser sends `confirmed: true`: its start is now or a timer it already holds)
- `PATCH /api/timer` -- Move the running timer's start (sprint 041-CL; rules in `src/routes/api/timer/timer-start-rules.ts`)
- `POST /api/timer/stop` -- Stop running timer (duration computed from full seconds and rounded up to at least 1 minute, see `src/lib/server/db/queries/timer-duration.ts`)
- `POST /api/timer/save` -- Save completed entry
- `POST /api/timer/discard` -- Discard draft entry
- `PUT /api/time-entries/:id` -- Update draft entry (contract, description)
- `POST /api/time-entries` -- Create manual time entry
- `GET /api/contracts` -- Load contracts for contract select
- `GET /api/deliverables?contractId=...` -- Load deliverables
- `GET /api/work-types?deliverableId=...` -- Load work types
