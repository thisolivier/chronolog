# Sprint 048 — DT: iOS build and TestFlight lane

**Status:** in progress
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

## Sign-off

(pending)
