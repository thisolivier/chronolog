---
description: Test offline sync cycle - create data offline, verify it survives coming back online
allowed-tools: Bash, Read, mcp__chrome-devtools__take_snapshot, mcp__chrome-devtools__click, mcp__chrome-devtools__fill, mcp__chrome-devtools__evaluate_script, mcp__chrome-devtools__emulate, mcp__chrome-devtools__press_key, mcp__chrome-devtools__wait_for, mcp__chrome-devtools__list_console_messages, mcp__chrome-devtools__list_network_requests, mcp__chrome-devtools__get_network_request
argument-hint: [contract-name]
---

Run a full offline sync cycle test. Requires /e2e-setup to have been run first.

If $ARGUMENTS specifies a contract name, use that contract. Otherwise, use the first contract visible in the sidebar.

## Step 1: Verify Ready State

Take a snapshot. Verify:
- We're on an authenticated page (CONTRACTS visible in sidebar)
- Note the current URL and page state

If not authenticated, tell the user to run `/e2e-setup` first and stop.

## Step 2: Capture Baseline

Navigate to the target contract by clicking it in the sidebar. Take a snapshot and record:
- Contract name
- Number of existing notes
- Note titles visible

Report: "Baseline: <contract> has <N> notes"

## Step 3: Create Online Note

Click "New Note". Wait for the editor to appear (look for a textbox with multiline attribute).

Type a marker text into the editor using:
```javascript
() => {
  const editor = document.querySelector('[contenteditable="true"]');
  if (editor) {
    editor.focus();
    document.execCommand('insertText', false, 'ONLINE-NOTE-<timestamp>');
    return 'typed';
  }
  return 'no editor';
}
```

Where `<timestamp>` is the current time (e.g., `Date.now()`).

Wait 3 seconds for autosave. Take snapshot to confirm note appears in list.

Check console for errors. Check network requests for any 500s on sync/push.

Report: "Online note created: <title>"

## Step 4: Go Offline

Emulate offline network:
```
mcp__chrome-devtools__emulate networkConditions=Offline
```

Dispatch the offline event:
```javascript
() => {
  window.dispatchEvent(new Event('offline'));
  return { navigatorOnline: navigator.onLine };
}
```

Verify `navigatorOnline` is `false`.

Report: "Offline mode active"

## Step 5: Create Offline Note

Click "New Note". Wait 3 seconds for the offline fallback to create the note.

Take a snapshot to confirm a new note appeared.

Type marker text into the editor:
```javascript
() => {
  const editor = document.querySelector('[contenteditable="true"]');
  if (editor) {
    editor.focus();
    document.execCommand('insertText', false, 'OFFLINE-NOTE-<timestamp>');
    return 'typed';
  }
  return 'no editor';
}
```

Wait 3 seconds for autosave. Take snapshot to record the note list state.

Report: "Offline note created: <title>"

## Step 6: Record Pre-Sync State

Take a snapshot and record ALL note titles visible in the sidebar. This is the expected state after sync.

## Step 7: Go Back Online

Remove network emulation:
```
mcp__chrome-devtools__emulate networkConditions="No emulation"
```

Dispatch the online event:
```javascript
() => {
  window.dispatchEvent(new Event('online'));
  return { navigatorOnline: navigator.onLine };
}
```

Wait 5 seconds for sync cycle to complete (2s debounce + push + pull).

## Step 8: Verify Post-Sync State

Take a snapshot. Check:

1. **Notes list**: Are ALL notes from Step 6 still visible? Compare titles.
2. **Content preserved**: Is the offline note's content still in the editor?
3. **Console errors**: Check for errors (filter out expected ERR_INTERNET_DISCONNECTED from offline period)
4. **Network requests**: Find the `POST /api/sync/push` request. Inspect its response body:
   - `applied` should be > 0
   - `conflicts` should be 0
   - If conflicts > 0, this is a **FAIL** — report the request body for debugging

## Step 9: Report Results

```
## E2E Offline Cycle Results

### Setup
- Contract: <name>
- Baseline notes: <N>

### Online Note
- Created: <title> - OK
- Synced: <yes/no>

### Offline Note
- Created: <title> - OK
- Content: "<first 50 chars>"

### Sync Results
- Push: applied=<N>, conflicts=<N>
- Pull: completed=<yes/no>
- Post-sync notes visible: <N> (expected: <N>)

### Verdict: PASS / FAIL
- [x] Online note survived sync
- [x] Offline note survived sync
- [x] Offline note content preserved
- [x] No sync conflicts
- [x] No unexpected console errors

### Issues Found
- <any issues, or "None">
```

## Error Recovery

If any step fails:
- Take a screenshot for debugging: `mcp__chrome-devtools__take_screenshot`
- Check console messages for errors
- Check network requests for failed API calls
- Report the failure clearly with all diagnostic info
- Do NOT silently continue — a failed step means the test result is FAIL
