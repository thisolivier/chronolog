---
description: Set up browser for manual E2E testing via Chrome DevTools MCP
allowed-tools: Bash, Read, Grep, mcp__chrome-devtools__list_pages, mcp__chrome-devtools__navigate_page, mcp__chrome-devtools__take_snapshot, mcp__chrome-devtools__list_console_messages, mcp__chrome-devtools__evaluate_script, mcp__chrome-devtools__wait_for, AskUserQuestion
argument-hint: [port]
---

Set up the browser for manual E2E testing of Chronolog.

## Step 1: Determine Server Port

Read the auth config to find the expected baseURL:

```
src/lib/server/auth.ts
```

Extract the default port from the `baseURL` config (usually 5173). If $ARGUMENTS specifies a port, verify it matches the auth config. If not, warn the user that auth will fail on a mismatched port.

## Step 2: Start Dev Server (if needed)

Check if a dev server is already running on the target port:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:<port>/ 2>/dev/null
```

If not running, start one in the background:

```bash
cd <project-root> && npx vite dev --port <port> &
```

Wait for it to be ready (retry curl up to 10 seconds).

## Step 3: Connect to Chrome

Use `mcp__chrome-devtools__list_pages` to verify Chrome DevTools MCP is connected.

If it fails with a Chrome path error, tell the user:
> Chrome DevTools MCP can't find Chrome. If Chrome is installed at a non-standard path, create a symlink:
> `sudo ln -s '/Applications/Chrome.app' '/Applications/Google Chrome.app'`

## Step 4: Navigate to Login

Navigate the browser to `http://localhost:<port>/login` using `mcp__chrome-devtools__navigate_page`.

Take a snapshot to confirm the login page loaded.

## Step 5: Ask User to Log In

Ask the user to log in manually in the browser window. Use AskUserQuestion:

> "Please log in to Chronolog in the browser window. Let me know when you're done."
>
> Options: "Done - I'm logged in", "I need help"

## Step 6: Verify Login

After user confirms, take a snapshot and verify we're on an authenticated page (should see "CONTRACTS" or "Time Entries" in the snapshot).

If still on login page, let the user know and ask them to try again.

## Step 7: Baseline Check

Run these checks and report:
- Take a snapshot of the current page state
- Check console for errors: `mcp__chrome-devtools__list_console_messages` with types=["error"]
- Report: page URL, visible contracts, any pre-existing errors

Output:
```
## E2E Setup Complete

- Server: http://localhost:<port>
- Page: <current URL>
- Contracts visible: <list>
- Pre-existing console errors: <count> (none related to sync / <details>)

Ready for E2E testing. Use /e2e-offline-cycle to test offline sync.
```
