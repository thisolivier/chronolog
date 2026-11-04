# Sprint 035 — DT: macOS desktop app (Tauri 2) with a menu-bar timer

**Status:** ready for review
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

## Sign-off (2026-11-04): ready for review

Branch `sprint-035-DT/macos-menu-bar-app`, rebased onto `main` (`d0a6f60`). Not merged.

### Done

1. **Rust shell** (`src-tauri/src/`: `lib.rs`, `window.rs`, `tray.rs`, `timer.rs`). The window is created
   in Rust with `WebviewUrl::External("https://chronolog.throb.online")` and the user agent
   `… AppleWebKit/605.1.15 (KHTML, like Gecko) Chronolog-Desktop/<version>` (a custom UA replaces
   WKWebView's, so its default is restated before the suffix). CloseRequested on the main window hides it
   and `prevent_close()`; `RunEvent::Reopen` shows it; Cmd+Q quits through the default app menu. The tray
   uses a template clock icon, shows `HH:MM CODE` while a timer runs and no title when idle. A 1 s thread
   recomputes it from `startedAt`. The menu has Show Chronolog, Start timer, Stop timer and Quit; Start is
   disabled while a timer runs and Stop while none does. Start opens the window and goes to `/time` if
   the timesheet is not already showing. Stop opens the window and presses the timer widget's Stop button,
   which shows the completion form; with no widget on the page it opens `/time`. Both run as Rust-side
   `eval`, so the page gets no extra IPC permission. `set_timer_state(running, startedAt, contractShortCode)`
   stores a `Mutex<TimerSnapshot>`. `build.rs` uses `AppManifest::commands(["set_timer_state"])`, and
   `capabilities/remote-timer.json` grants only `allow-set-timer-state` to the production origin
   (`remote.urls`; tauri-utils widens a bare origin to all paths). Config: `withGlobalTauri`, `version`
   `../package.json`, `frontendDist` `placeholder/`, no `devUrl` or before-commands, targets `app`+`dmg`,
   `signingIdentity "-"`, `minimumSystemVersion` 13.0, identifier `com.chronolog.app`. No plugins added.
   Diagnostics go to stderr, one line per page load, title change and timer start/stop. Icons are drawn
   by `src-tauri/scripts/draw-icons.mjs` (dependency-free PNG encoder), and the bundle icons come from
   `npx tauri icon`.
2. **Web bridge** (`src/lib/desktop/bridge.ts`). `isDesktopShell()` checks for
   `window.__TAURI__.core.invoke`, so every call is a no-op in browsers. `createDesktopTimerPusher()`
   pushes on change, ignoring start-time jitter of 2 s or less, and resends the last state every minute.
   It resends rather than recomputes, so a page without the timer widget cannot drift the start. Invoke
   errors are swallowed. It is wired in `timer-state.svelte.ts` behind `isDesktopShell()`.
   `TimerDisplayState` gains an optional `contractShortCode`, which `TimerWidget` fills from the
   contract's `clientShortCode`. That one-line `TimerWidget` change is outside the listed boundary;
   contracts have no short code of their own, and the store had no other way to know the client's.
3. **Built on the Mac mini**. Verification is below. The `.dmg` Finder-styling AppleScript times out over
   SSH (`AppleEvent timed out (-1712)`), so the mini builds with `CI=true`, which passes `--skip-jenkins`.
4. **`docs/DESKTOP.md`** covers prerequisites, the laptop build, install, the scp alternative, first launch
   with an ad hoc signature (right-click → Open; Open Anyway on macOS 15+; `xattr`), updating and
   troubleshooting. There is one pointer each in `docs/ONBOARDING.md` (Tauri section rewritten; the old
   device-key-header text no longer applies) and `docs/LAPTOP-SETUP.md` (new step 9). The module readme is
   `src-tauri/README.md`. No `TRUSTED_ORIGINS` change was needed: the page is served from its own origin.
5. **Tests.** `cargo test` passes 9 (title formatting, idle and blank code, clamping, the mutex, a
   cross-thread write, the UA suffix). `cargo clippy --all-targets -- -D warnings` is clean. `npm test`
   passes 786/786 (9 new in `bridge.test.ts`, using a fake `window.__TAURI__`). `npm run check` reports 0
   errors (3 existing warnings in `src/routes/+layout.svelte`). `npm run lint` is clean. Playwright, run
   against a dev server on port 5213: 88 passed, 5 skipped, 0 failed.

Also: removed the unused `@tauri-apps/api` npm dependency. `withGlobalTauri` replaces it, and its pin
(2.10) failed the CLI's version-mismatch check against the `tauri` 2.12 crate, which aborted the build.
`.gitignore` now ignores `src-tauri/permissions/autogenerated/` (regenerated each build) and `*.dmg`.

### Verification

- Artefacts (built at 09:15 from the final commit's code with `CI=true npm run tauri:build -- --bundles app,dmg`):
  - `.claude/worktrees/sprint-035-DT/src-tauri/target/release/bundle/macos/Chronolog.app`: 10 MB,
    `Signature=adhoc`, `flags=adhoc,runtime`, `LSMinimumSystemVersion` 13.0, version 0.0.1.
  - `.claude/worktrees/sprint-035-DT/src-tauri/target/release/bundle/dmg/Chronolog_0.0.1_aarch64.dmg`:
    3,710,899 bytes (3.6 MB), sha256 `641d5849f8e05cd45501a3d8575e33665256cc524c7ba3bd3267926da12fdbc4`.
  - Build log tail: `Finished 2 bundles at: …/macos/Chronolog.app …/dmg/Chronolog_0.0.1_aarch64.dmg`.
- Launch: `open …/Chronolog.app` stays running. Its stderr shows
  `loaded https://chronolog.throb.online/unlock` and `title "Chronolog · Unlock"`. No sign-in was attempted.
- Bridge, end to end: a temporary self-test build, not committed, evaled an invoke on the production page.
  `set_timer_state({running: true, startedAt: now − 62 min, contractShortCode: 'SELF'})` resolved, the
  shell logged `timer running=true`, and the ticker set the tray title to `01:02 SELF`. The same page
  calling `plugin:window|close` was refused with `Command plugin:window|close not allowed by ACL`.
- **Screenshots: not taken.** The Mac mini's console session is locked (`CGSSessionScreenIsLocked = true`),
  and `screencapture` fails with "could not create image from display". `docs/review/screenshots/sprint-035/`
  is therefore empty. For the same reason, closing the window, the Dock click, and the tray menu clicks
  were not exercised by hand here; the log evidence above covers loading, IPC and the tray title.

### Left for the owner (on the laptop, or the mini with the screen unlocked)

- Take the three screenshots: the window on the unlock page, the menu bar with the clock (and a running
  timer's `HH:MM CODE`), and the tray menu open.
- Click through: red close button hides the window and the app stays in the menu bar; the Dock icon
  brings it back; Cmd+Q quits; Start timer opens the timesheet; Stop timer shows the completion form.
- Known limit: if you sign out while a timer runs, the menu bar keeps the last state until the next
  signed-in page load.

### Laptop commands

```bash
# once
xcode-select --install
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh && source "$HOME/.cargo/env"

# each build (after this branch is merged)
cd ~/sites/chronolog && git pull && npm install
npm run tauri:build                    # CI=true npm run tauri:build if the .dmg step times out on Finder
cp -R src-tauri/target/release/bundle/macos/Chronolog.app /Applications/
open /Applications/Chronolog.app       # first launch: right-click → Open, or Privacy & Security → Open Anyway

# or copy the Mac mini's build instead (Apple Silicon laptops only)
scp olivier@100.110.206.54:sites/chronolog/.claude/worktrees/sprint-035-DT/src-tauri/target/release/bundle/dmg/Chronolog_0.0.1_aarch64.dmg ~/Downloads/
open ~/Downloads/Chronolog_0.0.1_aarch64.dmg
```

Then unlock with the device key and sign in, once.
