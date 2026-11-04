# iOS release (TestFlight)

The iOS app is a Tauri 2 shell (`src-tauri/`, Xcode project in `src-tauri/gen/apple/`) that loads
`https://chronolog.throb.online` full screen, like the macOS menu-bar app (`docs/DESKTOP.md`). It has
no bundled frontend, so a web deploy updates the iOS app's content; a new iOS build is only needed
when the shell itself changes (Rust, icons, Info.plist, Tauri version).

Release lane: `scripts/ios/ship-ios.sh`, ported from `~/sites/timeConvertor/scripts/ship.sh`. Shared
signing (team `CNHB9B5GX6`, Apple Distribution certificate, build keychain, App Store Connect API key)
is inventoried in `~/sites/navidromClient/spike/.signing/context.md`. **Never print or commit the files
in that directory.** Guided first-time setup: the `testflight-setup` skill (`.claude/skills/`).

| | |
|---|---|
| Bundle id | `dev.thisolivier.chronolog` (`src-tauri/tauri.ios.conf.json`; macOS keeps `com.chronolog.app`) |
| Version | `package.json` `version` → `CFBundleShortVersionString` |
| Build number | `bundle.iOS.bundleVersion` in `tauri.ios.conf.json` → `CFBundleVersion` (strictly increasing) |
| Profile | "Chronolog App Store" (App Store Connect distribution, manual signing) |
| Export options | `scripts/ios/ExportOptions.plist` (copied to `gen/apple/ExportOptions.plist` by the script) |
| Minimum iOS | 16.0. iPhone portrait only; iPad all four orientations |

## One-time setup (owner)

Nothing below exists yet (2026-11-04). Steps 1-3 are in the browser, team `CNHB9B5GX6`; do not use
Xcode's automatic signing to create them.

1. **App ID.** developer.apple.com → Certificates, Identifiers & Profiles → Identifiers → **+** →
   App IDs → App → Description "Chronolog", **Explicit** bundle id `dev.thisolivier.chronolog`. No
   capabilities.
2. **App Store Connect record.** appstoreconnect.apple.com → Apps → **+** → New App: platform iOS,
   name "Chronolog" (or another free store name), primary language English (U.K.), bundle id
   `dev.thisolivier.chronolog`, SKU `dev.thisolivier.chronolog`, full access. Note the numeric Apple ID
   from the URL and add it to the table above.
3. **Provisioning profile.** developer.apple.com → Profiles → **+** → Distribution → **App Store
   Connect** → App ID `dev.thisolivier.chronolog` → the existing **Apple Distribution** certificate →
   name exactly **`Chronolog App Store`** → Generate → Download.
4. **Install the profile** (on the Mac mini; if downloaded elsewhere, `scp` it into the `.signing`
   directory first):

   ```bash
   mv ~/Downloads/Chronolog_App_Store.mobileprovision ~/sites/navidromClient/spike/.signing/
   UUID=$(security cms -D -i ~/sites/navidromClient/spike/.signing/Chronolog_App_Store.mobileprovision | plutil -extract UUID raw -o - -)
   cp ~/sites/navidromClient/spike/.signing/Chronolog_App_Store.mobileprovision \
      "$HOME/Library/MobileDevice/Provisioning Profiles/$UUID.mobileprovision"
   ```

   Add a line for it (name, UUID, App ID, expiry) to `.signing/context.md`'s inventory.
5. **First upload**: `scripts/ios/ship-ios.sh 1`, then in App Store Connect → TestFlight: answer
   export compliance if asked (the build declares `ITSAppUsesNonExemptEncryption = false`), add
   yourself to an internal testing group, install from the TestFlight app.

Internal TestFlight testing needs no App Review. External testing and App Store release do, and a
web-wrapper app risks guideline 4.2 (minimum functionality). What would strengthen it later (no work
planned): native offline use through the outbox (045), notifications for a running timer, a widget or
Live Activity for the timer, Share-sheet capture into a note.

## Each release

```bash
cd ~/sites/chronolog && git pull && npm install
scripts/ios/ship-ios.sh <next build number>          # e.g. 1, then 2, …
git add src-tauri/tauri.ios.conf.json src-tauri/gen/apple docs/IOS-RELEASE.md
git commit -m "iOS build <n>"
~/sites/musicLibrary/iOSnative/scripts/asc-builds.py dev.thisolivier.chronolog   # wait for VALID
```

`--skip-upload` (or `SKIP_UPLOAD=1`) runs everything up to the upload and puts the build number back.
`SKIP_PREFLIGHT=1` carries on past a missing profile or identity, so Xcode reports what it needs.

