# Sprint 047 — QA: The app at iPhone sizes, found and fixed

**Status:** in progress
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

(pending)
