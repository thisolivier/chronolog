# Sprint 048 — DT: iOS build and TestFlight lane

**Status:** ready for review
**Branch:** `sprint-048-DT/ios-build` · **Worktree:** `.claude/worktrees/sprint-048-DT`
**Sources:** owner request 2026-11-04: an iOS build, with the release tooling from the adjacent `~/sites/timeConvertor` project. Decision in `docs/decisions.md` (2026-11-04, iOS build). Runs in parallel with 047-QA (which owns app UI/CSS); this sprint owns `src-tauri/` (iOS parts), `scripts/ios/`, `docs/IOS-RELEASE.md`, and a project skill. Wave rules apply.

## Context

- The macOS menu-bar app (035-DT, `src-tauri/`, built in `~/sites/chronolog-desktop/`) is a Tauri 2 shell loading production. iOS is the same idea: a WKWebView shell loading `https://chronolog.throb.online`, no bundled frontend.
- timeConvertor's lane: `scripts/ship.sh` (xcodegen → `xcodebuild archive` → `-exportArchive` with `ExportOptions.plist` → `xcrun altool --upload-app`, build-number bump and archive assertion), `scripts/lib/version.sh`, the `testflight-setup` skill (`.claude/skills/testflight-setup/`), `docs/releases.md`, `docs/testflight-setup-checklist.md`. Signing inventory and secrets: `~/sites/navidromClient/spike/.signing/` (read `context.md`; **never print secret files**), build keychain `~/Library/Keychains/spike-build.keychain-db`, team `CNHB9B5GX6`, Xcode 26.6 and xcodegen installed. Tauri 2's `tauri ios init` itself generates an xcodegen `project.yml` under `src-tauri/gen/apple/`.

## Tasks

