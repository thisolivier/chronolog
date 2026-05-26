# tmux Dispatch Protocol

How the Director launches and communicates with Team PM sessions via tmux.

## Overview

The Director creates a tmux window per Team PM, launches Claude Code in it, waits for boot, then pastes the prompt. PMs run in named tmux windows. The Director polls sprint docs for status — PMs do not notify the Director directly.

## Prerequisites

- `tmux` installed and available on PATH
- Claude Code CLI (`claude`) installed
- **Permissions must be skipped.** PMs run unattended — if they hit a permissions prompt, they block silently with no one to approve. The launch command MUST include `--dangerously-skip-permissions`. This is not optional. Use an alias if preferred, but the flag must be present.

## tmux Session Layout

Two supported patterns:

### Pattern A: Separate session (recommended when Director is already in a tmux session)

The user attaches to the PM session from a second terminal/SSH connection. Clean separation between Director and PMs.

```bash
# Create a dedicated session for PMs
tmux new-session -d -s {SESSION_NAME} -n "PM-{TEAM_ID_1}"

# Add additional PM windows
tmux new-window -t {SESSION_NAME} -n "PM-{TEAM_ID_2}"
tmux new-window -t {SESSION_NAME} -n "PM-{TEAM_ID_3}"
```

The user navigates PM windows with `Ctrl-B w` (window list) or `Ctrl-B {number}`.

### Pattern B: Windows in Director's session

PMs share the Director's tmux session. Simpler setup, but mixes Director and PM windows.

```bash
tmux new-window -t {DIRECTOR_SESSION} -n "PM-{TEAM_ID_1}"
tmux new-window -t {DIRECTOR_SESSION} -n "PM-{TEAM_ID_2}"
```

## Dispatching a sprint assignment

### Step 1 — Launch Claude in the PM's window

```bash
tmux send-keys -t {SESSION_NAME}:PM-{TEAM_ID} \
  "cd {PROJECT_ROOT} && {LAUNCH_CMD} --worktree sprint-{NNN}-{TEAM_ID} --name PM-{TEAM_ID}" \
  Enter
```

Where `{LAUNCH_CMD}` is the Claude launch command/alias (e.g. `hotclaude`).

Flags appended to the launch command:
- `--worktree sprint-{NNN}-{TEAM_ID}` — creates a git worktree automatically for this sprint
- `--name PM-{TEAM_ID}` — names the session for easy identification and resume

For discovery sprints (no code, just conversation), omit `--worktree`:

```bash
tmux send-keys -t {SESSION_NAME}:PM-{TEAM_ID} \
  "cd {PROJECT_ROOT} && {LAUNCH_CMD} --name PM-{TEAM_ID}" \
  Enter
```

### Step 2 — Wait for Claude to boot (~2 minutes)

Claude Code takes about 2 minutes to initialize. Do not paste the prompt immediately.

```bash
sleep 120
```

### Step 3 — Paste the prompt

Read the team's prompt file, combine with the sprint assignment, and send it as keystrokes to the PM's window.

```bash
# Build the prompt (must be a single line for send-keys)
PROMPT=$(cat prompts/team-pm-{TEAM_ID}.md | tr '\n' ' ')
ASSIGNMENT="Execute sprint-{NNN}-{TEAM_ID}.md. Read the sprint spec at docs/sprints/sprint-{NNN}-{TEAM_ID}.md, then begin."

tmux send-keys -t {SESSION_NAME}:PM-{TEAM_ID} \
  "${PROMPT} ${ASSIGNMENT}" \
  Enter
```

**Important:** The prompt content must be collapsed to a single line for `send-keys`. Newlines become spaces via `tr '\n' ' '`.

**Double-Enter for pasted prompts:** When pasting a prompt via `send-keys`, the text lands in Claude's input buffer but does not auto-submit. You must send a second `Enter` keystroke after a short delay to actually submit:

```bash
sleep 1
tmux send-keys -t {SESSION_NAME}:PM-{TEAM_ID} Enter
```

This is required because tmux's `send-keys` pastes the text and the first `Enter` into the TUI's input field, but Claude Code's TUI needs a separate `Enter` event to submit.

### Step 4 — Verify PMs started and begin polling

After dispatching, immediately verify each PM is running (not stuck on a prompt):

