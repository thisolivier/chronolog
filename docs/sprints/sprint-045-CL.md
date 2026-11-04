# Sprint 045 — CL: Offline outbox

**Status:** ready for review
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

**Done (2026-11-04).** No new dependency. After review: migration 0011 and an optional `clientId`
on two POST routes (see Review fixes). Module: `src/lib/offline/` (readme there); `docs/SPEC.md` Offline Strategy rewritten.

1. **Read cache.** `fetch-helpers.ts`' per-URL cache is persisted per user in IndexedDB
   (`chronolog-reads-<userId>`, plain IndexedDB, newest 600 copies) and loaded at start; a read
   that fails before the load finishes waits for it. Cloudflare's 502/503/504/52x now count as
   offline too (cached read, write queued). **App shell:** `src/service-worker.ts` (SvelteKit's own
   worker) precaches the build and keeps each signed-in page network-first, so a reload with no
   server loads; it never touches `/api/*`. The vite-pwa plugin now only writes the manifest: its
   generated `sw.js` could never install (its navigation fallback `/` was not precached under
   server rendering), so production had no working worker. Its update prompt is reimplemented
   (`service-worker-updates.ts`). Sign-out asks before discarding unsent changes, then deletes every
   user's read cache and the kept pages.
2. **Outbox.** Note create/edit and time entry create/edit/delete go to an ordered per-user queue
   in **localStorage** (synchronous, so a change is on disk before the editor says "Saved"; one item
   per resource, later edits folded in) when the server is unreachable, when the same note/entry
   already waits, or when they link an unsent offline note. Replay: notes made offline first
   (`offline-<hex>` temp IDs remapped in every queued item, wiki-links and descriptions included,
   and in later saves from editors still holding the temp ID), then the rest in order; network
   failure stops it; Web Locks keep it to one tab; retried every 8 s and on `online`. The open
   editor and URL follow the real ID without a reload, and an editor based on a copy the replay
   superseded carries on without a false "changed elsewhere". An edit made while its replay request
   was in flight is kept and rebased. **Timer:** an offline start runs as a browser timer and its
   saved entry is queued.
3. **Conflicts.** Each item carries the server copy it was based on; per-field (grouped: title /
   text; time / date / description / contract+deliverable+work type) last-write-wins against the
   live server copy; same field changed on the server → **held** with both versions. A server
   refusal (deleted note, 403, validation) is held with its message too.
4. **Visibility.** Banner: "N changes waiting", stays up online while items wait or are held, with
   "Review N changes that need a decision" opening the held panel (keep mine / keep the server's /
   keep both = mine as a new note; refused: try again / discard / save as new note). Rows, the note
   header and entry cards carry "queued" / "held" / "replayed" (session) markers.
5. **Offline DataService methods** (024 follow-up): `searchNotes` and `getNoteTitles` answer from
   cached lists and notes plus offline-created notes; `createNote` / `updateNote` queue; weeks are
   assembled from any cached week request.

**Cut / left.**
- Not queued (fail offline with an error, as before): note move, pin, trash/restore, attachments,
  note↔entry link panel, weekly status, timer **stop and start adjust** of a timer that already has
  a server draft, `saveTimer` of such a draft. An offline-started timer is covered (browser timer).
- A time entry moved to another date offline shows under its new date only if that week is loaded.
- Offline search is plain substring over cached titles, previews and opened notes' text.
- Playwright's WebKit cannot load any page while emulated offline (even from a service worker,
  "internal error"), so the WebKit run proves the reload with every API request refused instead
  (server down); Chromium proves the true offline reload through the service worker.
- `offline-data-service.ts` (385 lines) and `outbox-replay.ts` (312) are over the 200-line guideline.

