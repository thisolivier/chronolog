# Chronolog - First 10 Tasks

Sprint 1-2 backlog. These tasks establish the foundation — infrastructure, data model, core UI shell, and the first usable features.

---

## Task 1: Project Scaffolding & Dev Environment

**Goal**: Working SvelteKit + Tauri project with tooling configured.

- [ ] Initialise SvelteKit project with Svelte 5, TypeScript
- [ ] Configure dual adapter setup:
  - `@sveltejs/adapter-static` for Tauri desktop builds
  - `@sveltejs/adapter-node` for server deployment (PWA mobile fallback)
- [ ] Initialise Tauri 2.0 (`src-tauri/` directory, `tauri.conf.json`, Cargo.toml)
- [ ] Configure Vite, ESLint, Prettier
- [ ] Install and configure `@vite-pwa/sveltekit` with basic manifest and service worker (for mobile PWA)
- [ ] Set up Tailwind CSS (or comparable utility CSS — to be decided during design)
- [ ] Configure Drizzle ORM with PostgreSQL driver
- [ ] Create initial `docker-compose.yml` for local dev (PostgreSQL + app)
- [ ] Verify `cargo tauri dev` launches the desktop app with SvelteKit frontend
- [ ] Verify PWA installs on mobile (empty shell)
- [ ] Update CLAUDE.md for this project

**Output**: `cargo tauri dev` serves the desktop app; `npm run dev` serves the PWA-installable SvelteKit app; both connected to a local PostgreSQL.

---

## Task 2: Database Schema & Migrations

**Goal**: Full data model implemented in PostgreSQL via Drizzle migrations.

- [ ] Define Drizzle schema for all tables:
  - `users`
  - `clients`
  - `contracts`
  - `deliverables`
  - `work_types` (per-deliverable)
  - `time_entries`
  - `notes`
  - `note_time_entries` (many-to-many link table)
  - `weekly_statuses`
  - `attachments`
- [ ] Generate and run initial migration
- [ ] Write seed script with sample data (1 client, 1 contract, 2 deliverables, sample entries and notes)
- [ ] Document schema in a `docs/schema.md` or equivalent README

**Output**: `npm run db:migrate` creates all tables; `npm run db:seed` populates sample data.

---

## Task 3: Authentication & 2FA

**Goal**: Working login flow with TOTP 2FA.

- [ ] Install and configure Better Auth with SvelteKit integration
- [ ] Set up email/password authentication
- [ ] Create login and registration pages (minimal UI)
- [ ] Integrate Better Auth 2FA plugin for TOTP
- [ ] Build 2FA enrollment flow: secret generation, QR code display, verification
- [ ] Generate and display recovery codes at enrollment
- [ ] Add auth guard to all routes via `hooks.server.ts`
- [ ] Test login → 2FA → dashboard flow end-to-end

**Output**: Users can register, log in with password + TOTP code, and are redirected to a protected dashboard.

---

## Task 4: Client/Contract/Deliverable Management

**Goal**: CRUD interface for the client hierarchy.

- [ ] Build server-side API routes for clients, contracts, and deliverables
- [ ] Implement encryption for sensitive fields (contract names, descriptions)
- [ ] Create management UI:
  - Client list with add/edit
  - Contracts per client with add/edit
  - Deliverables per contract with add/edit
  - Work types per deliverable with add/edit/reorder
- [ ] This is admin-like functionality — simple form-based UI is fine

**Output**: Users can create and manage the client → contract → deliverable hierarchy and tags.

---

## Task 5: Time Entry Recording

**Goal**: Core time tracking functionality.

- [ ] Build time entry creation form:
  - Select client/contract/deliverable from hierarchy
  - Select work type (filtered to chosen deliverable)
  - Set date (defaults to today)
  - Option A: Set start time (now or manual), then later set end time
  - Option B: Manually enter duration (hh:mm)
  - Add description (free text)
- [ ] Build "running timer" UI for start/stop workflow
- [ ] Build time entry list view (for a given day)
- [ ] Build edit/delete for existing time entries
- [ ] Server-side encryption of descriptions before storage
- [ ] Server API routes for CRUD operations

**Output**: Users can record time entries via timer or manual input, view and edit them.

---

## Task 6: Weekly Time Overview

**Goal**: Primary dashboard showing time entries by week.

- [ ] Build weekly view:
  - Week selector (prev/next, date picker)
  - Daily breakdown with time entries listed
  - Total hours per day and per week
  - Group by client/contract
- [ ] Weekly status field (free text: "Unsubmitted", "Draft ready", etc.)
  - Editable inline
  - Saved per ISO week
- [ ] Show associated note references (note IDs) alongside time entries
- [ ] Mobile-responsive layout (cards on mobile, table-like on desktop)

**Output**: Users see a weekly dashboard with all time entries, totals, and status tracking.

---

## Task 7: Note-Taking with TipTap Editor

**Goal**: Create and edit markdown notes with the TipTap WYSIWYG editor.

- [ ] Install and configure TipTap with SvelteKit:
  - `@tiptap/core`, `@tiptap/starter-kit`, `@tiptap/extension-markdown`
  - `@tiptap/extension-image`, `@tiptap/extension-link`, `@tiptap/extension-placeholder`
- [ ] Build note creation flow (refer to UI-SPEC.md):
  - Select client/contract
  - Auto-generate note ID (`CLIENT.YYYYMMDD.SEQ`)
  - Open TipTap editor
