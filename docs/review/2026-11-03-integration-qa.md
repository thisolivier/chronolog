# Integration QA after 019/020/021-CL (2026-11-03)

Merged `main` (019-CL timesheet, 020-CL notes/editor, 021-CL dead code and wiring) driven end to
end through the real UI with `e2e-playwright/manual-checklist/qa-driver.mjs`, after bringing the
driver up to date with the current DOM and flows.

## Run summary

| | Before (driver as merged) | After (updated driver, run 5) |
|---|---|---|
| Result | 39 pass / 17 fail (56 steps) | **58 pass / 2 fail** (60 steps) |
| Real bugs among FAILs | not separable (stale selectors and cascades) | **2** (R1, R2) |
| Page errors | 0 | 0 |
| Console errors | 0 | 2 (`Error loading week: Failed to fetch`, week fetches aborted by the driver's own `page.reload()`; noise) |

- Environment: `main` at `63aa218` (19f01bb + the 023-CL dispatch doc), dev server
  `ALLOW_REGISTRATION=true BETTER_AUTH_URL=http://localhost:5196 npm run dev -- --port 5196` from the
  main checkout, Postgres `chronolog-postgres-1` on 5432, headless Chromium 1440x900 plus one
  375x812 mobile context.
- Five runs: run 1 = 49/11 (first driver pass), run 2 died mid-run (environment, see E1/E2 below),
  run 3 = 53/7, run 4 and run 5 = 58/2 (identical results). QA users `qa-20261103-*@chronolog.test` left in the dev DB.
- Logs, JSON and screenshots (not committed):
  `/private/tmp/claude-501/-Users-olivier-sites-chronolog/149f7782-2562-48b2-9904-8fe2b200ea3d/scratchpad/integration-qa/`
  (`run5.log`, `run5/qa-results.json`, `run5/shots/`).

## Integration seams (what the sprints could not test in isolation)

| Seam | Result | Evidence |
|---|---|---|
| Wiki-link click on a time card → notes mode → correct note | **Works**, including after the note moved contract (list panel switches to the note's new contract) | `A4-card-wiki-link-click-opens-note`, `C2-card-wiki-link-after-move`, shot `14b-card-wiki-link-opened-note.png` |
| Backlinks after linking (editor `[[` in B → "Linked from B" on A; chip opens B; editor link opens A) | **Works**, also after the move | `E1-backlinks-displayed`, `E1-wiki-link-click-navigates`, `C2-backlinks-after-move` |
| Linked time entries on a note (description `[[A]]` on a card → A's "Linked Time Entries") | **Works**, also after the move. Cosmetic: the panel prints the raw `[[id]]` (R4) | `C2-linked-time-entries-on-note`, `C2-linked-entries-after-move` |
| Timesheet refresh after timer save with a deliverable set | **Works** — card with "Phase 1" appears with no reload | `E1-timer-stop-save`, `A4-deliverable-shown-on-card` |
| Mobile top bar with the new timesheet (375px) | **Works** — "Chronolog" at level 0, "← Back" at y=0/h=48 after Time Entries, WeekStrip sticky at y=109 below it (also after scrolling), 7 day columns fit, no horizontal overflow, Back returns to level 0, no page errors | `M1-mobile-topbar-and-timesheet`, shot `27-mobile-timesheet.png` |
| Registration lands signed in; `/login` bounces an authenticated user | **Works** | `AUTH-register`, `AUTH-login-page-when-authenticated` |
| New-entry row and Add Entry modal deliverable / work type | **Works** (Deliverable disabled "Pick a contract first" until a contract is picked; Work type hidden when the deliverable has none) | `A5-*`, `E1-create-time-entry-manual`, `E1-add-entry-modal-deliverable-selector` |

## All steps (run 5)

"Before" is the original run on merged main (`smoke-main/driver.log`); "new" = step added in this pass.

| # | Step | Before | After | Notes / classification |
|---|---|---|---|---|
| 1 | `AUTH-redirect-unauthenticated` | PASS | PASS |  |
| 2 | `AUTH-register` | PASS | PASS | was a false PASS before (matched the transient /login hop); now asserts landing signed in on / |
| 3 | `AUTH-login-page-when-authenticated` | PASS | PASS | now asserts the redirect to / (was only logged) |
| 4 | `AUTH-login-redirect` | FAIL | PASS | driver: now signs out (clears cookies) first |
| 5 | `AUTH-native-submit-race` | FAIL | FAIL | **REAL BUG** (R1) — click before hydration does a native GET to /login?; was timing-dependent in dev, now deterministic |
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
| 18 | `A10-sidebar-color-dots` | PASS | PASS |  |
| 19 | `E1-create-note` | PASS | PASS |  |
| 20 | `A2-notes-mode-three-panels` | PASS | PASS |  |
| 21 | `E1-edit-note-tiptap-autosave` | PASS | PASS |  |
| 22 | `E1-raw-rendered-toggle` | PASS | PASS |  |
| 23 | `E1-export-markdown` | PASS | PASS |  |
| 24 | `E1-export-pdf-print` | PASS | PASS |  |
| 25 | `E1-wiki-link-editor-autocomplete` | PASS | PASS | driver: types full id and asserts data-note-id (previous PASS had linked B to itself) |
| 26 | `E1-backlinks-displayed` | FAIL | PASS | driver: the editor step had linked B to itself (prefix + Enter); with the full id the backlink chip shows |
| 27 | `E1-wiki-link-click-navigates` | FAIL | PASS | cascade of the above |
| 28 | `A5-new-entry-row-layout` | FAIL | PASS | driver: fields located by label; now also asserts row order and the disabled Deliverable placeholder |
| 29 | `A5-border-updates-on-contract-select` | FAIL | PASS | driver: contract select by label (was strict-mode violation) |
| 30 | `A5-new-entry-row-deliverable` | new | PASS | new step |
| 31 | `E1-create-time-entry-manual` | FAIL | PASS | cascade fixed; now also asserts the deliverable picked in the row shows on the card |
| 32 | `A4-card-hierarchy-and-colours` | FAIL | PASS |  |
| 33 | `A3-weekstrip-day-total-and-bar` | FAIL | PASS |  |
| 34 | `E1-edit-time-entry-time` | FAIL | PASS |  |
| 35 | `E1-edit-time-entry-contract` | FAIL | PASS | driver: selectByText waits for options; sidebar locator scoped |
| 36 | `A4-wiki-link-autocomplete-in-description` | FAIL | FAIL | **REAL BUG** (R2) — exact id + Enter links a different note |
| 37 | `A4-wiki-link-rendering-in-card` | FAIL | PASS |  |
| 38 | `A4-card-wiki-link-click-opens-note` | new | PASS | new integration step (card link to notes mode to the right note) |
| 39 | `C2-linked-time-entries-on-note` | FAIL | PASS | cascade fixed |
| 40 | `C1-move-menu-visible-and-excludes-current` | PASS | PASS |  |
| 41 | `C1-move-note` | PASS | PASS | now asserts the [data-testid=move-feedback] text (was optional) |
| 42 | `C1-note-appears-in-target` | PASS | PASS |  |
| 43 | `C2-backlinks-after-move` | FAIL | PASS | cascade fixed |
| 44 | `C2-linked-entries-after-move` | FAIL | PASS | cascade fixed |
| 45 | `C2-wiki-link-from-B-after-move` | FAIL | PASS | cascade fixed; see observation R3 (sidebar/list not switched) |
| 46 | `C2-card-wiki-link-after-move` | new | PASS | new integration step |
| 47 | `A7-status-chip-cycle` | PASS | PASS |  |
| 48 | `A7-status-persists-after-reload` | PASS | PASS |  |
| 49 | `A3-prev-next-week` | PASS | PASS |  |
| 50 | `A3-next-week-beyond-today` | PASS | PASS |  |
| 51 | `A3-click-day-scrolls` | PASS | PASS |  |
| 52 | `A3-sticky-strip` | PASS | PASS |  |
| 53 | `A9-timer-indicator` | PASS | PASS |  |
| 54 | `E1-timer-stop-save` | PASS | PASS | deliverable select now required; card must appear with no reload (time-entry-saved event) |
| 55 | `A4-deliverable-shown-on-card` | PASS | PASS |  |
| 56 | `E1-add-entry-modal-deliverable-selector` | PASS | PASS | requires #deliverable-select |
| 57 | `E1-delete-time-entry` | PASS | PASS |  |
| 58 | `E1-delete-note` | PASS | PASS | driver: sidebar-scoped /General/ (card button also matched) |
| 59 | `A2-no-layout-shift-switching-modes` | PASS | PASS | driver: sidebar-scoped /General/ |
| 60 | `M1-mobile-topbar-and-timesheet` | new | PASS | new step (375px) |

## Remaining FAILs

| Step | Classification | Reason |
|---|---|---|
| `AUTH-native-submit-race` | **REAL BUG** | Login form has no `preventDefault`, so a click before hydration natively GETs `/login?`. The sign-in is lost and the fields are cleared |
| `A4-wiki-link-autocomplete-in-description` | **REAL BUG** | `[[` search also matches note bodies and ranks only by recency, so the exact id typed loses to a newer note that mentions it |

## Real bugs, ranked

### R2 (medium) — `[[` autocomplete: typing an exact note id and pressing Enter links a different note

Introduced at the 020-CL seam: task 4 made `searchNotesForUser` also match `ilike(notes.content)`,
and results are still ordered only by `updatedAt desc`, with Enter picking the first item. Any note
whose body already links to (or mentions) the target note, and was edited more recently, outranks the
target itself. Affects the description input on time cards (`WikiLinkInput`) and the editor's `[[`
suggestion equally (same endpoint). A related symptom: with a short prefix the list also offers the
note being edited, so Enter can make a note link to itself (seen in the original run:
`Beta note links to [[<B's own id>]]`).

Repro:
1. In notes mode create note A ("Alpha"), then note B and type `[[` + A's full id in B and pick A
   (B's body now contains `[[A]]`).
2. Time Entries → any card → click the description → type ` see [[` + A's full id.
3. The dropdown lists **B first, then A**; press Enter.
4. The description becomes `… [[B]]`, not `[[A]]`.

Responsible: `src/lib/server/db/queries/notes.ts` `searchNotesForUser` (ranking: exact id match,
then id prefix, then title, then body; exclude the current note), with the Enter behaviour in
`src/lib/components/weekly/WikiLinkInput.svelte` and the editor's `SuggestionDropdown`.

### R1 (low) — Login (and register) form does a native GET submit if clicked before hydration

`src/routes/login/+page.svelte` `handleLogin()` (and `src/routes/register/+page.svelte`
`handleRegister()`) never call `event.preventDefault()`. After hydration SvelteKit's router
intercepts the GET form, so it works. Before hydration (slow network, mobile/PWA cold start) the
browser submits natively to `/login?` (the inputs have no `name`, so no credentials leak). The page
reloads with empty fields and the user's sign-in is silently dropped. The 2026-11-03 qa-state review
recorded PASS only because the driver's `/_app/**` delay never matched in dev mode.

Repro: open `/login` with scripts throttled (DevTools → Network → Slow 3G, or the driver's
1.5 s script delay), fill email and password, click "Sign in" before the page hydrates → URL becomes
`/login?`, form is empty, not signed in.

Responsible: `src/routes/login/+page.svelte`, `src/routes/register/+page.svelte`. Fix: `event.preventDefault()`
in the handlers, and/or disable the submit button until mounted.

### R3 (low, observation from a passing step) — Editor wiki-link / backlink chip to a note in another contract does not switch the sidebar and list

`NoteEditorPanel.svelte` wires `onWikiLinkClick` and the "Linked from" chips to
`navigation.selectNote(id)`. The time-card path (019-CL task 6) uses `navigation.openNote(id, contractId, clientId)`.
After A moves to Rocket Build, clicking `[[A]]` inside B (General) opens A in the editor, but the
sidebar still highlights General and the list still shows B (shot `18-cross-contract-wikilink.png`).
Repro: C1 move flow, then General → B → click the `[[A]]` link. Responsible:
`src/lib/components/layout/NoteEditorPanel.svelte` lines ~307 and ~318 (reuse the
`handleNoteLinkClick` resolution from `TimeEntriesPanel.svelte`).

### R4 (cosmetic, observation) — "Linked Time Entries" shows raw `[[id]]` in descriptions

`src/lib/components/notes/LinkedTimeEntries.svelte` prints `entry.description` as text
(`— Build the rocket engine see [[INTL.20261103.027]]`). Cards render it through `WikiLinkRenderer`.

## Environment findings (not product-user bugs, but they break dev QA)

- **E1 — Postgres pool leak in dev.** `src/lib/server/db/index.ts` calls `postgres(connectionString)`
  at module scope with no `globalThis` cache. Every Vite SSR module invalidation creates a new pool
  (up to 10 connections) and never ends the old one. During this session the 5194 dev server (another
  session) held 86 of the 100 `max_connections`. Once full, every request on every dev server
  returns 500 (`sorry, too many clients already`; run 2 died this way). Production (`node build`) is
  unaffected. Fix: cache the client on `globalThis` in dev.
- **E2 — Vite in the main checkout watches `.claude/worktrees/*`.** Each `svelte-kit sync` in
  another session's worktree logs `changed tsconfig file detected: …/.claude/worktrees/sprint-023-CL/.svelte-kit/tsconfig.json`
  and forces a full reload of every open page (and feeds E1). Fix: `server.watch.ignored: ['**/.claude/**']` in
  `vite.config.ts`.

## Driver changes (`e2e-playwright/manual-checklist/` only)

- Auth: `AUTH-register` expects to land signed in on `/`; `AUTH-login-page-when-authenticated`
  moved right after it and now asserts the redirect; `AUTH-login-redirect` clears cookies first;
  `AUTH-native-submit-race` uses its own unauthenticated context and delays every script request.
- `selectByText` polls for an enabled matching `<option>` (fixes the old "options not loaded"
  limitation).
- `newEntryRow` / `newEntryField(label)` helpers: new-entry-row fields located by label. A5 asserts
  contract/deliverable/time order and the disabled Deliverable before a contract is picked. New step
  `A5-new-entry-row-deliverable`. `E1-create-time-entry-manual` asserts "Phase 1" on the saved card.
- `sidebarContract(pattern)` scopes contract clicks to panel 1 (a card's "Internal / General" button
  also matched `/General/`).
- Wiki-link autocomplete (editor and description) types the full id. The editor step asserts
  `data-note-id`. The description step records the R2 failure, then corrects the text so later seams run.
- Move feedback asserted via `[data-testid="move-feedback"]` text.
- Timer completion: `#deliverable-select` waited for and required; card must appear without reload.
  Add Entry modal requires `#deliverable-select`.
- New steps: `A4-card-wiki-link-click-opens-note`, `C2-card-wiki-link-after-move`,
  `M1-mobile-topbar-and-timesheet`.
- README: run instructions (`ALLOW_REGISTRATION`, `BETTER_AUTH_URL`), the assumed flows, and the
  current known limitations (stale entries removed).
