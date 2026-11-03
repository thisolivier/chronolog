# Chronolog - Project Specification

## Overview

Chronolog is a time-tracking and note-taking app for consulting work, delivered as a **Tauri 2.0 desktop application** (macOS primary) with a **PWA fallback for mobile**. It supports 2-3 users managing time entries and markdown notes across 3-5 active client contracts, with an online-first design (a read cache keeps the last loaded data visible when the server is unreachable, and an offline banner says so), encryption at rest, and TOTP-based 2FA.

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
- **Desktop (Tauri)**: Built with `cargo tauri build`, distributed as macOS `.app` bundle / `.dmg` installer. Auto-updates via `tauri-plugin-updater`.
- **Server / PWA**: **Coolify** on a **Hetzner** CX22 VPS (~EUR 4-6/mo)
  - Automatic HTTPS via Let's Encrypt
  - Built-in scheduled PostgreSQL backups to S3-compatible storage
  - Git-push deploys
- **Alternative server**: Docker Compose + Caddy on any VPS

### Offline Strategy

The app is **online-first**. The server (SvelteKit API routes over PostgreSQL) is the source of truth, and every write goes straight to it. There is no local database and no service-worker data queue.

- **Read cache**: the client keeps the last successful GET response per URL in memory (`src/lib/services/fetch-helpers.ts`). When a read fails because the server is unreachable, the cached copy is returned. The cache lives for the current page session only and is lost on reload.
- **Write-through**: writes are never cached or queued. A successful write updates or evicts the cached reads of the resource it changed, so an offline read never shows a copy older than the last save.
- **Offline banner**: each request reports its outcome to the connectivity store. The banner shows when the server is unreachable, and reads served from the cache say so rather than showing an empty state.
- **Session expiry**: a 401 or a redirect to `/login` raises a session-expired error and sends the user to log in again.
- **Planned: offline outbox** (`docs/decisions.md`). A later sprint adds a persistent write outbox with last-write-wins per field, a visible "replayed" marker, and a held queue with a prompt when the server copy changed meanwhile. Until it exists, a write made while the server is unreachable fails with an error and is not saved.

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
| DB architecture | PostgreSQL (server, source of truth); client keeps an in-memory read cache only | Relational model fits linked data (notes ↔ entries); the server owns all data, and the planned offline outbox is the only client-side write state, sized for 2-3 users |
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

Generated automatically by the server (`getNextNoteId`) from the client's short code and the date. Note creation needs the server, so IDs are not allocated offline; the planned offline outbox must handle this.

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
