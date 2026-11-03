# Claude Configuration for Chronolog

## Project Overview

Chronolog is a time-tracking and note-taking app for consulting work, delivered as a Tauri 2.0 desktop app (macOS primary) with a PWA fallback for mobile. The app and its Postgres run containerised on the Mac mini, exposed at `chronolog.throb.online` through the existing Cloudflare tunnel. Decisions are logged in `docs/decisions.md`. See `docs/SPEC.md` for the full specification, `docs/backlog.md` for the live backlog, and `docs/sprints/readme.md` for sprint history.

## General Directives
- Start each response with ☀️
- Read `docs/SPEC.md` before making architectural decisions
- Read `docs/backlog.md` (live backlog) and `docs/review/` (latest state reviews) to understand current task context; root `BACKLOG.md` is the original long-form task list
- Keep code readable with verbose variable names — never abbreviate to a single letter
- Keep dependencies minimal (balance with low code directive)
- Prefer simple low-code solutions to complex ones where possible (balance with minimal dependency directive)
- Use local and virtual environments where possible
  - You can install global packages where required
  - When installing global packages, never override or disrupt system or OS packages
- When working on complex tasks, always use a todo list
- When working on tasks which involve multiple stages or components, use the following strategies
  - Always work using sub-agents and report progress back to the main agent
  - Use a working tree for new major branches
  - Establish what can be run in parallel with sub-agents and what is blocking
  - Review the todo list and parallel/sequential strategy after each few tasks complete
- Use the `context7` skill proactively for library/API documentation — don't wait to be asked
- Use the `release-version` skill when preparing releases — follow semantic versioning conventions
- Back up databases before working against prod or any only-environment
  - Take the backup BEFORE the session's first mutation; never delete the pre-session backup
  - Take periodic backups during long sessions
  - If no backup storage pattern exists for the project, ask the user to agree a pattern before proceeding
- ALWAYS ask for permission before editing this file

Your work is deeply appreciated.

## Repository Layout

- `src/` — SvelteKit application source (routes, components, lib)
- `src-tauri/` — Tauri 2.0 Rust backend
- `drizzle/` — database migrations
- `docs/` — specification, backlog, sprint specs, UX research, and state reviews
- `e2e-playwright/`, `src/e2e/` — browser and API end-to-end tests
- `scripts/` — deploy, backup and maintenance scripts
- `static/` — static assets
- `.claude/` — skills (synced from `~/sites/nakedClaude/.claude/`), context7 registry, session reviews

## Codebase Health
- Pro-actively modularize the code
  - Split groups of functions into separate files with clean interfaces
  - Prefer file lengths of less than 200 lines (light preference)
- Keep documentation up to date
  - Add readme.md files at the root of each module
  - Readme files should briefly describe module architecture and working patterns
  - Readme files should list the main components and their purposes
  - Ensure readme files are up to date at the end of each task
  - Readme files do not need to list every feature of the code, just the broad strokes
- Write tests for new features
- Run tests after every feature completion
- Ensure all tests can be run with a single command

## Working Trees

When asked to work in a new git working tree:
1. Create the working tree inside `.claude/worktrees/` (gitignored); name it after the sprint or task
2. Each working tree directory should be locked to a single Claude session at a time
3. Before using a working tree, check if it's already in use by another session
4. Use a lock file (e.g., `.claude-session.lock`) in the working tree to indicate active use
5. Release the lock when the session ends or when switching away from that working tree
6. Remove the working tree and delete its branch once the work is merged — do not let them accumulate

## Paths Not to Modify
- Do not modify files managed by package managers.
- ALWAYS ask for permission before editing this file
