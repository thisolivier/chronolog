# Backlog — Client (CL)

## CL-1: Land DataService Abstraction on Main (Phase C)

Cherry-pick the DataService abstraction layer from `powersync-spike` as a standalone PR.
Decouples all UI components from the sync backend via a unified interface.

Key files from the spike:
- `src/lib/services/data-service.ts` — base interface
- `src/lib/services/delegating-data-service.ts` — abstraction wrapper
- `src/lib/services/fetch-data-service.ts` — HTTP-based implementation (current backend)
- `src/lib/services/types.ts` — type definitions
- `src/lib/services/context.ts` — context setup
- `src/lib/services/index.ts` — exports
- ~20 Svelte component refactors to use the abstraction

This phase does NOT include PowerSync — just the abstraction + the fetch-based implementation
so the app continues working exactly as before but through the new interface.

**Unblocks:** CL-2

## CL-2: Wire PowerSyncDataService (Phase D)

- Implement `PowerSyncDataService` against the DataService interface
- Local SQL reads via PowerSync client SDK
- Connector `uploadData()` → existing REST API
- Reactive sync-status surface (online/offline indicator)
- Simplified single-user JWT auth (reuse spike endpoints)
- Env var toggle between Fetch and PowerSync backends

**Depends on:** CL-1, IF-2
**Unblocks:** QA-E

## CL-3: PWA Offline (Phase F)

- Service worker / app-shell caching via `@vite-pwa/sveltekit`
- OPFS-with-IndexedDB fallback for browsers without OPFS
- Online/offline indicator in the UI
- Graceful session-expiry-on-reconnect handling

**Depends on:** QA-E (GATE A must pass)
**Unblocks:** QA-G
