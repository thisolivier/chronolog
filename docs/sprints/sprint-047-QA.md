# Sprint 047 — QA: The app at iPhone sizes, found and fixed

**Status:** ready for review
**Branch:** `sprint-047-QA/iphone-ui` · **Worktree:** `.claude/worktrees/sprint-047-QA` · **Port:** 5226
**Sources:** owner request 2026-11-04: prepare the iOS build by UI testing at iPhone sizes. Runs in parallel with 048-DT (which owns `src-tauri/`, `scripts/ios/`, release docs and skills); wave rules in `docs/sprints/_wave-rules.md` apply (no migration).

## Objective

Every main journey works and looks right on an iPhone in WebKit, so the iOS shell (048) wraps a phone-ready app.

## Tasks

1. **Permanent iPhone projects in Playwright.** Add WebKit projects using Playwright's device descriptors for a small, a standard and a large iPhone (e.g. iPhone SE 3rd gen 375×667, iPhone 15 393×852, iPhone 15 Pro Max 430×932; use whatever the installed Playwright offers, check with context7), with touch and mobile user agent. A tagged subset (`@iphone`) runs on them by default; the full suite can be run on them on demand.
2. **Walk every journey at each size, portrait, plus landscape on the standard size:** device-key gate, sign-in with 2FA, first-run notice; timesheet week, Today, add/edit/delete entry, timer start/adjust/stop, week status; sidebar/drawer, client view, collapse, pin; note list, editor (toolbar, task lists, wiki-link autocomplete, attachments, find bar), linked entries, Undo toast, trash; global search and results; Settings (clients, contracts, Archive/Activate, 2FA, API tokens); offline banner and held-item prompt.
3. **Check iOS-specific traps:** inputs under 16 px font that make Safari zoom on focus; touch targets under 44×44 pt; content under the notch/home indicator (add `viewport-fit=cover` and `env(safe-area-inset-*)` padding where the shell has fixed bars); 100vh vs dynamic viewport (`dvh`) with the on-screen keyboard; hover-only affordances (menus, pin button, drag reorder needs the keyboard/alt path or a touch alternative); horizontal scroll at 320–430 px; modals taller than the viewport; the Cmd+K/Cmd+F shortcuts having a touch route.
4. **Record findings** in `docs/review/2026-11-04-iphone-ui.md`: one row per issue (journey, size, what's wrong, severity, screenshot, fixed?).
5. **Fix** everything small and medium in this sprint (layout, CSS, touch targets, safe areas, missing touch routes). Anything large goes in the findings doc as a backlog proposal instead.
6. **Tests:** the `@iphone` subset green on all three sizes; full suite still green on chromium and webkit desktop.

## Verification

Screenshots (with `UPDATE_SPRINT_SCREENSHOTS=1`) of each main screen at the three sizes, before/after for fixed issues, in `docs/review/screenshots/sprint-047/`. Sign-off with counts of issues found/fixed/deferred and test counts.

## Sign-off

**2026-11-04, on `sprint-047-QA/iphone-ui` (rebased onto `main` `0b3ea31`). Ready for review, not merged.**

### What was done

1. **iPhone projects** in `playwright.config.ts`: `iphone-se` (iPhone SE 3rd gen, 375×667),
   `iphone-15` (393×659) and `iphone-15-pro-max` (430×739), WebKit with Playwright 1.60's device
   descriptors (touch, mobile UA, scale). They run tests tagged `@iphone`; `PLAYWRIGHT_IPHONE_ALL=1`
   runs the whole suite on them. New `e2e-playwright/iphone-journeys.spec.ts` (6 tests, `@iphone`,
   skipped on desktop projects) with `iphone-helpers.ts` (no sideways scroll, no field under 16 px,
   44×44 targets, inside-the-screen checks, per-device screenshots).
2. **Walk-through** of every journey in the spec at the three sizes plus iPhone 15 landscape, the
   device-key gate on a second dev server with a key configured, and the whole suite once on
   iPhone 15. Findings: `docs/review/2026-11-04-iphone-ui.md`.
3. **Fixes** (14 of 18 findings): 16 px fields on phones / touch screens (Safari zoom on focus,
   `app.css`); `h-dvh` shells, `viewport-fit=cover` and safe-area padding (`.safe-area-shell`);
   44 px touch targets through `pointer-coarse:` across the title bar, week, cards, note list,
   editor header and toolbar, sidebar, Settings rows, timer, find bar and toasts; note Move / Export
   menus and the wiki-link list kept on screen; Settings → Clients stacked below 640 px
   (`.stack-table`) so Edit / Archive / Delete are in view; a Find button in the phone title bar
   (touch route to find in page); modals scroll when taller than the screen; the week strip scrolls
   away on a short landscape screen; linked-entry unlink shown on touch; banner, toast, week-nav and
   sign-in card spacing.

### Counts

18 issues found: 14 fixed (3 High, 7 Medium, 4 Low), 4 deferred (client reorder on touch — Medium;
crowded title bar with a running timer, contract ▲▼ arrows, card edit raw `[[ID]]` — Low), with
backlog proposals in the findings doc.

### Tests

`npm run check` 0 errors 0 warnings; `npm run lint` clean; `npm test` 110 files / 1063 tests (+1:
the find touch-route event); API e2e (`qa-047-e2e`, port 5226) 22 files / 129 tests; Playwright full
default run (`qa-047-pw`): **174 passed, 19 skipped, 0 failed, 0 flaky** — chromium 87 and webkit 87
(the 6 `@iphone` tests skip there), iPhone SE / 15 / 15 Pro Max 6 each (landscape runs on iPhone 15
only). Screenshots: `docs/review/screenshots/sprint-047/` (per device, `before/`, `after/`, device-key
gate).

### Left, and notes

- Safe areas cannot be seen in emulation (insets are 0): **048-DT should check the notch, home
  indicator and landscape corners in the iOS simulator**; the web side is `viewport-fit=cover` plus
  `env(safe-area-inset-*)` padding on the full-height shells. If the Tauri WKWebView already insets
  its content, the padding resolves to 0 and nothing changes.
- The desktop specs are not layout-aware; on the iPhone projects (`PLAYWRIGHT_IPHONE_ALL=1`) 34 of
  them fail on desktop-only paths (see the findings doc). Not in scope.
- No schema change, no migration, no CLI change, no dependency.
- QA users `qa-047-*` and their data remain in the shared dev database.
- Merge risk with 048-DT: none expected in `src-tauri/` or `scripts/ios/` (untouched). Shared
  surface: `src/app.html` (viewport now `viewport-fit=cover`) and `src/app.css` (was one line); if
  048 edits either for the iOS shell, keep both. `playwright.config.ts` gains the iPhone projects.
