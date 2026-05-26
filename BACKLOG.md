# Chronolog — Backlog

Previous completed tasks (1-10) are archived in [docs/BACKLOG-COMPLETE-1.md](docs/BACKLOG-COMPLETE-1.md).

---

## Task 11: Offline Sync (Self-Hosted PowerSync, Single-User)

**Goal**: App works offline on both Tauri desktop (primary) and the PWA; data syncs when
connectivity returns. Delivered via self-hosted PowerSync rather than a custom sync engine.

**Approach & rationale**: See [docs/EPIC-OFFLINE-SYNC.md](docs/EPIC-OFFLINE-SYNC.md). The custom
sync engine (`task-11-offline-sync`, ~2,300 lines) is abandoned. Single-account-per-instance
removes the spike's worst accommodation (per-user denormalisation) and flattens sync rules. The
PowerSync stack runs on the **remote machine**.

- [ ] **Phase A — Containerised remote stack**: single Docker Compose with source Postgres
      (containerised, `wal_level=logical`) + bucket-storage Postgres + PowerSync service, all on the
      internal Docker network (removes the spike's host-networking edits)
- [ ] **Phase B — Single-user sync rules + schema**: one global `SELECT * FROM <table>` bucket (no
      per-user filtering); resolve the spike's denormalised `user_id` columns (see epic Open
      Questions); reconcile migrations on a clean DB
- [ ] **Phase C — Land `DataService` abstraction on `main`**: cherry-pick Phase 1 from
      `powersync-spike` as a standalone PR (decouples UI from sync backend)
- [ ] **Phase D — Wire `PowerSyncDataService`**: local SQL reads, connector `uploadData()` → REST
      API, reactive sync-status surface, simplified single-user JWT auth
- [ ] **Phase E — GATE A (blocking): Tauri/WebKit validation**: full Tauri build; confirm
      OPFS-backed SQLite sync (schema, read/write, `db.watch()`, full sync cycle) works reliably in
      the macOS WebKit webview
- [ ] **Phase F — PWA offline**: service worker / app-shell caching, OPFS-with-IndexedDB fallback,
      online/offline indicator, graceful session-expiry-on-reconnect handling
- [ ] **Phase G — GATES B & C + E2E**: offline round-trip on both platforms (create/edit offline →
      reconnect → synced to source + second client); confirm attachment lazy-load strategy

**Depends on**: Task 10 (storage abstraction), Tasks 5 and 7; `powersync-spike` branch

**Output**: App is fully usable offline on desktop and mobile. Changes sync automatically when
connectivity returns, via a self-hosted PowerSync stack on the remote machine.

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

- [ ] Implement drag-and-drop reordering in the contracts sidebar (Panel 1)
  - The existing flat list layout is kept (no client grouping headers)
  - Contracts can be dragged freely across the entire list regardless of client
  - The `sortOrder` column already exists on the contracts table (integer, default 0)
- [ ] API endpoint to persist new ordering (`PATCH /api/contracts/reorder`)
  - Accepts an ordered list of contract IDs and updates `sortOrder` values accordingly
- [ ] Fallback ordering: alphabetical by name when all `sortOrder` values are equal (current behavior)
- [ ] Visual drag feedback: drag handle or ghost element during reorder

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

## Task 15: Rename and delete function for contracts

**Goal**: Add a context menu with rename and delete options for contracts in the sidebar. Deleting a contract safely reassigns its time entries and notes rather than destroying them.

- [ ] Create system-level 'Deleted Client' and 'Deleted Contract' database entities
  - Seeded automatically for each user (like the existing Internal/General defaults)
  - Hidden from all UI lists, dropdowns, and the "All Notes" view (Task 16)
  - Flagged with a `isSystem` or similar marker to exclude from queries
- [ ] On contract deletion, reassign related data:
  - **Time entries**: Update client/contract to 'Deleted Client'/'Deleted Contract'. Append `Formerly associated with: {Client Name} / {Contract Name}` as a new line in the time entry description
  - **Notes**: Move to the 'Deleted Contract' (reassign `contractId`). Notes on the Deleted Contract are hidden from the "All Notes" view (Task 16) but preserved in the database
  - **Deliverables**: Delete along with the contract (no reassignment needed)
- [ ] Contract context menu — desktop:
  - Ellipsis (`...`) icon appears on hover over a contract row in the sidebar
  - Clicking opens a dropdown menu with Rename and Delete options
- [ ] Contract context menu — mobile:
  - Ellipsis menu permanently visible in the Panel 2 header when a contract is selected
- [ ] Rename action:
  - Inline edit: contract name becomes an editable text field
  - Enter saves, Escape cancels
  - Calls `PATCH /api/contracts/:id` to persist
- [ ] Delete action:
  - Confirmation modal with contract name displayed
  - On confirm: reassigns time entries and notes, then deletes the contract
  - Navigation returns to sidebar (no contract selected)
- [ ] Client deletion (admin page only, not in sidebar):
  - Supported from the existing admin page, not via the sidebar context menu
  - Deleting a client deletes all its contracts (triggering the same reassignment logic per contract)

**Depends on**: Task 4 (contracts CRUD), Task 6b (sidebar layout)

**Output**: Users can rename and delete contracts from the sidebar. Deleted contract data is safely preserved under system entities.

---

## Task 16: All Notes view in sidebar

**Goal**: Add an 'All Notes' navigation item in the sidebar (Panel 1) that shows all notes across all contracts, and make it the default view on desktop.

- [ ] Add 'All Notes' button in the sidebar, positioned as a sibling to 'Time Entries' (at the top of Panel 1)
  - Styled consistently with the existing 'Time Entries' button
- [ ] Add a new navigation mode: `all-notes` (alongside existing `time-entries` and `notes` modes)
  - When active, Panel 2 shows all notes from all contracts in a flat list, sorted by `created_at` descending
  - Each note list item shows an additional line below the second note line displaying the contract/client prefix (e.g., "ABC: Contract Name")
  - Panel 3 shows the note editor for the selected note (reuses existing NoteEditorPanel)
- [ ] 'All Notes' should be the default view when loading the application on desktop
- [ ] The 'Create Note' button should NOT be visible in the All Notes view (no contract context to assign to)
- [ ] Notes belonging to system entities (e.g., 'Deleted Contract' from Task 15) should be excluded from the All Notes list
- [ ] API endpoint: `GET /api/notes/all` (or similar) that returns all notes for the user across contracts, with contract/client info included

**Depends on**: Task 7 (notes), Task 6b (sidebar layout)

**Output**: Users see all their notes when they log in on desktop. The All Notes view provides a single chronological list across all contracts.

___

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

### Notes — export & rich content
- [ ] **Markdown export of notes**: export a note (or selection) as a `.md` file. The editor already
      uses `tiptap-markdown`, so serialisation exists — add a download/save action (Tauri: write to
      disk via fs plugin; PWA: Blob download). Resolve `chronolog://` attachment URLs and wiki-links
      to a sensible export form.
- [ ] **PDF export of notes**: render a note to PDF (e.g. print-to-PDF of the rendered HTML, or a
      headless render). Decide between client-side (browser print / `window.print()` styling) and a
      server-side render for consistent output across platforms.
- [ ] **Rich code-block syntax highlighting**: the editor currently uses StarterKit's plain code
      block (monospace, no highlighting). Replace with `@tiptap/extension-code-block-lowlight` +
      `lowlight` for language-aware syntax highlighting; add a language selector to the editor
      toolbar and ensure highlighting survives Markdown round-trips.

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
