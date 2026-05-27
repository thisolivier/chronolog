# Sprint 015 — UX: Future Feature Recommendations (UX-4)

**Status:** signed-off
**Type:** research / design
**Backlog items:** UX-4
**Depends on:** Sprint 012-UX (timesheet redesign — signed-off), Sprint 013-UX (note-time linking UX — signed-off)
**Branch:** `sprint-015-UX/future-features`

## Objectives

Conduct a thorough, opinionated review of the entire Chronolog application and recommend
future features. This is a **proactive research sprint** — you are not implementing features,
you are identifying what the app should do next based on deep analysis.

**Critical directive: NO GIMMICKS.** Every recommendation must be grounded in a real user
need for a solo consultant doing billable time tracking. If a feature exists primarily to
be impressive or novel rather than practical, do not recommend it.

## Context

### What Chronolog Is

A time-tracking and note-taking app for a solo consultant. The user tracks billable hours
across 3-5 client contracts, writes notes about their work, and links notes to time entries.
The app runs as a Tauri desktop app (macOS) with a PWA mobile fallback.

### What Exists Today

Read these thoroughly before making recommendations:

- `docs/SPEC.md` — full specification
- `docs/ux/` — all UX documentation (14+ files from sprints 011-013)
- `docs/ux/timesheet-redesign-spec.md` — approved redesign (not yet implemented)
- `docs/ux/note-time-linking-spec.md` — approved linking UX (being implemented)
- `docs/backlog.md` — current backlog
- `BACKLOG.md` — if exists, additional backlog context

### User Profile

- Solo consultant, 10+ years experience
- Tracks billable hours across multiple client contracts
- Uses notes as a work journal (what was done, decisions made, meeting notes)
- Values speed of entry, clarity of review, and minimal friction
- Prefers "functional elegance" over feature-rich complexity
- Explicitly says "no gimmicks" — decorative features waste their time

## Tasks

### 1. Deep audit of the current app

Read everything:
- All docs in `docs/ux/`
- `docs/SPEC.md`
- The source code of key components:
  - `src/lib/components/weekly/` (timesheet view)
  - `src/lib/components/notes/` (notes system)
  - `src/lib/components/admin/` (settings/admin)
  - `src/routes/` (page routes, API routes)
  - `src/lib/services/` (data services)
  - `src/lib/types.ts` (data types)

Understand what the app does, how it works, what the interaction patterns are,
and where the friction points might be.

### 2. Identify gaps and pain points

Based on your audit, identify:
- What workflows feel incomplete or clunky
- What data exists in the schema but isn't surfaced well in the UI
- What common consulting tasks the app doesn't support yet
- What power-user shortcuts are missing
- What reporting or review capabilities are absent

### 3. Research comparable tools

Look at how mature time-tracking and consulting tools handle:
- Invoice generation / export
- Reporting and analytics (weekly, monthly, per-client)
- Recurring time entries / templates
- Keyboard-first workflows
- Data export (CSV, PDF reports)
- Calendar integration
- Multi-device sync experience

### 4. Write recommendations

File: `docs/ux/future-feature-recommendations.md`

For each recommendation, include:
- **What:** Clear description of the feature
- **Why:** The real user need it addresses (not "it would be cool")
- **Priority:** High / Medium / Low (based on impact vs effort)
- **Complexity:** Simple / Moderate / Complex
- **Dependencies:** What needs to exist first
- **Sketch:** Brief interaction design (how would it work?)

### 5. Prioritize and phase

Group recommendations into:
- **Next up** — high-impact, reasonable effort, builds on what exists
- **Worth doing** — valuable but can wait
- **Consider later** — speculative or dependent on other work
- **Explicitly rejected** — things you considered but decided against, with rationale

## Acceptance Criteria

- [x] Complete app audit (code + docs + UX specs reviewed)
- [x] Gap analysis with specific pain points identified
- [x] 8-15 feature recommendations (quality over quantity)
- [x] Each recommendation has what/why/priority/complexity/sketch
- [x] Phased priority grouping
- [x] "Explicitly rejected" section (shows rigor)
- [x] Document at `docs/ux/future-feature-recommendations.md`
- [x] No gimmicks — every recommendation passes the "would a busy consultant actually use this weekly?" test

## Notes

**Use high effort.** This is a deep research sprint. Read everything. Think carefully.
Quality of insight matters more than volume of recommendations.

**The user is pragmatic.** They've explicitly rejected decorative features multiple times.
Features like "AI-powered time suggestions" or "gamified tracking" would be dismissed.
Focus on workflow efficiency, data accessibility, and reducing friction.

**Consider the consulting lifecycle:** A consultant doesn't just track time — they also
need to review what they did, report to clients, generate invoices, plan capacity, and
understand where their time goes. Which of these workflows could Chronolog support?

**Don't duplicate existing backlog items.** Read `docs/backlog.md` and avoid recommending
things that are already planned or in progress.

## Progress Notes

- **Task 1 (Deep audit):** Complete. Produced `docs/ux/comprehensive-audit.md` — exhaustive gap analysis covering workflow completeness, data surface gaps, missing consultant workflows, UX friction points, API surface, and backlog overlap. Identified 20 ranked gaps.
- **Task 2 (Identify gaps):** Complete. Critical gaps not in backlog: reporting/client hour summaries (#1), CSV export (#2), search UI (#3), toast system (#4). Audit severity matrix ranks all 20 gaps by impact.
- **Task 3 (Research comparable tools):** Complete. Used training knowledge of Harvest (reporting, CSV, invoicing, budgets), Toggl Track (summary/detailed reports, keyboard shortcuts, templates), Clockify (export formats, project budgets), Day One (search, templates), Notion (Cmd+K, pins).
- **Task 4 (Write recommendations):** Complete. 12 recommendations at `docs/ux/future-feature-recommendations.md`. Each has what/why/priority/complexity/dependencies/sketch.
- **Task 5 (Prioritize and phase):** Complete. Grouped into Next Up (4), Worth Doing (5), Consider Later (3), Explicitly Rejected (8). Recommended build order for Next Up phase.

## Sign-off

All 8 acceptance criteria met. Deliverables committed to branch `sprint-015-UX/future-features`.

**12 recommendations (within 8-15 target):**

Next Up (high-impact):
1. Time Entry Export (CSV) — Simple, unblocks invoicing immediately
2. Client Reporting View — Most impactful missing workflow
3. Toast/Save Feedback System — Zero-effort UX win
4. Global Search — Backend exists, Cmd+K pattern

Worth Doing:
5. Keyboard Shortcuts — Power user speed
6. Weekly Review Summary — End-of-week workflow
7. Hourly Rate on Contracts — Billing calculations
8. Recurring Time Entry Templates — Reduce repetitive entry
9. Account Management — Sign out, profile, password reset (table stakes)

Consider Later:
10. Note Move Between Contracts — Edge case
11. Overlap Detection — Data integrity guard
12. Contract Budget Tracking — Depends on rates

**8 explicitly rejected features** with rationale: AI time suggestions, gamification, calendar integration, dark mode, expense tracking, team/multi-user, standalone mobile app, dashboard charts.

**Key design principle:** every recommendation was evaluated against "would a busy consultant actually use this weekly?" Features that exist primarily to impress (charts, AI, gamification) were rejected in favour of workflow efficiency (export, reporting, search, shortcuts).
