# Desktop bridge

Talks to the macOS menu-bar app in `src-tauri/` (see `docs/DESKTOP.md`). The shell loads the
production site and sets `app.withGlobalTauri`, so the page sees `window.__TAURI__` without bundling
`@tauri-apps/api`. In a browser `window.__TAURI__` is absent and everything here is a no-op.

- `bridge.ts`: `isDesktopShell()`, `toDesktopTimerState(status, elapsedSeconds, shortCode)`, and
  `createDesktopTimerPusher()`, which invokes `set_timer_state` with
  `{ running, startedAt, contractShortCode }` when the state changes (start-time jitter under 2 s is
  ignored) and resends the last state once a minute. The shell computes the elapsed time itself.
- `clearDesktopTimer()` (044-CL) sends a stopped state at once. Called by Settings → Sign out before
  signing out and by the login page when it loads (a sign-out elsewhere or an expired session), so
  the menu bar never keeps showing a signed-out user's timer. It ships with the web deploy; the
  desktop app needs no rebuild for it.
- Wired in `src/lib/stores/timer-state.svelte.ts`; `TimerWidget` fills `contractShortCode` from the
  contract's client short code.
- `set_timer_state` is the only command the production origin may call
  (`src-tauri/capabilities/remote-timer.json`).
