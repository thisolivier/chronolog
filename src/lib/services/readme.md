# DataService Module

Abstraction layer that decouples UI components from the data backend. Components
program against the `DataService` interface and never call fetch or database APIs
directly. There is one implementation today, `FetchDataService`, which talks to
the SvelteKit API routes; components reach it through a `DelegatingDataService`
wrapper provided via Svelte context.

## Main Files

| File | Purpose |
|---|---|
| `data-service.ts` | `DataService` interface definition. Declares all data operations grouped by domain: contracts, clients, notes, attachments, note-time-entry links, time entries, weekly statuses, timer, deliverables, and work types. |
| `fetch-data-service.ts` | `FetchDataService` class — the only `DataService` implementation. Delegates every operation to SvelteKit API routes via HTTP fetch calls. |
| `delegating-data-service.ts` | `DelegatingDataService` class — a thin wrapper that forwards all calls to an inner `DataService` and exposes `setDelegate()`. Components hold a reference to the wrapper, so the inner service can be replaced without re-setting context. |
| `fetch-helpers.ts` | Shared HTTP utilities (`fetchJson`, `postJson`, `putJson`, `deleteRequest`) used by `FetchDataService`. Each helper checks `response.ok` and throws a descriptive error on failure; a `401` (or a `303` to `/login`) raises `SessionExpiredError` and redirects to `/login` once (tested in `session-expiry.test.ts`). |
| `types.ts` | All shared TypeScript types consumed by the interface and its implementation (e.g. `NoteSummary`, `WeekData`, `TimerStatus`). |
| `context.ts` | Svelte context helpers for dependency injection (`setDataServiceContext` / `getDataService`). |
| `index.ts` | Barrel file re-exporting the public API: interface, implementation, context helpers, and all types. |

## Context Pattern

The module uses Svelte's `setContext` / `getContext` for dependency injection:

1. **Provider** — `+layout.svelte` creates
   `new DelegatingDataService(new FetchDataService())` and calls
   `setDataServiceContext()` synchronously during component initialization, so the
   service is available to the whole component tree immediately.
2. **Consumer** — Any child component calls `getDataService()` to retrieve the
   service and invoke data operations against it.

## Adding an operation

Add the method to the `DataService` interface, implement it in `FetchDataService`
(and forward it in `DelegatingDataService`), add any new types to `types.ts`, and
cover the HTTP call in `fetch-data-service.test.ts`, which mocks `fetch` and
asserts the URL, method and body for every method.