```bash
# Wait a few seconds for the prompt to be processed
sleep 5

# Check each PM's pane — look for signs of activity (tool calls, reading files)
tmux capture-pane -t {SESSION_NAME}:PM-{TEAM_ID} -p | tail -10
```

**What to look for:**
- Tool calls or "reading file" messages → PM is working, good
- "Do you want to proceed?" or permission prompts → PM is stuck, needs user intervention (likely missing `--dangerously-skip-permissions`)
- Empty or just the prompt text → PM may still be processing, check again in 30 seconds

**Then start polling.** After verifying PMs are running, begin the sprint doc polling loop immediately. Use a background bash command:

```bash
# Poll every 3 minutes, check all active sprint docs for sign-off
while true; do
  sleep 180
  grep -l "signed-off" docs/sprints/sprint-*-*.md 2>/dev/null
done
```

Or use the Bash tool with `run_in_background: true` to poll without blocking the Director session. The Director should not wait idle — continue with other planning work and check poll results when notified.

## Window assignment table

Define this in the Director prompt:

```
| tmux Window  | Team                          |
|--------------|-------------------------------|
| PM-{ID_1}    | {TEAM_1_NAME}                 |
| PM-{ID_2}    | {TEAM_2_NAME}                 |
| PM-{ID_3}    | {TEAM_3_NAME}                 |
```

## Useful tmux commands for the Director

```bash
# List all windows in the session
tmux list-windows -t {SESSION_NAME}

# Watch a PM's output (read-only from another pane)
tmux capture-pane -t {SESSION_NAME}:PM-{TEAM_ID} -p | tail -20

# Kill a stuck PM window
tmux send-keys -t {SESSION_NAME}:PM-{TEAM_ID} C-c
# or: tmux kill-window -t {SESSION_NAME}:PM-{TEAM_ID}
```

## Polling for completion

The Director polls sprint docs (not tmux windows) for status changes. Use the `/loop` skill or a cron-style check every 3 minutes:

```
Check docs/sprints/sprint-*-*.md for Status: signed-off
```

PMs do NOT notify the Director when done. The Director discovers completed work by reading sprint docs on the main branch.

## Dispatching subsequent sprints (resume)

PM sessions are **long-lived** — they persist across sprints and accumulate domain knowledge. For sprint N+1 and beyond, resume the existing session instead of launching a new one:

```bash
# Resume the PM's session in their tmux window
tmux send-keys -t {SESSION_NAME}:PM-{TEAM_ID} \
  "{LAUNCH_CMD} --resume PM-{TEAM_ID}" \
  Enter
```

Wait for boot, then send the assignment:

```bash
ASSIGNMENT="Execute sprint-{NNN}-{TEAM_ID}.md. Pull main into your worktree first (git pull origin main), then create a new branch and begin. Read the sprint spec at docs/sprints/sprint-{NNN}-{TEAM_ID}.md."

tmux send-keys -t {SESSION_NAME}:PM-{TEAM_ID} \
  "${ASSIGNMENT}" \
  Enter
```

The PM stays in the same worktree, pulls the latest main (which includes merged work from their previous sprint), and branches for the new sprint. No worktree recreation needed.

Named sessions (`--name`) make resume straightforward — no need to track session UUIDs.

## Branching Standard

All PMs must commit to a sprint branch, never directly to main. The Director merges via selective checkout (`git checkout <branch> -- <specific files>`).

**Branch naming:** `sprint-{NNN}-{TEAM_ID}` (e.g., `sprint-021-SV`)

**Why:** When PMs commit directly to main, it creates inconsistency — some sprints need selective checkout, others don't. Standardizing on branches keeps the merge workflow predictable and prevents worktree divergence surprises.

## Fallback: Sub-agent dispatch

If tmux dispatch is unavailable, the Director can execute sprint work directly using sub-agents with `isolation: "worktree"`. This is slower (sequential rather than parallel) but more reliable.

```
Director
├── Sub-agent (worktree): Execute sprint-003-OR
├── Sub-agent (worktree): Execute sprint-003-DA  (parallel if independent)
└── Sub-agent (worktree): Execute sprint-003-DW  (parallel if independent)
```

This fallback was used successfully in production when iTerm dispatch failed.
