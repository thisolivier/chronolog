# Offline module (sprint 045-CL)

Keeps the app usable without the server: a long-lived read cache, a write outbox that replays on
reconnect, and the service worker (`src/service-worker.ts`) that serves the app shell for an
offline reload. Nothing a user types offline is dropped or silently overwritten: a change either
reaches the server, waits in the queue, or is held until the user decides.

## How it fits together

1. **Reads.** `fetch-helpers.ts` keeps the last server copy of every GET. `read-cache-store.ts`
   persists it per user in IndexedDB (`chronolog-reads-<userId>`), loaded at start; a read that
   fails before the load finishes waits for it. Cloudflare's 502/503/504/52x count as offline.
2. **Writes.** `OfflineDataService` (the app's DataService) sends note create/edit and time entry
   create/edit/delete to the server, or queues them when the server is unreachable, when the same
   note or entry already waits, or when they link a note made offline that has no real ID yet.
   Note moves, pins, trash, attachments and timer stop/adjust are not queued (they fail offline as
   before); an offline timer start runs as a browser timer and its saved entry is queued.
3. **Queue.** One item per resource, in order of first edit (`outbox-queue.ts`), stored in
   localStorage per user, one key per item (`outbox-storage.ts`): on disk before the call returns,
   and two tabs queueing at once never overwrite each other. Items are tagged with their account.
   Temp IDs are `offline-<16 hex>`; they double as the `clientRequestId` of the create, online or
   replayed, so the server makes the row once even when an answer was lost (`POST /api/notes`,
   `POST /api/time-entries`, unique per user, migration 0011). A repeat answers 200 with the first
   attempt's row: the queued values then go as an edit of it, lists show that row once, and edits
   of it fold into the queued create.
4. **Replay** (`outbox-replay.ts`) first checks `GET /api/me`: if another account is signed in,
   nothing is sent (the banner says so). Then phase 1 creates the notes made offline (temp IDs remapped
   everywhere, wiki-links included), phase 2 sends the rest in order against the live server copy
   with per-field last-write-wins (`outbox-merge.ts`). Same field changed on the server: the item is
   **held**. A create being sent is marked `inFlight`; deleting it then queues a delete under its
   temp ID instead of dropping the create. Refused by the server: held with its message. Network failure: stop, retry later.
5. **Screen.** Reads lay the queue over the server copy (`outbox-projection.ts`), online too.
   `ConnectionStatus` shows the queued count and a Review button for held items
   (`OutboxHeldPanel.svelte`: keep mine / keep the server's / keep both); `OutboxMarker.svelte`
   tags rows "queued", "held" or "replayed" (for the session).

## Files

| File | Purpose |
|---|---|
| `outbox-types.ts` | Item shapes, temp IDs, resource keys |
| `outbox-queue.ts` | Adding and folding items, ID remapping (pure) |
| `outbox-merge.ts` | Per-field last-write-wins plans for notes and entries (pure) |
| `outbox-replay.ts` | Replay engine with injected transport (pure, unit tested) |
| `outbox-projection.ts` | Queue laid over notes, note lists and weeks (pure) |
| `outbox-resolve.ts` | Keep mine / keep the server's / retry for held items (pure) |
| `offline-reads.ts` | Weeks, note search and titles built from the read cache (pure) |
| `outbox-storage.ts` | localStorage persistence, unreadable data kept aside |
| `outbox-store.svelte.ts` | Reactive queue for the signed-in user (`outbox`) |
| `offline-session.svelte.ts` | Start per user, replay scheduling (Web Locks, one tab), sign-out clearing, `updatedAt` hand-over to open editors |
| `replay-transport.ts` | The HTTP calls of a replay; `isOfflineError` |
| `read-cache-store.ts` | IndexedDB read cache per user |
| `offline-data-service.ts` | `OfflineDataService extends FetchDataService` |
| `service-worker-updates.ts` | "A new version is available" for the service worker |
| `OutboxMarker.svelte`, `OutboxHeldPanel.svelte` | Row tag and the held-items prompt |

## Events

`chronolog:outbox-replayed` (lists and weeks reload), `chronolog:offline-id-remapped` (the open
editor and URL follow the real note ID), `chronolog:outbox-resolved` (a "keep the server's" note
reloads in the editor).

## Service worker

Registered by the root layout, never in the Tauri desktop app (`kit.serviceWorker.register` is
off). A new version keeps the kept pages and the previous version's files; `__data.json` is never
cached. Signing in as a different account than the browser's last one deletes the kept pages, the
runtime cache and the other accounts' read caches (their unsent queues stay, unsent).

## Sign-out

`clearOfflineDataForSignOut` asks before discarding this user's unsent changes, then deletes
every user's IndexedDB read cache and the service worker's kept pages. Another account's queue in
the same browser is left alone.
