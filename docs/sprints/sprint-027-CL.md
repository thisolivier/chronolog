# Sprint 027 — CL: Navigation state, URLs and context

**Status:** signed-off 2026-11-03 (branch not merged)
**Branch:** `sprint-027-CL/navigation-state` · **Worktree:** `.claude/worktrees/sprint-027-CL` · **Port:** 5204
**Sources:** `docs/review/2026-11-03-ux-journeys.md` (findings, journey log, and the "what the sidebar means" target rules), `docs/ux/09-navigation-state.md`.

## Objective

The app has one URL (`/`) and all state in memory, so reload, bookmarks and Back lose your place, and
panels never say where you are. After this sprint every screen state has a URL, Back works on desktop,
PWA and Android, and every panel names its client and contract.

## Tasks

1. **Adopt the journey report's target sidebar/state rules** as the spec; copy them into
   `docs/ux/09-navigation-state.md` and make the store enforce them.
2. **URL = state.** Routes such as `/time/2026-W45`, `/notes/<contractId>`, `/notes/<contractId>/<noteId>`,
   `/admin/...`; the navigation store reads from and writes to the URL via SvelteKit navigation (shallow
   routing for in-app moves, real history entries for mode/contract/note changes). Reload returns to the
   same screen; bookmarks work; browser Back and the mobile Back button walk the real history and never
   leave the app from inside it.
3. **Scroll restoration** on return to the timesheet (same week, same day in view).
4. **One `openNote()` for every path** (card links, editor links, "Linked from", search results, list
   clicks): sidebar, list and editor always agree. Views follow moved and saved items (moving a note keeps it
   open under its new contract; saving a timer entry shows that day).
5. **Context labels.** Each panel header shows client / contract (and week in time mode), visible with the
   sidebar collapsed and on phone.
6. **Actions use the current context.** New Contract preselects the viewed client; Add Entry and Start Timer
   preselect the viewed contract and week; nothing silently picks a different one.
7. **Mobile Back** from a note opened from the timesheet returns to the timesheet; the note list never
   shows a live Delete for a note that is not in the visible list.
8. **Tests:** navigation store unit tests for each rule; Playwright journeys 1, 2, 7, 8 and 10 from the
   journey report as regression tests under `e2e-playwright/`.

## Boundaries
Runs alone after 024–026 merge; may touch the store, routes, AppShell, sidebar, panels and list headers.
Keep API shapes unchanged.

## Verification
check 0 errors, tests green, lint clean; the ten journeys from the report re-run with screenshots in
`docs/review/screenshots/sprint-027/`; reload at every URL returns to the same place.

## Sign-off

**Status:** signed-off 2026-11-03 on branch `sprint-027-CL/navigation-state` (from `main` at 7512130, after
the 024–026 merges). Not merged. Dev server on port 5204; QA users `qa-027-mw16cc7s@chronolog.test`
(journeys) and the Playwright/driver users they register are left in the dev DB.

### URL scheme shipped

| URL | Screen |
|-----|--------|
| `/` | Phone: sidebar (level 0). Tablet/desktop: this week's timesheet |
| `/time/2026-W45` | Timesheet for that ISO week (`/time` = this week) |
| `/notes/<contractId>` | The contract's note list |
| `/notes/<contractId>/<noteId>` | A note under its contract |
| `/notes/<contractId>/new` | A new-note draft |

Invalid weeks, malformed contract IDs and bare `/notes` are 404s (`src/params/isoweek.ts`, `uuid`).
Login, register, unlock and the device-key gate are untouched. The workspace URLs share
`src/routes/(workspace)/+layout.svelte`, so moving between them never remounts a panel.

### Per task

| # | Task | Result | What changed |
|---|------|--------|--------------|
| 1 | Adopt the target rules | **Done** | `docs/ux/09-navigation-state.md` now holds the nine target rules, the URL scheme, and how the store enforces and tests each one. |
| 2 | URL = state | **Done** | `navigation.svelte.ts` reads the URL at creation and after every navigation (`afterNavigate` → `syncFromUrl`), and writes every user action with `goto`. Mode, contract and note changes push; week changes in the timesheet, closing or deleting a note, a draft becoming its note, and wrong-contract corrections replace. Several actions in one tick are one navigation. The phone level is derived from the route. Phone Back walks real history through an in-app history mirror (`navigation-history.ts`, sessionStorage) and goes one level up when there is nothing in the app behind it. A fresh deep link gets `/` put under it, so browser/Android Back goes into the app. "Back to app" on settings/admin returns to the last workspace place, even after a full page load there. The collapsed sidebar is a localStorage preference. The component API is unchanged (additions only). |
| 3 | Scroll restoration | **Done** | Each week remembers the top day and the offset into it (sessionStorage). Back, Time Entries and reload put the list there; otherwise it opens on today or the top. J2: saved 220 → restored 220. |
| 4 | One `openNote()`; views follow | **Done** | Every note-opening path already went through `openNote` (024). It is now also enforced from the URL: a note opened under the wrong contract is corrected in place. Move keeps the note open under its new contract, now at its new URL. Timer saves, Add Entry saves and linked-entry dates open the entry's week, scrolled to the day with a 2.5 s highlight (`showTimeEntryDay`); Back returns to the note. |
| 5 | Context labels | **Done** | The list header shows client and contract on its own row. The editor header shows "Client / Contract" before the ID. The phone top bar shows "← Week 44 / ← Rocket Build / ← Chronolog" plus the current place. The sidebar highlights the selected contract's client heading, and nothing on the phone home (closes 025 follow-up [44]). Visible with the sidebar collapsed (`t5-02`). |
| 6 | Actions use the current context | **Done** | New Contract preselects the viewed client. Add Entry preselects the viewed contract (notes) and the viewed week (timesheet: today if in that week, else its Monday). Start Timer: 025's rule holds (viewed contract or none). |
| 7 | Mobile Back; no hidden Delete | **Done** | Back from a note opened from the timesheet returns to that week ("← Week 45"), with scroll. The list has no Delete (024 moved it to the editor), and Back replaces nothing the list could keep selected. |
| 8 | Tests | **Done** | `navigation.test.ts`: 28 tests, one group per rule (replaces the demo file). `navigation-routes.test.ts` 55 and `navigation-history.test.ts` 29 (tables). `e2e-playwright/navigation-journeys.spec.ts`: J1, J2, J7, J8 (×2) and J10, in Chromium and WebKit. |

