# Sprint 009 — CL: Hours Total in Week Status (CL-7)

**Status:** pending
**Type:** standard
**Backlog items:** CL-7
**Depends on:** nothing
**Branch:** `sprint-009-CL/hours-in-week-status`

## Objectives

Move the hours total into the week status label so it reads "Unsubmitted (X.Y hours)"
instead of showing hours separately. This is a small, focused UI change.

## Tasks

### 1. Update WeekSectionHeader.svelte

File: `src/lib/components/weekly/WeekSectionHeader.svelte`

Currently the week section header shows the status text and total hours in separate locations.
Combine them so the status line reads: `Unsubmitted (12.5 hours)` or `Submitted (40.0 hours)`.

- The hours total should appear in parentheses after the status text
- Keep the inline-editable status field — just append the hours display
- If hours are 0, show `(0 hours)` rather than hiding it
- Use the existing `formatHoursFromMinutes` helper

### 2. Update WeekListPanel.svelte

File: `src/lib/components/weekly/WeekListPanel.svelte` (in `src/lib/components/layout/`)

The week list sidebar also shows week summaries. Update the summary display to include
hours in the status badge: `Unsubmitted (X.Y hrs)`.

### 3. Update tests

- Update any existing unit tests for WeekSectionHeader or WeekListPanel
- Add a test verifying the combined status + hours format renders correctly

### 4. Verify

- `npm run test` passes
- `npm run check` passes (no new errors)
- `npm run build` succeeds
- Visual check: the hours appear next to the status in both the week header and the sidebar

## Acceptance Criteria

- [ ] Week section header shows "Status (X.Y hours)" format
- [ ] Week list sidebar shows hours in status badge
- [ ] All existing tests pass
- [ ] `npm run check` passes (no new errors beyond pre-existing)
- [ ] `npm run build` succeeds
