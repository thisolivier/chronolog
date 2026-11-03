# Contract: DataService Interface

`DataService` (`src/lib/services/data-service.ts`) is the seam between the UI and the data
backend. Components obtain it from Svelte context (`getDataService()`) and never call `fetch()`
or API routes directly. The source file is the source of truth; this document mirrors it.

## Methods

Types come from `src/lib/services/types.ts`.

**Contracts**
- `getContractsByClient(): Promise<ContractsByClientResult[]>`
- `getContracts(): Promise<ContractOption[]>`
- `createContract(data: CreateContractInput): Promise<{ id: string }>`

**Clients**
- `getClients(): Promise<ClientSummary[]>`

**Notes**
- `getNotesForContract(contractId: string): Promise<NoteSummary[]>`
- `getNoteById(noteId: string): Promise<NoteDetail>`
- `createNote(contractId: string): Promise<NoteSummary>`
- `updateNote(noteId: string, data: UpdateNoteInput): Promise<NoteDetail>`
- `deleteNote(noteId: string): Promise<void>`
- `getNoteBacklinks(noteId: string): Promise<Backlink[]>`

**Attachments**
- `getNoteAttachments(noteId: string): Promise<AttachmentSummary[]>`
- `uploadAttachment(noteId: string, file: File): Promise<{ id: string }>`
- `deleteAttachment(attachmentId: string): Promise<void>`

**Note–Time Entry Links**
- `getNoteTimeEntries(noteId: string): Promise<LinkedTimeEntryDisplay[]>`
- `linkNoteTimeEntry(noteId: string, timeEntryId: string, headingAnchor?: string): Promise<void>`
- `unlinkNoteTimeEntry(noteId: string, timeEntryId: string): Promise<void>`

**Time Entries**
- `getWeeklyTimeEntries(weekStarts: string[]): Promise<WeekData[]>`
- `createTimeEntry(data: CreateTimeEntryInput): Promise<{ id: string }>`
- `updateTimeEntry(entryId: string, data: Partial<TimeEntryFields>): Promise<void>`
- `deleteTimeEntry(entryId: string): Promise<void>`
- `updateWeeklyStatus(year: number, weekNumber: number, status: string): Promise<void>`

**Timer**
- `getTimerStatus(): Promise<TimerStatus>`
- `startTimer(contractId?: string): Promise<TimerEntry>`
- `stopTimer(): Promise<TimerEntry>`
- `saveTimer(data: SaveTimerInput): Promise<void>`
- `discardTimer(entryId: string): Promise<void>`

**Deliverables & Work Types**
- `getDeliverables(contractId: string): Promise<DeliverableOption[]>`
- `getWorkTypes(deliverableId: string): Promise<WorkTypeOption[]>`

## Implementations

- **`FetchDataService`** (`fetch-data-service.ts`) — HTTP calls to the SvelteKit API routes. The
  only backend today; production runs in this mode against Postgres.
- **`DelegatingDataService`** (`delegating-data-service.ts`) — thin wrapper that forwards every
  call to an inner `DataService` and exposes `setDelegate()`. `+layout.svelte` provides
  `new DelegatingDataService(new FetchDataService())` via context, so the backend can be swapped
  at runtime without touching components.

## Rules

- UI components MUST go through `DataService`; no direct `fetch()` or API calls.
- Adding an operation: extend the interface, implement it in `FetchDataService`, forward it in
  `DelegatingDataService`, add types to `types.ts`, cover it in `fetch-data-service.test.ts`, and
  update the list above.
- A future offline backend (cache + outbox, deferred) implements this same interface and is
  plugged in behind `DelegatingDataService`; nothing else in the UI changes.
