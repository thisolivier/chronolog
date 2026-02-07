# Chronolog - First 10 Tasks

Sprint 1-2 backlog. These tasks establish the foundation — infrastructure, data model, core UI shell, and the first usable features.

---

## Task 1: Project Scaffolding & Dev Environment ✅

**Goal**: Working SvelteKit + Tauri project with tooling configured.

- [x] Initialise SvelteKit project with Svelte 5, TypeScript
- [x] Configure dual adapter setup:
  - Uses `adapter-auto` (switched from `adapter-static` to support server routes)
  - `@sveltejs/adapter-static` available but not active
- [x] Initialise Tauri 2.0 (`src-tauri/` directory, `tauri.conf.json`, Cargo.toml)
- [x] Configure Vite, ESLint, Prettier
- [ ] Install and configure `@vite-pwa/sveltekit` with basic manifest and service worker — _deferred (package installed but not configured)_
- [x] Set up Tailwind CSS v4 via `@tailwindcss/vite`
- [x] Configure Drizzle ORM with PostgreSQL driver
- [x] Create initial `docker-compose.yml` for local dev (PostgreSQL + app)
- [x] Verify `cargo tauri dev` launches the desktop app with SvelteKit frontend
- [ ] Verify PWA installs on mobile (empty shell) — _deferred_
- [x] Update CLAUDE.md for this project

**Output**: `cargo tauri dev` serves the desktop app; `npm run dev` serves the PWA-installable SvelteKit app; both connected to a local PostgreSQL.

---

## Task 2: Database Schema & Migrations ✅

**Goal**: Full data model implemented in PostgreSQL via Drizzle migrations.

- [x] Define Drizzle schema for all tables:
  - `users`, `clients`, `contracts`, `deliverables`, `work_types`, `time_entries`, `notes`, `note_time_entries`, `weekly_statuses`, `attachments`
- [x] Generate and run initial migration
- [x] Write seed script with sample data (1 client, 1 contract, 2 deliverables, sample entries and notes)
- [x] Document schema in `src/lib/server/db/schema/` README

**Output**: `npm run db:migrate` creates all tables; `npm run db:seed` populates sample data.

---

## Task 3: Authentication & 2FA ✅

**Goal**: Working login flow with TOTP 2FA.

- [x] Install and configure Better Auth with SvelteKit integration
- [x] Set up email/password authentication
- [x] Create login and registration pages (minimal UI)
- [x] Integrate Better Auth 2FA plugin for TOTP
- [x] Build 2FA enrollment flow: secret generation, QR code display, verification
- [x] Generate and display recovery codes at enrollment
- [x] Add auth guard to all routes via `hooks.server.ts`
- [x] Test login → 2FA → dashboard flow end-to-end

**Output**: Users can register, log in with password + TOTP code, and are redirected to a protected dashboard.

---

## Task 4: Client/Contract/Deliverable Management ✅

**Goal**: CRUD interface for the client hierarchy.

- [x] Build server-side API routes for clients, contracts, and deliverables
- [ ] Implement encryption for sensitive fields (contract names, descriptions) — _deferred to encryption task_
- [x] Create management UI:
  - Client list with add/edit
  - Contracts per client with add/edit
  - Deliverables per contract with add/edit
  - Work types per deliverable with add/edit/reorder
- [x] Admin-like functionality with simple form-based UI

**Output**: Users can create and manage the client → contract → deliverable hierarchy and tags.

---

## Task 5: Time Entry Recording ✅

**Goal**: Core time tracking functionality.

- [x] Build time entry creation form:
  - Select client/contract/deliverable from hierarchy
  - Select work type (filtered to chosen deliverable)
  - Set date (defaults to today)
  - Option A: Set start time (now or manual), then later set end time
  - Option B: Manually enter duration (hh:mm)
  - Add description (free text)
- [x] Build "running timer" UI for start/stop workflow
- [x] Build time entry list view (for a given day)
- [x] Build edit/delete for existing time entries
- [ ] Server-side encryption of descriptions before storage — _deferred to encryption task_
- [x] Server API routes for CRUD operations

**Output**: Users can record time entries via timer or manual input, view and edit them.

