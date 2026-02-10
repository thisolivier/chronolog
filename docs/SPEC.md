# Chronolog - Project Specification

## Overview

Chronolog is a time-tracking and note-taking app for consulting work, delivered as a **Tauri 2.0 desktop application** (macOS primary) with a **PWA fallback for mobile**. It supports 2-3 users managing time entries and markdown notes across 3-5 active client contracts, with offline-first capability, encryption at rest, and TOTP-based 2FA.

## Data Model

### Hierarchy

```
Client (e.g. "Big Cheese Inc.")
  └── Contract (e.g. "Install new cheese")
        └── Deliverable (e.g. "Onboarding")
              └── Work Type (e.g. "Development", "Review", "Documentation")
```

### Work Types

Each deliverable defines its own set of allowed work types. A time entry selects one work type from the deliverable it belongs to.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| deliverable_id | FK | Links to Deliverable |
| name | TEXT | e.g. "Development", "Review" |
| sort_order | INT | For UI ordering |

### Time Entries

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| contract_id | FK | Links to Contract |
| deliverable_id | FK | Nullable, links to Deliverable |
| work_type_id | FK | Nullable, links to Work Type (scoped to deliverable) |
| date | DATE | Entry date |
| start_time | TIME | Nullable (manual entry may have duration only) |
| end_time | TIME | Nullable (set later when stopping) |
| duration_minutes | INT | Computed or manually entered |
| description | TEXT | Encrypted at rest |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | Used for sync |

### Notes

| Field | Type | Notes |
|-------|------|-------|
| note_id | TEXT | Format: `CLIENT.YYYYMMDD.SEQ` (e.g. `BIGCH.20260206.001`) |
| contract_id | FK | Links to Contract (folder-like grouping) |
| title | TEXT | Encrypted at rest |
| content | TEXT | Markdown, encrypted at rest |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | Used for sync |

### Note-Time Entry Links

Many-to-many relationship between notes and time entries. A time entry can optionally reference a specific heading within a note (stretch goal).

| Field | Type | Notes |
|-------|------|-------|
| note_id | FK | |
| time_entry_id | FK | |
| heading_anchor | TEXT | Nullable, e.g. `design-review` |

### Note-Note Links (Graph)

Tracked via a backlinks index, extracted from `[[wiki-link]]` syntax in markdown content. Not a separate table initially — derived by parsing note content on save.

### Weekly Status

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | |
| week_start | DATE | Monday of the week |
| year | INT | ISO year |
| week_number | INT | ISO week |
| status | TEXT | Free text: "Unsubmitted", "Draft ready", "Submitted", etc. |
| updated_at | TIMESTAMP | |

### Attachments

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | |
| note_id | FK | Parent note |
| filename | TEXT | Original filename |
| mime_type | TEXT | |
| size_bytes | INT | |
| data | BLOB | Encrypted at rest (server); stored as Blob in IndexedDB (client) |
| created_at | TIMESTAMP | |

## Technology Stack

### Frontend
- **SvelteKit** with two build targets:
  - `@sveltejs/adapter-static` for the Tauri desktop build (static site loaded by the webview)
  - `@sveltejs/adapter-node` for the server deployment (PWA mobile fallback)
- **Svelte 5** runes for state management
- **@vite-pwa/sveltekit** (v1.1+) for PWA / service worker (mobile only)
- **Dexie.js** (v4.3+) for client-side IndexedDB storage (mobile/PWA)
- **TipTap** (v3.x) for WYSIWYG markdown editing
  - `@tiptap/extension-markdown` for markdown serialisation
  - Custom WikiLink node using Suggestion utility for `[[note-links]]`
  - FileHandler extension for drag-and-drop attachments
  - AnchoredHeading extension for section-level linking
- **Workbox Background Sync** for offline mutation queue (mobile/PWA)

### Desktop Shell (Tauri)
- **Tauri 2.0** as the desktop application shell (Rust-based, WebView2/WebKit)
- **Multi-window support** via Tauri's window management API (e.g. pop-out note editors)
- **Native menus** and system tray integration
- **tauri-plugin-sql** for native SQLite access (replaces IndexedDB on desktop)
- **tauri-plugin-updater** for auto-update support
- Primary target: macOS (.app / .dmg distribution)

### Backend
- **SvelteKit server routes** (API endpoints via `+server.ts`)
- **PostgreSQL** (v17) as the primary database
- **Drizzle ORM** for type-safe database access and migrations
- **Better Auth** (v1.4+) with TOTP 2FA plugin
- **Node.js crypto** (AES-256-GCM) for application-level encryption

### Deployment
- **Desktop (Tauri)**: Built with `cargo tauri build`, distributed as macOS `.app` bundle / `.dmg` installer. Auto-updates via `tauri-plugin-updater`.
- **Server / PWA**: **Coolify** on a **Hetzner** CX22 VPS (~EUR 4-6/mo)
  - Automatic HTTPS via Let's Encrypt
  - Built-in scheduled PostgreSQL backups to S3-compatible storage
  - Git-push deploys
- **Alternative server**: Docker Compose + Caddy on any VPS

### Offline Strategy

A **storage abstraction layer** provides a unified interface for local data access. The underlying storage engine differs by platform:

