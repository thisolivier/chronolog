# Sprint 012 — UX: Timesheet Layout Redesign (UX-2)

**Status:** pending
**Type:** research / design
**Backlog items:** UX-2
**Depends on:** Sprint 011-UX (app documentation — merged)
**Branch:** `sprint-012-UX/timesheet-redesign`

## Objectives

Research and design a new timesheet layout for Chronolog. The current 3-panel layout is
functional but has redundancies (middle column adds little value when the left panel can
infinite-scroll) and the visual hierarchy puts time/hours first rather than the work context.

This is a **design research sprint** — the deliverable is a design specification document
with wireframes and rationale, not code.

## Design Brief

### Current Pain Points
- The middle column (WeekListPanel) feels redundant — infinite scrolling in the left
  sidebar or content panel could replace it
- Time/hours are visually dominant; contracts and notes feel secondary
- No visual distinction between days, weeks, and months — everything blends together
- The layout is functional but clinical — lacks the warmth of a journal or planner

### Design Goals
- **Highlight contracts and notes** — these are the primary work context
- **Keep time/hours secondary** — important but not the visual focus
- **Clear temporal structure** — day, week, month boundaries should be obvious
- **Journal-app aesthetic** — warm, readable, subtle colour, not corporate
- **No gimmicks** — every design decision must serve a practical purpose
- **Note-time entry linking is coming** — inform layout decisions (see UX-3, CL-8)
- **Consider 2-panel layout** — the middle panel may not be needed

### Reference Material
- Read `docs/ux/` thoroughly (sprint 011 output) — understand every component
- Read `docs/ux/03-time-entries-view.md` for the current timesheet layout
- Read `docs/ux/04-notes-view.md` for the notes layout (may inform unified view)
- Read `docs/SPEC.md` for the data model (clients → contracts → deliverables)
- Look at journal apps (Day One, Bear, Notion) for aesthetic inspiration
- Look at time tracking apps (Harvest, Toggl, Clockify) for functional patterns

## Tasks

### 1. Analyze current layout

Read all UX docs from sprint 011. Identify specific issues with the current 3-panel
timesheet view. Catalog what works well (keep it) and what doesn't (redesign it).

### 2. Research layout patterns

Study layout patterns from:
- Journal/planner apps (Day One, Bear, Notion, Obsidian)
- Time tracking apps (Harvest, Toggl Track, Clockify)
- Calendar apps (Fantastical, Google Calendar)

Focus on how they handle: weekly views, daily breakdowns, entry grouping, visual
hierarchy between context (project/client) and metrics (hours).

### 3. Design the new layout

Produce ASCII wireframes for:
- **Desktop layout** (primary) — what replaces the current 3-panel view?
- **Mobile layout** — single-panel navigation equivalent
- **Week view** — how a week of entries looks
- **Day detail** — how a single day's entries are presented
- **Month transitions** — how to visually mark moving between months
- **Empty states** — what does a day/week with no entries look like?

### 4. Specify visual hierarchy

Define:
- What gets the most visual weight (contract/client context? description? hours?)
- How colour is used (client accent colours? status indicators? month headers?)
- Typography hierarchy (headings, labels, values)
- How the current status badges ("Unsubmitted", "Submitted") fit in

### 5. Consider integration with notes

The note-time entry linking feature (UX-3, CL-8) will allow inline references from
time entries to notes. The redesigned layout should accommodate:
- A way to see linked notes from a time entry
- A way to navigate to a note from the timesheet
- How note previews might appear in the time entry context

### 6. Write the design specification

File: `docs/ux/timesheet-redesign-spec.md`

Include:
- Problem statement (what's wrong with the current layout)
- Design principles (what guides the redesign)
- Wireframes (ASCII, multiple breakpoints)
- Visual hierarchy specification
- Colour and typography recommendations
- Component mapping (which existing components change, which are new)
- Migration path (how to get from current to proposed)
- Trade-offs and alternatives considered

## Acceptance Criteria

- [ ] Current layout analyzed with specific issues identified
- [ ] Layout patterns researched from 3+ reference apps
- [ ] Desktop wireframes for the new timesheet view
- [ ] Mobile wireframes
- [ ] Visual hierarchy specification
- [ ] Notes integration considered
- [ ] Design spec document produced at `docs/ux/timesheet-redesign-spec.md`
- [ ] Rationale for every design decision (no unjustified choices)

## Notes

**This is a high-effort research sprint.** Take time to read everything, study reference
apps, and think deeply about the layout before producing wireframes. Quality over speed.

**No gimmicks.** Every element must earn its place. If something is purely decorative
with no functional purpose, remove it. Subtle warmth and readability, not flashy.

**The user is a solo consultant.** The timesheet is used daily for tracking billable work
across 3-5 client contracts. Speed of entry and clarity of review are paramount.
