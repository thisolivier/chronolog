# src-tauri: the macOS desktop shell and the iOS shell

Tauri 2 app that loads the production site (`https://chronolog.throb.online`) in one window. On macOS
it keeps a menu-bar timer alive when the window is closed; build and install:
[docs/DESKTOP.md](../docs/DESKTOP.md). On iOS (sprint 048) it is a full-screen WKWebView with no
commands or tray; build and TestFlight: [docs/IOS-RELEASE.md](../docs/IOS-RELEASE.md). Desktop-only
code (tray, timer command, close-to-hide, Dock reopen) is behind `#[cfg(desktop)]`.

- `src/lib.rs`: builder wiring; the `set_timer_state` command; close → hide; Dock click
  (`RunEvent::Reopen`) → show.
- `src/window.rs`: the main window (`WebviewUrl::External`; desktop: `Chronolog-Desktop/<version>`
  user-agent suffix and title logging; iOS: off-origin navigations open in Safari through
  `tauri-plugin-opener`, an iOS-only dependency granted to no page). Page loads are logged as
  `[chronolog-shell] loaded …`. Debug builds honour `CHRONOLOG_SHELL_URL` at run time (local dev).
- `src/tray.rs`: the tray item (template clock icon, menu Show / Start timer / Stop timer / Quit) and
  the 1 s thread that sets the title from the stored start time. Start and Stop drive the page with
  `eval` (open `/time`; press the timer widget's Stop button), which needs no IPC permission.
- `src/timer.rs`: the `TimerSnapshot` behind a `Mutex`, and `tray_title()` (`HH:MM CODE`, or none when
  idle). Unit tested.
- `build.rs`: `AppManifest::commands(["set_timer_state"])` generates `allow-set-timer-state`;
  `capabilities/remote-timer.json` grants only that to the production origin.
- `tauri.conf.json`: `withGlobalTauri` (the page uses `window.__TAURI__`, no npm package), version
  from `../package.json` (the bundle's `CFBundleShortVersionString`; builds before 044-CL say
  0.0.1 because `package.json` was 0.0.1 at sprint 035; a rebuild picks up the current version,
  1.2.0 at 044), `placeholder/` as `frontendDist` (nothing is bundled), app + dmg, ad hoc
  signing, macOS 13.0 minimum.
- `icons/`: `scripts/draw-icons.mjs` draws `app-icon.png`, `app-icon-ios.png` (full bleed) and
  `tray-template.png`; the bundle icons come from `npx tauri icon icons/app-icon.png` (non-macOS
  outputs deleted). The iOS set lives in `gen/apple/Assets.xcassets`, flattened to opaque RGB by
  `scripts/flatten-ios-icons.swift`.
- `tauri.ios.conf.json`: iOS overrides (identifier `dev.thisolivier.chronolog`, team, iOS 16,
  `bundleVersion` = the TestFlight build number, bumped by `scripts/ios/ship-ios.sh`).
- `gen/apple/`: the Xcode project from `tauri ios init`, committed (Tauri's advice) because it
  carries hand edits: manual signing in `project.yml`, `ITSAppUsesNonExemptEncryption`, iPhone
  portrait only, icons. Its `.gitignore` drops `build/` and `Externals/`.

Checks: `cargo test --manifest-path src-tauri/Cargo.toml`, `cargo clippy --manifest-path
src-tauri/Cargo.toml --all-targets -- -D warnings`, and for iOS `cargo clippy --manifest-path
src-tauri/Cargo.toml --target aarch64-apple-ios --lib -- -D warnings`.