---

## Task 6: Weekly Time Overview ✅

**Goal**: Primary dashboard showing time entries by week.

- [x] Build weekly view:
  - Week selector (prev/next, this week)
  - Daily breakdown with time entries listed
  - Total hours per day and per week
  - [ ] Group by client/contract — _deferred to layout refactor_
- [x] Weekly status field (free text: "Unsubmitted", "Draft ready", etc.)
  - Editable inline via dropdown
  - Saved per ISO week
- [ ] Show associated note references (note IDs) alongside time entries — _blocked on Task 7_
- [ ] Mobile-responsive layout (cards on mobile, table-like on desktop) — _deferred to layout refactor_

**Output**: Users see a weekly dashboard with all time entries, totals, and status tracking.

---

## Task 6b: Three-Panel Layout & Navigation Shell ✅

**Goal**: Implement the Apple Notes-inspired layout from UI-SPEC.md — three resizable panels on desktop, single-panel push/pop navigation on mobile.

### Desktop (three-panel)

- [x] Build `AppShell` layout component with three panels:
  - **Panel 1 — Contracts sidebar** (far left, collapsible):
    - "Time Entries" item at the top (global, all clients)
    - Contracts grouped by client below
    - Selecting a contract populates Panel 2 with that contract's notes
    - Selecting "Time Entries" populates Panel 2 with week list
    - Timer widget pinned to bottom of this panel
  - **Panel 2 — List panel** (middle):
    - In Time Entries mode: week list (navigation index into Panel 3's continuous scroll)
    - In Notes mode: note list for the selected contract (placeholder until Task 7)
  - **Panel 3 — Content area** (right, main):
    - In Time Entries mode: continuous scroll of weekly sections (refactor existing `WeekHeader` + `DaySection` components)
    - In Notes mode: TipTap editor placeholder (actual editor in Task 7)
- [x] Panel 1 collapse/expand toggle
- [x] Resizable panel dividers (drag to resize)
- [x] Move timer widget from dashboard into Panel 1 bottom — persistent across all views
- [x] Move time entries view from `/time` route into Panel 3 content area
- [x] Continuous scroll with lazy loading by week (replace single-week prev/next navigation)
- [ ] Inline editing of time entries (click to edit any field) — _deferred to polish pass_
- [x] Move admin CRUD into a settings/admin modal or keep as separate route (accessible from Panel 1 gear icon)

### Mobile (single-panel push/pop)

- [x] Responsive breakpoint: below `lg` (1024px), switch to single-panel mode
- [x] Navigation stack with push/pop transitions:
  - Level 1: Contracts list (same data as Panel 1)
  - Level 2: Notes list or Week list (same data as Panel 2)
  - Level 3: Note editor or Week detail (same data as Panel 3)
- [x] Back button / swipe-right to pop
- [ ] Timer widget as persistent fixed footer (visible on all levels) — _deferred; timer accessible via Panel 1_

### Refactoring scope

- [x] Existing components (`TimerWidget`, `WeekHeader`, `DaySection`, `WeeklyEntryRow`, `CascadingSelects`) are reused — only their container/positioning changes
- [x] Dashboard route (`/`) becomes the `AppShell` (no more card-link hub)
- [x] `/time` and `/time/new` routes merged into Panel 3 flows
- [x] `/admin` routes remain separate (linked from Panel 1 settings icon)
- [x] Auth routes (`/login`, `/register`, `/settings/two-factor`) remain separate full-page routes

**Depends on**: Tasks 4, 5, 6

**Output**: The app has the Apple Notes three-panel layout on desktop and single-panel drill-down on mobile. Timer is persistent. Time entries scroll continuously by week.

---

## Task 7: Note-Taking with TipTap Editor ✅

**Goal**: Create and edit markdown notes with the TipTap WYSIWYG editor.

- [x] Install and configure TipTap with SvelteKit:
  - `@tiptap/core`, `@tiptap/starter-kit`, `tiptap-markdown`
  - `@tiptap/extension-link`, `@tiptap/extension-placeholder`
- [x] Build note creation flow:
  - Select client/contract from sidebar (Panel 1)
  - Auto-generate note ID (`CLIENT.YYYYMMDD.SEQ`)
  - Open TipTap editor in Panel 3
- [x] Build note list view per contract (NoteListPanel in Panel 2)
- [x] Implement save: serialise to markdown + JSON, store via API (auto-save with 1.5s debounce)
- [x] Implement load: fetch from API, deserialise into TipTap
- [x] Basic toolbar (headings, bold, italic, lists, links, horizontal rule)
- [x] Note CRUD API routes (`/api/notes`, `/api/notes/[noteId]`)
- [x] Note ID generation with tests (3 tests)
- [ ] Encryption of note content — _deferred to encryption task_
- [ ] Mobile-friendly editor layout — _works via responsive AppShell_

**Output**: Users can create, edit, and browse markdown notes organised by client/contract in the three-panel layout.

---

## Task 8: Wiki-Links & Note Linking ✅

**Goal**: Notes can link to other notes and to time entries.

- [x] Build custom TipTap WikiLink node extension:
  - `[[` trigger with Suggestion popup
  - Search notes by ID or title
  - Support `[[ID]]`, `[[ID|label]]`, `[[ID#heading]]` syntax
- [x] Build AnchoredHeading extension (auto-generate heading IDs)
- [x] Implement backlinks index:
  - Parse `[[links]]` from markdown on save
  - Store in `note_links` table (backlinks index)
  - Display "Linked from" section on note view
- [x] Build UI for linking notes to time entries:
  - From a note: see which time entries reference it (LinkedTimeEntries component)
  - API for linking/unlinking time entries to notes
  - [ ] From a time entry: attach note references — _deferred to polish pass_
- [x] Render wiki-links as clickable navigation in editor view

**Output**: Full linking system — notes link to notes, notes link to time entries, backlinks visible.

---

## Task 9: File Attachments ✅

**Goal**: Attach images and PDFs to notes.

- [x] Configure TipTap FileHandler extension for drag-and-drop
- [x] Build attachment upload pipeline:
  - Accept file via drag-drop or file picker
  - Generate attachment ID
  - [ ] Encrypt file data server-side — _deferred to encryption task_
  - Store in database (bytea column)
  - Insert markdown reference into note (`![](chronolog://attachment/ID)`)
- [x] Build attachment rendering:
  - Resolve `chronolog://` URLs to actual file endpoint
  - Inline image display in editor
  - PDF link display (click to open/download)
- [ ] Image thumbnail generation (Canvas API, client-side) — _deferred to polish pass_
- [x] Attachment list view per note

**Output**: Users can drag-drop images and PDFs into notes; files are stored in the database and rendered inline.

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
Task 1 (scaffolding + Tauri init) ✅
  ├── Task 2 (schema) ✅
  │     └── Task 4 (clients/contracts) ✅
  │           └── Task 5 (time entries) ✅
  │                 └── Task 6 (weekly view) ✅
  │                       └── Task 6b (three-panel layout) ← NEXT
  │
  └── Task 3 (auth) ✅
        └── (all subsequent tasks require auth)

Task 6b (layout shell) ✅
  └── Task 7 (notes editor) ✅
        └── Task 8 (wiki-links) ✅
        └── Task 9 (attachments) ✅

Task 10 (storage abstraction) ← NEXT (requires Task 2)
Task 11 (offline sync) ← requires Task 10, Tasks 5 and 7 minimum; ideally after all features
```

Tasks 1-9 are complete. **Task 10 (storage abstraction layer) is the next item** — it can proceed independently as it only depends on Task 2 (schema).

### Deferred cross-cutting concerns

These items were deferred from their original tasks and should be addressed as a batch:
- **Encryption at rest** (AES-256-GCM): contract names/descriptions (Task 4), time entry descriptions (Task 5), note content/titles (Task 7), attachment data (Task 9)
- **PWA configuration**: manifest, service worker, adapter-static for Tauri builds (Task 1)
- **Mobile responsiveness**: cards on mobile, table on desktop (Task 6)
- **Image thumbnails**: Canvas API client-side thumbnail generation (Task 9)

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