- [ ] Build note list view per contract (folder-like browsing)
- [ ] Implement save: serialise to markdown, encrypt, store via API
- [ ] Implement load: fetch, decrypt, deserialise into TipTap
- [ ] Basic toolbar (headings, bold, italic, lists, links)
- [ ] Mobile-friendly editor layout

**Output**: Users can create, edit, and browse markdown notes organised by client/contract.

---

## Task 8: Wiki-Links & Note Linking

**Goal**: Notes can link to other notes and to time entries.

- [ ] Build custom TipTap WikiLink node extension:
  - `[[` trigger with Suggestion popup
  - Search notes by ID or title
  - Support `[[ID]]`, `[[ID|label]]`, `[[ID#heading]]` syntax
- [ ] Build AnchoredHeading extension (auto-generate heading IDs)
- [ ] Implement backlinks index:
  - Parse `[[links]]` from markdown on save
  - Store in backlinks table/index
  - Display "Linked from" section on note view
- [ ] Build UI for linking notes to time entries:
  - From a time entry: attach one or more note references
  - From a note: see which time entries reference it
- [ ] Render wiki-links as clickable navigation in both editor and read views

**Output**: Full linking system — notes link to notes, notes link to time entries, backlinks visible.

---

## Task 9: File Attachments

**Goal**: Attach images and PDFs to notes.

- [ ] Configure TipTap FileHandler extension for drag-and-drop
- [ ] Build attachment upload pipeline:
  - Accept file via drag-drop or file picker
  - Generate attachment ID
  - Encrypt file data server-side
  - Store in database (or filesystem with DB metadata)
  - Insert markdown reference into note (`![](chronolog://attachment/ID)`)
- [ ] Build attachment rendering:
  - Resolve `chronolog://` URLs to actual file endpoint
  - Inline image display in editor
  - PDF link display (click to open/download)
- [ ] Image thumbnail generation (Canvas API, client-side)
- [ ] Attachment list view per note

**Output**: Users can drag-drop images and PDFs into notes; files are encrypted and stored separately.

---

## Task 10: Storage Abstraction Layer

**Goal**: Unified local storage interface that works on both Tauri (SQLite) and PWA (IndexedDB).

- [ ] Define a `StorageAdapter` interface with reactive query and mutation methods
- [ ] Implement `SqliteAdapter` using `tauri-plugin-sql`:
  - Create SQLite schema mirroring server tables
  - Reactive queries via Svelte 5 runes (writable signals refreshed on mutation)
- [ ] Implement `DexieAdapter` using Dexie.js (v4.3+):
  - IndexedDB schema mirroring server tables
  - Reactive queries via Dexie `liveQuery`
- [ ] Platform detection (`window.__TAURI__`) to select adapter at app init
- [ ] Store attachments as BLOBs in SQLite (desktop) or IndexedDB Blobs (mobile)
- [ ] Write adapter integration tests for both backends

**Depends on**: Task 2 (schema defines the tables to mirror)

**Output**: `import { storage } from '$lib/storage'` returns the correct adapter. UI code never references SQLite or Dexie directly.

---

## Task 11: Offline Sync

**Goal**: App works offline; data syncs when connectivity returns.

- [ ] Implement data sync layer on top of the storage abstraction (Task 10):
  - On load: pull latest from server, populate local store
  - On write: save to local store immediately, queue server sync
  - On reconnect: push queued changes, pull server updates
  - Conflict resolution: last-write-wins via `updated_at`
- [ ] Desktop (Tauri): sync queue with direct HTTP requests from Rust or JS
- [ ] Mobile (PWA): configure Workbox Background Sync for queued API writes
- [ ] Configure service worker for app shell caching (precache strategy, PWA only)
- [ ] Add online/offline indicator in UI
- [ ] Handle session expiry gracefully (re-auth prompt on reconnect)
- [ ] Test offline scenarios on both platforms:
  - Create time entry offline → comes back online → synced
  - Edit note offline → comes back online → synced
  - Multiple offline edits → bulk sync

**Depends on**: Task 10 (storage abstraction), Tasks 5 and 7 minimum

**Output**: App is fully usable offline on both desktop and mobile. Changes sync automatically when connectivity returns.

---

## Ordering & Dependencies

```
Task 1 (scaffolding + Tauri init)
  ├── Task 2 (schema) ──┐
  │     └── Task 4 (clients/contracts)
  │           └── Task 5 (time entries)
  │                 └── Task 6 (weekly view)
  │
  └── Task 3 (auth)
        └── (all subsequent tasks require auth)

Task 7 (notes editor) ← requires Task 2, Task 3, Task 4
  └── Task 8 (wiki-links) ← requires Task 7, Task 5
  └── Task 9 (attachments) ← requires Task 7

Task 10 (storage abstraction) ← requires Task 2
Task 11 (offline sync) ← requires Task 10, Tasks 5 and 7 minimum; ideally after all features
```

Tasks 1-3 are the critical path. Tasks 4-6 (time tracking) and Task 7 (notes) can proceed in parallel once the foundation is in place. Task 10 (storage abstraction) can begin as soon as the schema is defined. Task 11 (offline sync) wraps everything together at the end.

---

## Beyond Sprint 2

Items deferred to future sprints:

- **Tauri packaging & distribution**: `cargo tauri build` for macOS `.app` / `.dmg`, code signing, notarisation, `tauri-plugin-updater` for auto-updates
- Meeting transcription service integration
- Graph visualisation of note links
- iCloud backing / sync
- Advanced reporting and export
- Heading-level time entry linking (stretch goal partially addressed in Task 8)
- Key rotation tooling
- Automated backup verification
