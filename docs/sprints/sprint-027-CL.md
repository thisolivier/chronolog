# Sprint 027 — CL: Navigation state, URLs and context

**Status:** pending (starts after 024, 025, 026 merge; touches the navigation store, routes and every panel)
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
_Fill in._
