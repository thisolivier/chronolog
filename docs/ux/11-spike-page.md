> **Deleted in sprint 021-CL** (PowerSync removed); the `/spike` route no longer exists — see git history.

# Spike Page (`/spike`)

## Overview

The spike page is a diagnostic test runner for validating that PowerSync Web SDK (WASM SQLite via OPFS) works in the current browser environment. It is a public route (no auth required) and is not part of the main application flow.

## Layout

```
+----------------------------------------------------------+
|  PowerSync Spike Test                                     |
|  Validates PowerSync Web SDK (WASM SQLite) works in      |
|  this environment.                                        |
|                                                           |
|  [Run Spike Tests]                                        |
|                                                           |
|  PASS  Environment Detection          (detail)    1.2ms  |
|  PASS  PowerSync Import               (detail)   45.3ms  |
|  PASS  Schema Creation                (detail)    2.1ms  |
|  PASS  Database Init                  (detail)  120.5ms  |
|  PASS  Local Write                    (detail)   15.2ms  |
|  PASS  Local Read                     (detail)    3.4ms  |
|  PASS  JOIN Query                     (detail)    2.8ms  |
|  PASS  Reactive Watch                 (detail)   50.1ms  |
|  PASS  Cleanup                        (detail)    5.6ms  |
|  PASS  Upload Queue                   (detail)    1.0ms  |
|                                                           |
|  10/10 tests passed. PowerSync is viable on this platform!|
+----------------------------------------------------------+
```

## Tests

| # | Test | What it validates |
|---|------|-------------------|
| 1 | Environment Detection | Checks Tauri vs Browser, OPFS, SharedWorker availability |
| 2 | PowerSync Import | Dynamic import of `@powersync/web` module |
| 3 | Schema Creation | Import and instantiate the app's PowerSync schema |
| 4 | Database Init | Create a `PowerSyncDatabase` with WASM SQLite |
| 5 | Local Write | INSERT test rows into clients, contracts, notes tables |
| 6 | Local Read | SELECT all rows from each table |
| 7 | JOIN Query | Cross-table JOIN (notes + contracts + clients) |
| 8 | Reactive Watch | Test `watch()` async iterator for live query updates |
| 9 | Cleanup | DELETE all test data (rows matching `spike-%` prefix) |
| 10 | Upload Queue | Check `getUploadQueueStats()` for CRUD queue tracking |

## COOP/COEP Headers

The `hooks.server.ts` middleware adds special headers for the `/spike` route to enable OPFS access:
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

## Styling

The spike page uses inline styles (not Tailwind) and a monospace font. Results are color-coded:
- Green left border: PASS
- Red left border + red background: FAIL
- Yellow left border: PENDING

## Files

| File | Purpose |
|------|---------|
| `src/routes/spike/+page.svelte` | Spike test runner page |
| `src/routes/spike/+page.ts` | Client-only load (no SSR) |
| `src/lib/powersync/schema.ts` | PowerSync schema definition |
| `src/lib/powersync/database.ts` | PowerSync database setup |
