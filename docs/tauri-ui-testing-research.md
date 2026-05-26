# Tauri UI Testing Research (2026-05-26)

## The Core Problem

Tauri uses WKWebView on macOS. Apple does NOT provide a WebDriver for embedded WKWebView, so the official `tauri-driver` only works on Windows and Linux.

## Recommended: tauri-plugin-playwright

**Best option for Chronolog.** A Rust plugin + npm package that gives Playwright-compatible API controlling the real native webview via a socket bridge.

- **Status:** v0.2.2 (March 2026), ~1,900 monthly downloads
- **Three testing modes** from the same test files:
  - **browser** — Headless Chromium with mocked Tauri IPC. Fast, good for CI.
  - **tauri** — Socket bridge to real WKWebView. True E2E. Works on macOS.
  - **cdp** — Chrome DevTools Protocol. Windows only.

**Setup:**
1. Add `tauri-plugin-playwright` as optional dep behind `e2e-testing` feature flag in `src-tauri/Cargo.toml`
2. Register plugin in `lib.rs` gated by `#[cfg(feature = "e2e-testing")]`
3. `pnpm add -D @srsholmes/tauri-playwright @playwright/test`
4. Create fixtures with `createTauriTest({ devUrl, ipcMocks, mcpSocket })`
5. Write standard Playwright tests using `tauriPage`
6. Run: `cargo tauri dev --features e2e-testing` + `npx playwright test --project=tauri`

**No accessibility permissions required** — socket bridge injects JS via Tauri IPC, doesn't use OS UI automation. Screen recording permission only needed for screenshots/video.

**Links:**
- [GitHub](https://github.com/srsholmes/tauri-playwright)
- [crates.io](https://crates.io/crates/tauri-plugin-playwright/0.1.0)

## Alternatives

### WebDriver approaches (two community projects)

1. **Choochmeque/tauri-webdriver** — Cross-platform embedded plugin serving W3C WebDriver protocol. 54 commits, Feb 2026.
2. **danielraffel/tauri-webdriver** — macOS-focused with JS bridge. Comprehensive W3C support including shadow DOM, cookies, screenshots.

### tauri-pilot (Linux only currently)

Rust CLI using accessibility tree + Unix socket. Built for AI agents (Claude Code). macOS support planned but not yet available.

### Official tauri-driver

Works on Linux (WebKitGTK) and Windows (Edge). NOT macOS. Good for Linux CI runners.

### CrabNebula Cloud

Paid commercial service from Tauri maintainers. Has macOS support via proprietary WebDriver.

## Recommended Strategy for Chronolog

1. **Layer 1** (do first): `tauri-plugin-playwright` in "tauri" mode for real WKWebView E2E
2. **Layer 2**: Same tests in "browser" mode for fast CI. Add `webkit` to Playwright matrix
3. **Layer 3**: `@tauri-apps/api/mocks` for Vitest unit testing of Tauri command calls
4. **Layer 4** (optional): Official `tauri-driver` on Linux CI runner

## macOS Permissions

| Permission | When Needed | Automated? |
|---|---|---|
| Accessibility | Only if using OS-level UI automation (AppleScript) | No — manual |
| Screen Recording | Screenshots/video of the app | No — manual, re-prompted weekly on Sequoia |
| Developer Tools | Safari Web Inspector for WKWebView | Enable via Safari Develop menu |

Socket-bridge approaches (playwright plugin, webdriver plugins) bypass accessibility and screen recording permissions for basic testing.

## Key Gotcha

Playwright's WebKit build ≠ macOS WKWebView. Tests passing in Playwright WebKit don't guarantee real app behavior. Always test in "tauri" mode for true verification.