**Tests.** `npm run check` 0/0; `npm run lint` clean; `npm test` 109 files / 1048 tests (offline: 4
new files, 27 tests for ordering, folding, ID remap, per-field merge, hold, in-flight rebase,
projection, cached answers, resolution; read cache +4); API e2e 21 files / 126 passed; Playwright
`offline-outbox.spec.ts` 4 tests × chromium + webkit green (edit + entry offline, banner count,
reload with no server, replay + markers; note conflict from a second context held, Keep mine; note
created offline gets its real ID and keeps saving; entry conflict held, Keep the server's).
Full Playwright (chromium + webkit, dev server on 5223): 154 passed, 5 skipped, 2 flaky (passed on retry: `notes-autosave` "switch to Time Entries" and `notes-conflict`, both under full-suite load; 5 repeats of each alone were 21/21 green). Screenshots: `docs/review/screenshots/sprint-045/`
(`offline-banner-queued.png`, `replayed-marker.png`, `held-item-prompt.png`).

Playwright now blocks service workers by default (`playwright.config.ts`): routing does not see
requests a worker answers, and in WebKit a worker plus `page.route` failed requests in
`work-type-consistency.spec.ts`. Vite's watcher ignores `e2e-playwright/`, `playwright-report/`
and `test-results/` (a report write was reloading pages under test).

**Risks for production users.**
- First load after deploy: browsers have no persisted cache yet (it was in memory only), so
  offline use starts after one online visit. The new worker registers at `/service-worker.js`;
  any browser holding a registration of the old `/sw.js` gets it replaced (same scope), and legacy
  workbox caches are deleted on activate. `/service-worker.js` is exempt from the device gate.
- Kept pages and the IndexedDB cache hold decrypted note text and the user's name/email on the
  device until sign-out (decided: no at-rest encryption in the browser). An expired session does
  not clear them; an online navigation goes to `/login` as before.
- A note created offline is dated by the day it reached the server (`CLIENT.YYYYMMDD.SEQ`).
- A keepalive save fired at tab close while the browser still believed it was online, but was not,
  can still be lost (the request dies with the page); while the app knows it is offline, saves go
  straight to the queue.
- localStorage full (~5 MB): the save fails visibly ("could not be kept on this device"), not
  silently. Private-mode browsers that refuse storage keep the queue for the page session only.
- The replay compares and writes time entries in two requests (no server-side check), so an edit
  landing between them is overwritten; notes use `expectedUpdatedAt` and retry.


### Review fixes (2026-11-04)

1. **Duplicate creates (HIGH).** Migration `0011_idempotent_client_ids`: nullable `client_id` on
   `notes` and `time_entries`, unique `(user_id, client_id) where client_id is not null`.
   `POST /api/notes` and `POST /api/time-entries` take an optional `clientId`; a repeat answers 200
   with the first row, same shape (notes check under the ID-allocation advisory lock; entries
   catch the unique violation). The browser uses one temp ID for the online try and, if that
   fails, the queued create, so a lost answer, a 524 or a tab closing mid-replay never makes a
   second note or entry. 524 stays "retry": with idempotent creates and compare-before-write
   edits, a retry of an unknown outcome is safe. CLI unaffected (no `clientId`, every POST creates).
   Batch routes not changed (the outbox does not use them).
2. **Delete during an in-flight create.** Replay marks a create `inFlight` while its POST is out;
   deleting it then queues an `entry-delete` under the temp ID (remapped on success, blocked until
   the create is done) instead of dropping the create. Note creates fold edits into the item and
   note deletes are not queued, so notes need nothing more.
3. **Service worker after a deploy.** Activate no longer deletes the kept pages; it keeps the
   previous version's shell (older ones go), and `/_app/immutable/*` is served from any cache, so
   the first cold start offline after a deploy loads the old page with its old files.
4. **Two tabs.** The queue is stored one key per item; a change writes only the keys it changed
   and removes only the items it removed, so another tab's items are never overwritten. **Not**
   Web Locks around `update()`: those are asynchronous, and a save queued during `pagehide` (tab
   close) would not reach the disk; the synchronous write is what keeps the last keystrokes.
   Residual: two tabs changing the *same* item at the same instant, last write wins on that item
   (its revision then makes a running replay keep and rebase it); replay re-applies known ID
   mappings before it starts.
5. **Accounts.** (a) `+layout.server.ts` returns only `user { id, name, email }` (no session or
   token); the worker never caches `__data.json`; sign-out also deletes `chronolog-runtime`.
   (b) Items carry `ownerUserId`; replay first asks `GET /api/me` and sends nothing while another
   account is signed in (banner: "Another account is signed in…"; the queue stays as it is rather
   than being held item by item, so it goes out unchanged once its owner signs in). Signing in as
   a different account than the browser's last one deletes the kept pages, the runtime cache and
   the other accounts' read caches; their queues stay under their own keys, unsent.
   (c) `startOfflineSession` stops the previous user's session first.
6. **Tauri.** `kit.serviceWorker.register: false`; the root layout registers the worker outside
   Tauri only. The desktop app loads from the network, so offline reload there is not needed; the
   outbox and read cache still work in an open desktop window.
7. **Unreadable queue.** An unreadable item is copied to `chronolog-outbox-unreadable:…`; if that
   copy does not fit, reading throws `OutboxFullError` and no write happens, so nothing replaces it.

**Tests after the fixes.** `npm run check` 0/0, lint clean, `npm test` 1055 passed (new: idempotent
replay after a lost answer, delete during an in-flight create, other account signed in, two tabs
writing from stale reads, unreadable item kept / refused when full, owner tagging); API e2e 22
files / 129 passed (new `idempotent-creates.e2e.test.ts`: a repeat returns the same note / entry
and no second row; without `clientId` two POSTs make two entries; a malformed `clientId` is 400);
full Playwright 156 passed, 5 skipped, 0 flaky. Production build checked (no kit-injected
registration).

**The two earlier flakes on `main`.** `notes-autosave` + `notes-conflict` with
`--repeat-each=10` (chromium, alone): `main` 41/41, this branch 41/41. Full suite on `main`: 148
passed, no flakes; on this branch after the fixes: 156 passed, no flakes. So no evidence the branch
causes them; they flaked once, under full-suite load, and did not reproduce.

**Deploy note.** Migration 0011 must run before the new app serves (`drizzle-kit migrate`); it
was applied to the shared dev database.
