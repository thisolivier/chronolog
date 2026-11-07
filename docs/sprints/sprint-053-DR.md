# Sprint 053 — DR: Design r1 stage 3a, app shell, sidebar and one visible timer

**Status:** ready for review
**Branch:** `design-r1-stage3a` (from the integration branch `design-r1` at `c1e43d2`) · **Worktree:** `.claude/worktrees/design-r1-stage3a` · **Port:** 5182 (5183 was the stage 3b worktree's server)
**Sources:** `docs/design/r1/specs/02-shell-and-navigation.md` (SH-01 to SH-08, state matrix), `03-time-capture.md` (TC-02, TC-06), `01-design-system.md` (DS-02, DS-05, DS-06), source maps `02-shell-and-navigation.md` and `03-04-capture-and-split.md`, decisions of 2026-11-07 (solid marks, no pattern tiles).
**Runs alongside:** stage 3b (notes list header, editor header, toolbar, linked time, note scroll restoration). This sprint did not touch the 3b files.

**Goal:** the shell and sidebar in the r1 design, global search at the far right, and exactly one visible representation of the timer: an expanded or collapsed sidebar widget, or a header reflection when no widget is on screen, with the completion fields in one shared store.

## What was built

### A. Sidebar (SH-02, DS-05)

- A client with two or more contracts is a pale tinted section (`bg-sunken`, `rounded-panel`). The heading is the client name in `text-sm font-semibold` with **no colour dot**; the collapse chevron and the client view stay. Each contract row: `ContractMark size="sm"` (client colour + initials), the name at `gap-mark-gap` (5 px token), the note count at the right.
- The selected contract (and the viewed client's name) is a **surface punch-out**: `bg-surface shadow-panel ring-1 ring-divider`, `font-medium text-ink`. The ring is the "selection edge if needed": on the canvas the flattened row's surface alone was too close to the background (`#fffefa` on `#f8f6f0`). Time Entries and the "Notes" heading use the sage `bg-selection` when current (as in the raw 12 reference).
- **Looser alignment kept.** Inside a group the heading text and the child marks share one inset (30 px from the sidebar edge); a single-contract client stays one flattened row at the outer inset (marks at 24 px), with the client name beneath. No universal alignment. The client chevrons stay in one column with the Archived chevron (4 px right inset).
- Archived, Trash and Settings: sentence case, 16 px icons, `text-ink-muted`, the same hover. Time Entries got a calendar icon. Pinned notes are untouched (they are in the note list, not the sidebar).
- `ContractMark`: three initials (`RGM`) overflowed the 16 px square; at `sm` they now render one step smaller (`0.4rem`, `tracking-tighter`). Two-letter marks are unchanged.
- Every `data-testid` and accessible name is kept; contract buttons still start their name with the contract name (the mark is `aria-hidden`).

### B. Mute Notes while reviewing time (SH-03)

One wrapper, `sidebar-notes-section` (`data-muted`), from the "Notes" heading to Settings gets `opacity-50` while Time Entries is selected (200 ms fade). Time Entries and the timer are outside it. Nothing is disabled, no `inert`, no `aria-disabled`. Inactive contracts no longer use `opacity-50` (now `text-ink-fainter`), and archived / inactive ContractMarks drop their own `muted` (60 %) while the wrapper is on, so the lowest effective opacity is 50 %. Tested by multiplying computed opacities up the tree.

### C. App bar (SH-05, SH-01)

Left: ≡, Chronolog, ‹ ›. Right: the timer reflection (when shown), then the global search field at the far right. The `/search` page keeps its own header (‹ › left of its field) for the later search stage. The phone bar is unchanged except for the timer rule below.

### D. One visible timer (SH-04, SH-06, TC-02, TC-06)

- **Identity header (TC-02, `TimerIdentityHeader.svelte`).** ContractMark `lg`, contract name first, client as subtitle, on the client's wash colour. The pulsing green light sits at the **top right** (static under reduced motion through `app.css`); there is no RECORDING text. The collapse chevron is a separate button below and left of the light. Running with a contract: a visible **"Change"** button (accessible name "Change contract") reveals the existing ContractSelect, focused; "Keep this contract" hides it again; picking a contract closes it. Before a contract is chosen the select shows as before, with its hint. Stop keeps the text "Stop" (the Tauri tray clicks it); compact keeps it in the DOM, hidden.
- **Collapse (SH-06).** Desktop and tablet sidebar widget only (no chevron on a phone or in the phone timesheet footer). The chevron switches the same component to one compact row: small mark, contract / client, and the clock (running, with the light) or "Finish entry" with the frozen duration (stopped). The body stays mounted with `hidden`; the preference is per browser (`chronolog:timer-compact`).
- **Header reflection (SH-04, `TimerIndicator`).** Shows only when `headerReflectionFor()` says no widget is on screen. It shows the capture's own identity (mark, contract, client), not the browsed contract. Running: clock (ticks from the shared start, so it keeps time on a phone note screen with the widget unmounted) and the light at the top right. Stopped: "Finish entry", the frozen duration, no light, `data-state="finish"`.
- **Clicking it.** Desktop with the sidebar hidden, or tablet with the overlay closed: **shows the sidebar** (`openSidebar`), where the same widget lives. Chosen over a popover as the simpler path: no second mount of the widget, no focus management. Phone: opens the capture screen (home, level 0) as before; Back returns to the note.
- **Phone opened straight on a note.** No widget mounts there, so nothing used to publish the capture. AppShell now reads it once, read-only (`timer-reflection.ts`: `GET /api/timer/status`, else the pending timer) and the first widget to mount takes over. It never starts, stops, saves or discards.
- The pre-053 idle "▶ Timer" button (desktop, sidebar hidden, no capture) is kept as the matrix's "existing Start timer / Add entry access"; no new idle UI.

### Visibility matrix as implemented (`timer-visibility.ts`)

| Situation | Header (`timer-indicator`) | Widget | Tested in |
|---|---|---|---|
| Desktop sidebar expanded (running or stopped) | hidden | expanded | unit; `timer-visibility.spec` desktop 1 |
| Desktop sidebar timer collapsed | hidden | compact row | unit; spec desktop 1 and 2 |
| Desktop sidebar hidden (≡), running | `data-state="running"`: mark, contract, client, clock, light | mounted at 0 px, not on screen | unit; spec desktop 1 |
| Desktop sidebar hidden, stopped unfinished | `data-state="finish"`: Finish entry, frozen duration, no light | not on screen | unit; spec desktop 2 |
| Tablet notes, overlay closed / open | shown / hidden (the desktop hide preference does not apply) | overlay | unit |
| Tablet time mode (inline sidebar) | as desktop | inline | unit |
| Phone home (capture screen) or timesheet (footer widget) | hidden | full widget, no chevron | unit; spec phone |
| Phone note list / note | shown (running or Finish entry), opens home | none mounted | unit; spec phone |
| No running or unfinished capture | none (desktop with sidebar hidden keeps the old "Timer" access) | Start Timer / Add Entry | unit |
| Off-shell routes (`/search`, `/settings`, `/notes/trash`) | no AppShell: **no timer access there**; stage 7 brings `/search` into the shell, `/settings` and `/notes/trash` are a follow-up | none | — |

### E. Shared capture state (IN-03, TC-06, SH-07)

`src/lib/stores/capture-draft.svelte.ts` (`captureDraft`) with pure helpers in `capture-draft.ts`: contract, deliverable, work type, description, time text and the measured text (the frozen interval stays on the server row or pending timer only; see review fixes). Persisted in localStorage per user (`chronolog:capture-draft:<userId>`; the root layout calls `configure(userId, localStorage)` before the panels mount). TimerWidget calls `open(captureKey, initial)` when it stops a timer or finds a stopped draft (key `entry:<id>` or `pending:<date>T<start>`); stored fields for the same capture win over what the server knows. `TimerCompletionForm` binds to `captureDraft.fields` and writes through on every change; Save and Discard clear it; a mount that finds no server draft and no pending timer clears a stale record. The server timer model and the `expectedStartedAt` on save / discard are unchanged; there is no second timer model.

### F. Owner backlog item (2026-11-05, desktop timer placement)

The backlog asked to hide the header pill while the sidebar timer is on screen (done) and, with the sidebar collapsed, to show the widget in the middle panel. The spec's later rule (SH-04: a header reflection when the sidebar is hidden; no persistent timer bar in the notes workspace) supersedes the middle-panel idea, so it was not built. `docs/backlog.md` is left for the owner to close.

## Hooks exposed for stage 3b

- `src/lib/components/layout/shell-presentation.svelte.ts` → `shellPresentation.sidebarOnScreen` (false: desktop sidebar hidden, tablet overlay closed, phone screen other than home), `layoutMode`, `timerWidgetOnScreen`. Written only by AppShell. The notes list header can read `sidebarOnScreen` to decide whether it repeats the client / contract context the sidebar would otherwise show.
- `ContractMark` now fits three initials at `sm`; no API change.

## Tests (verbatim)

- `npm run check`: `svelte-check found 0 errors and 0 warnings`
- `npm run lint`: `> eslint .` with no findings
- `npm test`: `Test Files  124 passed (124)` · `Tests  1193 passed (1193)` (new: `capture-draft.test.ts` 7: persist / restore across a fresh store, stale capture replaced, per user, clear, no storage; `timer-visibility.test.ts` 8: every matrix row)
- `PLAYWRIGHT_BASE_URL=http://localhost:5182 npm run test:playwright:chromium` (server: `ALLOW_REGISTRATION=true TRUSTED_ORIGINS=http://127.0.0.1:5182,http://localhost:5182 npm run dev -- --port 5182`):
  ```
  3 failed
  6 skipped
  99 passed (1.2m)
  ```
  The 3 failures are `search-results-layout.spec.ts` (desktop, phone 320, phone 390): `expect(kinds).toEqual(['entry', 'note', 'note', 'note', 'entry', 'entry'])` receives `['note', 'note', 'note', 'entry', 'entry', 'entry']`. **Pre-existing, not from this sprint:** the same spec fails the same way (`3 failed, 1 passed`) against the stage 3b server on port 5183, which has none of these changes. The spec seeds an entry for today at 23:30 and expects it first; at 11:38 PST (19:38 UTC) the notes sort ahead of it, so it looks clock / time-zone dependent. The search route and API are untouched here.
- iPhone WebKit projects, `PLAYWRIGHT_BASE_URL=http://localhost:5182 npx playwright test --project=iphone-se --project=iphone-15 --project=iphone-15-pro-max`: `2 skipped` · `20 passed (19.7s)` (includes the new phone timer test, tagged `@iphone`).
- **After the review fixes:** check `svelte-check found 0 errors and 0 warnings`; lint clean; `npm test` `Test Files 124 passed (124)` · `Tests 1194 passed (1194)`; chromium `3 failed` · `6 skipped` · `99 passed (1.3m)` (the same 3 `search-results-layout` failures, fixed on `design-r1` by correcting the test); iPhone projects `1 flaky` · `2 skipped` · `19 passed (28.7s)` (the flaky one is `iphone-journeys.spec.ts:27` "sign in, then the week…" on iphone-15-pro-max, passed on retry; not a timer or sidebar test).
- New specs: `timer-visibility.spec.ts` (desktop: expanded / Change / collapsed / hidden / browsed-vs-capture identity / click shows sidebar; stopped: compact Finish entry, header Finish entry with a frozen duration over 1.5 s, fields survive `/settings` and back and the 600 px crossing, Discard clears the stored record; phone: reflection on a note, ticking clock, tap opens home, Stop, Back shows Finish entry, survives reload, fields restored), `sidebar-design.spec.ts` (tint is `--color-sunken`, no dot, marks, surface selection, 5 px mark gap, count at the right, flattened row left of the grouped marks; mute: wrapper 0.5, Time Entries and timer 1, Archived / Trash / Settings / heading 0.5, inactive and archived rows and marks 0.5 not 0.25, keyboard Enter and mouse still navigate).
- Updated: `history-buttons.spec.ts` (search field in the right half of the app bar, within 48 px of its right edge; ‹ › in the left half; the `/search` page assertion unchanged), `notes-helpers.ts` (`expectSidebarSelected`: `aria-current` + `bg-surface` instead of `/pine/`), `sidebar-archive-collapse.spec.ts` (`bg-surface`; the solo row's dot is now a `contract-mark`).

## Screenshots (`docs/review/screenshots/sprint-053/`, chromium)

- `01-desktop-notes-expanded-timer.png`: 1280×800, tinted Amplitude group with marks, surface selection, running widget (Lake wash, HM mark, contract then client, Change, light top right, chevron).
- `02-desktop-collapsed-timer.png`: the compact row (mark, contract / client, clock, light, chevron); no header pill.
- `03-desktop-time-entries-muted-sidebar.png`: Time Entries selected; Notes to Settings at 50 %, Archived expanded; the timer at full opacity.
- `04-desktop-hidden-sidebar-header-pill.png`: sidebar hidden, header reflection names Hungryroot while Rank Group is browsed, search at the far right.
- `05-iphone-notes-header-pill.png`: 390×844 note screen with the running reflection.
- `06-desktop-stopped-unfinished.png`, `06b-desktop-header-finish-entry.png`: the completion form under the identity header; the header's Finish entry with the frozen 1m.
- `07-iphone-finish-entry.png`: phone note screen with Finish entry after a reload.
- `08-sidebar-selected-contract.png`: sidebar close-up (group, inactive row, flattened rows, Archived / Trash / Settings).

Reviewed by eye: the flattened row's selection needed the ring to read on the canvas (added); `RGM` overflowed its mark (fixed). Still reads tight: see follow-ups.

## Review fixes (independent review, same day)

1. **Stale time text after a server interval change (blocker).** The draft had one key (the entry id) and an in-memory early return, so after a split / resume / move elsewhere a reload restored the old time text, equal to the old measured text, and Save sent no time: the form showed 1h and the server saved 30m. Now the record has a second key, `intervalKey` (date, start, end, minutes), checked against memory and storage on every `open`: a changed interval resets the time and measured text from the server and keeps description, contract, deliverable and work type. The stored end / start / date were dropped (never read; the server is the one source). Unit test for the key change; e2e moves the stopped draft's start by `PATCH /api/timer`, reloads, and checks the Time field reads the new range while the description survives.
2. **Focus lost on collapse (blocker, a11y).** The chevron is drawn in each layout; toggling now moves focus to the new chevron when the old one had it. Keyboard e2e: Enter collapses and expands with focus staying on the chevron.
3. A dragged client used `opacity-50` (25% inside the muted section): now a dashed pine outline.
4. The header pill appeared while the sidebar was still animating closed: showing it now waits 300 ms (the width transition); hiding it, phone changes and running ↔ Finish entry stay immediate. E2e checks no pill right after ≡, then the pill.
5. The read-only header loader names a stopped capture by the completion form's chosen contract (`captureDraft.contractFor`) before the server's.
6. `WorkTypeSelect` keeps the selected work type when loading the list fails (TC-05), so the write-through no longer persists a cleared value.
7. Phone header: the pill is the mark and the clock (running) or the mark and the frozen duration in ochre (stopped; "Finish entry" stays in the accessible name and as screen-reader text). With the pill showing, the phone context title is dropped (3b's list and editor headers name the context) and "← Back" may use the whole left side. Screenshots 05 and 07 retaken.

## Decisions

- Header click on desktop shows the sidebar (no popover).
- A compact widget counts as "on screen" (SH-06), so the header stays hidden while collapsed.
- The stopped widget's contract-change affordance is the completion form's own Contract field (TC-04 wants every field present from the start of completion); "Change" is in the running header only.
- The completion form's heading reads "Finish entry: save or discard it" (was "Timer stopped: save or discard this entry").
- Kept the pre-053 idle "Timer" access with the desktop sidebar hidden (matrix: existing access, no new idle UI).
- The list panel stays resizable (pre-existing; SH-01's "not resizable in this scope" is read as "do not add resizing").

## Follow-ups

- `/settings` and `/notes/trash` sit outside the app shell and have no timer access (stage 7 brings `/search` in).
- The compact desktop row truncates contract and client hard at 240 px; the clock could go to `text-xs`.
- `--spacing-mark-gap` (5 px) and the `sm` mark still need the DS-05 actual-size review; three-initial marks at `sm` are small (0.4rem).
- A stopped capture's identity follows the completion form's Contract choice in the widget and header; the read-only phone loader uses the server's contract until a widget mounts.
- The hidden desktop sidebar is still not `inert` (keyboard can tab into it at 0 px), as before.
- The Tauri menu bar still only ticks while a widget is mounted (the header pill now ticks on its own).
- `docs/backlog.md` "Owner-requested (2026-11-05)" can be closed by the owner (superseded by SH-04).
- `search-results-layout.spec.ts` ordering failure (pre-existing, time dependent) needs its own look.
- Commit trailer: the session's harness requires `Co-Authored-By: Claude Opus 5.5`, used instead of the brief's `Claude Fable 5.1` line (as in 052-DR).
