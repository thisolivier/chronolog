# Platform Abstraction: Tauri + PWA from a Shared SvelteKit Codebase

Chronolog ships as a Tauri 2.0 desktop app (macOS primary) and a PWA (mobile fallback). Both targets share one SvelteKit codebase. This document explains the abstraction layers that make that possible without littering every component with `if (isTauri)` branches.

The two main divergence points are **storage** (SQLite vs. IndexedDB) and **window management** (native OS windows vs. single-window navigation). Everything else -- UI components, server API calls, sync logic, auth -- is shared.

```
                         Shared SvelteKit App
                    ┌────────────────────────────┐
                    │  UI Components (Svelte 5)  │
                    │  Sync Engine               │
                    │  Server API Client         │
                    │  Auth (Better Auth)        │
                    └──────────┬─────────────────┘
                               │
                    ┌──────────┴──────────────────┐
                    │   Platform Abstraction      │
                    │   Layer ($lib/platform/)    │
                    ├──────────────┬──────────────┤
                    │  Tauri impl  │   PWA impl   │
                    │  (desktop)   │   (mobile)   │
                    ├──────────────┼──────────────┤
                    │  SQLite via  │ IndexedDB    │
                    │  tauri-      │ via Dexie.js │
                    │  plugin-sql  │              │
                    ├──────────────┼──────────────┤
                    │  OS windows  │  In-app      │
                    │  via Webview │  focus mode/ │
                    │  Window API  │  navigation  │
                    └──────────────┴──────────────┘
```

---

## 1. Storage Abstraction

### The Problem

Chronolog's desktop build uses **native SQLite** via `tauri-plugin-sql`. It is fast, has no storage limits, and supports synchronous-style queries. The PWA build uses **IndexedDB** via `Dexie.js`. It is async-only, has browser-imposed quotas (~1 GB on Safari, more on Chrome), and has a different query model.

The application code -- components, sync engine, data access hooks -- should not know which backend it is talking to. A note save, a time entry query, and an attachment store should all go through the same interface.

### The Interface

Define a `StorageBackend` interface in `$lib/platform/storage.ts`. Every method is async because IndexedDB is async-only, and making the interface uniformly async costs nothing on the SQLite side.

```typescript
// $lib/platform/storage.ts

import type {
  TimeEntry,
  Note,
  Attachment,
  Contract,
  Deliverable,
  WorkType,
  WeeklyStatus,
  NoteTimeEntry,
  Client,
} from '$lib/types';

export interface StorageBackend {
  // --- Lifecycle ---
  init(): Promise<void>;
  close(): Promise<void>;

  // --- Time Entries ---
  getTimeEntry(id: string): Promise<TimeEntry | undefined>;
  getTimeEntriesByDateRange(start: string, end: string): Promise<TimeEntry[]>;
  getTimeEntriesByContract(contractId: string): Promise<TimeEntry[]>;
  saveTimeEntry(entry: TimeEntry): Promise<void>;
  deleteTimeEntry(id: string): Promise<void>;

  // --- Notes ---
  getNote(noteId: string): Promise<Note | undefined>;
  getNotesByContract(contractId: string): Promise<Note[]>;
  searchNotes(query: string): Promise<Note[]>;
  saveNote(note: Note): Promise<void>;
  deleteNote(noteId: string): Promise<void>;

  // --- Note-Time Entry Links ---
  linkNoteToTimeEntry(link: NoteTimeEntry): Promise<void>;
  getLinksForNote(noteId: string): Promise<NoteTimeEntry[]>;
  getLinksForTimeEntry(timeEntryId: string): Promise<NoteTimeEntry[]>;

  // --- Attachments ---
  getAttachment(id: string): Promise<Attachment | undefined>;
  getAttachmentsForNote(noteId: string): Promise<Attachment[]>;
  saveAttachment(attachment: Attachment): Promise<void>;
  deleteAttachment(id: string): Promise<void>;

  // --- Hierarchy ---
  getClients(): Promise<Client[]>;
  getContracts(clientId: string): Promise<Contract[]>;
  getDeliverables(contractId: string): Promise<Deliverable[]>;
  getWorkTypes(deliverableId: string): Promise<WorkType[]>;

  // --- Weekly Status ---
  getWeeklyStatus(year: number, week: number): Promise<WeeklyStatus | undefined>;
  saveWeeklyStatus(status: WeeklyStatus): Promise<void>;

  // --- Sync bookkeeping ---
  getLastSyncTimestamp(): Promise<string | null>;
  setLastSyncTimestamp(timestamp: string): Promise<void>;
  getChangedSince(timestamp: string): Promise<ChangedRecords>;
  applyServerChanges(changes: ChangedRecords): Promise<void>;
}

export interface ChangedRecords {
  timeEntries: TimeEntry[];
  notes: Note[];
  attachments: Attachment[];
  weeklyStatuses: WeeklyStatus[];
  noteTimeEntries: NoteTimeEntry[];
}
```

