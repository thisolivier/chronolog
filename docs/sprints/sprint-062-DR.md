# Sprint 062-DR — "Chronolog" home button with ‹ › on every layout

**Branch:** `design-r1-home` (from `design-r1` after "Merge main (backlog and decisions) into design-r1"). **Status:** ready for review. No new dependencies, no migrations, nothing in `src-tauri/`.

Source: owner decision 2026-11-07 "Home button and history buttons" (`docs/decisions.md`): the phone's "← Back" / "← Chronolog" top-left label hid the home affordance behind history navigation. Builds on 050-UI (‹ ›, history store), 053-DR (app bar, pill), 059-DR (/search in the shell) and 060-DR (phone title rule, stopped pill). Design r1 SH-01 / SH-07 unchanged in substance.

## What changed

1. **`AppBarHome.svelte` (new):** the left group on every layout: "Chronolog" as a button (`app-home-button`, accessible name "Chronolog home") then `HistoryButtons`. It calls the new `navigation.goHome()`: a pushed step to `/` (the phone's home screen, level 0; this week's timesheet on wider screens), so Back undoes it; it works from the workspace, /search, Settings and the trash. Navigating never touches the capture, so a running or unfinished capture survives (SH-07; the spec checks the timer id).
2. **Desktop and tablet bar:** ≡ (unchanged, far left), then Chronolog ‹ ›. Right group unchanged (pill, search far right).
3. **Phone bar:** Chronolog ‹ › on every screen, then the context title where `phoneTitleBarNamesContext` keeps it (the week: "Time entries · Week N"; none on notes screens, at home, or with the pill), truncating first; then Find, the search icon and the pill. The "← Back" / "← Chronolog" label and the "› beside Back" variant are gone: the phone ‹ (`mobile-back`) keeps the old Back rule (the step before, else one level up via `goBackMobile`, disabled only at home with nothing behind) and its accessible name says where ("Back to Week 45"); › (`mobile-forward`) is always shown, disabled with no step ahead. 44 px targets.
4. **Room at 320–390 px:** at 390 the old spacing let › slide under Find with the pill showing, and at 320 both chevrons were covered. Now: 12 px bar gutters on the phone, no extra gaps between the 44 px icons, the pill drops its ContractMark below 420 px (clock and pulse dot, or flag and frozen duration, stay; the contract stays in its accessible name), and below 360 px Find gives way while the pill shows. `home-button.spec.ts` checks with `elementFromPoint` that nothing covers the home button or ‹ › at 390 and 320.
5. **/search on a phone:** "← Back to app" (`search-back-to-app`) replaced by the same group; pill kept; no search icon, no Find. ‹ walks history (a search submitted with Enter is a step, so it goes /search?q= → /search → the note).
6. **Settings and Trash headers:** the same group on every width (‹ › were md+ only); "Back to app" stays at the right (the workspace place you left, distinct from home).
7. Keyboard shortcuts unchanged (⌘[ ⌘], Alt+←/→, still in `HistoryButtons`).

## Review round

- **Blocker: the phone ‹ did nothing at home or on /search entered from home.** `goBackMobile` returned early whenever the place was home (and /search keeps the last place, often home), though ‹ was enabled and named "Back to …". It now takes the history step whenever there is one (the same step `goBack` takes), falls back to one level up only with nothing before, and does nothing only at home with nothing before. The accessible name already follows `backTarget` (the history entry, else the parent), so it names what will happen. Unit tests: ‹ at home after the home button, and on /search entered from home; `home-button.spec.ts` now taps ‹ after Home (back to the note, editor shown) and home → search → ‹ (home screen).

## Spec changes (deliberate)

- `history-buttons.spec.ts` (phone 390): › is now always present; `toHaveCount(0)` / `toBeVisible()` became `toBeDisabled()` / `toBeEnabled()`, and the size check is 44 px (was 32).
- `navigation-journeys.spec.ts`, `sidebar-notes-header.spec.ts`: `mobile-back` text ("Week", "All notes") is now read from its `aria-label` (‹ is an icon).
- `search-and-picker.spec.ts` (phone search): expects no `search-back-to-app`, the home button present, and walks ‹ twice back to the note.
- `search.spec.ts` (Cmd+F outside the panel): clicked the "Chronolog" text to focus the bar; that now navigates home, so it clicks an empty part of the bar.
- New `home-button.spec.ts` (desktop chromium/webkit; phone `@iphone`). New unit tests for `goHome` in `navigation-steps.test.ts`.

Kept test ids: `history-buttons`, `history-back`, `history-forward`, `mobile-back`, `mobile-forward`, `mobile-context-title`, `mobile-find-button`, `mobile-search-link`, `app-top-bar`, `trash-back-to-app`. Removed: `search-back-to-app`.

## Tests

- `npm run check`: svelte-check found 0 errors and 0 warnings
- `npm run lint`: clean
- `npm test`: 139 files, 1364 tests passed after the review round (new: 3 `goHome` cases, 2 phone-Back cases)
- `npm run test:playwright` (all projects): 346 passed, 41 skipped (3.6m after the review round). An earlier full run, before the phone search spec walked ‹ through the submitted search, failed that one test in all five projects and showed one webkit flake (`attach-note-sidebar` 049, passed on retry).

## Screenshots

`docs/review/screenshots/sprint-062/`: `desktop-01-app-bar.png`, `phone-390-01-notes-list.png`, `phone-390-02-note-editor.png`, `phone-390-03-timesheet-running.png`, `phone-390-04-search.png`, `phone-320-02-note-editor.png`, `phone-320-03-timesheet-running.png`.

## Known issues

- After a reload straight onto /search the phone ‹ has no in-app step behind it. It is disabled only when the tab's last workspace place was home; otherwise it is enabled and replaces /search with that place's parent (the one-level-up rule). The home button always works.
- Follow-up for the next polish pass: the pill's md ContractMark lets a three-letter code ("PMM") spill past its tile (seen in this sprint's first screenshots; ContractMark untouched here; below 420 px the pill no longer shows the mark).
