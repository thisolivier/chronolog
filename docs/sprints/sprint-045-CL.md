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

**Done (2026-11-04).** No new dependency, no migration, no server API change beyond one device-gate
exemption. Module: `src/lib/offline/` (readme there); `docs/SPEC.md` Offline Strategy rewritten.

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
Full Playwright: see below. Screenshots: `docs/review/screenshots/sprint-045/`
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
