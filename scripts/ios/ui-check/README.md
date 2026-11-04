# ui-check: the iOS shell in the simulator, with real taps

An XCUITest bundle (`DriverUITests`, hosted by an empty `DriverHost` app; `project.yml` for xcodegen)
that drives the installed Chronolog debug shell by bundle id. It works with the Mac's screen locked,
where clicking the Simulator window cannot. Sprint 048 used it for the screenshots in
`docs/review/screenshots/sprint-048/`.

1. A local dev server with registration on and a known device key, e.g. on port 5248:
   `node scripts/generate-device-key.mjs` (keep the key), then
   `DEVICE_ACCESS_KEY_HASH=… ALLOW_REGISTRATION=true BETTER_AUTH_URL=http://localhost:5248 npx vite dev --port 5248 --strictPort`.
2. The debug shell installed on a booted simulator (`docs/IOS-RELEASE.md` → Development).
3. `email=$(scripts/ios/ui-check/seed-dev-user.sh http://localhost:5248 "$KEY")`: a fresh user with
   one client, contract, note and time entry (local servers only).
4. `scripts/ios/ui-check/run.sh <simulator-udid> http://localhost:5248 "$KEY" "$email" [test]`.

Tests, in order: `test1_unlockAndSignIn` (needs a clean cookie store), `test2_timesheet`,
`test3_openNote`, `test4_editNote`, `test5_externalLinkOpensSafari` (`run.sh` serves a temporary
`static/ios-link-test.html`), `test6_safeAreas`, `test7_productionUnlockSafeAreas` (loads production;
needs no account). Screenshots go to `SHOT_DIR` (default `docs/review/screenshots/sprint-048/`).

Simulator note: WKWebView cookies live in the simulator-wide
`data/Library/Cookies/Cookies.binarycookies`, not the app container, so uninstalling the app does not
sign it out. For a clean `test1`, shut the simulator down and move that file aside first. On a device
the cookies are per app.
