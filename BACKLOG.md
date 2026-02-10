# Chronolog — Backlog

Previous completed tasks (1-10) are archived in [docs/BACKLOG-COMPLETE-1.md](docs/BACKLOG-COMPLETE-1.md).

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

**Depends on**: Task 10 (storage abstraction), Tasks 5 and 7

**Output**: App is fully usable offline on both desktop and mobile. Changes sync automatically when connectivity returns.

---

## Task 12: MCP Server

**Goal**: Build an MCP (Model Context Protocol) server that allows AI assistants to interact with Chronolog on behalf of a user — authenticating, creating notes, and recording time entries with note references.

- [ ] Build an MCP server (standalone process) that exposes Chronolog tools:
  - `login` — authenticate as a Chronolog user (email/password, handle 2FA)
  - `create_note` — create a note under a given client/contract
  - `record_time_entry` — record a time entry with client/contract/deliverable, duration or start/end, and description
  - `link_time_entry_to_note` — attach a wiki-link reference (`[[noteId]]`) in a time entry description, linking it to an existing note
  - `list_clients` / `list_contracts` / `list_notes` — read helpers so the AI can discover existing entities
- [ ] Authentication: MCP server authenticates against Better Auth API, stores session token for subsequent calls
- [ ] Time entry descriptions support wiki-link syntax (`[[noteId]]` or `[[noteId|label]]`) to reference notes
- [ ] Error handling: clear tool error messages for invalid credentials, missing entities, validation failures
- [ ] Documentation: usage instructions for connecting the MCP server to Claude Desktop or other MCP clients

**Depends on**: Tasks 3 (auth), 5 (time entries), 7 (notes), 8 (wiki-links)

**Output**: An MCP server that AI assistants can use to log into Chronolog, create notes, and record time entries with note references.

---

## Task 13: Contract Drag & Drop Reordering

**Goal**: Allow users to manually reorder contracts in the sidebar via drag and drop.

- [ ] Add a `sort_order` (integer) column to the `contracts` table
- [ ] Implement drag-and-drop reordering in the contracts sidebar (Panel 1)
- [ ] API endpoint to persist new ordering (`PATCH /api/contracts/reorder`)
- [ ] Reordering should work within a client group (contracts under the same client)
- [ ] Fallback ordering: alphabetical when no custom order is set

**Depends on**: Task 4 (contracts CRUD), Task 6b (sidebar layout)

**Output**: Users can drag contracts in the sidebar to reorder them, and the order persists across sessions.

---

## Task 14: Undo (Ctrl+Z) for Time Entries

**Goal**: Add an in-memory undo stack for the time entry page, with potential for app-wide extension.

- [ ] Implement an undo stack (in-memory, UI-level) for the time entry view:
  - Track field changes (duration, description, client/contract/deliverable, etc.)
  - `Ctrl+Z` / `Cmd+Z` reverts the most recent change
  - `Ctrl+Shift+Z` / `Cmd+Shift+Z` for redo
  - Stack clears on navigation away from the time entry view
- [ ] Handle edge cases: reverting an invalid entry back to valid state, undo after save
- [ ] Visual feedback: brief toast or indicator when undo/redo is triggered
- [ ] (Stretch) Generalise the undo system so it can be adopted by other views (notes, admin)

**Depends on**: Task 5 (time entries), Task 6b (layout)

**Output**: Users can undo/redo field changes on the time entry page with keyboard shortcuts.

---

## Deferred Cross-Cutting Concerns

These items were deferred from their original tasks and should be addressed as a batch:

### Encryption at rest (AES-256-GCM)
- [ ] Contract names/descriptions (from Task 4)
- [ ] Time entry descriptions (from Task 5)
- [ ] Note content/titles (from Task 7)
- [ ] Attachment data (from Task 9)

### PWA configuration
- [ ] Manifest and service worker via `@vite-pwa/sveltekit` (from Task 1)
- [ ] `adapter-static` for Tauri builds (from Task 1)

### Polish
- [ ] Image thumbnail generation via Canvas API, client-side (from Task 9)
- [ ] Timer widget as persistent fixed footer on mobile (from Task 6b)
- [ ] From a time entry: attach note references (from Task 8)

---

## Future

- Tauri packaging & distribution: `cargo tauri build` for macOS `.app`/`.dmg`, code signing, notarisation, `tauri-plugin-updater` for auto-updates
- Meeting transcription service integration
- Graph visualisation of note links
- iCloud backing / sync
- Advanced reporting and export
- Heading-level time entry linking
- Key rotation tooling
- Automated backup verification
