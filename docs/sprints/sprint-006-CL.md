# Sprint 006 — CL: PWA Offline Shell (Phase F)

**Status:** signed-off
**Type:** standard
**Backlog items:** CL-3
**Depends on:** Sprint 004-CL (PowerSyncDataService — merged), GATE A (passed in sprint 001-GK)
**Branch:** `sprint-006-CL/pwa-offline-shell`
**Working tree:** `/Users/olivier/sites/chronolog/.claude/worktrees/sprint-006-CL`

## Objectives

Add PWA (Progressive Web App) capabilities so the browser version of Chronolog works offline.
This means:

1. Service worker caches the app shell (HTML, CSS, JS) for instant loads and offline access
2. Web app manifest enables "Add to Home Screen" / installable PWA
3. Online/offline indicator in the UI shows sync state
4. Graceful session-expiry-on-reconnect handling
5. Service worker registration is skipped in Tauri (native app doesn't need it)

After this sprint, the web version is a proper installable PWA that works offline via PowerSync's
local SQLite (data) + service worker (app shell).

## Tasks

### 1. Wire `@vite-pwa/sveltekit` into the build

The package is already installed (`@vite-pwa/sveltekit: ^1.1.0`). Wire it in:

```typescript
// vite.config.ts
import { SvelteKitPWA } from '@vite-pwa/sveltekit'

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit(),
    SvelteKitPWA({
      // config here
    })
  ],
  // ... existing config
})
```

Configure with `generateSW` strategy (auto-generated service worker) with:
- App shell precaching (HTML, CSS, JS, fonts)
- Runtime caching for API calls (NetworkFirst for data, CacheFirst for static assets)
- Navigation fallback to the app shell for offline SPA routing
- Skip waiting + claim clients on update (prompt user to reload)

### 2. Create web app manifest

Create or update the manifest with:
- `name`: "Chronolog"
- `short_name`: "Chronolog"
- `description`: "Time tracking and notes for consulting"
- `theme_color` and `background_color` matching the app theme
- `display`: "standalone"
- `start_url`: "/"
- Icons at 192x192 and 512x512 (generate from the existing app icon in `static/`)

The `SvelteKitPWA` plugin can generate the manifest inline via config, or reference a static file.

### 3. Conditional service worker registration (skip in Tauri)

The service worker should NOT register inside Tauri's webview — Tauri embeds the app natively
and SW registration would be wasteful/conflicting. Check for Tauri:

```typescript
const isTauri = '__TAURI__' in window || '__TAURI_INTERNALS__' in window;
```

Configure `@vite-pwa/sveltekit` to only register when NOT in Tauri. The plugin has a
`registerType` option and you can control registration in the layout.

### 4. Online/offline indicator component

Create a Svelte component that shows connection status:
- Shows "Offline" indicator when `navigator.onLine` is false
- Shows "Syncing..." when PowerSync is catching up after reconnect
- Shows nothing (or a subtle "Online" dot) when connected and synced
- Place it in the app layout (visible on all pages)

Use the `online`/`offline` browser events and PowerSync's sync status if available.
Keep it simple — a small banner or badge, not a modal.

### 5. Session-expiry-on-reconnect handling

When the app comes back online after being offline, the Better Auth session may have expired.
Handle this gracefully:
- Detect when API calls fail with 401/303 after reconnect
- Show a "Session expired — please sign in" message
- Redirect to login without losing local PowerSync data
- After re-login, PowerSync reconnects and syncs automatically

This should be handled in the fetch helpers or a global error handler, not per-component.

### 6. COOP/COEP headers for OPFS

PowerSync's OPFS storage requires specific headers. The spike route already has them:
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

These headers need to be set for ALL routes when in PowerSync mode, not just `/spike`.
Update `hooks.server.ts` to apply them globally (or conditionally based on `PUBLIC_SYNC_MODE`).

**Careful**: COOP/COEP can break third-party resources (fonts, scripts). Test thoroughly.
If COEP breaks external resources, use `credentialless` instead of `require-corp`.

### 7. Write tests

- Unit test for the online/offline indicator component
- Unit test for the session-expiry handler
- Verify service worker config generates correctly (`npm run build` + check output)
- E2e test: verify `/manifest.webmanifest` is served
- Existing tests must continue to pass

### 8. Verify

- `npm run build` succeeds and includes service worker + manifest in output
- `npm run test` passes
- `npm run test:e2e` passes (Docker stack running)
- `npm run check` passes (no new errors)
- `npm run preview` serves the built app with working service worker
- In Chrome DevTools: Application tab shows service worker registered, manifest valid
- Network tab: app loads from cache when offline (after first visit)

## Contracts

- DataService interface: `docs/contracts/data-service-interface.md`
- Docker stack: `docs/contracts/docker-stack.md`
- Epic context: `docs/EPIC-OFFLINE-SYNC.md` (section 6 Phase F)

## Verification

- `npm run build` — includes service worker and manifest
- `npm run test` — all existing + new tests pass
- `npm run test:e2e` — all e2e tests pass
- `npm run check` — no new errors
- PWA manifest is valid (can be checked with Lighthouse or manual inspection)

## Acceptance Criteria

- [x] `@vite-pwa/sveltekit` wired into vite.config.ts
- [x] Web app manifest with correct name, icons, display mode
- [x] Service worker caches app shell for offline access
- [x] Service worker skipped in Tauri context
- [x] Online/offline indicator component in the layout
- [x] Session-expiry-on-reconnect handled gracefully
- [x] COOP/COEP headers applied for OPFS access (PowerSync mode)
- [x] All existing tests pass + new tests
- [x] `npm run check` passes (1 pre-existing jose KeyLike error, 0 new errors)
- [x] `npm run build` succeeds with SW + manifest in output

## Notes

**`@vite-pwa/sveltekit` is already installed** as a devDependency. Just wire it in.

**Tauri detection**: Use `'__TAURI_INTERNALS__' in window` (Tauri v2) to skip SW registration.

**COOP/COEP gotcha**: These headers can break loading of cross-origin resources (e.g., Google Fonts,
CDN scripts). If this happens, use `Cross-Origin-Embedder-Policy: credentialless` instead of
`require-corp`. This is less restrictive but still enables SharedArrayBuffer/OPFS.

**Adapter consideration**: The current `adapter-auto` should work. The service worker is generated
by the Vite plugin at build time, independent of the SvelteKit adapter. If issues arise, consider
switching to `adapter-node` or `adapter-static`.

**Runtime caching strategy for API calls**: Use NetworkFirst for `/api/*` routes — try the network
first (live data), fall back to cache if offline. This complements PowerSync's local-first approach
for the web PWA fallback path.

**Existing COOP/COEP in hooks.server.ts**: Currently only applied to `/spike` route (lines 107-117).
For PowerSync mode, these need to be global. Consider making them conditional on
`PUBLIC_SYNC_MODE === 'powersync'` to avoid breaking fetch mode.

## Sign-off

**Date:** 2026-05-26
**Commit:** `6249868` on `sprint-006-CL/pwa-offline-shell`

### Verification Results

- `npm run test`: 269 tests passed (257 existing + 12 new), 0 failed
- `npm run test:e2e`: 32 tests passed, 0 failed
- `npm run build`: Succeeded — PWA v1.2.0, generateSW mode, 70 entries precached
  - `manifest.webmanifest` generated with correct name/icons/display
  - `sw.js` + `workbox-a665390a.js` generated in client output
- `npm run check`: 1 error (pre-existing jose KeyLike issue, not introduced by this sprint), 23 warnings (all pre-existing)

### Implementation Summary

| Task | File(s) | Notes |
|------|---------|-------|
| 1. Wire SvelteKitPWA | `vite.config.ts` | generateSW, NetworkFirst for API, CacheFirst for static assets, nav fallback |
| 2. Web app manifest | `vite.config.ts` (inline), `static/pwa-{192,512}x512.png` | Icons generated from Tauri source icon |
| 3. Conditional SW (skip Tauri) | `src/routes/+layout.svelte` | Checks `__TAURI__` / `__TAURI_INTERNALS__` in window |
| 4. Online/offline indicator | `src/lib/components/layout/ConnectionStatus.svelte` | Amber banner offline, blue pulse syncing |
| 5. Session-expiry handling | `src/lib/services/fetch-helpers.ts` | Detects 401 / 303-to-login, redirects with path preservation |
| 6. COOP/COEP headers | `src/hooks.server.ts` | Global when `PUBLIC_SYNC_MODE=powersync`, uses `credentialless` for COEP |
| 7. Tests | `ConnectionStatus.test.ts`, `session-expiry.test.ts` | 12 new unit tests |
| 8. PWA update prompt | `src/routes/+layout.svelte` | Toast with Update/Dismiss when new SW version detected |

### Design Decisions

- **COEP `credentialless` instead of `require-corp`**: Prevents breaking cross-origin resources (fonts, CDN). Still enables SharedArrayBuffer/OPFS.
- **`registerType: 'prompt'`**: User is prompted to reload when a new SW version is available, rather than auto-updating which could interrupt work.
- **Session expiry redirect includes `?redirect=` param**: So the login page can return the user to their previous location after re-auth.
- **`navigateFallbackAllowlist`**: Excludes `/api/` and `/_app/` paths from being intercepted by the navigation fallback, ensuring API calls and SvelteKit internals work correctly.
