# Sprint 050 — UI: Back and forward through the user's journey

**Status:** merged
**Branch:** `sprint-050-UI/back-forward` · **Worktree:** `.claude/worktrees/sprint-050-UI` · **Port:** 5225
**Sources:** owner request 2026-11-05: back/forward buttons for moving through the user's journey, "to the left of the search bar, and left align the search bar". Every navigation is a step (opening a note, a contract, the timesheet, client view, settings, search results opened, and paging weeks); typing is not a step. Wave rules in `docs/sprints/_wave-rules.md` apply (no migration, no API change).

**Owns:** `src/lib/stores/navigation.svelte.ts`, `src/lib/stores/navigation-history.ts`, `src/lib/components/layout/AppShell.svelte` (top bars), a new small back/forward component, related tests. Do not touch the timer widget/indicator placement (separate backlog item).

## Background

Navigation is URL-driven (sprint 027-CL): the store pushes/replaces URLs via `goto`, and `InAppHistory` (`navigation-history.ts`) mirrors this tab's in-app history entries in sessionStorage (index, entries, pop by delta). The phone "← Back" (`goBackMobile`, `data-testid="mobile-back"`) uses it, going one level up when there is no in-app entry behind. Journeys are covered in `e2e-playwright/navigation-journeys.spec.ts` (J1–J10).

## Tasks

