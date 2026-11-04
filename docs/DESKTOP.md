# Desktop app (macOS)

Written 2026-11-04 (sprint 035). Chronolog for the Mac is a small Tauri 2 shell around the production
site. It has no login or key storage of its own and nothing to build on the web side.

- The window loads `https://chronolog.throb.online`. The device-key cookie (from `/unlock`) and the
  login cookie live in the app's WebKit data store, so you unlock and sign in once, as in a browser.
  The user agent ends in ` Chronolog-Desktop/<version>`.
- Closing the window (red button or Cmd+W) hides it; the app keeps running in the menu bar. Cmd+Q, or
  **Quit Chronolog** in the menu-bar menu, quits. Clicking the Dock icon brings the window back.
- The menu-bar item is a clock. While a timer runs it shows the elapsed time and the client short
  code, for example `01:25 ACME`; the app counts from the start time itself, so it stays right while
  the window is hidden. Its menu: **Show Chronolog**, **Start timer** (opens the window on the
  timesheet; press Start Timer there), **Stop timer** (opens the window and presses Stop, which shows
  the completion form), **Quit Chronolog**.
- The page reports the timer through one command, `set_timer_state`; the production origin may call
  that command and nothing else (`src-tauri/capabilities/remote-timer.json`).
- No updater, notifications, extra windows or offline mode. The build is signed ad hoc, not
  notarised, so macOS asks once before the first launch (see below).

The build is for the CPU it is built on. The Mac mini builds Apple Silicon (`aarch64`) only; an Intel
laptop must build its own.

## Build on the laptop

Prerequisites, once:

```bash
xcode-select --install                                           # Xcode command line tools
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh   # Rust (rustup), default options
source "$HOME/.cargo/env"
node --version                                                   # Node 20 or newer
```

Then, in the clone (`~/sites/chronolog`, from [LAPTOP-SETUP.md](LAPTOP-SETUP.md) step 5):

```bash
cd ~/sites/chronolog
git pull
npm install
npm run tauri:build
```

The first build compiles the Rust dependencies and takes a few minutes; later builds take about a
minute. The output:

| File | Path |
|---|---|
| App | `src-tauri/target/release/bundle/macos/Chronolog.app` (about 10 MB) |
| Disk image | `src-tauri/target/release/bundle/dmg/Chronolog_<version>_aarch64.dmg` (about 4 MB) |

Install by dragging `Chronolog.app` to `/Applications` (or open the `.dmg` and drag it onto the
Applications link):

```bash
cp -R src-tauri/target/release/bundle/macos/Chronolog.app /Applications/
open /Applications/Chronolog.app
```

The `.dmg` step styles a Finder window with AppleScript. Run from Terminal on the laptop, macOS may
ask once to let Terminal control Finder; allow it. Over SSH, or if it fails with
`AppleEvent timed out (-1712)`, skip the styling: `CI=true npm run tauri:build`. To build only the
app, `npm run tauri:build -- --bundles app`.

## Or copy the build from the Mac mini

The Mac mini (Apple Silicon) builds the same files. On the Mac mini, in a checkout that has the
sprint merged:

```bash
cd ~/sites/chronolog && git pull && npm install
CI=true npm run tauri:build      # CI=true: SSH sessions cannot script Finder for the .dmg
```

Then on the laptop:

```bash
scp olivier@100.110.206.54:sites/chronolog/src-tauri/target/release/bundle/dmg/Chronolog_0.0.1_aarch64.dmg ~/Downloads/
open ~/Downloads/Chronolog_0.0.1_aarch64.dmg     # drag Chronolog to Applications
```

## First launch

The app is signed ad hoc, not by an Apple developer identity, so Gatekeeper asks before the first
launch when the file carries the download quarantine flag (a browser or AirDrop download; `scp` and a
local build usually do not set it):

- Right-click (Control-click) `Chronolog.app` in Applications → **Open** → **Open**.
- If macOS only offers **Done** or **Move to Bin** (macOS 15 and later): System Settings → Privacy &
  Security → scroll to "Chronolog was blocked" → **Open Anyway**, then open the app again.
- Or clear the flag from Terminal: `xattr -dr com.apple.quarantine /Applications/Chronolog.app`.

In the window: enter the device access key on the unlock page (password manager), then sign in. Both
are remembered between launches. No change to `.env.prod` is needed: the page is served from the
production origin itself, so `TRUSTED_ORIGINS` already covers it.

## Updating

`git pull`, `npm run tauri:build`, quit the running app (Cmd+Q), copy the new `Chronolog.app` over the
old one. The cookies survive because the WebKit data store is keyed by the bundle identifier
(`com.chronolog.app`), not the file.

## Troubleshooting

Run the binary from Terminal to see what the shell does; it logs each page load, title change and
timer start or stop:

```bash
/Applications/Chronolog.app/Contents/MacOS/chronolog
# [chronolog-desktop] loaded https://chronolog.throb.online/unlock
# [chronolog-desktop] timer running=true
```

- Menu bar shows only the clock while a timer runs: the page has not reported yet. Show the window
  once (it reports on load and every minute).
- The menu-bar item is missing: macOS hides items that do not fit beside the notch; quit other
  menu-bar apps or use a menu-bar manager.
- Locked out after a key rotation: the app is a browser here; visit `/unlock` again in the window.

## Where the code is

`src-tauri/` (see its [README](../src-tauri/README.md)) and the page side in `src/lib/desktop/`
(bridge) and `src/lib/stores/timer-state.svelte.ts` (calls it).
