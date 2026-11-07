# Sprint 056 — DR (UI): Design r1 stage 5, the desktop two-card split

**Status:** ready for review
**Branch:** `design-r1-stage5` (from `design-r1` at `d281be6`) · **Worktree:** `.claude/worktrees/design-r1-stage5` · **Port:** 5189
**Server half:** [sprint-056-DR-api.md](sprint-056-DR-api.md) (`POST /api/timer/split`, `PATCH /api/timer { resume }`, the save/discard guards). This sprint adds no endpoint, no migration and no dependency.
**Sources:** `docs/design/r1/specs/04-split-time.md` (SP-01..SP-08, seven acceptance scenarios), `03-time-capture.md` TC-07, source map `03-04-capture-and-split.md`, sprint 055-DR (entry points, capture store, `isResolving`), crop `split-two-card-overlay.png`.
**Outside `timer/`:** none in `src/` (no AppShell, search, notes or weekly edits). New Playwright spec `e2e-playwright/split-time.spec.ts`.

## What was built

- **Overlay (SP-01).** `SplitTimeOverlay.svelte`: two independent cards side by side over the dimmed app, a modest "Split time" label and a floating Cancel above them, Flip between the cards. No enclosing dialog, no shared footer, no chevrons. It is moved to `<body>` and the rest of the page is made `inert` while open, so the sidebar widget and the header pill cannot be used (SH-04); the sidebar widget shows only "Splitting this time…" (no Stop). Desktop only: the Split buttons are not drawn below 768 px.
- **Entry points (TC-07).** The 055 stub is replaced: `split-entry.ts` `splitEntryFor()` returns the opener for a **server draft**. A browser-only (contractless) timer gets a disabled Split with the reason "Choose a contract to split this time" (decision below). Offline: "Split time is not available offline" (unchanged). Opening flushes the running description's debounce first (risk d4).
- **Times (SP-02).** `split-times.ts` + `SplitTimesFields.svelte`. Left: duration and From / To. Right: duration "until now" with From and To = Now while live (Stop in the header), or From / To when stopped. Left To and right From are one boundary; a left duration moves it from the start, a right duration moves it back from the end, or from Now at the moment the duration is confirmed (Enter or blur): the boundary is then a fixed moment, so the live part grows and nothing moves on ticks or while typing. Outer start (left From) and a stopped end (right To) stay editable. The shared parser (`duration.ts`) reads typed durations (a range is accepted for the left and a stopped right); zero, negative, future and ≥ 24 h parts are refused inline. Typed clocks land on the nearest day, so a midnight crossing works.
- **Content (SP-03).** Each card has description (with `[[links]]`) and the shared cascade (`SplitContentFields.svelte` → `CascadeFields` / `OntologyCascade`). The left starts with the original package, the right blank, contract included. Flip swaps the packages; the cascades are rebuilt for the swapped selections; times stay.
- **Left first (SP-04), right actions (SP-05), Cancel (SP-06), resize (SP-07), persistence (SP-08):** tables below.

## State table as implemented (`split-rules.ts`)

| Phase | Left card | Right card | Flip / Cancel / Escape / backdrop |
| --- | --- | --- | --- |
| `editing` (both unresolved) | editable; Save / Discard | editable; Stop while live; Save / Discard / Resume disabled, "Finish the first part to continue" | available (Escape and backdrop = Cancel; Escape inside a select is left to it) |
| `left-saving` (split request in flight) | "Saving…", fields disabled | disabled, Stop hidden | hidden / ignored |
| `resolved` (left saved or discarded) | summary in the same footprint (min-height kept): Saved / Discarded, duration, range, contract, description | editable; Stop while live; Save / Discard / Resume enabled | removed; Escape and backdrop do nothing |
| `right-busy` | summary | the action's label ("Saving…", "Discarding…", "Resuming…") | none |
| left Save fails | unresolved, all fields kept, error shown, Save reads Retry | completion actions still locked | still available |

Right actions after the left: **Stop** = `POST /api/timer/stop` (draft) or the pending timer's end (no save). **Save** = stop first if live, then `POST /api/timer/save` with `expectedStartedAt` (time overrides only if From / To were edited), or `createTimeEntry` with `<clientRequestId>:right` for a pending remainder. **Discard** = `POST /api/timer/discard` with `expectedStartedAt`, or clear the pending timer. **Resume** = `PATCH /api/timer { resume: true, expectedStartedAt, startTime if edited }` for a stopped draft (a running one: move the start if edited), then the right content is written to the draft; a pending remainder continues as the browser timer, or becomes a server draft from its start if a contract was chosen in the right card. Each closes the overlay; the widgets reload (`announceCaptureChange('split')`). 409 `timer_changed` / `not_a_draft` / `expected_start_required` close it with a notice ("…nothing was split here. The timer has been reloaded."); `start_overlaps_entry` asks to press again (then sends `confirmed`).

**Cancel before resolution:** nothing is written by the split, so the widgets just reload: still running, or stopped if Stop was pressed in the split (scenario 6). The left content edits are dropped (the original package is restored).

**Resize below 768 px (`resizeDecisionFor`):** `editing` → as Cancel; `resolved` → the remainder goes back to ordinary capture as it is (a running remainder keeps running with the right card's description / classification written to the draft, or as the pending timer; a stopped remainder stays stopped and its completion form opens with the right card's fields and edited times in the capture store; never Resume); `left-saving` / `right-busy` → the overlay disappears, the answer settles once (same `clientRequestId`, `isResolving` held), then the matching branch runs; growing again never reopens.

## Reconcile logic (SP-08, `split-marker.ts`, `split-reconcile.ts`)

