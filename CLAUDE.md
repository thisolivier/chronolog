# Claude Configuration for Chronolog

## Project Overview

Chronolog is a time-tracking and note-taking app for consulting work, delivered as a Tauri 2.0 desktop app (macOS primary) with a PWA fallback for mobile. See `SPEC.md` for the full specification and `BACKLOG.md` for the task backlog.

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
- Tauri 2.0 as desktop shell (Rust backend, WebView frontend)
- SvelteKit with Svelte 5 (runes, not legacy stores)
- TypeScript throughout
- Two SvelteKit adapters: adapter-static (Tauri), adapter-node (server/PWA)
- Drizzle ORM for PostgreSQL (server)
- tauri-plugin-sql for SQLite (desktop local storage)
- Dexie.js for IndexedDB (mobile/PWA local storage)
- Storage abstraction layer over SQLite and IndexedDB
- TipTap for markdown editing
- Better Auth for authentication
- @vite-pwa/sveltekit for PWA support (mobile only)

### Security
- Never log or expose encryption keys, session tokens, or TOTP secrets
- All sensitive content (note titles, note content, time entry descriptions) must be encrypted before database writes
- Use AES-256-GCM via Node.js crypto module for encryption
- Validate all user input on the server side

### Paths Not to Modify
Do not modify files managed by package managers.

Your work is deeply appreciated.
