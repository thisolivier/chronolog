# Claude Configuration for Chronolog

## Project Overview

Chronolog is a time-tracking and note-taking app for consulting work, delivered as a Tauri 2.0 desktop app (macOS primary) with a PWA fallback for mobile. See `docs/SPEC.md` for the full specification and `BACKLOG.md` for the task backlog.

## General Directives
- Start each response with ☀️
- Read `docs/SPEC.md` before making architectural decisions
- Read `BACKLOG.md` to understand current task context
- Keep code readable with verbose variable names — never abbreviate to a single letter
- Keep dependencies minimal (balance with low code directive)
- Prefer simple low-code solutions to complex ones where possible (balance with minimal dependency directive)
- When working on complex tasks, always use a todo list
- When working on tasks which involve multiple stages or components, use the following strategies
  - Always work using sub-agents and report progress back to the main agent
  - Use a working tree for new major branches
  - Establish what can be run in parallel with sub-agents and what is blocking
  - Review the todo list and parallel/sequential strategy after each few tasks complete
- Use the `context7` skill proactively for library/API documentation — don't wait to be asked
- ALWAYS ask for permission before editing this file

Your work is deeply appreciated.

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
- Ensure all tests can be run with a single command

## Active Development Branch

**All new work should branch from `powersync-spike`, not `main`.**

This branch is the base for an in-progress migration to PowerSync (offline sync via Postgres WAL replication). It contains the spike validation and migration plan. A DataService abstraction layer will be added here next, which all feature work should build on top of.

- See `docs/POWERSYNC_MIGRATION.md` for the full plan and architecture
- When creating new feature branches, branch from `powersync-spike`
- PRs should target `powersync-spike` until the migration is complete and merged to `main`

## Working Trees

When asked to work in a new git working tree:
1. Create the working tree inside the `working-trees/` directory at the repository root
2. Each working tree directory should be locked to a single Claude session at a time
3. Before using a working tree, check if it's already in use by another session
4. Use a lock file (e.g., `.claude-session.lock`) in the working tree to indicate active use
5. Release the lock when the session ends or when switching away from that working tree

## Paths Not to Modify
Do not modify files managed by package managers.