**Bugs found and fixed on the way:**
- An identical route write re-ran the editor effect and loaded the note twice. The mounted editor then reported to a stale session, so a 409 showed as "Saved": 024's `notes-conflict.spec` failed on this branch until fixed. Fixed at both ends: identical routes are not rewritten, and a second load of the same note is skipped.
- The timesheet could record a scroll position before it had placed the week.
- A wrong-contract correction made during the deep-link root insertion was overwritten.
- Workspace route code is preloaded, so moving between workspace URLs works offline (`offline-behavior.spec` caught this).

### Verification

- `npm run check`: 0 errors (3 warnings, all the pre-existing `data.user` captures in `src/routes/+layout.svelte`). `npm run lint`: clean, after renaming one unused variable in 026's `docs/review/screenshots/sprint-026/probe.mjs`.
- `npm test`: 48 files, **560 passed** (458 at branch start).
- `npm run test:e2e` (API, port 5204): 8 files, 53 passed.
- Playwright (`PLAYWRIGHT_BASE_URL=http://localhost:5204 npx playwright test`): **56 passed**, 0 failed, three consecutive full runs with no retries (44 before plus 12 new). J2 was also run under 6-way load ×6, 13/13. Stale selectors fixed in existing specs: `smoke` (026's `/settings` link), `crud` (024's inline delete confirm), and three specs that looked for the old "Notes" heading.
- Journey re-run (`scratchpad/sprint-027/journeys.mjs`, log in `docs/review/screenshots/sprint-027/journey-run.txt`): **57/57 checks**, 0 page errors. It covers J1–J10, J8 in Chromium and WebKit, plus a 390 px Back sweep. Reload at every distinct URL (J10) returns to the same place: `/`, `/time/2026-W44`, `/time/2026-W45`, `/notes/<c>`, `/notes/<c>/<n>`, `/notes/<c>/new`, `/settings`, `/settings/two-factor`, `/admin/clients/<id>`, and with the sidebar collapsed. `/notes/<wrong>/<n>` is corrected. `/time/2026-W60`, `/notes/not-a-uuid` and `/notes` are 404s.
- 390 px Back (Chromium and WebKit): browser Back from inside a session walked `/time/2026-W44 → /` and never left the app. Fresh deep links to a note, a note list and a week each go Back to `/`. Back from `/` itself leaves the app, which is expected: that is the first page.
- Checklist driver (`QA_BASE_URL=http://localhost:5204 node e2e-playwright/manual-checklist/qa-driver.mjs`): **39 pass / 21 fail**. The same driver against an untouched `main` (7512130, port 5214) gives 39 / 21 with **all 60 steps the same status**, so this sprint changes none of its outcomes. Per the coordinator, the driver and its README were not modified. Notes for its owner:
  - The 21 failures are pre-existing. `E1-create-note` reads the note ID right after New Note, but since 024 a draft has no ID until the first save ("unexpected note id New note"); 18 later note steps cascade from it. `A10-sidebar-color-dots` finds "fewer than 2 contracts" with the 026 grouped sidebar. `E1-export-pdf-print` expects `window.print` (024 prints from an iframe).
  - New stable hooks from this sprint: `aria-current="page"` on the selected sidebar contract and on Time Entries; `data-testid` `note-list-context`, `note-editor-context`, `mobile-back`, `mobile-context-title`, `timesheet-scroll`; `data-day` on day sections. Notes can be reached directly at `/notes/<contractId>/<noteId>`, and weeks at `/time/YYYY-Www`.
  - The phone Back button is now named "Back to <place>" (still matches `/Back/`). The list header is no longer a "Notes" heading.

Screenshots in `docs/review/screenshots/sprint-027/`:
- `j1-*` … `j10-*`: journeys. `j8-*` covers both engines.
- `t2-01`: URL per week.
- `t3-01`: phone home with nothing highlighted.
- `t4-01`: draft URL on the phone.
- `t5-01`…`03`: context headers on desktop, with the sidebar collapsed, and on the phone list.
- `journey-run.txt`: the full step log.

### Follow-ups

1. `POST /api/notes` retries a note-ID collision five times, then returns 500. Eight parallel creates for one client and day exhaust it. This only shows in parallel tests, but a bulk import (e.g. the planned Claude secretary or API skills) would hit it. Consider a sequence or an advisory lock in `createNoteForUser`.
2. Keyboard focus after following a wiki-link still lands on `<body>`, the editor header or the link target (journey A-11), so the focus moves the review asked for are not done. Out of scope here.
3. Notes created through the API with markdown still list as "Untitled" (A-08, 024 follow-up 5). This made list-row selection by title impossible in tests.
4. The in-app history mirror resets when the browser jumps to an entry it did not record (e.g. after the tab was restored from a crash). Back still works; only the Back label falls back to the level above.
5. `/` on tablet and desktop is "this week's timesheet" and is not rewritten to `/time/<week>`. A bookmark of `/` therefore always opens on the current week, which is intended but worth stating.