1. **History model.** Add forward awareness to `InAppHistory` (`next`, `canGoBack`, `canGoForward`) and expose reactive `canGoBack` / `canGoForward` and labels for the previous/next entry (reuse whatever builds the phone Back label) plus `goBack()` / `goForward()` (`history.back()` / `history.forward()`) on the navigation store. Back never leaves the app; Forward is disabled when there is nothing ahead.
2. **What is a step.** Each of these pushes one history entry: opening a note, a contract, a client view, the timesheet, trash, settings pages, a search result, and each week paged with the week arrows or picked. Typing never adds entries: note autosave, title edits, the search field's query (replace, not push, while typing; submitting/opening a result is a step), description edits, timer fields. Audit current `replace` vs `push` uses and fix the ones that disagree with this list; list the changes in the sign-off.
3. **Desktop top bar.** Two compact icon buttons ‹ › (accessible labels "Back to {label}" / "Forward to {label}", disabled state when unavailable, tooltip with the destination) placed immediately left of the global search field. The search field sits left-aligned in the top bar right after them (no centring; keep its current width or a little wider). Keyboard: ⌘[ / ⌘] (Ctrl on non-Mac) and Alt+←/→ go back/forward, except when focus is in a text field or the editor.
4. **Phone top bar.** Keep the labelled "← Back" (it already does history-then-up). Add a compact › forward button next to it when forward is possible (hidden otherwise, to save room). No horizontal scroll at 320 px; tap targets ≥ 32 px.
5. **Mac app / PWA.** Works in the Tauri webview and the standalone PWA (no browser chrome there; that's the point). Back/forward must survive a reload (sessionStorage snapshot) and the browser's own back/forward keep it in sync (pop by delta).
6. **Tests.** Unit tests for `InAppHistory` forward behaviour and for the push/replace rules. Extend `navigation-journeys.spec.ts` (or a new spec): a journey timesheet → week back ×2 → note → contract → client; Back walks it in reverse one step at a time, Forward replays it; typing in a note and in the search field adds no steps; reload mid-journey keeps Back/Forward state; buttons disabled at the ends; keyboard shortcuts. Desktop 1280 and phone 390 (touch), chromium and webkit; keep the existing J1–J10 passing (update any that encoded the old week-paging behaviour, and say so).

## Verification

Screenshots (desktop 1280 top bar with both buttons, one disabled; phone 390 with Back and forward) in `docs/review/screenshots/sprint-050/`. `npm run check`, `npm test`, touched Playwright specs incl. `navigation-journeys`, `iphone-journeys`, `attach-note-sidebar`. Sign-off as per the wave rules.

## Sign-off (2026-11-05): ready for review

Branch `sprint-050-UI/back-forward`, on `main` (`40c4113`, unchanged since the branch was cut). Not merged. No migration, no API or CLI change.

### Done

1. **History model.** `InAppHistory` gained `next`, `canGoBack`, `canGoForward` and `expectMove(±1)`; the snapshot (sessionStorage) already held the entries ahead, so a reload restores both directions. The store exposes reactive `canGoBack` / `canGoForward` / `previousPath` / `nextPath` and `goBack()` / `goForward()`; the adapter gained `forward` (`history.forward()` in the root layout). Back and Forward only fire when an in-app entry is there, so they never leave the app. Found in the real UI: SvelteKit fires `afterNavigate` only for the last of several quick Back/Forward presses (the overtaken ones are dropped), which put the mirror out of step after fast keyboard repeats. A move the app asks for is now counted as pending until it lands, and a landing is matched to where the pending moves lead, then to `delta`, then to the nearest entry with that path (unit-tested; the Playwright keyboard replay exercises it).
2. **What is a step.** Push/replace audit, changes:
   - `selectWeek` (week arrows, inside the timesheet or from `/`): **replace → push**.
   - `showTimeEntryDay` on another week from inside the timesheet (Today, a search hit, a linked entry, a timer/Add Entry save into another week): **replace → push**. Same week: still no navigation.
   - Moving a note to another contract (`note-panel-actions.ts`): **push → replace** (an edit, not a step; Back used to land on the old URL, which was then corrected straight back).
   - A note made offline getting its real ID (`handleNoteRemapped` → `selectNote(…, { replace: true })`, new option): **push → replace** (autosave is not a step).
   - Search field: typing never touched the URL (kept); Enter is a step (`goto` push, kept), now skipped when that exact search is already shown, so re-pressing Enter adds no duplicate.
   - Unchanged and agreeing with the list: contract, client, note, timesheet, New Note pushes; trash, settings pages and search hits are links / `openNote` pushes; closing/deleting a note, draft → saved note and wrong-contract correction replace; title, description and timer fields never navigate.
3. **Desktop top bar.** New `HistoryButtons.svelte`: ‹ › 32×32 icon buttons immediately before the search field, which stays left-aligned and is a little wider (`w-60 lg:w-72`, was `w-56 lg:w-64`). `aria-label` and tooltip "Back to {label}" / "Forward to {label}" (labels from `labelForPath`, now also "Search" and "Trash"; note titles from the title cache), plain "Back" / "Forward" and greyed when disabled. Cmd+[ / Cmd+] (Ctrl on non-Apple), Alt+← / Alt+→, ignored while focus is in an input, textarea, select or contenteditable (the editor) (`history-shortcuts.ts`).
4. **Phone top bar.** "← Back" unchanged in behaviour; a › (32 px wide, 44 tall) follows it only when a step is ahead, also at home next to "Chronolog". The context title now gives way first and Back is capped at 65 % of the bar, so "← Week 44 ›" stays readable at 320 px with no sideways scroll.
5. **Mac app / PWA.** Nothing browser-specific: the buttons and keys drive `history.back/forward` from inside the page, the mirror survives reloads (sessionStorage) and follows the browser's own Back/Forward (popstate by delta, with the matching above).
6. **Tests.** See below.

### Deviations

- The ‹ › also appear (md and wider) in the Search, Trash and Settings/Admin headers (one component line each, plus import), since those are steps of the journey and the Mac app has no other way back from them but "Back to app". On a phone those pages keep their "Back" link only.
- Labels are built in the component from `previousPath` / `nextPath` with the existing `labelForPath` (the store stays free of component imports), not as store fields.
- History entries record the pathname only (as before), so `/search?q=a` and `/search?q=b` are both labelled "Search".
- None of J1–J10 needed changing: J2 and J8 page a week and then go Back from a note, which lands on the same week either way. The unit test "replaces the entry for week changes inside the timesheet" became "pushes an entry for each week paged" (and `showTimeEntryDay` from inside the timesheet now pushes).
- `navigation.test.ts`'s fake adapter moved to `navigation-test-setup.ts` so the new `navigation-steps.test.ts` shares it.
- The worktree needed its own `npm ci`: with Node resolving the main checkout's `node_modules`, Vite refused to serve SvelteKit's client entry (outside `server.fs.allow`) and the app never hydrated.

### Tests

- `npm run check` 0 errors / 0 warnings; `npm run lint` clean; `npm test` 113 files, 1095 tests (new: `navigation-history.test.ts` forward + quick presses 11, `navigation-steps.test.ts` 7, `history-shortcuts.test.ts` 4).
- New `e2e-playwright/history-buttons.spec.ts` (each test signs up its own `qa-050-…` user): desktop 1280 journey timesheet → week back ×2 → note → contract → client, Back walks it one step at a time (with a reload mid-way keeping both directions and labels), Forward replays it by keyboard (Alt+→ and Cmd/Ctrl+]), typing in the note and the search field adds no step, buttons disabled at both ends, keys ignored in a text field; search submit is a step and the buttons sit left of the field on /search; phone 390 (touch) Back and › through the journey, › hidden with nothing ahead, ≥ 32 px, no sideways scroll at 320. Chromium + webkit: 6/6, and 55/55 with `--repeat-each=3` together with `navigation-journeys`.
- `navigation-journeys`, `iphone-journeys`, `attach-note-sidebar`, `history-buttons` on chromium, webkit, iphone-se, iphone-15, iphone-15-pro-max: 51 passed, 14 skipped as designed, no retries.
- Also green (chromium + webkit): `search`, `search-results-layout`, `sidebar-client-view`, `note-trash`, `notes-navigation`, `notes-autosave`, `offline-outbox`, `timesheet-polish`, `smoke`, `two-factor-login` (80/81 in one parallel run; the one failure, `notes-navigation` search click, matched another spec's "Trash target …" note of the shared Playwright user, and passes on its own: pre-existing shared-user collision).
- API e2e (`npm run test:e2e`, with `BETTER_AUTH_URL` set to the dev server): 128 / 129; the failure is again `note-changes-cli` "note new --date yesterday" expecting a 3-digit sequence while the shared dev DB is at `INTL.20261104.2049` (unrelated).
- Screenshots (chromium) in `docs/review/screenshots/sprint-050/`: `desktop-01-end-of-journey`, `desktop-02-top-bar-forward-disabled` (top bar: ‹ enabled, › disabled), `desktop-03-search-page`, `phone-01-back-and-forward` (390: "← Week 44 ›"), `phone-02-home-forward`, `phone-03-320-wide`.

