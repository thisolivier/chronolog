# Claude Configuration for Chronolog

## Project Overview

Chronolog is a time-tracking and note-taking PWA for consulting work. See `SPEC.md` for the full specification and `BACKLOG.md` for the task backlog.

## Agent Directives

### General
- Read `SPEC.md` before making architectural decisions
- Read `BACKLOG.md` to understand current task context
- Keep code readable with verbose variable names — never abbreviate to a single letter
- Keep dependencies minimal
- Prefer simple low-code solutions to complex ones where possible
- Pro-actively modularize the code
  - Split groups of functions into separate files with clean interfaces
  - Prefer file lengths of less than 200 lines (light preference)
  - Add readme.md files at the root of each module to describe the architecture and subcomponents
  - Ensure readme files are updated at the end of each task

### Tech Stack
- SvelteKit with Svelte 5 (runes, not legacy stores)
- TypeScript throughout
- Drizzle ORM for PostgreSQL
- TipTap for markdown editing
- Dexie.js for IndexedDB (offline storage)
- Better Auth for authentication
- @vite-pwa/sveltekit for PWA support

### Security
- Never log or expose encryption keys, session tokens, or TOTP secrets
- All sensitive content (note titles, note content, time entry descriptions) must be encrypted before database writes
- Use AES-256-GCM via Node.js crypto module for encryption
- Validate all user input on the server side

### Paths Not to Modify
Do not modify files managed by package managers.

Your work is deeply appreciated.
