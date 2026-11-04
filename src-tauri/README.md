# src-tauri: the macOS desktop shell

Tauri 2 app that loads the production site (`https://chronolog.throb.online`) in one window and keeps a
menu-bar timer alive when the window is closed. Build and install: [docs/DESKTOP.md](../docs/DESKTOP.md).

- `src/lib.rs`: builder wiring; the `set_timer_state` command; close → hide; Dock click
  (`RunEvent::Reopen`) → show.
- `src/window.rs`: the main window (`WebviewUrl::External`, `Chronolog-Desktop/<version>` user-agent
  suffix, page-load and title logging to stderr).
- `src/tray.rs`: the tray item (template clock icon, menu Show / Start timer / Stop timer / Quit) and
  the 1 s thread that sets the title from the stored start time. Start and Stop drive the page with
  `eval` (open `/time`; press the timer widget's Stop button), which needs no IPC permission.
- `src/timer.rs`: the `TimerSnapshot` behind a `Mutex`, and `tray_title()` (`HH:MM CODE`, or none when
  idle). Unit tested.
- `build.rs`: `AppManifest::commands(["set_timer_state"])` generates `allow-set-timer-state`;
  `capabilities/remote-timer.json` grants only that to the production origin.
- `tauri.conf.json`: `withGlobalTauri` (the page uses `window.__TAURI__`, no npm package), version
  from `../package.json`, `placeholder/` as `frontendDist` (nothing is bundled), app + dmg, ad hoc
  signing, macOS 13.0 minimum.
- `icons/`: `scripts/draw-icons.mjs` draws `app-icon.png` and `tray-template.png`; the bundle icons
  come from `npx tauri icon icons/app-icon.png` (non-macOS outputs deleted).

Checks: `cargo test --manifest-path src-tauri/Cargo.toml`, `cargo clippy --manifest-path
src-tauri/Cargo.toml --all-targets -- -D warnings`.
