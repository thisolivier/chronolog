# DataService Module

Abstraction layer that decouples UI components from the data backend. Components
program against the `DataService` interface and never call fetch or database APIs
directly. This makes it possible to swap the underlying implementation (e.g. from
server-fetch to local-first offline sync) without changing any component code.

## Main Files

| File | Purpose |
|---|---|
| `data-service.ts` | `DataService` interface definition. Declares all data operations grouped by domain: contracts, clients, notes, attachments, time entries, timer, deliverables, and work types. |
| `fetch-data-service.ts` | `FetchDataService` class -- the current `DataService` implementation. Delegates every operation to SvelteKit API routes via HTTP fetch calls. |
| `fetch-helpers.ts` | Shared HTTP utilities (`fetchJson`, `postJson`, `putJson`, `deleteRequest`) used by `FetchDataService`. Each helper checks `response.ok` and throws a descriptive error on failure. |
| `types.ts` | All shared TypeScript types consumed by the interface and its implementations (e.g. `NoteSummary`, `WeekData`, `TimerStatus`). |
| `context.ts` | Svelte context helpers for dependency injection (`setDataServiceContext` / `getDataService`). |
| `index.ts` | Barrel file re-exporting the public API: interface, implementation, context helpers, and all types. |

## Context Pattern

The module uses Svelte's `setContext` / `getContext` for dependency injection:

1. **Provider** -- `+layout.svelte` calls `setDataServiceContext(new FetchDataService())`
   during component initialization, making the service available to the entire
   component tree.
2. **Consumer** -- Any child component calls `getDataService()` to retrieve the
   current implementation and invoke data operations against it.

This keeps components unaware of which `DataService` implementation is active.

## Implementations

- **FetchDataService** (current) -- Talks to the server via SvelteKit API routes.
  Suitable for online-only usage.
- **Offline-sync / PowerSync-backed implementation** -- Planned for a future
  iteration. Will read from and write to a local database, syncing with the server
  in the background.
