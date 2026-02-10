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