- **Desktop (Tauri)**: Native SQLite via `tauri-plugin-sql`. No IndexedDB or service worker needed.
- **Mobile / PWA**: IndexedDB via Dexie.js, with service worker caching and Workbox Background Sync.

The abstraction exposes the same reactive query and mutation API to the Svelte UI regardless of platform. Platform detection (`window.__TAURI__`) selects the appropriate backend at initialisation.

```
                  ┌─────────────┐
                  │  PostgreSQL  │  (server, source of truth)
                  └──────┬──────┘
                         │ API
                  ┌──────┴──────┐
                  │  SvelteKit  │  (server routes, encryption/decryption)
                  │   Server    │
                  └──────┬──────┘
                         │ HTTPS
          ───────────────┼─────────────── network boundary
                         │
              ┌──────────┴──────────┐
              │                     │
     Desktop (Tauri)         Mobile (PWA)
              │                     │
      ┌───────┴───────┐    ┌───────┴───────┐
      │  SQLite       │    │ Service Worker │
      │  (tauri-      │    │ (app shell     │
      │   plugin-sql) │    │  cache +       │
      └───────┬───────┘    │  Background    │
              │            │  Sync)         │
              │            └───────┬───────┘
              │                    │
              │            ┌───────┴───────┐
              │            │  Dexie.js     │
              │            │  (IndexedDB)  │
              │            └───────┬───────┘
              │                    │
      ┌───────┴────────────────────┴───────┐
      │   Storage Abstraction Layer        │
      │   (unified reactive query/mutate)  │
      └────────────────┬──────────────────┘
                       │
               ┌───────┴───────┐
               │  Svelte UI    │  (TipTap editor, time tracker, weekly view)
               └───────────────┘
```

- **Reads**: Storage abstraction serves data from local store (SQLite or IndexedDB). Background sync pulls changes from server.
- **Writes**: Saved to local store immediately. Queued for server sync (Background Sync on PWA; direct HTTP on Tauri).
- **Conflict resolution**: Last-write-wins using `updated_at` timestamps. Acceptable for 2-3 users with low collision probability.
- **Session expiry**: 30-day server sessions. App remains usable offline via cached data. Re-auth required on reconnection if session expired.

## Security

### Authentication
- Email/password with Argon2id hashing (via Better Auth)
- TOTP 2FA via Google Authenticator (via Better Auth 2FA plugin)
- 10 single-use recovery codes generated at 2FA enrollment
- Server-side sessions (cookie-based, 30-day expiry)

### Encryption at Rest
- **What's encrypted**: Note content, note titles, time entry descriptions, attachment data
- **What's not encrypted**: Dates, durations, IDs, structural metadata (needed for queries/aggregation)
- **Algorithm**: AES-256-GCM (authenticated encryption)
- **Key management**: 256-bit key stored as environment variable, loaded at server startup
- **Implementation**: Application-level encryption in SvelteKit server routes before database writes

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Desktop shell | Tauri 2.0 | Dock presence, native multi-window, native menus, SQLite access, small binary size (~10 MB); Rust backend avoids Electron's memory overhead |
| DB architecture | PostgreSQL (server) + SQLite/IndexedDB (client) | Relational model fits linked data (notes ↔ entries); SQLite on desktop, IndexedDB on mobile; custom sync manageable at 2-3 user scale |
| Why not PouchDB/CouchDB | Ruled out | Document model awkward for relational links; smaller modern ecosystem |
| Why not Turso | Ruled out for now | Browser offline sync is beta with no durability guarantees |
| Editor | TipTap | Best Svelte 5 support; Suggestion system maps directly to wiki-links; markdown serialisation built-in |
| Sync approach | Custom last-write-wins | Simple, sufficient for 2-3 users, avoids CRDT complexity |
| Auth | Better Auth | First-class SvelteKit + TOTP support; avoids building auth from scratch |
| Deployment | Coolify on Hetzner | Web UI, built-in backups, git-push deploys, ~EUR 5/mo |

## Note ID System

Preserves the user's existing convention:

```
CLIENT_CODE.YYYYMMDD.SEQ
```

- `CLIENT_CODE`: Short uppercase code derived from client name (e.g. "BIGCH" for Big Cheese Inc.)
- `YYYYMMDD`: Creation date
- `SEQ`: Zero-padded sequence number for that client+date (001, 002, ...)

Generated automatically. Sequence counter stored per client+date in IndexedDB to ensure uniqueness even offline.

## Wiki-Link Syntax

| Pattern | Meaning |
|---------|---------|
| `[[BIGCH.20260206.001]]` | Link to note |
| `[[BIGCH.20260206.001\|Meeting notes]]` | Link with display text |
| `[[BIGCH.20260206.001#design-review]]` | Link to heading in note |
| `[[BIGCH.20260206.001#design-review\|the review]]` | Heading link with display text |

Parsed in TipTap via custom WikiLink node with `[[` trigger and Suggestion popup. Backlinks index rebuilt on save.

## UI Principles

- Minimal / functional aesthetic (Linear, Notion-inspired)
- Desktop-first design (Tauri), responsive for mobile PWA
- Fast navigation between time tracking and notes
- Weekly time overview as primary dashboard
