# Chronolog - Project Specification

## Overview

Chronolog is a time-tracking and note-taking app for consulting work, delivered as a **Tauri 2.0 desktop application** (macOS primary) with a **PWA fallback for mobile**. It supports 2-3 users managing time entries and markdown notes across 3-5 active client contracts, with an online-first design (a persistent read cache keeps the last loaded data visible when the server is unreachable, an offline outbox keeps note and time entry changes until the server is back, and an offline banner says so), encryption at rest, and TOTP-based 2FA.

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
| data | BLOB | Encrypted at rest (server) |
| created_at | TIMESTAMP | |

## Technology Stack

### Frontend
- **SvelteKit** with two build targets:
  - `@sveltejs/adapter-static` for the Tauri desktop build (static site loaded by the webview)
  - `@sveltejs/adapter-node` for the server deployment (PWA mobile fallback)
- **Svelte 5** runes for state management
- **@vite-pwa/sveltekit** (v1.1+) for PWA / service worker (mobile only)
- **TipTap** (v3.x) for WYSIWYG markdown editing
  - `@tiptap/extension-markdown` for markdown serialisation
  - Custom WikiLink node using Suggestion utility for `[[note-links]]`
  - FileHandler extension for drag-and-drop attachments
  - AnchoredHeading extension for section-level linking

### Desktop Shell (Tauri)
- **Tauri 2.0** as the desktop application shell (Rust-based, WebView2/WebKit)
- **Multi-window support** via Tauri's window management API (e.g. pop-out note editors)
- **Native menus** and system tray integration
- **tauri-plugin-updater** for auto-update support
- Primary target: macOS (.app / .dmg distribution)

### Backend
- **SvelteKit server routes** (API endpoints via `+server.ts`)
- **PostgreSQL** (v17) as the primary database
- **Drizzle ORM** for type-safe database access and migrations
- **Better Auth** (v1.4+) with TOTP 2FA plugin
- **Node.js crypto** (AES-256-GCM) for application-level encryption

### Deployment
- **Production**: the app and PostgreSQL run as a two-container Docker Compose stack (`docker-compose.prod.yml`) on the Mac mini under OrbStack.
  - The app listens on `127.0.0.1:3123`; PostgreSQL publishes no host port.
  - Reached at `chronolog.throb.online` through the existing Cloudflare Tunnel.
  - A self-managed device access key gates access before login.
  - Nightly `pg_dump` backups run from launchd at 03:30.
  - Details: `docs/DEPLOYMENT.md`.

### Offline Strategy

The app is **online-first with an offline outbox** (sprint 045-CL). The server (SvelteKit API routes over PostgreSQL) is the source of truth; while it is unreachable the app keeps showing what it last loaded and keeps note and time entry changes on the device until it can send them. Module details: `src/lib/offline/readme.md`.

- **Read cache**: the client keeps the last successful GET response per URL (`src/lib/services/fetch-helpers.ts`), persisted per user in IndexedDB, so a reload while offline still shows the notes, lists, sidebar and weeks already visited. A failed read (no answer, or Cloudflare's 502/503/504/52x) returns the cached copy. A successful write updates or evicts the cached reads of the resource it changed.
- **App shell**: a SvelteKit service worker (`src/service-worker.ts`) precaches the built app and keeps the last copy of each signed-in page, so an offline reload loads. It never touches `/api/*`.
- **Outbox**: note create and edit and time entry create, edit and delete made while the server is unreachable are queued per user in localStorage (written before the call returns) and replay in order on reconnect. Notes made offline get temp IDs (`offline-…`), created first on replay so their real IDs replace the temp ones everywhere, wiki-links included. Each queued edit carries the server copy it was based on: **last-write-wins per field** when the server did not change that field; when it did, the item is **held** and a prompt shows both versions (keep mine / keep the server's / for notes keep both). A change the server refuses is held with its message. Nothing is dropped without the user choosing it.
- **Idempotent creates**: `POST /api/notes` and `POST /api/time-entries` take an optional `clientId` (unique per user); a repeat answers 200 with the first row. The outbox sends its temp ID, so a retry after a lost answer (or Cloudflare 524) never makes a second note or entry. Replay only runs when `GET /api/me` names the queue's own account.
- **Not queued**: note moves, pins, trash and restore, attachments, timer stop and start adjustments, weekly status. Offline they fail with an error as before. An offline timer start runs as a browser timer; its saved entry is queued.
- **Offline banner**: shows when the server is unreachable, with the count of changes waiting and a Review button for held ones; rows carry a "queued", "held" or "replayed" marker.
- **Session expiry**: a 401 or a redirect to `/login` raises a session-expired error and sends the user to log in again; queued changes stay and replay after signing back in as the same user.
- **Sign-out** asks before discarding unsent changes, then deletes the read cache and the kept pages: nothing cached outlives the session (not encrypted at rest in the browser, by decision).

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
| Desktop shell | Tauri 2.0 | Dock presence, native multi-window, native menus, small binary size (~10 MB); Rust backend avoids Electron's memory overhead |
| DB architecture | PostgreSQL (server, source of truth); client keeps a per-user read cache (IndexedDB) and the offline outbox (localStorage) | Relational model fits linked data (notes ↔ entries); the server owns all data, and the offline outbox is the only client-side write state, sized for 2-3 users |
| Why not PouchDB/CouchDB | Ruled out | Document model awkward for relational links; smaller modern ecosystem |
| Why not Turso | Ruled out for now | Browser offline sync is beta with no durability guarantees |
| Editor | TipTap | Best Svelte 5 support; Suggestion system maps directly to wiki-links; markdown serialisation built-in |
| Sync approach | Custom last-write-wins | Simple, sufficient for 2-3 users, avoids CRDT complexity |
| Auth | Better Auth | First-class SvelteKit + TOTP support; avoids building auth from scratch |
| Deployment | Mac mini (OrbStack) behind the existing Cloudflare Tunnel | App and Postgres containerised on the owner's Mac mini; no VPS. Access gated by a self-managed device key (`docs/decisions.md`, 2026-11-03) |

## Note ID System

Preserves the user's existing convention:

```
CLIENT_CODE.YYYYMMDD.SEQ
```

- `CLIENT_CODE`: Short uppercase code derived from client name (e.g. "BIGCH" for Big Cheese Inc.)
- `YYYYMMDD`: Creation date
- `SEQ`: Zero-padded sequence number for that client+date (001, 002, ...)

Generated automatically by the server (`getNextNoteId`) from the client's short code and the date. IDs are not allocated offline: a note made offline has a temp ID (`offline-…`) until the outbox replays it, and its ID is dated by the day it reached the server.

**Sequence scope (decided in sprint 026-CL, UX finding 42):** the server derives `SEQ` from the
highest existing `notes.id` with the same `CLIENT_CODE.YYYYMMDD.` prefix across the whole table, not
per user. This is deliberate and stays: `notes.id` is the global primary key, so two users with the
same short code on the same day would collide if each counted from 001. Chronolog runs one account
per instance, so in production the sequence is effectively per user already; the gap seen in the
review (`INTL.20261103.020` as a new user's first note) only happens on the shared multi-user dev
database. If multi-account ever returns, the ID needs a per-user component, not a per-user counter.

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
