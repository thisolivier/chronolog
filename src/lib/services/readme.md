# DataService Module

Abstraction layer that decouples UI components from the data backend. Components
program against the `DataService` interface and never call fetch or database APIs
directly. `FetchDataService` talks to the SvelteKit API routes; the app uses its
subclass `OfflineDataService` (`$lib/offline`, sprint 045-CL), which queues note and
time entry writes in the offline outbox when the server is unreachable. Components
reach it through a `DelegatingDataService` wrapper provided via Svelte context.

## Main Files

| File | Purpose |
|---|---|
| `data-service.ts` | `DataService` interface definition. Declares all data operations grouped by domain: contracts, clients, notes, attachments, note-time-entry links, time entries, weekly statuses, timer, deliverables, and work types. |
| `fetch-data-service.ts` | `FetchDataService` class — the only `DataService` implementation. Delegates every operation to SvelteKit API routes via HTTP fetch calls. |
| `delegating-data-service.ts` | `DelegatingDataService` class — a thin wrapper that forwards all calls to an inner `DataService` and exposes `setDelegate()`. Components hold a reference to the wrapper, so the inner service can be replaced without re-setting context. It fires `notes-changed` after note create, delete and move. |
| `notes-changed-event.ts` | `announceNotesChanged()` and the `notes-changed` window event name. The sidebar listens to it to refresh per-contract note counts. |
| `fetch-helpers.ts` | Shared HTTP utilities (`fetchJson`, `postJson`, `putJson`, `deleteRequest`) used by `FetchDataService`. Each helper checks `response.ok` and throws a descriptive error on failure; a `401` (or a `303` to `/login`) raises `SessionExpiredError` and redirects to `/login` once (tested in `session-expiry.test.ts`). The last successful GET body per URL is kept and returned when the network fails or the proxy answers 502/503/504/52x (a successful write replaces the cached GET of the same path with a same-shaped PUT/PATCH response or evicts it, and a DELETE also evicts its sub-resources; tested in `offline-read-cache.test.ts`); since sprint 045-CL the cache is persisted per user in IndexedDB through `setReadCachePersistence` and a failed read waits for the stored copies to load. `fetchFreshJson` never answers from the cache (the outbox replay). Writes are never queued here; the outbox does that one level up. Each request reports its outcome to `connectivity`. |
| `types.ts` | All shared TypeScript types consumed by the interface and its implementation (e.g. `NoteSummary`, `WeekData`, `TimerStatus`). |
| `context.ts` | Svelte context helpers for dependency injection (`setDataServiceContext` / `getDataService`). |
| `index.ts` | Barrel file re-exporting the public API: interface, implementation, context helpers, and all types. |

## Context Pattern

The module uses Svelte's `setContext` / `getContext` for dependency injection:

1. **Provider** — `+layout.svelte` creates
   `new DelegatingDataService(new OfflineDataService())` and calls
   `setDataServiceContext()` synchronously during component initialization, so the
   service is available to the whole component tree immediately.
2. **Consumer** — Any child component calls `getDataService()` to retrieve the
   service and invoke data operations against it.

## Adding an operation

`createContract` accepts `newClient` (`{ name, shortCode }`) in place of an existing `clientId`, so a contract and its new client are created in one request.

Add the method to the `DataService` interface, implement it in `FetchDataService`
(and forward it in `DelegatingDataService`), add any new types to `types.ts`, and
cover the HTTP call in `fetch-data-service.test.ts`, which mocks `fetch` and
asserts the URL, method and body for every method.

## Online-only reads

`getTotalTime({ from, to, contracts })` (sprint 065-TT, `GET /api/time-entries/total`) reads
through `fetchFreshJson`, so a failed request never answers with an old cached total, and
`OfflineDataService` wraps it in `runOnlineOnly` (`NotAvailableOfflineError` offline). The Total
time modal shows "Needs a connection" in that case. `contracts` is `'all'` or contract IDs; an empty
list is a zero total.
