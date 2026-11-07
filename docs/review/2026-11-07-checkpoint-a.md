# Checkpoint A — integrated QA of `design-r1` (2026-11-07)

**Branch:** `design-r1-qa-a` from `design-r1` at `0b01e71` (stage 2 tokens 052-DR, stage 3a shell 053-DR, stage 3b notes headers 054-DR, split/resume API 056-DR-api, shared search matcher 058-DR-api).
**Server:** `npm run dev -- --port 5185` with `ALLOW_REGISTRATION=true`, `BETTER_AUTH_URL` / `TRUSTED_ORIGINS` = `http://localhost:5185`; dev Postgres `chronolog-postgres-1`.

**Verdict: ready for owner review.** The merged stages pass every suite; the one interaction found (two copies of the "navigation hidden" rule) is unified, and no merge broke behaviour.

## Test results (verbatim)

### First run, on the merge as received (`0b01e71`)

- `npm run check`: `svelte-check found 0 errors and 0 warnings`
- `npm run lint`: clean (no output)
- `npm test`: `Test Files 126 passed (126)`, `Tests 1209 passed (1209)`
- `npm run test:e2e` (API, `E2E_BASE_URL=http://localhost:5185 BETTER_AUTH_URL=http://localhost:5185`): `Test Files 24 passed (24)`, `Tests 150 passed (150)`. (Without `BETTER_AUTH_URL` set to the server's own origin the global setup fails with `Sign-up failed (403): {"code":"INVALID_ORIGIN"}`; environment, not code.)
- `npm run test:playwright` (all projects: auth-setup, chromium, webkit, iphone-se, iphone-15, iphone-15-pro-max; iPhone projects run the `@iphone` subset per `playwright.config.ts`): `2 flaky`, `19 skipped`, `229 passed (2.4m)`
  - flaky, passed on retry: `[webkit] timer-visibility.spec.ts:55 expanded, collapsed and hidden` — `expect(dotBox.y + dotBox.height).toBeLessThanOrEqual(chevronBox.y)`, `Expected: <= 575.0625`, `Received: 575.07470703125`. Sub-pixel rounding of the pulsing light's box in WebKit; not a merge interaction. Fixed with half a pixel of slack.
  - flaky, passed on retry: `[webkit] timer-start-today.spec.ts:157 a timer with no contract yet moves its start` — `toHaveValue` `Expected: "11:14"`, `Received: "11:13"`. The test computes "45 minutes ago" at assertion time and the minute rolled over in a 13 s run; pre-existing timing flake, not touched (timer start area belongs to stage 4).

### Re-run after the fixes (`68931ef`)

- `npm run check`: `svelte-check found 0 errors and 0 warnings`
- `npm run lint`: clean
- `npm test`: `Test Files 126 passed (126)`, `Tests 1209 passed (1209)`
- `npm run test:e2e`: `Test Files 24 passed (24)`, `Tests 150 passed (150)`
- `npm run test:playwright` (all projects): `26 skipped`, `237 passed (2.6m)`, no failures or retries. The 7 extra skips are `checkpoint-a-screenshots.spec.ts`, off unless `CHECKPOINT_SCREENSHOTS=1`; of the 8 extra passes, 6 are `checkpoint-a-acceptance.spec.ts` (3 tests × chromium, webkit) and 2 are the first run's flaky tests, which passed first time.

## Fixes

1. **One source of truth for "navigation hidden"** (`350bf6b`). `note-context-ownership.ts` derived it from `navigation.panel1Collapsed` and "tablet is always hidden", a second copy of what AppShell writes to `shellPresentation.sidebarOnScreen` (and the timer reflection uses). The list and editor headers now read `shellPresentation.sidebarOnScreen`; a phone is always hidden. AppShell writes the record in `$effect.pre`, so the panels' first render already sees it (no frame with the wrong header after a reload with the sidebar hidden). Behaviour change: on tablet with the overlay sidebar *open*, the list header says "Notes" (the open overlay names the contract), as on desktop. Unit tests and the layout README updated.
2. **Acceptance spec** `e2e-playwright/checkpoint-a-acceptance.spec.ts` (`dee4f96`, chromium + webkit, 3 tests) for the rows only the merged branch can exercise; seed in `checkpoint-a-seed.ts`.
3. **Flaky sub-pixel assertion** in `timer-visibility.spec.ts` (`dee4f96`).
4. **Compact sidebar timer** (`68931ef`): the clock went from `text-sm` to `text-xs` so "Hungryroot" is no longer cut to "Hungryr…" in the 240 px row (053-DR follow-up).

## Acceptance walk (SH, NT)

| Row | Where it is checked | Result |
|---|---|---|
| Browse Rank Group while timing Hungryroot: note context Rank Group, timer Hungryroot | `checkpoint-a-acceptance` test 1 (sidebar selection, list and editor `data-contract-id`, widget identity, server timer contract) | pass |
| Hide/show sidebar, collapse/expand timer: never duplicate controls | `timer-visibility.spec` desktop 1; `checkpoint-a-acceptance` test 1 (pill names Hungryroot, not the browsed Daily Pay) | pass |
| Time Entries mutes Notes but stays operable | `sidebar-design.spec` "Time Entries mutes Notes…" | pass |
| Stop on phone, details, Back, reopen Finish entry | `timer-visibility.spec` phone (chromium, webkit, three iPhones) | pass |
| Long note Back restores position | `notes-headers.spec` desktop and phone | pass |
| Three-column single-contract view: no triple label | `notes-headers.spec` desktop 1 | pass |
| Hidden navigation restores readable context | `notes-headers.spec` desktop 1; `checkpoint-a-acceptance` test 1 | pass |
| Cross-contract note while another timer runs | `checkpoint-a-acceptance` test 1 (wiki-link Rank Group → Daily Pay) | pass |
| Copy code, Move, Export, Delete, Rich/Raw | `notes-headers.spec` (Note actions), `sidebar-notes-header.spec` (copy), `checkpoint-a-acceptance` test 3 (copy and Rich/Raw with a timer running) | pass |
| New note vs timer Add note in their own contexts | `checkpoint-a-acceptance` test 2 (New note → Rank Group; timer Attach note → Hungryroot, linked in the timer description) | pass |

## Screenshots (`docs/review/screenshots/checkpoint-a/`)

Regenerate with `CHECKPOINT_SCREENSHOTS=1 PLAYWRIGHT_BASE_URL=… npx playwright test e2e-playwright/checkpoint-a-screenshots.spec.ts --project=chromium --project=iphone-15`.

- `desktop-01-notes-three-columns-timer-expanded.png` — 1280×800, Amplitude / Hungryroot, long note, running timer expanded
- `desktop-02-notes-timer-collapsed.png` — same, compact timer row
- `desktop-03-note-actions-menu.png` — Note actions menu open (Move, Export as Markdown, Export as PDF, Delete)
- `desktop-04-sidebar-hidden-header-pill.png` — sidebar hidden; list header names Amplitude / Hungryroot; header pill
- `desktop-05-all-notes.png` — `/notes/all` with Pricing review (Rank Group) open
- `desktop-06-time-entries-finish-entry.png` — Time Entries, muted Notes, stopped unfinished timer (Finish entry form)
- `phone-01-notes-list.png` — iPhone 390×844, Hungryroot list
- `phone-02-note-toolbar.png` — note with the compact toolbar and linked time
- `phone-03-note-running-pill.png` — Rank Group note with the Hungryroot pill in the title bar
- `phone-04-formatting-overflow.png` — the Formatting overflow open

What reads wrong (looked at each):

- **Phone title bar repeats the context.** On the phone list and note (no running pill) the title bar says "Amplitude · Hungryroot" while the list header and the editor header name it too, so the phone note shows it twice. This is 054-DR's unmet hook for 053-DR (`titleForRoute`; the D26 mock-up shows "‹ Notes"). Not changed here: it is a navigation-label decision and `navigation-journeys.spec` J8 asserts the current title. With the pill running the title is already dropped (`phone-03`).
- **Wiki-link chip spacing:** "…are in ␣Payroll integration questions␣." — the chip's padding reads as a space before the full stop (desktop-05, phone-03). Pre-existing styling.
- **Disabled list buttons look faint:** with the caret in the H1 the bullet / numbered / checklist buttons (and "Ordered List" in the phone overflow) are drawn disabled; correct, but on a first look they read as low contrast rather than unavailable.
- **Time Entries with the completion form open:** the taller Finish entry form covers the lower sidebar list without a divider; the General row's mark peeks out above the form (desktop-06). Stage 4 owns the form; noted for it.
- **Week strip** (desktop-06): the week's Monday heading scrolls under the strip and "Unsubmitted ·" has a stray dot; stage 6 owns this.
- **Phone pill** shows the mark and clock only (no contract name) in `phone-03`; matches 053-DR's compact phone pill, but the owner may want the name.
- **Desktop editor body scrolls inside its box** with linked time pinned below (desktop-01, 04), so long notes show a cut line at the box edge; pre-existing (054-DR follow-up).
- No old blue remnants, no horizontal overflow, no misaligned headers seen.

## Known issues for the owner

1. Phone title bar repeats client · contract above headers that now name it (decide: "Notes" / note title, as in the D26 mock-up).
2. iPhone projects run only the `@iphone` subset by design; `PLAYWRIGHT_IPHONE_ALL=1` (whole suite on iPhones) was not run.
3. `timer-start-today.spec.ts:157` minute-boundary flake (WebKit), left for stage 4.
4. Off-shell routes (`/settings`, `/notes/trash`) still have no timer access (053-DR follow-up).
5. Hidden desktop sidebar is still not `inert` (keyboard can tab into the 0 px sidebar).
6. Commit trailer: the harness requires `Co-Authored-By: Claude Opus 5.5`, used instead of the brief's `Claude Fable 5.1` line (as in 052-DR and 053-DR).

## Commits on `design-r1-qa-a`

- `350bf6b` Notes headers read the shell's sidebarOnScreen: one rule for navigation hidden
- `dee4f96` Checkpoint A acceptance spec; timer-visibility sub-pixel slack
- `68931ef` Compact sidebar timer clock at text-xs; checkpoint A owner screenshots
- this document
