# Sprint 055 — DR: Design r1 stage 4, time capture and completion

**Status:** ready for review
**Branch:** `design-r1-stage4` (from `design-r1` at `0b01e71`) · **Worktree:** `.claude/worktrees/design-r1-stage4` · **Port:** 5186
**Sources:** `docs/design/r1/specs/03-time-capture.md` (TC-01 to TC-09, acceptance), `04-split-time.md` (SP-01, TC-07: entry points only), source map `03-04-capture-and-split.md`, sprints 053-DR (capture store, identity header) and 056-DR (timer API guards), decisions of 2026-11-07, crops `completion-*` and `capture-mobile-*` with their written overrides.
**Runs alongside:** a QA pass over the merged shell / notes, and stage 6 (time review). This sprint did not touch `TimeEntriesPanel.svelte`, `src/lib/components/weekly/*` or the week utilities. Outside `timer/` it changed two lines of `AppShell.svelte` (the phone pill) and two Playwright specs whose phone flow changed.

## What was built

### A. Completion form (TC-04, TC-05, TC-06)

- From the moment of Stop every control is drawn in a fixed place: a "Finish entry" header with the frozen duration and range (Split time at its right on desktop), Description, Contract, Deliverable, Work type, Time, then Discard and Save anchored at the bottom (a divider above them; pinned above the keyboard on the phone screen).
- No row pops in. Each cascade level is always one native select of the same height; when it cannot be browsed it is disabled and says why (table below). The identity header's subtitle row reserves its height too.
- No "Only option" badge and no reserved helper space: a sole option is simply selected and shown.
- Labels exactly **Save** and **Discard** ("Saving…" and "Retry" states kept). Heading shortened to "Finish entry" (was "Finish entry: save or discard it"; it wrapped to two lines in the sidebar).
- Validation unchanged (contract required, time validated only when edited, the shared parser); errors inline. Save first waits for the cascade to settle (`cascade.settled()`), so it never sends a stale deliverable / work type pair.
- The Time field no longer shows "= 24m" under an untouched measured range when the frozen duration is 25m (an untouched field saves the measured seconds rounded up, not the whole-minute range): `DurationField` takes an optional `measuredText`.

### B. One ontology cascade (IN-03)

`ontology-cascade.ts` (pure rules) and `ontology-cascade.svelte.ts` (`OntologyCascade`, the controller), drawn by `CascadeFields.svelte` / `CascadeSelect.svelte`. The completion form and `AddTimeEntryModal` both use it; the selection stays with the host (capture store or modal state), passed as `() => selection`.

| Level state | When | Shown | Held value |
| --- | --- | --- | --- |
| `waiting` | parent not chosen | disabled: "Choose a contract first" / "Choose a deliverable first" | cleared |
| `loading` | options on their way | disabled: "Loading…" | kept |
| `ready` | one or more options | browsable list with "No deliverable" / "No work type" (contract: "Select a contract…") | kept if valid; else the **sole option** if exactly one; else cleared |
| `not-applicable` | parent chosen, no options | disabled: "Not applicable" (contract: "No contracts yet") | cleared |
| `failed` | the list did not load | disabled: "Couldn't load work types" (": your choice is kept" when one is held) + **Retry** | **kept** |

