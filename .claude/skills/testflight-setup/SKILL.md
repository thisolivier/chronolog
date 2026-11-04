---
name: testflight-setup
description: Guide the owner through Chronolog's first TestFlight upload of the Tauri iOS shell (App ID, App Store Connect record, "Chronolog App Store" profile, ship-ios.sh) and verify each step on this Mac. Use when the user wants to ship the iOS app, set up App Store Connect or TestFlight for Chronolog, install the provisioning profile, or says "testflight gubbins".
---

# TestFlight setup: Chronolog iOS

Adapted from `~/sites/timeConvertor/.claude/skills/testflight-setup` for a Tauri 2 project. The
canonical doc is `docs/IOS-RELEASE.md` (one-time steps, release commands, failure table). Signing
inventory: `~/sites/navidromClient/spike/.signing/context.md`. **Secrets live in that directory: never
print, cat or paste `api-key.env`, `keychain.password`, `p12.password`, `.p8`, `.p12` or `.key` files.**

Values: team `CNHB9B5GX6`; bundle id `dev.thisolivier.chronolog`; profile name `Chronolog App Store`;
build number in `src-tauri/tauri.ios.conf.json` (`bundle.iOS.bundleVersion`); lane
`scripts/ios/ship-ios.sh`.

## How to run this skill

Interactive. Portal and App Store Connect steps happen in the owner's browser: you never create App
IDs, app records or profiles yourself (not through the API either, unless the owner explicitly asks for
that call), and you never let Xcode do it (release signing is Manual for that reason; do not switch it
to Automatic or add `-allowProvisioningUpdates` paths that could mint things). For each step tell the
owner exactly what to do, then **verify it landed** before moving on. Keep a visible checklist.

## Phase 0: shared infrastructure (yours, verify only)

```bash
security unlock-keychain -p "$(cat ~/sites/navidromClient/spike/.signing/keychain.password)" "$HOME/Library/Keychains/spike-build.keychain-db"
security find-identity -v -p codesigning "$HOME/Library/Keychains/spike-build.keychain-db"
# must list: Apple Distribution: Olivier Butler (CNHB9B5GX6)
rustup target list --installed | grep apple-ios     # aarch64-apple-ios and aarch64-apple-ios-sim
```

## Phase 1: portal (owner's browser; you verify)

Give the owner `docs/IOS-RELEASE.md` → "One-time setup" steps 1-3 (App ID, App Store Connect record,
App Store Connect profile named exactly `Chronolog App Store`). Ask for the ASC app id (numeric) and
write it into the doc's table.

## Phase 2: install the profile (yours)

Step 4 of the doc. Verify with `SKIP_UPLOAD=1 scripts/ios/ship-ios.sh <n>`: preflight must print
`OK  'Chronolog App Store' for CNHB9B5GX6.dev.thisolivier.chronolog`. Append the profile (name, UUID,
App ID, expiry) to `.signing/context.md`'s inventory.

## Phase 3: dry run, then the first upload (yours; owner confirms in the browser)

1. `scripts/ios/ship-ios.sh 1 --skip-upload` must reach "Export OK" (archive and `.ipa`), then puts
   the build number back.
2. `scripts/ios/ship-ios.sh 1`. Never pipe it through `tail`/`grep` without `pipefail`: the pipe hides
   the exit code. A Delivery UUID is not a delivered build: check
   `~/sites/musicLibrary/iOSnative/scripts/asc-builds.py dev.thisolivier.chronolog` until
   `processingState` is `VALID`.
3. Commit `src-tauri/tauri.ios.conf.json`, `src-tauri/gen/apple` and `docs/IOS-RELEASE.md` (release
   log row).
4. Owner: App Store Connect → TestFlight → export compliance if asked → internal testing group → add
   themselves → install from the TestFlight app; unlock with the device key and sign in once.

## Things that differ from the xcodegen projects

- Do not run `xcodebuild archive` yourself: the "Build Rust Code" phase needs the running Tauri CLI.
  `ship-ios.sh` uses `tauri ios build --export-method app-store-connect`.
- Do not bump the build number in `gen/apple/project.yml` or `Info.plist`: Tauri rewrites both versions
  from its config on every build.
- `gen/apple` is committed. If it is regenerated, re-apply what `docs/IOS-RELEASE.md` → Development
  lists (signing block, encryption key, portrait-only iPhone, icons).