What the script does: source `api-key.env` and unlock the build keychain → preflight (Apple
Distribution identity in the keychain; a profile named "Chronolog App Store" for
`CNHB9B5GX6.dev.thisolivier.chronolog`) → bump `bundle.iOS.bundleVersion` (must increase) →
`tauri ios build --export-method app-store-connect` (xcodebuild build, archive and export) → assert the
archive's `CFBundleVersion`, `CFBundleShortVersionString` and bundle id → find the `.ipa` →
`xcrun altool --upload-app` → append a row to the release log below.

Why `tauri ios build` and not `xcodebuild archive` directly: the Xcode project's "Build Rust Code"
phase calls `npm run tauri ios xcode-script`, which needs the running Tauri CLI (it fails with "failed
to read missing addr file …-server-addr" otherwise). Why manual signing: Tauri passes
`-allowProvisioningUpdates`, and this Mac's Xcode is signed in to the developer account, so automatic
signing could register App IDs or profiles on its own. `gen/apple/project.yml` pins
`CODE_SIGN_STYLE: Manual` (release: Apple Distribution + "Chronolog App Store", build keychain via
`OTHER_CODE_SIGN_FLAGS`; debug: `-`, simulator only).

## Development

```bash
rustup target add aarch64-apple-ios aarch64-apple-ios-sim     # once
npm run tauri ios build -- --debug --target aarch64-sim        # simulator .app
xcrun simctl install booted src-tauri/gen/apple/build/arm64-sim/Chronolog.app
xcrun simctl launch booted dev.thisolivier.chronolog
# against a local dev server instead of production (debug builds only):
SIMCTL_CHILD_CHRONOLOG_SHELL_URL=http://localhost:5173 xcrun simctl launch booted dev.thisolivier.chronolog
```

The page's load log: `xcrun simctl spawn booted log stream --predicate 'process == "Chronolog"' | grep chronolog-shell`.
UI check with real taps (works with the Mac's screen locked): `scripts/ios/ui-check/README.md`.

If `gen/apple` is ever regenerated (`tauri ios init`), re-apply: the signing block and
`ITSAppUsesNonExemptEncryption` in `project.yml`, iPhone portrait only, the app icons (below), and
`assets/.gitkeep`. Icons: `node src-tauri/scripts/draw-icons.mjs`, then
`npx tauri icon src-tauri/icons/app-icon-ios.png -o /tmp/icons`, copy `/tmp/icons/ios/*` into
`gen/apple/Assets.xcassets/AppIcon.appiconset/`, and run
`swift src-tauri/scripts/flatten-ios-icons.swift src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset/*.png`
(App Store validation rejects icons with an alpha channel, ITMS-90717).

## Common failures

| Symptom | Cause / fix |
|---|---|
| `No profile for team … matching 'Chronolog App Store' found` | One-time steps 1-4 not done, or the profile is not in `~/Library/MobileDevice/Provisioning Profiles/` |
| `failed to read missing addr file …-server-addr` | `xcodebuild` run directly; build through `tauri ios build` |
| `npm error Missing script: "tauri"` in the Rust phase | `package.json` needs the plain `"tauri": "tauri"` script |
| `failed to rename app … Directory not empty` | A previous `gen/apple/build/arm64-sim` (or `arm64`) folder; delete `gen/apple/build` |
| 0 identities in `security find-identity` | Keychain locked (6 h auto-lock; the script unlocks it) or the WWDR G3 intermediate is missing (`.signing/context.md`) |
| ITMS-90189 at upload | Build number not higher than the last upload; use the next one |
| ITMS-90717 / 90023 | Icon has alpha / no asset-catalog icon: redo the icon steps above |
| Upload "succeeded" but no build in TestFlight | Processing is asynchronous: check `asc-builds.py` for `VALID`; `INVALID`/`FAILED` means investigate, never blind-retry |

## Known limits of the shell

- `window.open` does nothing on iOS (Tauri's `on_new_window` is desktop only), so opening a note
  attachment in a new tab does not work in the app yet. Off-site links that navigate the page open in
  Safari.
- In landscape the webview kept reporting the portrait safe-area insets (sprint 048), so the iPhone
  build is portrait only.
- No timer in a widget, menu or notification: the macOS tray and `set_timer_state` are desktop only.

## Release log

One row per uploaded build (appended by `ship-ios.sh`).

| date | build | version | commit | artifact |
|------|-------|---------|--------|----------|