- The sole-option rule runs when a level loads (mount, parent change, retry) and continues down the chain (contract → its one deliverable → its one work type). It also applies to the contract list (one contract: chosen).
- Parent change: the child list reloads (cached per parent for the form's life); a still-valid child is kept, an invalid one cleared, then the sole-option rule. Description and `[[links]]` are separate fields and are never touched.
- Root (contract): a held contract the list does not offer (archived, restored capture) is kept and shown as "Current contract (not in the list)"; the server validates on save.
- Newest request wins when answers arrive out of order.
- Desktop list: **native select kept** (the simpler choice: the OS list is anchored and browsable, keyboard and screen-reader behaviour come free, existing tests and test ids keep working). Phone: native select.

### C. Running state (TC-01, TC-03, TC-07)

`TimerRunningPanel.svelte` (extracted from TimerWidget): clock and **Stop** (text unchanged for the Tauri tray), editable start, contract select until chosen (then "Change" in the header), description. Attach note (049 behaviour, accessible name "Attach note") appears once a contract is chosen, with the **Split time** icon beside it.

**Split stub (TC-07, for stage 5).** `SplitTimeButton.svelte`: running (beside Attach note) and stopped (form header). Hidden on the phone layout (`layoutMode === 'mobile'`), disabled offline ("Split time is not available offline"). `split-entry.ts` `splitHandlerFor()` returns `undefined` today, so the button is **disabled** with the tooltip "Split time (coming soon)". **TODO stage 5:** return a handler that opens the split overlay for the current capture; the buttons are already wired to it.

### D. Phone capture screen (TC-08)

- `PhoneCaptureScreen.svelte` + `capture-screen.svelte.ts`. The header pill (3a) now opens a focused surface **over** the current screen instead of navigating to home; "← Back" closes it and the originating screen (note, list, timesheet) is untouched underneath, scroll position included.
- Running: large clock, start, contract, description; **Add note** (text button, disabled until a contract is chosen) and **Stop** pinned at the bottom. Stopped: the full completion form with Discard / Save pinned. No collapse chevron, no Split, no header pill (the surface covers the app bar; a mounted `'screen'` widget also hides the pill).
- Back never resumes or resolves: the frozen end stays on the server row (or pending timer), the fields in the capture store; the pill reads Finish entry. Save, Discard and Add note's navigation close the surface.
- Keyboard: the surface is sized and placed from `window.visualViewport` (`visual-viewport.svelte.ts`, falls back to `100dvh`), because iOS Safari does not shrink `dvh` for the keyboard. Fields scroll in the middle with `scroll-padding`, a focused field is scrolled into view (`revealFocusedField`), and the actions sit at the bottom with `env(safe-area-inset-bottom)`. Escape closes the surface unless a select has focus or the Add Entry modal is open.
- The timesheet's footer widget can stay mounted under the surface, so widgets now announce start / stop / save / discard (`announceCaptureChange` in `timer-widget-registry.svelte.ts`) and other mounted copies reload from the server; one timer model, copies only re-read it.

### E. Manual entry (TC-09)

`AddTimeEntryModal`: Date, Description, Contract + cascade, Time, **Cancel** / **Save** (no "Discard"). Desktop centred overlay; below 768 px a full-height sheet sized to the visual viewport with the actions pinned and the fields scrolling. Escape is ignored while a select has focus (its list may be open); Escape or a backdrop click on a **dirty** form (typed description or time, changed date, a hand-picked choice) shows "Discard what you typed?" with **Keep editing** (focused) and **Close without saving**; a clean form closes at once. Cancel still closes directly. It never touches a running timer (unchanged).

## API error handling (056-DR guards)

The widget keeps sending `expectedStartedAt` (`date` + `HH:MM:SS` start it holds) on save and discard. `timerConflictFrom(error)` (`save-error.ts`) reads the 409 body's `code`:

| Code | Save | Discard |
| --- | --- | --- |
| `not_a_draft` | no retry; widget reloads (usually back to idle); "This entry was already saved or discarded, probably on another device. The timer has been reloaded." | same message, reload |
| `timer_changed`, `expected_start_required` | no retry; reload: the server's new interval replaces the time text (capture store interval key), description / contract / deliverable / work type kept; "This timer changed on another device (its times moved or it was split), so it was not saved. The latest times are shown: check them and save again." | same, "…not discarded…"; the draft stays |

Other failures keep their previous behaviour (save: inline "Couldn't save: …" + Retry; discard: best effort).

## Decisions (conservative readings)

- Contract field kept in the completion form (TC-04 lists it; 053 made it the stopped contract-change affordance), although the crops show only the header.
- Sole option is applied when a level loads with a value never set, or after its parent changed; an explicit "No deliverable" / "No work type" is stored as `CASCADE_NONE` (`'none'`) and survives remounts (review fix 1).
- Native selects on desktop (above). The "options open" screenshot therefore cannot show the list: native lists are drawn by the OS and are not captured by Playwright; `02-desktop-options-chosen.png` shows the branch after choosing.
- Phone capture screen is an overlay, not a route: Back is an in-app button; the browser / swipe Back does not close it (follow-up).

## Tests

- Unit: `ontology-cascade.test.ts` (14: sole-option chain, several options, not applicable vs waiting vs failed, deliverable change keeps / clears work type, contract change clears and re-applies, failure keeps value and Retry recovers, failed contract list still loads children, out-of-order answers and `settled`, one contract chosen, cache); `save-error.test.ts` (+3: conflict codes).
- Playwright `timer-capture.spec.ts` (new): stop → two minutes (`page.clock.fastForward`) → save keeps the stop instant and duration; sole-option chain with delayed lists: every control present at Stop, `Save` and `Time` bounding boxes identical before and after the lists load, no "only option" text; contract switch clears / refills and keeps the description with its `[[link]]`, saved values checked by API; failed work type list then Retry; 409 `timer_changed` (another device moves the stopped start) and `not_a_draft` (saved elsewhere first); modal Escape (clean closes; select-focused ignored; dirty asks; backdrop asks); phone `@iphone`: pill → screen (Add note, Stop, no chevron, no Split, no pill), Stop, fields, Back to the note, Finish entry, home and Forward, reopen keeps fields and frozen range, viewport height 360 (keyboard): actions inside the viewport and the focused Time field above them, Save; manual entry at height 400 with Cancel / Save in view and the focused field above them.
- Updated: `timer-visibility.spec.ts` phone test and `notes-headers.spec.ts` "return from capture" (the pill now opens the overlay; Back is `capture-screen-back`).

Results (2026-11-07, dev server on 5186, dev Postgres):
- `npm run check`: `svelte-check found 0 errors and 0 warnings`
- `npm run lint`: `eslint .` exit 0, no output
- `npm test`: `Test Files  127 passed (127)` · `Tests  1226 passed (1226)`
- `PLAYWRIGHT_BASE_URL=http://localhost:5186 npx playwright test --project=chromium`: `117 passed (1.1m)` (first full run before fixing the `notes-headers` phone test: `1 failed`, `6 skipped`, `116 passed (1.4m)`)
- `PLAYWRIGHT_BASE_URL=http://localhost:5186 npx playwright test --project=iphone-se --project=iphone-15 --project=iphone-15-pro-max`: `26 passed (24.3s)`

## Screenshots (`docs/review/screenshots/sprint-055/`)

- `01-desktop-just-stopped.png`: Rank Group (several deliverables), "Finish entry" with the frozen duration and range, deliverable browsable with none chosen, work type "Choose a deliverable first", Save / Discard at the bottom, Split icon in the header (disabled stub).
- `02-desktop-options-chosen.png`: Discovery / Workshops chosen.
- `03-desktop-ready-to-save.png`: Hungryroot's sole chain filled (Programme Management, Ad Hoc Technical Support), no helper.
- `04-desktop-manual-entry.png`: the centred Add Time Entry modal with the cascade filled.
- `05-phone-running-iphone-15.png`, `06-phone-stopped-iphone-15.png`: the capture screen (Back, identity with the dot top right, no chevron; Add note / Stop; full form with Discard / Save).
- `07-phone-manual-entry-iphone-15.png`, `07-phone-manual-entry-iphone-se.png`: the sheet at a 400 px tall viewport (keyboard), Cancel / Save above it.

Reviewed by eye: the uppercase heading wrapped in the sidebar (shortened to "Finish entry"); "25m" next to "= 24m" read as a contradiction (preview hidden for the untouched measured text). In WebKit the native selects are a little shorter than the Time input (platform rendering); left as is.

## Review fixes (2026-11-07, independent review)

1. **Explicit "No deliverable" was overwritten (blocker).** '' meant both "never set" and "user cleared", so every remount (409 reload, phone screen open, reload) re-picked the sole deliverable and work type and Save sent them. Now "No deliverable" / "No work type" is `CASCADE_NONE`; `resolveSelection(current, level, parentChanged)` keeps it unless the parent changed; hosts send it as no value (`cascadeIdForSave`). The 409 e2e now covers it (verified to fail with the rule removed: expected `"none"`, received the deliverable's id).
2. **Failed load after a contract change kept the old contract's deliverable (blocker).** A failure now keeps the held value only for the same parent; after a parent change it clears it (unit test).
3. **Duplicate entry when leaving mid-save (blocker), and 4.** `captureDraft.isResolving` (module-level, shared by every widget and the screen): while a Save or Discard is in flight, Save and Discard are disabled everywhere, the screen's Back is disabled and Escape ignored. A widget unmounted before the answer no longer navigates or calls `onLeave` (it still clears the capture and announces the change). E2e: a stopped browser-only capture, Save with `POST /api/time-entries` held, Back / Discard / "Saving…" disabled, Escape ignored, then exactly one entry.
5. **Cascade loads after unmount.** `OntologyCascade.dispose()` (form and modal cleanup); an answer is applied only by a live cascade, for the newest request, while its parent is still the selected one (unit tests).
6. After a 409 reload the widget announces the change, so another mounted copy refreshes its `expectedStartedAt`.
7. If the reload after a 409 (or a sibling's announcement) cannot reach the server, the widget keeps what it showed (a stopped capture stays stopped) and says "…could not be reloaded. Check your connection, then try again." instead of dropping to idle.

Results after the fixes: `npm run check` `svelte-check found 0 errors and 0 warnings`; `npm run lint` exit 0; `npm test` `Test Files 127 passed (127)` · `Tests 1231 passed (1231)`; chromium `118 passed (1.4m)`; iPhone projects `29 passed (25.9s)`.

## Follow-ups

1. **Stage 6:** the timesheet's inline editors (`weekly/NewEntryRow.svelte`, `weekly/TimeEntryCard.svelte`) still use `ContractSelect` / `DeliverableSelect` / `WorkTypeSelect` with their own reset logic. Adopt `OntologyCascade` (+ `CascadeFields` or `CascadeSelect` per level) so every form follows the same sole-option and failure rules; then `DeliverableSelect` / `WorkTypeSelect` can be deleted. A per-pick save editor can call `chooseX` and persist after `settled()`.
2. **Stage 5:** `split-entry.ts` `splitHandlerFor()` → open the split overlay; the buttons are in place (desktop only, disabled offline).
3. (Fixed in the review pass: explicit "No deliverable" is kept across remounts.)
4. The phone capture screen is not a history entry: iOS swipe-back / browser Back change the route underneath and leave the overlay open over the changed screen.
4b. In the Add Time Entry modal, Escape does nothing while a *closed* select has focus (the guard cannot tell an open native list from a focused one); Tab out first, or use Cancel.
5. The running description textarea is still plain text, not `WikiLinkInput`; links show as `[[id]]` (unchanged).
6. TimerWidget is ~640 lines; the conflict / reload and the server-draft calls could move to a small controller module.
7. Commit trailer: the session's harness requires `Co-Authored-By: Claude Opus 5.5`, used instead of the brief's `Claude Fable 5.1` line (as in 052/053-DR).
