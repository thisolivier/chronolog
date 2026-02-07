# Timer Components

Interactive timer widget for time tracking with start/stop/pause/save workflow.

## Architecture

The timer widget is split across several files:

- **TimerWidget.svelte** — Main component managing timer state (idle, running, paused, stopped). Renders sub-components based on state.
- **TimerDisplay.svelte** — Formats and displays elapsed time as HH:MM:SS.
- **TimerCompletionForm.svelte** — Form shown after stopping the timer. Allows selecting contract/deliverable/work type and entering a description before saving.
- **CascadingSelects.svelte** — Reusable cascading select component for contract -> deliverable -> work type hierarchy. Fetches options from API endpoints.
- **timer-api.ts** — API client functions for timer operations (start, stop, save, discard, status check) and time calculation utilities.

## State Flow

1. **Idle** — "Start Timer" button. Creates a draft time entry via API.
2. **Running** — Timer ticks every second via `$effect` with `setInterval`. Can pause or stop.
3. **Paused** — Timer frozen. Can resume or stop.
4. **Stopped** — Shows completion form with cascading selects. Can save (requires contract) or discard.

## API Dependencies

- `GET /api/timer/status` — Check for existing running timer
- `POST /api/timer/start` — Start new timer
- `POST /api/timer/stop` — Stop running timer
- `POST /api/timer/save` — Save completed entry
- `POST /api/timer/discard` — Discard draft entry
- `GET /api/contracts` — Load contracts for cascading select
- `GET /api/deliverables?contractId=...` — Load deliverables
- `GET /api/work-types?deliverableId=...` — Load work types
