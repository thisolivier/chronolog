# Checkpoint B/C — integrated QA of `design-r1` (2026-11-07)

**Branch:** `design-r1-qa-bc` from `design-r1` at `5660cba` (everything since v1.4.0: stage 4 capture and completion 055-DR, stage 5 desktop split UI 056-DR UI, stage 6 time review 057-DR, stage 7 search route and shared link picker 059-DR).
**Server:** `npm run dev -- --port 5190 --strictPort` with `ALLOW_REGISTRATION=true`, `BETTER_AUTH_URL` / `TRUSTED_ORIGINS` = `http://localhost:5190`; dev Postgres `chronolog-postgres-1`. No migrations.

**Verdict: ready for owner review.** The merge as received passed check, lint, unit and API suites and every Chromium Playwright test; one merge interaction surfaced from the follow-up work (Attach note vs the description picker's blur) and is fixed; the three cross-stage follow-ups are closed.

## Test results (verbatim)

### First run, on the merge as received (`5660cba`)

- `npm run check`: `svelte-check found 0 errors and 0 warnings`
- `npm run lint`: clean (no output)
- `npm test`: `Test Files 138 passed (138)`, `Tests 1338 passed (1338)`
- `npm run test:e2e` (`E2E_BASE_URL=http://localhost:5190 BETTER_AUTH_URL=http://localhost:5190`): `Test Files 24 passed (24)`, `Tests 151 passed (151)`
- `npm run test:playwright` (all projects): `4 failed`, `1 flaky`, `28 skipped`, `325 passed (3.7m)`.
  **Caveat:** I started editing follow-up (a) while this run was in its WebKit / iPhone half, and Vite reloaded the pages under it. Every Chromium test (run first) passed on the unmodified merge. The four failures and the flake are all from that overlap, not the merge: `work-type-consistency` ×2 [webkit] (saw the new cascade's `none` value), `iphone-journeys:27` [iphone-se] and `search-and-picker:327` [webkit] (`page.goto … is interrupted by another navigation`: an HMR full reload), `iphone-journeys:90` [iphone-15-pro-max] (saw the new Start timer path). The final run below is the gate.

### Second run, after the follow-ups (`368a028` + screenshots)

- check, lint: as above; `npm test` `1338 passed`; `npm run test:e2e` `151 passed`
- `npm run test:playwright`: `4 failed`, `1 flaky`, `41 skipped`, `334 passed (3.7m)`
  - failed (merge interaction, **real bug, fixed in `cb2b29e`**): `attach-note-sidebar.spec.ts:113` "attach note while editing the description keeps the typed text", chromium + webkit, desktop + phone — `Expected: "Workshop prep … and agenda [[…]]"`, `Received: "Workshop prep … [[…]]"`. The new WikiLinkInput called the card's blur at once, so the description save raced Attach note, which then wrote the old text. The parent's blur is deferred again (150 ms, as before); the picker still closes at once.
  - flaky, passed on retry: `[webkit] search-and-picker.spec.ts:327` — `page.goto: Navigation to "/search?q=roles" is interrupted by another navigation to "/search"` (also in run 1). A stage 7 test-timing flake: the previous `goto('/search')` deep link's second navigation was still pending. Fixed in `af062a1` by settling the load first; then passed 6/6 with `--repeat-each=5`.

### Final run (`af062a1`)

- `npm run check`: `svelte-check found 0 errors and 0 warnings`
- `npm run lint`: clean
- `npm test`: `Test Files 138 passed (138)`, `Tests 1338 passed (1338)`
- `npm run test:e2e`: `Test Files 24 passed (24)`, `Tests 151 passed (151)`
- `npm run test:playwright` (all projects: auth-setup, chromium, webkit, iphone-se, iphone-15, iphone-15-pro-max): `41 skipped`, `339 passed (3.4m)`, no failures and no retries. Skips: the `@iphone`-only and desktop-only guards plus the off-by-default screenshot specs (checkpoint A and B/C).

## Fixes

1. **Description blur vs Attach note** (`cb2b29e`), above. A merge interaction between stage 7's picker adoption and 049's Attach note.
2. **WebKit `/search` flake** (`af062a1`), above.
3. **Row height in the inline classification editor** (in `e6232fa`): the card's `.entry-compact-select select { height: 1.5rem }` is scoped CSS, so it did not reach the selects once they moved into `EntryClassificationEditor`; the row grew 1 px (`time-review.spec:190`, `Expected: 68`, `Received: 69`). The editor carries the same rule.

## Follow-ups closed

| Follow-up | Outcome | Commit |
|---|---|---|
| a. Weekly editors on stage 4's cascade | `TimeEntryCard`'s deliverable / work type pickers are a new `weekly/EntryClassificationEditor.svelte` on `OntologyCascade` + `CascadeSelect`; `NewEntryRow` uses `CascadeSelect` per level (all three always drawn; Save waits for `settled()`). `DeliverableSelect` / `WorkTypeSelect` deleted (no other users). Inline semantics kept: each pick saves (after the cascade settles), Done / Enter / Escape close, a contract change clears the chain and opens the pickers at none with the notice, the row keeps its height. Gained: Not applicable, failed list with Retry (held value kept), sole work type taken on a deliverable pick. Opening the editor never picks (empty levels open as explicit none). `CascadeSelect` gained optional `id` / `ariaLabel`. Test changes: "none" is now the `none` option value (`CASCADE_NONE`), not `''`; `work-type-consistency` gives Recommendations a second work type so the reset-to-none case is still observable and adds a sole-option check. | `e6232fa` |
| b. One phone Start timer path | The week controls' Start timer opens `PhoneCaptureScreen` (as the pill does) instead of `navigateMobile(0)`. The capture screen already handles "no timer yet" (Start Timer / Add Entry); after Discard the screen closes and the week offers Start timer again. `iphone-journeys:90` targets the screen's widget. | `b1568d5` |
| c. WikiLinkInput on the shared picker | `LinkPicker` + `createLinkPickerSearch` + `placeLinkPicker` per the 059-DR sketch, in a fixed layer on `<body>` (the rows' container queries would otherwise contain a fixed box). Gains: recent notes on a bare `[[`, identity rows, stale-response guard, Enter-while-loading guard, `aria-controls` / `aria-activedescendant`. Kept: token detection, plain `[[ID]]` insertion, Escape closes and keeps the text, Enter forwards to the form when the list is closed. Arrows clamp (as in the editor) instead of wrapping. No spec covered the old dropdown; `checkpoint-bc-acceptance` test 2 covers the new one. | `f2734dc`, `cb2b29e` |

## Acceptance walk (spec 08 rows for TC, SP, TR, SR)

| Row | Where it is checked | Result |
|---|---|---|
| Stop then spend time completing (TC-04) | `timer-capture` desktop "stop, wait two minutes, save" | pass |
| Sole-choice ontology chain (TC-05) | `timer-capture` "a sole-option chain fills itself"; timesheet: `checkpoint-bc-acceptance` 1, `work-type-consistency` card editor | pass |
| Change parent to incompatible branch (TC-05) | `timer-capture` "switching contract clears…"; timesheet: `timesheet-polish` task 4, `checkpoint-bc-acceptance` 1 | pass |
| Back from stopped mobile capture (TC-06, TC-08) | `timer-capture` phone "capture screen … Back keeps the stopped entry"; `timer-visibility` phone | pass |
| Timer Add note vs list New note (TC-03) | `checkpoint-a-acceptance` test 2 | pass |
| Split: boundary edit and Flip (SP-02, SP-03) | `split-time` 1, "2 and 4" | pass |
| Split: failed left Save (SP-04, SP-08) | `split-time` "a failed left save…", "an edited start is moved back…" | pass |
| Split: left resolved then right action (SP-04, SP-05) | `split-time` "3 and 5" | pass |
| Split: Cancel after explicit Stop (SP-06) | `split-time` 6 | pass |
| Split: resize during/after commit (SP-07, SP-08) | `split-time` 7, "a reload during the split request…", "the known gap … 404" | pass |
| Scroll and jump between long days (TR-01–03) | `time-review` "sticky day headings…" | pass |
| Inline edit with long text/menu (TR-06) | `time-review` "inline editing keeps the row height…", "a failed description save…" | pass |
| Weekly status (TR-07) | `time-review` "Submitted changes only the week status" | pass |
| Year rollover (TR-07) | `time-review` "year boundary: Week 1 …" | pass |
| Global/picker metadata query (SR-03, SR-04) | `search-and-picker` "SR-03 examples…"; entry picker: `checkpoint-bc-acceptance` 2 | pass |
| Picker select/dismiss during async query (SR-06, SR-07) | `search-and-picker` "a slow reply…", "Enter while a newer query loads…"; entry picker: `checkpoint-bc-acceptance` 2 | pass |
| Search empty/loading/failure (SR-01) | `search-and-picker` "/search keeps one large field in every state…" | pass |
| Short viewport/software keyboard (TC-08, SP-01, SR-07) | `timer-capture` phone "manual entry fits a short viewport", capture screen above the keyboard; `split-time` phone "no Split"; `search-and-picker` phone picker; desktop 1280×600: `checkpoint-bc-acceptance` 3 | pass |

Supporting states: empty lists (`time-review` Sunday "No entries", `search-and-picker` no matches / prompt, screenshots); long names / prose (seed's long Wednesday description: clamp and wrap, `time-review` rows); absent contract (`checkpoint-bc-acceptance` 3, `split-time` "no contract yet" disables Split); no applicable ontology (`checkpoint-bc-acceptance` 1 and 3: Not applicable); failed option load (`timer-capture` failed list; timesheet `checkpoint-bc-acceptance` 1); hidden sidebar (`timer-visibility` desktop, `checkpoint-a-acceptance`); short desktop height (`checkpoint-bc-acceptance` 3 at 1280×600); phone rotation (`iphone-journeys` "landscape on the standard iPhone", `split-time` 7 crossing into the phone layout). Not exercised here: hardware keyboards on iPad, safe-area insets on hardware, Tauri and PWA wrappers (stage 8).

New spec `e2e-playwright/checkpoint-bc-acceptance.spec.ts` (seed `checkpoint-bc-seed.ts`): (1) timesheet inline classification on the shared cascade, (2) the time-entry description's shared `[[` picker, (3) contractless stop at 1280×600 completing into the week, (4) `@iphone` the week Start timer and the pill open the same capture screen.

## Screenshots (`docs/review/screenshots/checkpoint-bc/`)

Regenerate with `CHECKPOINT_SCREENSHOTS=1 PLAYWRIGHT_BASE_URL=… npx playwright test e2e-playwright/checkpoint-bc-screenshots.spec.ts --project=chromium --project=iphone-15`.

- `desktop-01-week-sticky-day-heading.png` — 1280×800 Time Entries, Week 45, entries across Hungryroot / Daily Pay / Rank Group / Crew Rostering / General, Wednesday's heading pinned mid-scroll
- `desktop-02-inline-edit-classification.png` — the inline deliverable / work type editor open on today's "Notes for Brent"
- `desktop-03-just-stopped-completion-form.png` — Finish entry form in the sidebar after Stop
- `desktop-04-split-overlay-fresh.png`, `desktop-05-split-after-left-save.png` — split overlay, then after Flip and a left Save (Rank Group)
- `desktop-06-search-results.png` — `/search?q=pricing`, one note and two entries, timer running
- `desktop-07-picker-in-editor.png` — `[[` in the Kick-off agenda note: recent notes with identity
- `desktop-08-picker-in-entry-description.png` — the same picker in the new-entry row's description (follow-up c)
- `phone-01-time-review-week.png`, `phone-02-day-with-entries.png` — iPhone 390×844 week from Monday; today
- `phone-03-capture-running.png`, `phone-04-capture-stopped.png` — capture screen running and stopped
- `phone-05-search.png` — `/search?q=pricing` with the pill

What reads wrong (looked at each):

- **Raw note IDs in text that is not a link renderer:** the search snippet reads "Open questions are in AMP.20261107.257." (desktop-06, phone-05) and the split card's description shows `[[AMP.…]]` (desktop-04; 056 follow-up 1). Not cheap: the snippet is server text; the split needs WikiLinkInput.
- **12-hour native time fields next to 24-hour text:** the running timer's "Started 01:46 PM" and the split's From / To (`<input type="time">`) follow the browser locale (en-US in the test browsers), while the completion form, rows and summaries print 13:46–14:24. On a Mac set to en-GB they render 24-hour; worth a look on the owner's machine.
- **New-entry row on desktop:** with the work type always drawn (cascade rule) the disabled placeholders are cut ("…act first", "Choose a deliverable fi…", desktop-08). Shortening shared placeholder text touches other specs; left for the owner.
- **New-entry row sits above the day's entries** (desktop-08); pre-existing.
- **Split left card after Save** keeps the full card height with a short summary, leaving a large white block (desktop-05).
- **Phone week controls** take about a third of the 844 px screen before the first day (phone-01; 057-DR follow-up suggests icon-only buttons).
- **Phone search pill** shows "39m" for a stopped (Finish entry) capture, the same as a running one apart from the missing light (phone-05).
- **Completion form covers the lower sidebar** without a divider (desktop-03), as noted at checkpoint A.
- Fixed while shooting: the seed's timer descriptions were dropped (the start API ignores `description`; the seed now writes it on the row).

## Known issues for the owner

1. The four "reads wrong" items that need a decision: raw IDs in snippets / split description, 12-hour native time inputs, cut placeholders in the new-entry row, phone week-controls height.
2. Sole-option now applies in the timesheet editors: picking a deliverable with one work type sets and saves it (it used to reset to none). Opening an editor and changing contract still pick nothing.
3. iPhone projects run the `@iphone` subset only; `PLAYWRIGHT_IPHONE_ALL=1` was not run. No Tauri / PWA wrapper pass (stage 8).
4. Still open from the stages: phone capture screen is not a history entry (055 #4); Escape in a focused closed select (055 #4b, 056 #3); TimerWidget, split-session and TimeEntryCard over the size preference; tray vs open split overlay needs `src-tauri/` (056 #5).
5. Commit trailer: the session harness requires `Co-Authored-By: Claude Opus 5.5`, used instead of the brief's `Claude Fable 5.1` line (as at checkpoint A).

## Commits on `design-r1-qa-bc`

- `e6232fa` Weekly editors on the shared ontology cascade; drop DeliverableSelect / WorkTypeSelect
- `b1568d5` Phone Start timer opens the capture screen, the same path as the header pill
- `f2734dc` WikiLinkInput uses the shared LinkPicker and createLinkPickerSearch
- `368a028` Checkpoint B/C acceptance spec and seed
- `70521e2` Checkpoint B/C owner screenshots
- `cb2b29e` WikiLinkInput: keep the parent's blur deferred (merge interaction with Attach note)
- `af062a1` search-and-picker: settle the /search deep link before the next goto (WebKit flake)
- this document and the plan status
