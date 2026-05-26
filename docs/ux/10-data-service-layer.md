# Data Service Layer

## Overview

All UI components access data through a `DataService` interface abstraction. This decouples the UI from the backend implementation, enabling future swaps between fetch-based (server) and PowerSync-based (offline-first) backends.

## Architecture

```
+------------------+
|  Svelte UI       |  calls getDataService()
+--------+---------+
         |
+--------v---------+
|  DelegatingDS    |  wraps the active implementation
+--------+---------+
         |
+--------v---------+
|  FetchDataService|  current implementation (HTTP fetch)
+------------------+
         |
+--------v---------+
|  /api/* routes   |  SvelteKit server endpoints
+------------------+
```

## DataService Interface

The `DataService` interface (`data-service.ts`) defines all data operations:

### Contracts & Clients
- `getContractsByClient()` -- flat list with client info + note counts
- `getContracts()` -- dropdown options with client short codes
- `createContract(data)` -- create a new contract
- `getClients()` -- client summaries (id, name, shortCode)

### Notes
- `getNotesForContract(contractId)` -- note summaries with preview lines
- `getNoteById(noteId)` -- full note with content/JSON
- `createNote(contractId)` -- create empty note
- `updateNote(noteId, data)` -- save title/content/JSON/pinned
- `deleteNote(noteId)` -- delete a note
- `getNoteBacklinks(noteId)` -- notes linking to this note

### Attachments
- `getNoteAttachments(noteId)` -- attachment metadata list
- `uploadAttachment(noteId, file)` -- upload file, returns ID
- `deleteAttachment(attachmentId)` -- delete an attachment

### Note-Time Entry Links
- `getNoteTimeEntries(noteId)` -- linked entry IDs
- `unlinkNoteTimeEntry(noteId, timeEntryId)` -- remove link

### Time Entries
- `getWeeklyTimeEntries(weekStarts)` -- full week data for multiple weeks
- `getWeekSummaries(count, before?)` -- paginated week summaries
- `createTimeEntry(data)` -- create a new entry
- `updateTimeEntry(entryId, data)` -- update fields
- `deleteTimeEntry(entryId)` -- delete an entry
- `updateWeeklyStatus(year, weekNumber, status)` -- set week status

### Timer
- `getTimerStatus()` -- check for running timer
- `startTimer(contractId?)` -- create draft entry
- `stopTimer()` -- set end time
- `saveTimer(data)` -- finalize entry
- `discardTimer(entryId)` -- delete draft

### Deliverables & Work Types
- `getDeliverables(contractId)` -- deliverable options
- `getWorkTypes(deliverableId)` -- work type options

## DelegatingDataService

`DelegatingDataService` wraps any `DataService` implementation. It forwards all calls to the wrapped instance. This allows hot-swapping the backend (e.g., from Fetch to PowerSync) without invalidating component references.

```typescript
class DelegatingDataService implements DataService {
    constructor(private delegate: DataService) {}
    // All methods forward to this.delegate
}
```

## FetchDataService

`FetchDataService` implements `DataService` using standard `fetch()` calls to SvelteKit API routes. It uses helper functions from `fetch-helpers.ts` for consistent error handling.

### API Route Mapping

| DataService Method | HTTP Method | API Route |
|-------------------|-------------|-----------|
| `getContractsByClient()` | GET | `/api/contracts-by-client` |
| `getContracts()` | GET | `/api/contracts` |
| `createContract()` | POST | `/api/contracts` |
| `getClients()` | GET | `/api/clients` |
| `getNotesForContract()` | GET | `/api/notes?contractId=` |
| `getNoteById()` | GET | `/api/notes/[noteId]` |
| `createNote()` | POST | `/api/notes` |
| `updateNote()` | PUT | `/api/notes/[noteId]` |
| `deleteNote()` | DELETE | `/api/notes/[noteId]` |
| `getNoteBacklinks()` | GET | `/api/notes/[noteId]/backlinks` |
| `getNoteAttachments()` | GET | `/api/notes/[noteId]/attachments` |
| `uploadAttachment()` | POST | `/api/notes/[noteId]/attachments` (multipart) |
| `deleteAttachment()` | DELETE | `/api/attachments/[attachmentId]` |
| `getNoteTimeEntries()` | GET | `/api/notes/[noteId]/time-entries` |
| `unlinkNoteTimeEntry()` | DELETE | `/api/notes/[noteId]/time-entries?timeEntryId=` |
| `getWeeklyTimeEntries()` | GET | `/api/time-entries/weekly?weeks=` |
| `getWeekSummaries()` | GET | `/api/weeks?count=&before=` |
| `createTimeEntry()` | POST | `/api/time-entries` |
| `updateTimeEntry()` | PUT | `/api/time-entries/[id]` |
| `deleteTimeEntry()` | DELETE | `/api/time-entries/[id]` |
| `updateWeeklyStatus()` | POST | `/api/time-entries/weekly-statuses` |
| `getTimerStatus()` | GET | `/api/timer/status` |
| `startTimer()` | POST | `/api/timer/start` |
| `stopTimer()` | POST | `/api/timer/stop` |
| `saveTimer()` | POST | `/api/timer/save` |
| `discardTimer()` | POST | `/api/timer/discard` |
| `getDeliverables()` | GET | `/api/deliverables?contractId=` |
| `getWorkTypes()` | GET | `/api/work-types?deliverableId=` |
| `searchNotes()` | GET | `/api/notes/search?q=` |

## Context Setup

```typescript
// In +layout.svelte (for authenticated users only):
const delegatingService = new DelegatingDataService(new FetchDataService());
setDataServiceContext(delegatingService);

// In any component:
const dataService = getDataService();
```

## Files

| File | Purpose |
|------|---------|
| `src/lib/services/data-service.ts` | DataService interface definition |
| `src/lib/services/delegating-data-service.ts` | Forwarding wrapper |
| `src/lib/services/fetch-data-service.ts` | HTTP fetch implementation |
| `src/lib/services/fetch-helpers.ts` | Shared fetch utilities |
| `src/lib/services/context.ts` | Svelte context setup/access |
| `src/lib/services/types.ts` | Shared type definitions |
| `src/lib/services/index.ts` | Module exports |
