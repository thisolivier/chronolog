# scripts/ios/

The iOS shell's release lane and its simulator check (sprint 048). Runbook: [docs/IOS-RELEASE.md](../../docs/IOS-RELEASE.md).

| File | Purpose |
|---|---|
| `ship-ios.sh` | `scripts/ios/ship-ios.sh <build> [--skip-upload]`: unlock the build keychain, preflight (identity and the "Chronolog App Store" profile), bump the build number, `tauri ios build --export-method app-store-connect`, assert the archive's build number, version and bundle id, upload the `.ipa` with altool, log the release. A run that stops before the upload puts the build number back. Ported from `~/sites/timeConvertor/scripts/ship.sh`. |
| `lib/version.sh` | Reads and bumps `bundle.iOS.bundleVersion` in `src-tauri/tauri.ios.conf.json` (strictly increasing; read back after the write) and reads the marketing version from `package.json`. |
| `ExportOptions.plist` | `app-store-connect`, manual signing, team `CNHB9B5GX6`, profile "Chronolog App Store". Copied over `src-tauri/gen/apple/ExportOptions.plist` before each build. |
| `ui-check/` | XCUITest driver that taps through the installed debug shell in the simulator: device-key gate, sign-in, timesheet, note edit, off-site link → Safari, portrait-only layout, production unlock page. See [ui-check/README.md](ui-check/README.md). |

Scripts never print secrets from `~/sites/navidromClient/spike/.signing/` (the API key id is reported by length only).
