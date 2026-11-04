# Sprint 035 — DT: macOS desktop app (Tauri 2) with a menu-bar timer

**Status:** in progress
**Branch:** `sprint-035-DT/macos-menu-bar-app` · **Worktree:** `.claude/worktrees/sprint-035-DT` · **Port:** 5213
**Sources:** owner request 2026-11-04; `docs/SPEC.md` (Tauri desktop shell); `docs/ONBOARDING.md` ("New Tauri desktop install"); Tauri 2 docs via context7 (`/tauri-apps/tauri-docs`: remote capability, system tray, macOS signing).

## Objective

A standalone macOS app the owner installs on their laptop. It wraps the production site, keeps running in the menu bar when the window is closed, shows the running timer there, and reopens the window from the menu bar or the Dock. Built on the Mac mini (arm64, Xcode present) and copied over, or built locally on the laptop; both paths documented and both work.

## Design (decided; do not re-litigate)

- The main window loads `https://chronolog.throb.online` as an external URL. Cookies for the device key and the login persist in the WebKit data store between launches, so the app has no login or key storage of its own. The window's user agent gets a ` Chronolog-Desktop/<version>` suffix.
- Closing the window hides it; Cmd+Q quits. A menu-bar (tray) item shows the timer: icon only when nothing runs, `HH:MM` plus contract short code when a timer runs. Its menu: Show Chronolog, Start timer (opens the window on the timesheet), Stop timer (opens the window with the stop form), Quit. Clicking the Dock icon reopens the window.
- Timer state reaches Rust from the page: in `src/lib/stores/timer-state.svelte.ts` (or a small `src/lib/desktop/bridge.ts` it calls), when `window.__TAURI__` exists, push `{ running, startedAt, contractShortCode }` through `invoke('set_timer_state', …)` on every change and once a minute. `app.withGlobalTauri: true` so the site needs no `@tauri-apps/api` bundle; a capability file grants `remote.urls: ["https://chronolog.throb.online"]` the one custom command and nothing else. The Rust side ticks the tray title itself from `startedAt`, so a hidden page that throttles timers still shows the right elapsed.
- No updater, no notifications, no multi-window, no offline work in this sprint.
- Config: `bundle.targets` `["app", "dmg"]`, `bundle.macOS.signingIdentity: "-"` (ad hoc), `minimumSystemVersion` 13.0, `version` from `package.json`, no `beforeBuildCommand` (nothing to build; `frontendDist` points at a one-file placeholder directory so the CLI is happy), `devUrl` removed. Keep `identifier` `com.chronolog.app`.

## Tasks

1. **Rust shell.** `src-tauri/src/lib.rs`: tray with menu, `on_window_event` CloseRequested → hide + prevent close, `RunEvent::Reopen` → show, the `set_timer_state` command storing state in a `Mutex`, a 1 s interval updating the tray title, main window created with `WebviewUrl::External` to the production URL and the UA suffix. Add `tauri-plugin-opener` only if needed for external links; prefer none. Replace the default icons in `src-tauri/icons/` with a simple generated clock glyph (`npm run tauri icon` from a 1024 px PNG you draw with a script; no brand assets exist). Include a monochrome template icon for the menu bar.
2. **Web bridge.** The timer store pushes state when running inside Tauri; guard every call so browsers never touch it; unit test the bridge with a fake `window.__TAURI__`. The `/unlock` and `/login` pages need nothing new.
3. **Build on the Mac mini.** `npm run tauri:build -- --bundles app,dmg`. Record the output paths and sizes. Launch the `.app` here with `open` and verify with a screenshot (the window loading the production login/unlock page is enough; do not sign in on the Mac mini). Verify the tray appears (`screencapture` of the menu bar).
4. **Build on the laptop, documented.** `docs/DESKTOP.md`: prerequisites (Rust via rustup, Xcode command line tools, Node), `npm install` then `npm run tauri:build`, where the `.app` lands, first launch via right-click → Open because of the ad-hoc signature, and the scp alternative from the Mac mini. Update `docs/ONBOARDING.md`'s Tauri section and `docs/LAPTOP-SETUP.md` with one pointer each. Add `.env.prod`'s `TRUSTED_ORIGINS` note only if testing shows the WebKit origin needs it (it should not, since the page is served from the same https origin).
5. **Tests.** `cargo test` for the elapsed-title formatting and the state mutex; `cargo clippy` clean; `npm test` green with the bridge test; the Playwright suite unchanged and green.

## Boundaries

Owns `src-tauri/**`, `src/lib/desktop/**`, `src/lib/stores/timer-state.svelte.ts` (bridge call only), `docs/DESKTOP.md`, the two doc pointers, `package.json` scripts for tauri. No API or CLI changes.

## Working rules

Worktree only. The web side needs no dev server; use production for the shell's URL as designed. `npm run check` 0 errors, `npm test`, `npm run lint`, `cargo clippy`, `cargo test` before sign-off; rebase onto `main` before sign-off. Do not merge.

## Verification

Screenshots in `docs/review/screenshots/sprint-035/`: the app window on the unlock page, the menu bar with the tray item, the tray menu open. The build log tail and artefact paths in the sign-off. Sign-off at the bottom with what was done, what was left, and the exact commands the owner runs on the laptop.