One `clientRequestId` per split attempt (per overlay opening), reused by every Retry. Before `POST /api/timer/split` the browser writes `chronolog.split-marker` `{ clientRequestId, entryId, boundary, leftAction, request }`; a settled answer (200 or an HTTP error) clears it; a network failure keeps it ("Couldn't reach the server, so the first part may not be saved yet. Retry to finish it.").

A marker found when a widget loads the timer, or when Cancel / resize closes an unanswered split:
1. Read `GET /api/timer/status`. Offline → keep the marker for the next load (a user Cancel stays open and says so).
2. The marked draft starts at the boundary → the split happened; clear; the remainder shows as ordinary capture.
3. The marked draft still starts at `expectedStartedAt` → on load, re-send the same request (the user asked for it; the server performs it once); on Cancel, nothing happened: clear and cancel.
4. Otherwise (draft gone or another one) → re-send: 200 (normally `replayed`) applies the result (a pending remainder is written as the pending timer); a 404 after `left: discard` with a contractless right part is the known server gap → settled, the pending remainder restored from the marker (boundary, `expectedEndedAt`, right description) unless one exists; any other HTTP error → clear, "could not be finished". A notice in the widget says what happened.

## Decisions (conservative readings)

- **Contractless timers cannot be split** (disabled with a reason) rather than a second, browser-only split path: the API works on a draft row, and the pending path would need its own non-atomic create + rewrite. A *remainder* without a contract is supported (the API's `pending` answer).
- **Breakpoint:** the app's 768 px (`layoutMode === 'mobile'`), per source map O06.
- **Outer start edit** (left From) is sent as `PATCH /api/timer` just before the split, not atomically with it; if the split then fails, the capture keeps the new start. The overlap warning asks for a second press.
- **Tray:** the right card's testid is `timer-widget-split`, so the tray's "Stop" presses the right card's Stop while the overlay is open; closed, the overlay is unmounted and the sidebar widget's Stop is the only one.
- Native time inputs for From / To (as TimerStartField); they render in the browser's 12/24 h locale.
- Commit trailer: this harness requires `Co-Authored-By: Claude Opus 5.5`, used instead of the brief's Fable line (as in 055-DR).

## Tests

- Unit (34 new): `split-times.test.ts` (11: initial boundary, shared boundary, left from start, right back from a stopped end, right confirmed against now then fixed, ranges, zero, problems, midnight, Flip), `split-rules.test.ts` (9: the stage table, the resize decision table), `split-marker.test.ts` (7), `split-reconcile.test.ts` (7: none, happened, re-send on load, forget on Cancel, the 404 gap restores the pending remainder, 409 abandons, offline keeps the marker).
- Playwright `split-time.spec.ts` (chromium 9 + phone 1): 1 shared boundary both ways, left / right durations, fixed after ticks, zero and negative refused; 2 + 4 Flip content-only, left save with a different contract, Flip / Cancel gone, right start edit leaves the saved left, Escape / backdrop inert, right Save; 3 + 5 right actions locked with the reason, Stop before resolution, edited To kept (split still checks the server end), Resume from the right start with the right content; 6 Cancel after Stop → stopped completion, Escape from the stopped form; failed left save (500 by route) keeps everything and Retry succeeds; 7 resize before resolution, after left Save (running remainder with the right's fields), after left Discard (stopped pending remainder, fields kept), during Save (split request held by route, resize, release: exactly one entry, remainder stopped); a reload after an aborted request finishes the split from the marker; disabled without a contract and offline; phone: no Split running or stopped.

Results (2026-11-07, dev server on 5189, dev Postgres):
- `npm run check`: `svelte-check found 0 errors and 0 warnings`
- `npm run lint`: `eslint .` exit 0
- `npm test`: `Test Files 136 passed (136)` · `Tests 1318 passed (1318)`
- `PLAYWRIGHT_BASE_URL=http://localhost:5189 npx playwright test --project=chromium`: `136 passed (1.3m)` (the run before the last fix: `1 flaky` (`notes-autosave.spec.ts:40`, passed on retry, not touched here), `9 skipped`, `135 passed (1.8m)`)
- `… --project=iphone-se --project=iphone-15 --project=iphone-15-pro-max`: `35 passed (29.4s)`

## Screenshots (`docs/review/screenshots/sprint-056/`)

`01-two-cards-fresh.png`, `02-after-boundary-edit.png`, `03-after-flip.png`, `04-after-left-save.png` (summary keeps the footprint, Flip / Cancel gone, right actions enabled), `05-right-stopped-with-resume.png`. Reviewed by eye: the label was first drawn over the app header and the cards jumped when Cancel left (now one fixed-height row above the cards); time inputs were cut off in the 12 h locale (widened); the backdrop was darkened for the white label.

## Follow-ups

1. The `[[links]]` show as raw `[[id]]` text in the split description (as in the running panel); the crop's link chip needs the WikiLinkInput there too.
2. Outer start edit + split are two requests; a server `startTime` on the split would make them one.
3. Escape in a closed (focused) select does nothing, as in the Add Entry modal (055 follow-up 4b).
4. `split-session.svelte.ts` (~430 lines) and `SplitTimeOverlay.svelte` (~350) exceed the 200-line preference; the left summary and the right-action plumbing could move out.
5. If the tray presses Stop with the overlay open and the right part already stopped, the tray finds no Stop and opens `/time` (a full load): nothing is lost (the marker / server hold the state) but right-card edits are.
6. The original capture's edited time text (completion form) is not carried into the split; the split starts from the server's interval.
7. Contractless (browser-only) timer split, if wanted: marker + idempotent create + pending rewrite (source map O10).
