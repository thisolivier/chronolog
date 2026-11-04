# Sprint 045 — CL: Offline outbox

**Status:** planned (last in the backlog run; after 043–044 merge)
**Branch:** `sprint-045-CL/offline-outbox` · **Worktree:** `.claude/worktrees/sprint-045-CL` · **Port:** 5223
**Sources:** `docs/backlog.md` Next #2 and `docs/decisions.md` (Offline): long-lived read cache plus write outbox, last-write-wins per field, a visible "replayed" marker, and a held queue with a prompt when the server copy changed meanwhile. Also the 024 follow-up: the offline backend must implement `searchNotes`, `getNoteTitles`, `createNote`, `updateNote`.

## Tasks

1. **Read cache.** The existing write-through read cache becomes long-lived (IndexedDB), keyed per user, so a reload while offline shows the last-known notes, note list, sidebar and the weeks already visited. Signing out clears it. Encrypted-at-rest is not required in the browser (decided), but nothing cached outlives sign-out.
2. **Outbox.** Offline writes (note create/edit, time entry create/edit/delete, timer start/stop/adjust) go to an ordered outbox in IndexedDB and apply optimistically to the cache. When the server is reachable again the outbox replays in order. Temporary ids for offline-created notes/entries are remapped on replay, including wiki-links written meanwhile.
3. **Conflicts.** Each queued edit carries the `updatedAt` it was based on. Last-write-wins per field when the server copy did not change that field; when the server changed the same field meanwhile, the item is **held** and a prompt shows both versions (keep mine / keep server / for notes, open both). Nothing is dropped silently.
4. **Visibility.** The offline banner shows the queued count; replayed items get a small "replayed" marker for the session; held items are listed in a panel reachable from the banner.
5. **Offline DataService methods** from the 024 follow-up.
6. **Tests.** Unit for the outbox (ordering, id remap, per-field merge, hold). Playwright with network offline (`context.setOffline`): edit a note, add an entry, reload offline (still there), go online, replay, markers shown; a conflict made from a second context is held and the prompt resolves it (chromium and webkit).

## Verification

Screenshots: offline banner with queued count, replayed marker, held-item prompt. Sign-off with what was done, what was left, test counts.

## Sign-off

(pending)