This interface is intentionally not generic or clever. It has concrete methods for concrete data. For a 2-3 user app, this is the right level of abstraction.

### SQLite Implementation (Tauri)

Tauri exposes SQLite through `tauri-plugin-sql`. You register the plugin in your Tauri config, and it gives you a `Database` class that runs SQL statements.

```typescript
// $lib/platform/storage-sqlite.ts

import Database from '@tauri-apps/plugin-sql';
import type { StorageBackend, ChangedRecords } from './storage';
import type { TimeEntry, Note, Attachment } from '$lib/types';

export class SqliteStorage implements StorageBackend {
  private db: Database | null = null;

  async init(): Promise<void> {
    // Opens or creates the database file in the Tauri app data dir.
    // The "sqlite:" prefix tells tauri-plugin-sql to use SQLite.
    this.db = await Database.load('sqlite:chronolog.db');
    await this.runMigrations();
  }

  async close(): Promise<void> {
    await this.db?.close();
    this.db = null;
  }

  async saveTimeEntry(entry: TimeEntry): Promise<void> {
    await this.db!.execute(
      `INSERT OR REPLACE INTO time_entries
        (id, contract_id, deliverable_id, work_type_id, date,
         start_time, end_time, duration_minutes, description,
         created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        entry.id,
        entry.contractId,
        entry.deliverableId,
        entry.workTypeId,
        entry.date,
        entry.startTime,
        entry.endTime,
        entry.durationMinutes,
        entry.description,
        entry.createdAt,
        entry.updatedAt,
      ]
    );
  }

  async getTimeEntriesByDateRange(
    start: string,
    end: string
  ): Promise<TimeEntry[]> {
    const rows = await this.db!.select<TimeEntryRow[]>(
      `SELECT * FROM time_entries WHERE date >= $1 AND date <= $2 ORDER BY date, start_time`,
      [start, end]
    );
    return rows.map(mapRowToTimeEntry);
  }

  async saveAttachment(attachment: Attachment): Promise<void> {
    // SQLite handles BLOBs natively. No size limit concerns.
    await this.db!.execute(
      `INSERT OR REPLACE INTO attachments
        (id, note_id, filename, mime_type, size_bytes, data, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        attachment.id,
        attachment.noteId,
        attachment.filename,
        attachment.mimeType,
        attachment.sizeBytes,
        attachment.data, // Uint8Array, stored as BLOB
        attachment.createdAt,
      ]
    );
  }

  async getChangedSince(timestamp: string): Promise<ChangedRecords> {
    // SQL makes this straightforward -- query each table with a WHERE clause.
    const timeEntries = await this.db!.select<TimeEntryRow[]>(
      `SELECT * FROM time_entries WHERE updated_at > $1`,
      [timestamp]
    );
    const notes = await this.db!.select<NoteRow[]>(
      `SELECT * FROM notes WHERE updated_at > $1`,
      [timestamp]
    );
    // ... same for other tables
    return {
      timeEntries: timeEntries.map(mapRowToTimeEntry),
      notes: notes.map(mapRowToNote),
      attachments: [],
      weeklyStatuses: [],
      noteTimeEntries: [],
    };
  }

  // --- Migrations ---

  private async runMigrations(): Promise<void> {
    await this.db!.execute(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY
      )
    `);

    const [row] = await this.db!.select<{ version: number }[]>(
      `SELECT version FROM schema_version ORDER BY version DESC LIMIT 1`
    );
    const currentVersion = row?.version ?? 0;

    for (const migration of MIGRATIONS) {
      if (migration.version > currentVersion) {
        await this.db!.execute(migration.sql);
        await this.db!.execute(
          `INSERT INTO schema_version (version) VALUES ($1)`,
          [migration.version]
        );
      }
    }
  }
}

