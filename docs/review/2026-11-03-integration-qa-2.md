# Integration QA after 024/025/026-CL (2026-11-03)

Merged `main` (024-CL notes/editor, 025-CL timesheet/forms, 026-CL admin/shell/safety, on top of 023)
driven end to end through the real UI with `e2e-playwright/manual-checklist/qa-driver.mjs`, after
bringing the driver up to date with the current DOM and flows. Method as in
`2026-11-03-integration-qa.md`.

## Run summary

| | Before (driver as merged) | After (updated driver, run 5) |
|---|---|---|
| Result | 39 pass / 21 fail (60 steps) | **63 pass / 2 fail** (65 steps) |
| Real bugs among FAILs | not separable (two early failures cascaded into 19 more) | **2** (R1, R2), both at the 026 offline / 024 notes seam |
| Page errors | 0 | 0 |
| Console errors | 0 | 12: 3 `Failed to fetch` from loads the driver cancels at `AUTH-login-redirect`, 9 from the driver's simulated outage (8 `ERR_INTERNET_DISCONNECTED` / autosave failure, 1 `409`, the consequence of R2) |
| Failed requests | 27 (all `net::ERR_ABORTED` Vite module loads) | 38: 30 `ERR_ABORTED` navigation cancels, 7 simulated outage, **1 HTTP 409** (R2). No other 4xx/5xx. See "Failed requests explained" |