1. **iOS shell.** Rust iOS targets (`rustup target add aarch64-apple-ios aarch64-apple-ios-sim`, user-level only). `tauri ios init`; a `src-tauri/tauri.ios.conf.json` override with identifier `dev.thisolivier.chronolog` (desktop keeps `com.chronolog.app`) and the production URL. Desktop-only code (tray, menu bar, close-to-hide) behind `#[cfg(desktop)]` so the iOS build compiles. Decide what of `gen/apple` is committed (Tauri recommends committing it; say why either way). App icon set from the existing icons; launch screen plain.
2. **Run it.** Build and run in the iOS Simulator (an iPhone 15-class device): the device-key gate, sign-in, timesheet and a note work; cookies persist across app relaunch (the device key and session must survive a cold start in WKWebView); external links open in Safari; the safe areas look right (047 adds `viewport-fit=cover`; check with whatever is on `main`). Screenshots in `docs/review/screenshots/sprint-048/`.
3. **Release lane.** Port `ship.sh` to `scripts/ios/ship-ios.sh` for the Tauri project: version from `package.json`, build number argument, `tauri ios build` or xcodegen + `xcodebuild archive` (whichever gives a signed App Store archive reliably; say which), the archive build-number assertion, export with `scripts/ios/ExportOptions.plist` (method `app-store-connect`, manual signing, profile name "Chronolog App Store", team `CNHB9B5GX6`), upload with altool; `--skip-upload` supported. Bring the `testflight-setup` skill into `.claude/skills/` adapted to Chronolog, and write `docs/IOS-RELEASE.md` (one-time portal steps, each release's commands, common failures).
4. **Dry run** to the limit of what exists: everything up to signing. The App ID, App Store Connect record and "Chronolog App Store" profile do not exist yet; **do not create anything in the Apple portal or App Store Connect and do not upload**. List the exact owner steps (portal clicks, or API calls with the existing App Store Connect key if the skill does that, for the owner to approve). If signing is the only thing missing, the sign-off says so with the failing command's message.
5. **Notes for review:** TestFlight internal testing needs no App Review; external testing/App Store review may raise guideline 4.2 (web wrapper). Note what would strengthen it later (offline outbox, notifications), no work now.

## Boundaries

No changes to the web app's UI/CSS (047). Do not touch production, `~/sites/chronolog-desktop/`, or timeConvertor (copy from it, never edit it). No secrets in the repo or in logs.

## Verification

Simulator screenshots; a `--skip-upload` transcript up to the signing step; sign-off with what was done, the owner checklist, and what is left.

## Sign-off (2026-11-04): ready for review

Branch `sprint-048-DT/ios-build`, rebased onto `main` (`8c831f3`, after 047 merged). Not merged.

### Done

1. **iOS shell.** Rust targets `aarch64-apple-ios` and `aarch64-apple-ios-sim` (rustup, user level).
   `src-tauri/src/lib.rs` has a desktop `run()` (unchanged behaviour: tray, `set_timer_state`,
   close-to-hide, Dock reopen) and a `#[tauri::mobile_entry_point]` iOS `run()` with one full-screen
   webview and no commands. `timer`/`tray` modules and the command are `#[cfg(desktop)]`. On iOS,
   `on_navigation` keeps the app's origin (plus `about:`, `blob:`, `data:`) and hands anything else to
   Safari through `tauri-plugin-opener` (an iOS-only Cargo dependency; no capability grants it to the
   page). Debug builds read `CHRONOLOG_SHELL_URL` at run time to load a local dev server (it has to be
   run time: `tauri ios build` runs xcodebuild, and so cargo, with a cleaned environment); release
   builds always load production. `tauri.ios.conf.json`: identifier `dev.thisolivier.chronolog`, team
   `CNHB9B5GX6`, iOS 16.0, `bundleVersion` `"0"` (the TestFlight build number; nothing shipped yet). The
   production URL stays in `window.rs` (`WebviewUrl::External`), shared with desktop, not in config.
   Icons: `draw-icons.mjs` also draws a full-bleed `app-icon-ios.png`; the iOS set is generated with
   `tauri icon` and flattened to opaque RGB (`scripts/flatten-ios-icons.swift`; App Store rejects icon
   alpha, ITMS-90717). Launch screen is Tauri's plain one. `package.json` gains `"tauri": "tauri"`
   (Xcode's "Build Rust Code" phase runs `npm run tauri ios xcode-script`).
   **`gen/apple` is committed** (Tauri recommends it, and it now carries hand edits a re-init would
   lose: manual signing, `ITSAppUsesNonExemptEncryption = false`, iPhone portrait only, icons,
   `assets/.gitkeep`). `.gitignore` keeps ignoring `gen/schemas`; `gen/apple/.gitignore` drops `build/`
   and `Externals/`. 220 KB.
2. **Run it.** Built with `npm run tauri ios build -- --debug --target aarch64-sim`, run on an iPhone 17
   Pro simulator (iOS 26.5). The Mac's screen is locked, so clicks in the Simulator window are
   impossible; an XCUITest driver (`scripts/ios/ui-check/`) taps and types inside the installed app
   instead. Production has no test account and I hold no production credentials, so the signed-in flow
   ran against a local dev server (this branch, i.e. `main` with 047) through the debug URL override,
   with a throwaway device key and a seeded dev user. Production was loaded for the unlock page only.
   All seven UI tests pass from a clean cookie store:
   - device-key gate → unlock (real typing) → sign-in → workspace; timesheet shows the seeded entry;
     the contract's note list; the note opened and edited in the editor ("Saved", and the server has
     the text);
   - **cold start keeps the device key and session**: terminate + relaunch lands on `/` signed in, and
     so does a full simulator shutdown + boot; the database shows a single iPhone session for the user
     (no re-login). WKWebView persists the `chronolog_device` and `better-auth.session_token` cookies
     to disk (on the simulator in the device-wide `Library/Cookies/Cookies.binarycookies`; on a device
     in the app container);
   - an off-site link opens Safari (the app logs `opening outside the app: https://example.com/`) and
     the shell stays on its page; a same-origin link stays in the app;
   - safe areas with 047's changes: header below the Dynamic Island, bottom bar above the home
     indicator (before 047 the bottom bar ran under it). **Landscape was wrong**: WKWebView kept
     reporting the portrait insets (top 62, left/right 0, bottom 34) after rotation and even when
     launched in landscape, so the sidebar sat under the island. Measured with a probe page printing
     `env(safe-area-inset-*)`. 047's CSS is right; the shell does not pass landscape insets. Fix taken
     here: **iPhone is portrait only** (`UISupportedInterfaceOrientations`); iPad keeps all four
     (needed for App Store validation, ITMS-90474). Revisit if landscape on iPhone matters.
   Screenshots, `docs/review/screenshots/sprint-048/`: `02-unlock-gate`, `03-sign-in`, `04-timesheet`,
   `05-note-list`, `06-note-edited`, `07-relaunch-signed-in`, `08-after-simulator-reboot-signed-in`,
   `09-external-link-in-safari`, `10-menu-portrait-bottom-bar`, `11-timesheet-portrait`,
   `12-device-turned-landscape-app-stays-portrait`, `14-production-unlock-portrait`,
   `15-production-unlock-device-turned-stays-portrait` (13 was dropped with landscape).
3. **Release lane.** `scripts/ios/ship-ios.sh <build> [--skip-upload]`, `scripts/ios/lib/version.sh`,
   `scripts/ios/ExportOptions.plist` (`app-store-connect`, manual, team `CNHB9B5GX6`, profile "Chronolog
   App Store", `manageAppVersionAndBuildNumber` false). **It uses `tauri ios build --export-method
   app-store-connect`, not xcodegen + `xcodebuild archive`**: the Xcode project's Rust phase calls back
   into a running Tauri CLI, and a bare `xcodebuild` fails with "failed to read missing addr file
   …-server-addr" (tried). The build number lives in `tauri.ios.conf.json` because Tauri rewrites
   `Info.plist` versions from its config on every build. Kept from timeConvertor: API key + keychain
   unlock, monotonic bump with read-back, stale-archive removal, the archive `CFBundleVersion`
   assertion (plus version and bundle id), the altool `|| true` capture, `--skip-upload`, the
   "Delivery UUID is not delivered" note. Added: a preflight that names the missing profile and
   prints the owner steps (`SKIP_PREFLIGHT=1` continues to Xcode's own error), and a trap that puts the
   build number back when a run stops before the upload. Release signing is **Manual** in
   `gen/apple/project.yml`: Tauri passes `-allowProvisioningUpdates` and this Mac's Xcode is signed in
   to the developer account, so automatic signing could have minted an App ID or profile on its own.
   The `testflight-setup` skill is in `.claude/skills/` (adapted: no portal creation by the agent, the
   Tauri differences), and the runbook is `docs/IOS-RELEASE.md`.
4. **Dry run.** Transcript: `docs/review/sprint-048-ios-lane-dry-run.txt`. Without the profile the
   lane stops at preflight. With `SKIP_PREFLIGHT=1` it unlocks the keychain, finds the Apple
   Distribution identity, bumps 0 → 1, and the archive stops on signing only:

   ```
   error: No profile for team 'Olivier Butler' matching 'Chronolog App Store' found: Xcode couldn't
   find any provisioning profiles matching 'CNHB9B5GX6/Chronolog App Store'. … (in target
   'chronolog_iOS' from project 'chronolog')
   ```

   and puts the build number back to 0. The release Rust library builds for the device target
   (`cargo build --release --lib --target aarch64-apple-ios`; `cargo clippy --target
   aarch64-apple-ios --lib -- -D warnings` clean). **Signing is the only thing missing.** Nothing was
   created in the portal or App Store Connect, and nothing was uploaded.
5. **Review notes** (TestFlight internal testing needs no App Review; external testing and the App
   Store risk guideline 4.2; what would strengthen it later) are in `docs/IOS-RELEASE.md`.

Checks: `npm run check` 0 errors 0 warnings; `npm test` 1063/1063; `npm run lint` clean; desktop
`cargo check`, `cargo clippy --all-targets -- -D warnings`, `cargo test` (11, two new for the
link guard). No web app UI/CSS touched (one log-prefix line in `docs/DESKTOP.md`: page loads now log as
`[chronolog-shell]`).

### Owner checklist (in order; details in `docs/IOS-RELEASE.md` → One-time setup)

1. developer.apple.com → Identifiers → **+** → App ID, explicit `dev.thisolivier.chronolog`, no
   capabilities.
2. appstoreconnect.apple.com → Apps → **+** → New App: iOS, "Chronolog", bundle id
   `dev.thisolivier.chronolog`, SKU `dev.thisolivier.chronolog`. Note the numeric Apple ID.
3. developer.apple.com → Profiles → **+** → Distribution → App Store Connect → that App ID → the Apple
   Distribution certificate → name exactly **`Chronolog App Store`** → download.
4. Install it into `~/sites/navidromClient/spike/.signing/` and
   `~/Library/MobileDevice/Provisioning Profiles/<UUID>.mobileprovision` (commands in the doc), or ask
   an agent with the `testflight-setup` skill to do steps 4-6.
5. `scripts/ios/ship-ios.sh 1 --skip-upload` (must reach "Export OK"), then `scripts/ios/ship-ios.sh 1`.
6. TestFlight: export compliance if asked, internal group, install; unlock with the device key and
   sign in once on the phone.

### Left / risks

- First signed archive, export and upload are unproven until the profile exists (the export step has
  never run). Expect at most ExportOptions or icon tweaks.
- Production signed-in flows in the app are unverified (no credentials); the same flows passed against
  this branch's code locally. Check on the phone after the first TestFlight install.
- Attachments do not open in the iOS app: they use `window.open`, which does nothing in Tauri on iOS
  (`on_new_window` is desktop only). Needs a web-side change (e.g. same-tab navigation to the blob or
  a download) or a native handler. Not done here (web UI belongs to 047's area).
- Landscape on iPhone is off (see 2). The inset bug looks like Tauri/wry's iOS view hosting; worth an
  upstream look if landscape is wanted.
- **Machine side effect:** the first `tauri ios init` ran Homebrew on its own to install
  `libimobiledevice` (with `libplist`, `libusbmuxd`, `libtatsu`, `libtasn1`,
  `libimobiledevice-glue`), upgraded `ca-certificates`, installed `openssl@4` and **relinked the
  `openssl` command from 3.6.1 to 4.1.0** (`openssl@3` is still installed). If anything needs the old
  CLI: `brew unlink openssl@4 && brew link openssl@3`. I did not revert it.
- The dev database has a few `ios-shell-*@chronolog.test` users from the UI runs (dev only).
- Simulator cookie note for future testers: uninstalling the app does not clear WKWebView cookies on
  the simulator (they are device-wide there); see `scripts/ios/ui-check/README.md`.