// Migration definitions -- same structure as the PostgreSQL schema,
// but using SQLite syntax.
const MIGRATIONS = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS time_entries (
        id TEXT PRIMARY KEY,
        contract_id TEXT NOT NULL,
        deliverable_id TEXT,
        work_type_id TEXT,
        date TEXT NOT NULL,
        start_time TEXT,
        end_time TEXT,
        duration_minutes INTEGER,
        description TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS notes (
        note_id TEXT PRIMARY KEY,
        contract_id TEXT NOT NULL,
        title TEXT,
        content TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      -- ... other tables
    `,
  },
  // Future migrations go here as { version: 2, sql: "ALTER TABLE ..." }
];
```

Key points about the SQLite backend:

- `Database.load('sqlite:chronolog.db')` creates the file in the Tauri app data directory (e.g., `~/Library/Application Support/com.chronolog.app/chronolog.db` on macOS). You do not manage file paths yourself.
- `db.execute()` runs write statements. `db.select()` runs read statements and returns typed rows.
- BLOBs (attachments) are stored directly in the database. SQLite handles multi-megabyte blobs efficiently.
- Migrations are simple: track a version number, run SQL statements sequentially.

### IndexedDB Implementation (PWA)

The PWA uses Dexie.js, a wrapper around IndexedDB that provides a cleaner API.

```typescript
// $lib/platform/storage-indexeddb.ts

import Dexie from 'dexie';
import type { StorageBackend, ChangedRecords } from './storage';
import type { TimeEntry, Note, Attachment } from '$lib/types';

class ChronologDatabase extends Dexie {
  timeEntries!: Dexie.Table<TimeEntry, string>;
  notes!: Dexie.Table<Note, string>;
  attachments!: Dexie.Table<Attachment, string>;
  noteTimeEntries!: Dexie.Table<NoteTimeEntry, string>;
  weeklyStatuses!: Dexie.Table<WeeklyStatus, string>;
  clients!: Dexie.Table<Client, string>;
  contracts!: Dexie.Table<Contract, string>;
  deliverables!: Dexie.Table<Deliverable, string>;
  workTypes!: Dexie.Table<WorkType, string>;
  meta!: Dexie.Table<{ key: string; value: string }, string>;

  constructor() {
    super('chronolog');

    // Each version() call defines the schema at that version.
    // Dexie handles upgrades automatically when the version number increases.
    this.version(1).stores({
      timeEntries: 'id, contractId, date, updatedAt',
      notes: 'noteId, contractId, updatedAt',
      attachments: 'id, noteId',
      noteTimeEntries: '[noteId+timeEntryId], noteId, timeEntryId',
      weeklyStatuses: 'id, [year+weekNumber]',
      clients: 'id',
      contracts: 'id, clientId',
      deliverables: 'id, contractId',
      workTypes: 'id, deliverableId',
      meta: 'key',
    });

    // Future schema change example:
    // this.version(2).stores({
    //   timeEntries: 'id, contractId, date, updatedAt, workTypeId',
    //   // ... everything else unchanged
    // }).upgrade(tx => {
    //   // data migration logic if needed
    // });
  }
}

export class IndexedDbStorage implements StorageBackend {
  private db: ChronologDatabase;

  constructor() {
    this.db = new ChronologDatabase();
  }

  async init(): Promise<void> {
    // Dexie opens the database lazily on first access, but calling
    // open() explicitly lets us catch errors early.
    await this.db.open();
  }

  async close(): Promise<void> {
    this.db.close();
  }

  async saveTimeEntry(entry: TimeEntry): Promise<void> {
    await this.db.timeEntries.put(entry);
  }

  async getTimeEntriesByDateRange(
    start: string,
    end: string
  ): Promise<TimeEntry[]> {
    return this.db.timeEntries
      .where('date')
      .between(start, end, true, true)
      .sortBy('date');
  }

  async searchNotes(query: string): Promise<Note[]> {
    // IndexedDB has no full-text search. For a small dataset, filter in memory.
    const allNotes = await this.db.notes.toArray();
    const lowerQuery = query.toLowerCase();
    return allNotes.filter(
      (note) =>
        note.title.toLowerCase().includes(lowerQuery) ||
        note.noteId.toLowerCase().includes(lowerQuery)
    );
  }

  async saveAttachment(attachment: Attachment): Promise<void> {
    // IndexedDB stores Blobs and ArrayBuffers natively.
    // But watch storage quotas -- see trade-offs section below.
    await this.db.attachments.put(attachment);
  }

  async getChangedSince(timestamp: string): Promise<ChangedRecords> {
    // Dexie can query on indexed fields. updatedAt is indexed above.
    const timeEntries = await this.db.timeEntries
      .where('updatedAt')
      .above(timestamp)
      .toArray();
    const notes = await this.db.notes
      .where('updatedAt')
      .above(timestamp)
      .toArray();
    // ... same pattern for other tables
    return {
      timeEntries,
      notes,
      attachments: [],
      weeklyStatuses: [],
      noteTimeEntries: [],
    };
  }

  async getLastSyncTimestamp(): Promise<string | null> {
    const record = await this.db.meta.get('lastSync');
    return record?.value ?? null;
  }

  async setLastSyncTimestamp(timestamp: string): Promise<void> {
    await this.db.meta.put({ key: 'lastSync', value: timestamp });
  }
}
```

Key points about the IndexedDB backend:

- Dexie's `stores()` declaration lists indexed fields, not all fields. IndexedDB stores arbitrary objects -- you only declare which properties need indexes for querying.
- `put()` is an upsert (insert or replace). Matches `INSERT OR REPLACE` on the SQLite side.
- No SQL. Queries use Dexie's fluent API (`where().between()`, `.above()`, etc.) or fall back to `.filter()` for non-indexed fields.
- BLOBs are stored as `Blob` or `Uint8Array` objects. IndexedDB handles this natively, but browser quotas apply (see trade-offs).

### Platform Detection

The app needs to know which backend to instantiate. Tauri injects a `__TAURI_INTERNALS__` object on the global `window`. Check for it at startup:

```typescript
// $lib/platform/detect.ts

export type Platform = 'tauri' | 'pwa';

export function detectPlatform(): Platform {
  if (
    typeof window !== 'undefined' &&
    '__TAURI_INTERNALS__' in window
  ) {
    return 'tauri';
  }
  return 'pwa';
}
```

This runs once at app init. The result is stored in a Svelte context so any component can access it without re-detecting:

```typescript
// $lib/platform/index.ts

import { detectPlatform } from './detect';
import type { StorageBackend } from './storage';

let storageInstance: StorageBackend | null = null;

export async function initPlatform(): Promise<StorageBackend> {
  const platform = detectPlatform();

  if (platform === 'tauri') {
    // Dynamic import -- this module is never loaded in the PWA build.
    const { SqliteStorage } = await import('./storage-sqlite');
    storageInstance = new SqliteStorage();
  } else {
    const { IndexedDbStorage } = await import('./storage-indexeddb');
    storageInstance = new IndexedDbStorage();
  }

  await storageInstance.init();
  return storageInstance;
}

export function getStorage(): StorageBackend {
  if (!storageInstance) {
    throw new Error('Platform not initialized. Call initPlatform() first.');
  }
  return storageInstance;
}
```

Dynamic imports are critical here. If you statically import `@tauri-apps/plugin-sql` in the PWA build, it will crash because the Tauri runtime does not exist. The `await import()` ensures the SQLite module is only loaded when Tauri is detected.

Call `initPlatform()` early -- in the root `+layout.svelte` or `+layout.ts`:

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { onMount, setContext } from 'svelte';
  import { initPlatform, getStorage } from '$lib/platform';

  let ready = $state(false);

  onMount(async () => {
    await initPlatform();
    setContext('storage', getStorage());
    ready = true;
  });
</script>

{#if ready}
  <slot />
{:else}
  <div class="loading">Loading...</div>
{/if}
```

### Schema Synchronisation

Three storage systems must stay in sync: PostgreSQL (server, source of truth), SQLite (Tauri desktop), and IndexedDB (PWA). The schemas are not identical in syntax, but they must represent the same data model.

```
PostgreSQL (Drizzle)          SQLite (manual SQL)          IndexedDB (Dexie)
────────────────────          ───────────────────          ─────────────────
CREATE TABLE notes (          CREATE TABLE notes (         this.version(1).stores({
  note_id TEXT PK,              note_id TEXT PK,             notes: 'noteId, contractId,
  contract_id UUID FK,          contract_id TEXT,                    updatedAt'
  title TEXT,                   title TEXT,                });
  content TEXT,                 content TEXT,
  created_at TIMESTAMPTZ,       created_at TEXT,
  updated_at TIMESTAMPTZ        updated_at TEXT
);                            );
```

There is no automated way to derive one from the other. The practical approach:

1. **Drizzle schema is the source of truth.** When you add a field or table, you start with the Drizzle schema and generate a PostgreSQL migration.
2. **Then update the other two.** Add the corresponding `ALTER TABLE` to the SQLite migrations array. Bump the Dexie version number and add the new index if needed.
3. **Keep a checklist.** Every schema change requires touching three files:
   - `src/lib/server/db/schema.ts` (Drizzle / PostgreSQL)
   - `src/lib/platform/storage-sqlite.ts` (SQLite migrations array)
   - `src/lib/platform/storage-indexeddb.ts` (Dexie version)

This is manual but workable. At 2-3 users, the alternative -- a schema generation tool -- would cost more to build than it saves.

### Sync Behaviour

Both platforms use the same sync logic. Only the local storage backend differs.

```
┌──────────────────────────────────────────────┐
│               Sync Engine                    │
│         ($lib/sync/engine.ts)                │
│                                              │
│  1. Read local changes since last sync       │
│     storage.getChangedSince(lastSync)        │
│                                              │
│  2. Push local changes to server             │
│     POST /api/sync/push  { changes }         │
│                                              │
│  3. Pull server changes since last sync      │
│     GET /api/sync/pull?since=lastSync        │
│                                              │
│  4. Apply server changes locally             │
│     storage.applyServerChanges(serverData)   │
│                                              │
│  5. Update sync timestamp                    │
│     storage.setLastSyncTimestamp(now)        │
│                                              │
│  Conflict: last-write-wins (updated_at)      │
└──────────────────────────────────────────────┘
```

The sync engine calls `storage.getChangedSince()` and `storage.applyServerChanges()`. It does not know whether "storage" is SQLite or IndexedDB. The push/pull API calls are identical on both platforms -- they go to the same SvelteKit server routes.

Offline writes are queued differently per platform:

- **PWA**: Uses the Workbox Background Sync API. The service worker intercepts failed API calls and retries them when connectivity returns.
- **Tauri**: Can use the same Workbox approach (Tauri windows are still web views with service worker support), or a simpler approach: attempt the API call, and if it fails, mark the record as "pending sync" in SQLite and retry on a timer.

Both approaches converge on the same result: local writes are saved immediately, and server sync happens asynchronously.

### Trade-offs

| Aspect | SQLite (Tauri) | IndexedDB (PWA) |
|---|---|---|
| **Speed** | Fast. Synchronous queries under the hood, exposed as async for consistency. | Slower. All operations are truly async, routed through the browser's storage layer. |
| **Storage limits** | None (disk-limited). A 10 GB database is fine. | Browser quotas. Safari caps at ~1 GB. Chrome is more generous but can still evict under storage pressure. |
| **Query power** | Full SQL. JOINs, CTEs, aggregations, full-text search via FTS5. | Index-based lookups and range queries. No joins. Complex queries require pulling data into memory. |
| **BLOB storage** | Efficient. SQLite handles multi-MB blobs well. | Works, but large blobs eat into the quota quickly. Consider evicting old attachment blobs on the PWA side. |
| **Transactions** | Full ACID transactions via `BEGIN`/`COMMIT`. | IndexedDB transactions are automatic per operation, or explicit via `db.transaction()`. Dexie makes this ergonomic. |
| **Debugging** | Open the `.db` file in any SQLite browser. | Browser DevTools > Application > IndexedDB. Less ergonomic. |

For Chronolog's scale (2-3 users, maybe a few thousand notes and time entries), both backends are more than adequate. The biggest practical difference is attachment storage on the PWA side -- stay under quota by evicting old attachment blobs and re-fetching from the server when needed.

### Migrations

**SQLite migrations** are sequential numbered SQL scripts, tracked by a `schema_version` table (shown in the SQLite implementation above). You write raw SQL. Example of a version-2 migration adding a column:

```typescript
{
  version: 2,
  sql: `ALTER TABLE time_entries ADD COLUMN billable INTEGER DEFAULT 1;`
}
```

**Dexie migrations** use Dexie's built-in versioning. You declare a new `version()` and optionally provide an `upgrade()` function for data transformations:

```typescript
this.version(2).stores({
  // Only re-declare tables whose indexes change.
  // If no indexes change, you don't even need to list the table.
  timeEntries: 'id, contractId, date, updatedAt, billable',
}).upgrade(transaction => {
  // Data migration: set billable=true for all existing entries
  return transaction.table('timeEntries').toCollection().modify(entry => {
    entry.billable = true;
  });
});
```

**PostgreSQL migrations** are handled by Drizzle's `drizzle-kit generate` and `drizzle-kit migrate` commands. These produce numbered SQL migration files in a `drizzle/` directory.

The key discipline: when you add migration N to any one of these systems, add the equivalent to the other two before merging the change.

---

## 2. Window Management Abstraction

### The Problem

On desktop, Tauri can open multiple native OS windows. A user might want to pop out a note into its own window while keeping the main time-tracking view visible. The PWA cannot do this -- it has one browser tab. It uses in-app focus mode instead (sidebars collapse, note fills the screen).

Both should be triggered by the same user action ("Open in New Window" or double-click a note). The abstraction decides what actually happens.

### The Interface

```typescript
// $lib/platform/windows.ts

export interface WindowManager {
  /**
   * Open a note in its own context.
   * - Tauri: spawns a new OS window.
   * - PWA: navigates to the note route with sidebars hidden (focus mode).
   */
  openNote(noteId: string): Promise<void>;

  /**
   * Check if a note is currently open in a separate window.
   * - Tauri: checks the open windows list.
   * - PWA: always returns false (no separate windows).
   */
  isNoteOpen(noteId: string): boolean;

  /**
   * Close a note's window if it is open.
   * - Tauri: closes the OS window.
   * - PWA: no-op.
   */
  closeNote(noteId: string): Promise<void>;

  /**
   * List all currently open note windows.
   */
  getOpenNotes(): string[];

  /**
   * Subscribe to data change events from other windows.
   * Used to keep the main window's note list in sync when a note
   * is edited in a pop-out window.
   */
  onDataChanged(callback: (event: DataChangedEvent) => void): () => void;

  /**
   * Broadcast that data has changed (called after a save).
   */
  broadcastDataChanged(event: DataChangedEvent): void;
}

export interface DataChangedEvent {
  type: 'note' | 'timeEntry' | 'attachment';
  id: string;
  action: 'created' | 'updated' | 'deleted';
}
```

### Tauri Implementation: Multi-Window

Tauri 2.0 provides the `WebviewWindow` class from `@tauri-apps/api/webviewWindow`. Each window loads a URL from your SvelteKit app, running in its own webview process.

```typescript
// $lib/platform/windows-tauri.ts

import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { emit, listen } from '@tauri-apps/api/event';
import type { WindowManager, DataChangedEvent } from './windows';

export class TauriWindowManager implements WindowManager {
  private openWindows = new Map<string, WebviewWindow>();

  async openNote(noteId: string): Promise<void> {
    // If already open, focus the existing window.
    const existing = this.openWindows.get(noteId);
    if (existing) {
      await existing.setFocus();
      return;
    }

    // Create a new OS window. The label must be unique.
    // The URL points to a SvelteKit route that renders just the editor.
    const label = `note-${noteId}`;
    const webview = new WebviewWindow(label, {
      url: `/note/${noteId}?window=detached`,
      title: noteId,
      width: 800,
      height: 600,
      center: true,
    });

    // Wait for the window to finish creating.
    // Tauri emits a 'tauri://created' event on success.
    await new Promise<void>((resolve, reject) => {
      webview.once('tauri://created', () => resolve());
      webview.once('tauri://error', (e) => reject(e));
    });

    this.openWindows.set(noteId, webview);

    // Clean up when the window is closed by the user.
    webview.once('tauri://close-requested', async () => {
      this.openWindows.delete(noteId);
      await webview.destroy();
    });
  }

  isNoteOpen(noteId: string): boolean {
    return this.openWindows.has(noteId);
  }

  async closeNote(noteId: string): Promise<void> {
    const window = this.openWindows.get(noteId);
    if (window) {
      await window.destroy();
      this.openWindows.delete(noteId);
    }
  }

  getOpenNotes(): string[] {
    return Array.from(this.openWindows.keys());
  }

  onDataChanged(callback: (event: DataChangedEvent) => void): () => void {
    // Tauri's event system broadcasts across all windows in the app.
    const unlisten = listen<DataChangedEvent>('data-changed', (tauriEvent) => {
      callback(tauriEvent.payload);
    });

    // Return an unsubscribe function.
    return () => {
      unlisten.then((fn) => fn());
    };
  }

  broadcastDataChanged(event: DataChangedEvent): void {
    // emit() sends to all windows, including the current one.
    emit('data-changed', event);
  }
}
```

How Tauri multi-window works under the hood:

1. Each `WebviewWindow` is a separate native window managed by the OS (an `NSWindow` on macOS).
2. Each window loads a URL from your SvelteKit app. The Tauri dev server (or bundled assets in production) serves the page.
3. The `?window=detached` query parameter tells the SvelteKit route to render without sidebars. This is a simple check in the layout component.
4. All windows share the same Tauri backend process, so they can communicate via `emit()`/`listen()`.
5. Each window has its own JavaScript context -- they do not share memory. Communication must go through the event system or through the shared storage backend.

The SvelteKit route for a detached note window:

```svelte
<!-- src/routes/note/[noteId]/+page.svelte -->
<script lang="ts">
  import { page } from '$app/stores';
  import NoteEditor from '$lib/components/NoteEditor.svelte';

  const { noteId } = $page.params;
  const isDetached = $page.url.searchParams.get('window') === 'detached';
</script>

{#if isDetached}
  <!-- No sidebars, no navigation chrome. Just the editor. -->
  <div class="detached-editor">
    <NoteEditor {noteId} />
  </div>
{:else}
  <!-- Normal three-panel layout handles this in +layout.svelte -->
  <NoteEditor {noteId} />
{/if}
```

### PWA Implementation: Focus Mode

The PWA cannot open native windows. Instead, it navigates to the note route and enters focus mode (sidebars collapse, note fills the screen).

```typescript
// $lib/platform/windows-pwa.ts

import { goto } from '$app/navigation';
import type { WindowManager, DataChangedEvent } from './windows';

export class PwaWindowManager implements WindowManager {
  private channel: BroadcastChannel;
  private listeners: Set<(event: DataChangedEvent) => void> = new Set();

  constructor() {
    // BroadcastChannel allows communication between tabs of the same origin.
    // Useful if the user happens to open Chronolog in two browser tabs.
    this.channel = new BroadcastChannel('chronolog-data');
    this.channel.onmessage = (messageEvent) => {
      const data = messageEvent.data as DataChangedEvent;
      for (const listener of this.listeners) {
        listener(data);
      }
    };
  }

  async openNote(noteId: string): Promise<void> {
    // Navigate to the note route. The layout component detects focus mode
    // and hides the sidebars.
    await goto(`/note/${noteId}?focus=true`);
  }

  isNoteOpen(_noteId: string): boolean {
    // PWA has no concept of multiple open windows.
    return false;
  }

  async closeNote(_noteId: string): Promise<void> {
    // No-op. Focus mode is exited via the back button or Escape key.
  }

  getOpenNotes(): string[] {
    return [];
  }

  onDataChanged(callback: (event: DataChangedEvent) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  broadcastDataChanged(event: DataChangedEvent): void {
    // Post to BroadcastChannel for other tabs, and also notify local listeners.
    this.channel.postMessage(event);
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
```

### Window Lifecycle and Inter-Window Communication

When a note is edited in a pop-out Tauri window, the main window needs to know. The flow:

```
Pop-out window                     Main window
──────────────                     ───────────
User edits note
    │
    ▼
saveNote() writes to storage
    │
    ▼
broadcastDataChanged({
  type: 'note',
  id: 'BIGCH.20260206.001',
  action: 'updated'
})
    │
    ├─── Tauri: emit('data-changed', payload) ──────────►  listen('data-changed')
    │                                                            │
    └─── PWA: BroadcastChannel.postMessage() ──────────►  channel.onmessage
                                                                 │
                                                                 ▼
                                                        Callback fires.
                                                        Re-query note list
                                                        from storage.
                                                        UI updates via
                                                        Svelte reactivity.
```

On the receiving end, the main window's note list component subscribes:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { getWindowManager } from '$lib/platform';
  import { getStorage } from '$lib/platform';

  let notes = $state([]);
  const contractId = $derived(/* from context or route */);

  async function loadNotes() {
    const storage = getStorage();
    notes = await storage.getNotesByContract(contractId);
  }

  onMount(() => {
    loadNotes();

    const windowManager = getWindowManager();
    const unsubscribe = windowManager.onDataChanged((event) => {
      if (event.type === 'note') {
        // A note was changed in another window. Refresh the list.
        loadNotes();
      }
    });

    return unsubscribe;
  });
</script>
```

### Wiring Up the Window Manager

Same pattern as the storage backend -- detect platform, dynamic import:

```typescript
// $lib/platform/index.ts  (extended)

import { detectPlatform } from './detect';
import type { WindowManager } from './windows';

let windowManagerInstance: WindowManager | null = null;

export async function initWindowManager(): Promise<WindowManager> {
  const platform = detectPlatform();

  if (platform === 'tauri') {
    const { TauriWindowManager } = await import('./windows-tauri');
    windowManagerInstance = new TauriWindowManager();
  } else {
    const { PwaWindowManager } = await import('./windows-pwa');
    windowManagerInstance = new PwaWindowManager();
  }

  return windowManagerInstance;
}

export function getWindowManager(): WindowManager {
  if (!windowManagerInstance) {
    throw new Error('WindowManager not initialized. Call initWindowManager() first.');
  }
  return windowManagerInstance;
}
```

---

## 3. Architectural Considerations

### Platform Detection: When and Where

Detection happens once, at app startup, before any component renders. The `+layout.svelte` at the root of the app calls `initPlatform()` and `initWindowManager()`:

```
App startup
    │
    ▼
+layout.svelte onMount()
    │
    ├── detectPlatform()          →  'tauri' or 'pwa'
    ├── initPlatform()            →  creates SqliteStorage or IndexedDbStorage
    ├── initWindowManager()       →  creates TauriWindowManager or PwaWindowManager
    │
    ▼
setContext('storage', ...)
setContext('windowManager', ...)
    │
    ▼
Child components render
(they call getStorage() / getWindowManager() as needed)
```

After init, the platform type is immutable for the session. No component ever needs to call `detectPlatform()` again.

### Avoiding Tauri Imports in the PWA Build

This is the most common mistake when adding Tauri to an existing web app. If any module imports from `@tauri-apps/api` at the top level:

```typescript
// BAD: This import is evaluated at module load time.
// In the PWA build, @tauri-apps/api will throw because
// there is no Tauri runtime.
import { emit } from '@tauri-apps/api/event';
```

The fix is dynamic imports, used consistently:

```typescript
// GOOD: Only loaded when detectPlatform() returns 'tauri'.
const { emit } = await import('@tauri-apps/api/event');
```

The platform abstraction layer enforces this naturally. The Tauri-specific modules (`storage-sqlite.ts`, `windows-tauri.ts`) import Tauri APIs at the top of their files -- but those files are only ever loaded via `await import()` after platform detection confirms Tauri is present.

For build-time safety, you can also configure Vite to warn if Tauri modules appear in the PWA bundle:

```typescript
// vite.config.ts (addition for PWA builds)
export default defineConfig({
  build: {
    rollupOptions: {
      // If building for PWA-only deployment, externalize Tauri modules.
      // They won't be in node_modules anyway if Tauri isn't installed.
      external: process.env.BUILD_TARGET === 'pwa'
        ? [/^@tauri-apps\//]
        : [],
    },
  },
});
```

### File Structure

```
src/lib/platform/
├── index.ts              # initPlatform(), getStorage(), getWindowManager()
├── detect.ts             # detectPlatform() → 'tauri' | 'pwa'
├── storage.ts            # StorageBackend interface + ChangedRecords type
├── storage-sqlite.ts     # SqliteStorage (Tauri only, dynamically imported)
├── storage-indexeddb.ts  # IndexedDbStorage (PWA only, dynamically imported)
├── windows.ts            # WindowManager interface + DataChangedEvent type
├── windows-tauri.ts      # TauriWindowManager (Tauri only, dynamically imported)
└── windows-pwa.ts        # PwaWindowManager (PWA only, dynamically imported)
```

Interfaces in `storage.ts` and `windows.ts` are imported everywhere. Implementation files are only imported dynamically by `index.ts`.

### Testing Both Paths

**Unit tests for storage backends.** Each implementation can be tested independently:

- `storage-indexeddb.test.ts` -- Use `fake-indexeddb` (an in-memory IndexedDB implementation for Node.js) so tests run without a browser. Dexie supports this out of the box:

  ```typescript
  import 'fake-indexeddb/auto';
  // Now Dexie uses the in-memory implementation.
  ```

- `storage-sqlite.test.ts` -- Use `better-sqlite3` or a similar Node.js SQLite library for testing. The actual `tauri-plugin-sql` API is thin enough that you can write a test adapter that wraps `better-sqlite3` with the same `execute()`/`select()` interface.

**Integration tests with mocks.** For components that use `getStorage()`, provide a mock implementation via Svelte context:

```typescript
// In a test file
const mockStorage: StorageBackend = {
  getNote: vi.fn().mockResolvedValue({ noteId: 'TEST.20260206.001', ... }),
  saveNote: vi.fn().mockResolvedValue(undefined),
  // ... stub all methods
};

// Render the component with the mock in context
render(NoteEditor, {
  context: new Map([['storage', mockStorage]]),
  props: { noteId: 'TEST.20260206.001' },
});
```

**End-to-end tests.** Run Playwright tests against the PWA build (standard browser automation). For Tauri, use `tauri-driver` which wraps WebDriver for Tauri windows. Both exercise the real storage backends.

### What Stays Shared

Almost everything:

- All Svelte components (`NoteEditor`, `TimerWidget`, `WeeklyView`, etc.)
- All server API routes (`/api/sync/push`, `/api/sync/pull`, `/api/notes`, etc.)
- All sync logic (`$lib/sync/engine.ts`)
- Auth flows (Better Auth, login, 2FA)
- TipTap editor configuration and extensions
- Type definitions
- Encryption/decryption (happens server-side, shared by both platforms)

### What Diverges

| Concern | Tauri | PWA |
|---|---|---|
| Local storage | SQLite via `tauri-plugin-sql` | IndexedDB via Dexie.js |
| Window management | OS windows via `WebviewWindow` | In-app focus mode + SvelteKit navigation |
| Inter-window comms | Tauri event system (`emit`/`listen`) | `BroadcastChannel` API |
| Offline write queue | SQLite flag + retry timer (or Workbox) | Workbox Background Sync |
| File system access | Tauri `fs` plugin (direct file read/write) | File API + IndexedDB blobs |
| Notifications | Tauri `notification` plugin (native OS notifications) | Web Notifications API |
| App updates | Tauri updater plugin | Service worker update flow |

Each of these can be added to the platform abstraction layer as needed. Start with storage and windows (the two covered in this document). Add file system, notifications, and updater abstractions later if the divergence justifies it.

### Resist Over-Abstraction

This is a small app for 2-3 users. The platform abstraction layer should be the thinnest possible wrapper that lets the rest of the codebase ignore the platform question. A few rules of thumb:

- If a platform-specific feature is used in exactly one place, an `if (platform === 'tauri')` check in that one place is fine. Do not build an abstraction for it.
- If a platform-specific feature is used in 3+ places, add it to the abstraction layer.
- Do not build a plugin system. Do not build a dependency injection container. The dynamic `import()` pattern shown above is sufficient.
- The interface can grow over time. Start with what you need for the first feature that touches local storage or window management, and expand from there.
