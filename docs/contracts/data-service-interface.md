# Contract: DataService Interface

The DataService abstraction is the central contract for this epic. It decouples all UI
components from the sync/storage backend.

## Interface Shape

The `powersync-spike` branch defines the interface in `src/lib/services/data-service.ts`.
It exposes ~28 methods covering:

- **Clients**: getClients, getClient, createClient, updateClient, deleteClient
- **Contracts**: getContracts, getContract, createContract, updateContract, deleteContract
- **Deliverables**: getDeliverables, createDeliverable, updateDeliverable, deleteDeliverable
- **Work Types**: getWorkTypes, createWorkType, updateWorkType, deleteWorkType
- **Time Entries**: getTimeEntries, getTimeEntry, createTimeEntry, updateTimeEntry, deleteTimeEntry
- **Notes**: getNotes, getNote, createNote, updateNote, deleteNote
- **Note Links**: getNoteLinks, createNoteLink, deleteNoteLink
- **Weekly Statuses**: getWeeklyStatuses, createWeeklyStatus, updateWeeklyStatus

## Implementations

1. **FetchDataService** — HTTP calls to existing SvelteKit API routes (current behavior)
2. **PowerSyncDataService** — local SQLite reads + uploadData() writes (Phase D)

## Rules

- All UI components MUST use the DataService interface, never direct fetch() or API calls
- The active implementation is selected at app init via env var or runtime config
- Both implementations must pass the same test suite
- The interface is the source of truth — spike code is reference, not gospel
