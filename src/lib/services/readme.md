# DataService Module

Abstraction layer that decouples UI components from the data backend. Components
program against the `DataService` interface and never call fetch or database APIs
directly. This makes it possible to swap the underlying implementation (e.g. from
server-fetch to local-first offline sync) without changing any component code.

## Main Files

| File | Purpose |
|---|---|
| `data-service.ts` | `DataService` interface definition. Declares all data operations grouped by domain: contracts, clients, notes, attachments, time entries, timer, deliverables, and work types. |
| `fetch-data-service.ts` | `FetchDataService` class -- the default `DataService` implementation. Delegates every operation to SvelteKit API routes via HTTP fetch calls. |
| `delegating-data-service.ts` | `DelegatingDataService` class -- a wrapper that forwards all calls to a mutable inner `DataService`. Used by the layout to allow swapping the backend (e.g. from FetchDataService to PowerSyncDataService) after async initialization without invalidating component references. |
| `fetch-helpers.ts` | Shared HTTP utilities (`fetchJson`, `postJson`, `putJson`, `deleteRequest`) used by `FetchDataService`. Each helper checks `response.ok` and throws a descriptive error on failure. |
| `types.ts` | All shared TypeScript types consumed by the interface and its implementations (e.g. `NoteSummary`, `WeekData`, `TimerStatus`). |
| `context.ts` | Svelte context helpers for dependency injection (`setDataServiceContext` / `getDataService`). |
| `index.ts` | Barrel file re-exporting the public API: interface, implementation, context helpers, and all types. |

## Context Pattern

The module uses Svelte's `setContext` / `getContext` for dependency injection:

1. **Provider** -- `+layout.svelte` creates a `DelegatingDataService` (wrapping
   `FetchDataService`) and calls `setDataServiceContext()` synchronously during
   component initialization. This makes the service available to the entire
   component tree immediately.
2. **Consumer** -- Any child component calls `getDataService()` to retrieve the
   service and invoke data operations against it.
3. **Backend swap** -- When `PUBLIC_SYNC_BACKEND=powersync`, the layout connects
   PowerSync asynchronously in `onMount` and calls `setDelegate()` on the
   `DelegatingDataService` to swap the underlying implementation. Existing
   component references remain valid because they point to the wrapper, not
   the inner service.

This keeps components unaware of which `DataService` implementation is active.

## Implementations

- **FetchDataService** (default) -- Talks to the server via SvelteKit API routes.
  Suitable for online-only usage. Always used as the initial backend.
- **PowerSyncDataService** (opt-in via `PUBLIC_SYNC_BACKEND=powersync`) -- Reads
  from and writes to a local PowerSync database, syncing with the server in the
  background. See `$lib/powersync/` for the implementation. Falls back to
  FetchDataService if the connection fails.