- Environment: `main` at `7512130`, dev server
  `ALLOW_REGISTRATION=true BETTER_AUTH_URL=http://localhost:5196 npm run dev -- --port 5196` from the
  main checkout, shared Postgres on 5432, headless Chromium 1440x900 plus 375x812 (two passes) and
  900x800 contexts. Sprint 027-CL was running in its worktree on 5204; the dev log shows no
  `changed tsconfig` reloads and no `too many clients` (026's `vite.config.ts` and `globalThis` fixes hold).
- Five runs of the updated driver: runs 1-2 = 63/1 (before the offline banner step existed), runs 3-5 =
  63/2 with identical step results. QA users `qa-int2-*@chronolog.test` left in the dev DB
  (run 5: `qa-int2-mw16ik4q@chronolog.test`, notes `INTL.20261103.142` / `.143`).
- Logs, JSON and screenshots (not committed):
  `/private/tmp/claude-501/-Users-olivier-sites-chronolog/149f7782-2562-48b2-9904-8fe2b200ea3d/scratchpad/integration-qa-2/`
  (`run5/driver.log`, `run5/qa-results.json`, `run5/shots/`; `dev.log` for the server).

## Why the merged driver failed 21 steps

Two DOM changes cascaded:

- **`E1-create-note — unexpected note id New note`**: 024 task 7 made New Note a draft. The header
  reads "New note" until the first keystroke creates the note. The driver read the ID before typing, so
  `noteAId` was the string "New note". Every later step that waits for `PUT /api/notes/<id>`, compares IDs,
  or types `[[<id>` (editor autosave, raw toggle, B's link to A, backlinks, card link, move, linked entries)
  failed from it.
- **`A10-sidebar-color-dots — fewer than 2 contracts`**: 026 task 4 moved the colour dot from each contract
  button to the client heading, so `button:has(span.rounded-full.h-2)` matched nothing and `sidebarDots`
  stayed empty. `A4-card-hierarchy-and-colours` (`sidebar=undefined`) and `E1-edit-time-entry-contract`
  (`reading 'match'` of undefined) followed.

The rest were selector drift from intended changes:
- Card links now show the note title with the ID as `title`, not "Go to note <id>".
- "Linked from" shows titles, not `button.font-mono`.
- PDF export prints a hidden iframe, so `window.print` on the app window is never called.
- A moved note stays open, and the list follows it to the destination.
- Note delete uses an inline confirm, not `confirm()`.

None of the 21 was a product bug.

## Integration seams (what the sprints could not test in isolation)

| Seam | Result | Evidence |
|---|---|---|
| 026 grouped sidebar vs note counts and colour dots | **Works.** Contracts sit under "Acme Corp" (sky) and "Internal" (rose) headings, and the colours are distinct. Card border, card dot and timer segment use the client colour from the sidebar heading. The note count badge follows create (0→1→2), move (General 1, Rocket Build 1) and delete (General 1→0) within the 150 ms debounce | `A10-sidebar-color-dots`, `E1-create-note`, `E1-wiki-link-editor-autocomplete`, `C1-move-note`, `E1-delete-note`, `A4-card-hierarchy-and-colours`; shot `03b-sidebar-grouped.png` |
| 024 title rendering inside 025 cards | **Works.** The card shows `[[A]]` as "Alpha note heading" with the ID as tooltip, and no raw `[[`. Clicking it opens A in notes mode, also after A moved contract. Linked Time Entries on A shows "Build the rocket engine see Alpha note heading" (the earlier R4 is fixed) | `A4-wiki-link-rendering-in-card`, `A4-card-wiki-link-click-opens-note`, `C2-card-wiki-link-after-move`, `C2-linked-time-entries-on-note`; shots `14`, `14b`, `15` |
| 024 editor links and backlinks | **Works.** The editor chip shows A's title and keeps `data-note-id`. An empty `[[` lists A and never the current note B. "Linked from" shows B's title. Exact ID + Enter now links the right note in both the editor and the card description (the earlier R2 is fixed by 024's ranking) | `E1-wiki-link-editor-autocomplete`, `E1-backlinks-displayed`, `A4-wiki-link-autocomplete-in-description` |
| 026 confirm dialogs vs 024 note delete | **Works, and the two are consistent in intent.** Note delete is 024's inline "Delete this note? Delete / Cancel" in the editor header, with no native dialog. The admin client delete opens 026's dialog: "It has 1 contract and 1 note." matches the sidebar count for the note that 024 moved into Rocket Build. Archive has focus and Cancel deletes nothing. The two look different (inline for one note, modal with counts for a hierarchy), which is reasonable | `E1-delete-note`, `SEAM-admin-delete-dialog-counts`; shots `17b`, `30` |
| 025 DurationField inside the timer completion form | **Works.** The measured "1m" was replaced with `0.75`, the preview reads "= 45m", and the saved card shows 45m with deliverable "Phase 1" without a reload | `E1-timer-stop-save`; shot `23-timer-completion.png` |
| 026 offline read cache vs 024 note saves | **Broken: R2.** A note opened while the server is unreachable shows the copy last *read*, not the copy last *saved*. Typing into it then ends in a 409 on reconnect | `SEAM-offline-read-cache-after-note-save`; shots `28`, `29` |
| 026 offline banner when the server is unreachable | **Broken: R1.** It shows "Back online" instead of "Offline" (the browser-offline path works) | `SEAM-offline-banner-on-request-failure`; shot `27b-offline-banner.png` |
| 025 phone footer, 026 breakpoints | **Works.** At 375px, Start Timer and Add Entry sit in the footer (y=745 of 812) and the Add Entry modal fits. At 900px the notes mode hides the sidebar, ≡ opens a 240px overlay, and picking a contract closes it, with no overflow. At 1440px the 3-panel layout and the 375px top bar and strip still pass | `M2-mobile-footer-actions`, `T1-tablet-notes-sidebar-overlay`, `M1-mobile-topbar-and-timesheet`; shots `31`, `32`, `27` |
| 026 login robustness | **Works.** A click before hydration no longer submits natively (the earlier R1 is fixed) | `AUTH-native-submit-race` |

## All steps (run 5)

"Before" is the run on merged main (`smoke-main2/driver.log`); "new" = step added in this pass.

| # | Step | Before | After | Notes / classification |
|---|---|---|---|---|
| 1 | `AUTH-redirect-unauthenticated` | PASS | PASS |  |
| 2 | `AUTH-register` | PASS | PASS |  |
| 3 | `AUTH-login-page-when-authenticated` | PASS | PASS |  |
| 4 | `AUTH-login-redirect` | PASS | PASS |  |
| 5 | `AUTH-native-submit-race` | PASS | PASS | previous report's R1, fixed by 026 task 7 |
| 6 | `A1-palette-stone` | PASS | PASS |  |
| 7 | `A1-interactive-blue-600` | PASS | PASS |  |
| 8 | `A2-time-mode-two-panels` | PASS | PASS |  |
| 9 | `A3-weekstrip-present` | PASS | PASS |  |
| 10 | `A3-today-column-amber` | PASS | PASS |  |
| 11 | `A6-today-badge-and-bg` | PASS | PASS |  |
| 12 | `A6-autoscroll-to-today` | PASS | PASS |  |
| 13 | `A8-empty-state` | PASS | PASS |  |
| 14 | `A2-sidebar-collapse-expand` | PASS | PASS |  |
| 15 | `E1-admin-create-client` | PASS | PASS |  |
| 16 | `E1-admin-create-contract` | PASS | PASS |  |
| 17 | `E1-admin-create-deliverable` | PASS | PASS |  |
| 18 | `A10-sidebar-color-dots` | FAIL | PASS | driver: reads `[data-testid=sidebar-client-group]` headings; asserts distinct client colours and Rocket Build under Acme Corp |
| 19 | `E1-create-note` | FAIL | PASS | driver: asserts the draft ("New note", Discard, no `POST /api/notes` for 1.5 s), types, waits for the POST and the real ID, checks the sidebar count +1 |
| 20 | `A2-notes-mode-three-panels` | PASS | PASS |  |
| 21 | `E1-edit-note-tiptap-autosave` | FAIL | PASS | cascade of 19 |
| 22 | `E1-raw-rendered-toggle` | FAIL | PASS | cascade of 19 |
| 23 | `E1-export-markdown` | PASS | PASS |  |
| 24 | `E1-export-pdf-print` | FAIL | PASS | driver: stubs `print()` on `iframe[data-note-print-frame]`; asserts the frame holds the note and ID, and the app window is not printed |
| 25 | `E1-wiki-link-editor-autocomplete` | FAIL | PASS | cascade of 19; now also asserts the chip shows A's title, an empty `[[` excludes the current note, and the count +1 |
| 26 | `E1-backlinks-displayed` | FAIL | PASS | driver: `[data-testid=note-backlinks] button[title=<id>]`; asserts the chip shows B's title |
| 27 | `E1-wiki-link-click-navigates` | FAIL | PASS | cascade of 19 |
| 28 | `A5-new-entry-row-layout` | PASS | PASS |  |
| 29 | `A5-border-updates-on-contract-select` | PASS | PASS |  |
| 30 | `A5-new-entry-row-deliverable` | PASS | PASS |  |
| 31 | `E1-create-time-entry-manual` | PASS | PASS |  |
| 32 | `A4-card-hierarchy-and-colours` | FAIL | PASS | cascade of 18 |
| 33 | `A3-weekstrip-day-total-and-bar` | PASS | PASS |  |
| 34 | `E1-edit-time-entry-time` | PASS | PASS |  |
| 35 | `E1-edit-time-entry-contract` | FAIL | PASS | cascade of 18 |
| 36 | `A4-wiki-link-autocomplete-in-description` | FAIL | PASS | cascade of 19; previous report's R2 is fixed (024 ranking) |
| 37 | `A4-wiki-link-rendering-in-card` | FAIL | PASS | driver: asserts the link reads A's title with the ID as tooltip, and no raw `[[` remains |
| 38 | `A4-card-wiki-link-click-opens-note` | FAIL | PASS | driver: `.wiki-link-rendered button[title=<id>]` |
| 39 | `C2-linked-time-entries-on-note` | FAIL | PASS | cascade of 19; previous R4 is fixed (titles rendered) |
| 40 | `C1-move-menu-visible-and-excludes-current` | PASS | PASS |  |
| 41 | `C1-move-note` | FAIL | PASS | driver: the note stays open and the sidebar and list follow it to Rocket Build (024 B-02); asserts counts General 1 and Rocket Build 1 |
| 42 | `C1-note-appears-in-target` | FAIL | PASS | driver: asserts the note is gone from General, then listed under Rocket Build with the same ID |
| 43 | `C2-backlinks-after-move` | FAIL | PASS | cascade |
| 44 | `C2-linked-entries-after-move` | FAIL | PASS | cascade |
| 45 | `C2-wiki-link-from-B-after-move` | FAIL | PASS | cascade; previous R3 fixed (`openNote` everywhere) |
| 46 | `C2-card-wiki-link-after-move` | FAIL | PASS | cascade |
| 47 | `A7-status-menu` | PASS | PASS |  |
| 48 | `A7-status-persists-after-reload` | PASS | PASS |  |
| 49 | `A3-prev-next-week` | PASS | PASS |  |
| 50 | `A3-next-week-beyond-today` | PASS | PASS |  |
| 51 | `A3-click-day-scrolls` | PASS | PASS |  |
| 52 | `A3-sticky-strip` | PASS | PASS |  |
| 53 | `A9-timer-indicator` | PASS | PASS |  |
| 54 | `E1-timer-stop-save` | PASS | PASS | now adjusts the duration in the completion form (`0.75` → "= 45m") and asserts 45m on the card |
| 55 | `A4-deliverable-shown-on-card` | PASS | PASS |  |
| 56 | `E1-add-entry-modal-deliverable-selector` | PASS | PASS |  |
| 57 | `E1-delete-time-entry` | PASS | PASS |  |
| 58 | `SEAM-offline-banner-on-request-failure` | new | **FAIL** | **REAL BUG** (R1) |
| 59 | `SEAM-offline-read-cache-after-note-save` | new | **FAIL** | **REAL BUG** (R2) |
| 60 | `E1-delete-note` | FAIL | PASS | driver: inline `[data-testid=delete-confirm]`; asserts no native dialog and the count −1 |
| 61 | `A2-no-layout-shift-switching-modes` | PASS | PASS |  |
| 62 | `SEAM-admin-delete-dialog-counts` | new | PASS | new step: reached through sidebar Settings → Clients and contracts |
| 63 | `M1-mobile-topbar-and-timesheet` | PASS | PASS |  |
| 64 | `M2-mobile-footer-actions` | new | PASS | new step (375px) |
| 65 | `T1-tablet-notes-sidebar-overlay` | new | PASS | new step (900px) |

## Remaining FAILs

| Step | Classification | Reason |
|---|---|---|
| `SEAM-offline-banner-on-request-failure` | **REAL BUG** (R1) | After a network-level API failure, the banner shows "Back online. Reload anything that failed to save." at once and never "Offline…". The `ConnectionStatus` effect re-runs on the failure and resets it |
| `SEAM-offline-read-cache-after-note-save` | **REAL BUG** (R2) | The read cache returns the last GET of `/api/notes/<id>`, which predates the last successful PUT. The stale note is shown as "Saved", and editing it ends in a 409 on reconnect |

Neither is a driver limitation. R2 reproduced in all five runs and R1 in every run that had its step (3-5). The outage is simulated with
`page.route('**/api/**', abort)`, which is what a stopped server or dropped Wi-Fi looks like to `fetch`
while `navigator.onLine` stays true. The browser-offline path (`context.setOffline(true)`) does show the
offline banner (checked separately).

## Real bugs, ranked

### R1 (medium): Offline banner says "Back online" when the server is unreachable

026 task 2 defines offline as `navigator.onLine === false` **or** the last API request failed at the
network level. The second half never shows. In `src/lib/components/layout/ConnectionStatus.svelte`,
`$effect(() => trackBrowserConnectivity())` runs `connectivity.setBrowserOnline(navigator.onLine)`
synchronously. `setBrowserOnline` reads `this.isOffline`, so the effect subscribes to `serverUnreachable`.
When `fetch-helpers` calls `reportNetworkFailure()`, the effect re-runs and calls `setBrowserOnline(true)`,
which clears `serverUnreachable` and sets `recentlyReconnected`. The store unit tests pass because they
never mount the component.

Effect at the seam: in notes mode the "Offline, changes not saved" warning, 026's protection for 024's
editor, never appears when the server goes away. The user sees "Back online" while their edits fail
(the header says "Couldn't save — retrying").

Repro:
1. Sign in at 1440px and open a contract in notes mode.
2. Stop the dev server, or block `/api/*` in DevTools (Network → Request blocking). Do not toggle the
   browser offline.
3. Click another contract in the sidebar. The green "Back online. Reload anything that failed to save."
   banner appears and stays, and no amber "Offline…" banner is shown (shot `27b-offline-banner.png`).

Likely fix: `src/lib/components/layout/ConnectionStatus.svelte`, run the subscription untracked
(`$effect(() => untrack(trackBrowserConnectivity))`) or in `onMount`. Also add a component-level test.

### R2 (medium): Offline read cache serves a note older than its last save; editing it ends in a 409 and the offline typing is lost

`src/lib/services/fetch-helpers.ts` keeps `lastLoadedResponses` per GET URL and returns it when `fetch`
rejects. Successful writes (`putJson` to `/api/notes/<id>`, and also POST and DELETE) never update or evict
the cached GET of the same resource. 024's autosave writes with PUT, and the editor only re-reads on open.

Repro (driver step 59; shots `28-offline-note-open.png`, `29-after-reconnect.png`):
1. Open note B, so `GET /api/notes/B` is cached. Type " saved-online-…" and wait for "Saved"
   (`PUT` 200).
2. Open another note, A.
3. Make the server unreachable (as in R1).
4. Open B again. The editor shows B **without** the text saved in step 1, and the header says "Saved".
   There is no offline banner, because of R1.
5. Type " typed-offline". The header shows "Couldn't save — retrying".
6. Restore the server. The retry sends `expectedUpdatedAt` from the stale copy and gets **409**, so the
   header shows "This note changed elsewhere, reload to see it". After Reload the server copy has the
   step-1 text, but the offline typing is gone.

No silent overwrite happens: 024's conflict check catches it. But the user is shown stale content
labelled "Saved", and anything typed in it is discarded. The same staleness applies to cached note
lists (previews and titles) and to any other resource written after it was last read.

Likely fix: in `fetchJson`, after any successful non-GET, evict cached entries for that URL and the
collection prefixes it affects. For a note PUT, store the returned note as the GET body. Alternatively,
exclude `/api/notes/<id>` from the read cache, since 026 says note edits are not offline-capable anyway.
Add a case to `src/lib/services/offline-read-cache.test.ts`.

### Observations (passing steps, low)

- **O1: A note title drops wiki-link text.** B's first line is "Beta note links to [[A]]". Its title in
  the list, in "Linked from" and in the export filename is "Beta note links to", with the link silently
  missing. The title derivation from `contentJson` skips the `wikiLink` atom nodes (likely
  `src/lib/utils/note-display-title.ts` and the title computed on save). Using the cached title or the ID
  for the atom would fix it.
- **O2: A reload drops the notes selection.** After a reload the app opens in Time Entries
  (`E1-edit-note-tiptap-autosave`). This is expected to change with 027-CL (navigation/URLs). Not a bug
  in these sprints.

## Failed requests explained

Every entry in `qa-results.json` now carries the step that was running. Run 5 had 38:

| Count | Step | What | Verdict |
|---|---|---|---|
| 23 | `AUTH-register` | `GET` Vite modules (`@vite/client`, kit runtime, `.svelte-kit/generated/*`) `net::ERR_ABORTED` | The register page does `goto('/login')`, and `/login`'s server load deliberately answers with a full-reload redirect to `/` (`src/routes/login/+page.server.ts`). The `/login` document's module loads are cancelled by that second navigation. By design, not an error |
| 7 | `AUTH-login-redirect` | `GET /api/time-entries/weekly…`, `/api/contracts`, `/api/contracts-by-client`, `/api/timer/status`, `/api/clients`, `pwa-register` `ERR_ABORTED` | The driver clears cookies and calls `page.goto('/login')` while `/` is still loading. Produces the 3 `Failed to fetch` console errors. Driver-induced |
| 7 | `SEAM-offline-*` | `GET /api/notes…` and `PUT /api/notes/<B>` `net::ERR_INTERNET_DISCONNECTED` | The driver's simulated outage |
| 1 | `SEAM-offline-read-cache-after-note-save` | `PUT /api/notes/<B>` → **409** | Consequence of R2 (stale `expectedUpdatedAt`) |

The **27 failed requests on the merged-main run** (port 5199) were all `GET` `net::ERR_ABORTED` for the
lazily imported note editor graph: `@tiptap_*`, `lowlight`, `SuggestionDropdown.ts`, `markdown-text.ts`,
`anchored-heading.ts`, `SaveStatusIndicator.svelte`, `NoteEditor.svelte?…lang.css`, and shared chunks.
The set appears twice (about 13 each). These are in-flight dynamic imports cancelled when the driver
navigated (`page.reload()` / `page.goto()`) in two separate document lifetimes, while the cascading notes
steps were timing out. That log is not step-tagged, so the exact steps cannot be named. None were HTTP
errors, and none reached the server. Whether they appear depends on timing: run 1 of this pass (also
untagged) had one such set plus 5 aborted API GETs, and the tagged runs 2-5 had none.

No request in any run returned 5xx. The only 4xx is the 409 above.

## Environment findings

- The previous report's E1 (Postgres pool leak) and E2 (Vite watching `.claude/worktrees`) are fixed by
  026 task 9. The dev log for this session shows no `changed tsconfig` and no `too many clients`, although
  027-CL was active in its worktree.

## Driver changes (`e2e-playwright/manual-checklist/` only)

- `QA_USER_PREFIX` env var (this review: `qa-int2`). Console errors, page errors and failed requests are
  prefixed with the running step.
- Sidebar: `[data-testid=app-sidebar]` panel, client groups, the per-client colour map, and
  `sidebarNoteCount` / `expectNoteCount` (asserted after create, second create, move and delete).
- Notes:
  - New Note draft flow with `waitForSavedNoteId()`; `currentNoteId()` reads the editor header.
  - The print-frame stub.
  - Title assertions for editor chips, card links and backlinks; the self-suggestion check.
  - Move asserts that the sidebar and list follow the note.
  - Inline delete confirm with a native-dialog guard.
- Timer completion adjusts the duration through the DurationField and checks the preview and the card.
- New steps: `SEAM-offline-banner-on-request-failure`, `SEAM-offline-read-cache-after-note-save`,
  `SEAM-admin-delete-dialog-counts` (DOM navigation through Settings, no admin URL),
  `M2-mobile-footer-actions` and `T1-tablet-notes-sidebar-overlay`.
- The README covers the 024/025/026 flows, the offline simulation, the expected `ERR_ABORTED` noise,
  and refreshed known limitations (025 follow-up).
