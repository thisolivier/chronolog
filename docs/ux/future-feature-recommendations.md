# Future Feature Recommendations

Sprint 015-UX / UX-4. Opinionated feature recommendations based on a deep audit of the
Chronolog codebase, UX documentation, and comparison with mature time-tracking tools
(Harvest, Toggl Track, Clockify) and note-taking tools (Day One, Notion, Obsidian).

Every recommendation passes the test: **would a busy solo consultant use this weekly?**

---

## Methodology

1. **Deep audit** of all source code, UX specs, and documentation (see `comprehensive-audit.md`)
2. **Gap analysis** against the consulting lifecycle: track time, review work, report to clients, export for invoicing, plan capacity
3. **Comparable tool patterns** from Harvest (reporting, CSV export, invoicing), Toggl Track (summary/detailed reports, keyboard shortcuts), Clockify (export formats, project budgets), Day One (search, templates), Notion (Cmd+K, pins, database views)
4. **Backlog awareness** — recommendations do not duplicate items already in `docs/backlog.md` or `BACKLOG.md` (CL-4 through CL-8, Tasks 12-16, UX-1 through UX-3, IF-3)

---

## Next Up

High-impact, reasonable effort. These address the most critical gaps in the consulting workflow.

---

### 1. Time Entry Export (CSV)

**What:** Export time entries as CSV with configurable columns and date range filtering. A
single "Export" button on the timesheet view opens a minimal dialog: date range picker
(defaulting to current month), optional client/contract filter, and a Download button.

**Why:** Data trapped in the app is a liability. Every consultant needs to get hours out
for invoicing, tax reporting, or sharing with clients. This is the #2 gap identified in
the audit (after reporting, but simpler to build). Harvest and Toggl both treat CSV export
as table-stakes functionality — it ships in their free tiers.

**Priority:** High
**Complexity:** Simple
**Dependencies:** None. The `GET /api/time-entries/weekly` endpoint already returns all
the data needed. A new `GET /api/time-entries/export?from=&to=&clientId=` endpoint
wraps the same query with CSV serialization.

**Sketch:**

```
Export Time Entries                              [x]
+---------------------------------------------------+
| Date range:  [May 1, 2026] — [May 31, 2026]      |
|                                                    |
| Client:      [All clients           v]            |
| Contract:    [All contracts          v]            |
|                                                    |
| Columns:     [x] Date                              |
|              [x] Client                             |
|              [x] Contract                           |
|              [x] Deliverable                        |
|              [x] Work Type                          |
|              [x] Start / End                        |
|              [x] Duration (hours)                   |
|              [x] Description                        |
|                                                    |
|                              [Download CSV]        |
+---------------------------------------------------+
```

The dialog is a modal accessible from a new "Export" icon in the timesheet header. CSV
is generated server-side and streamed as a download. Column checkboxes default to all
selected; the selection is persisted in `localStorage` so repeated exports use the same
format.

---

### 2. Client Reporting View

**What:** A dedicated reporting page showing hour totals grouped by client, contract, and
deliverable for a selected date range. Accessible from the sidebar as a new top-level
navigation item alongside "Time Entries."

**Why:** This is the single most impactful missing workflow. Time tracking without
reporting is half a product. A consultant who bills 3 clients needs to answer "how many
hours did I work for Big Cheese in May?" without scrolling through 4 weeks of entries.
Harvest's "Reports" tab and Toggl's "Summary" view are the most-used features in those
apps — they exist because this question is asked at least weekly, often daily.

**Priority:** High
**Complexity:** Moderate
**Dependencies:** New API endpoint: `GET /api/reports/summary?from=&to=&groupBy=client`
returning aggregated hours. The database queries are straightforward `GROUP BY` on the
existing `time_entry` table joined to contracts and clients.

**Sketch:**

```
Reports                                   May 2026  < >
+---------------------------------------------------------+
| SUMMARY                          Total: 142.5 hours     |
+---------------------------------------------------------+
|                                                          |
| Big Cheese Inc                           68.0h          |
|   API Contract                    42.5h                  |
|     Development          28.0h                           |
|     Code Review          14.5h                           |
|   Support Contract                25.5h                  |
|     Incident Response    18.0h                           |
|     Documentation         7.5h                           |
|                                                          |
| Acme Corp                                52.0h          |
|   Platform Rebuild                52.0h                  |
|     Backend              32.0h                           |
|     Frontend             20.0h                           |
|                                                          |
| Internal                                 22.5h          |
|   Admin / Business Dev            22.5h                  |
|                                                          |
+---------------------------------------------------------+
|                        [Export CSV]  [Copy to Clipboard] |
+---------------------------------------------------------+
```

**Interaction details:**
- Date range defaults to current month. Arrow buttons navigate months. Custom range
  available via date pickers.
- Rows are collapsible. Click a client to expand/collapse contracts. Click a contract
  to expand/collapse deliverables.
- Client rows use the client color from the redesign spec's color system.
- "Export CSV" triggers the same export dialog as recommendation #1, pre-filtered to
  the current report range and client.
- "Copy to Clipboard" copies a plain-text summary suitable for pasting into an email
  or invoice.

---

### 3. Toast / Save Feedback System

**What:** A lightweight toast notification system that confirms saves, warns on errors,
and provides brief status messages. Toasts appear at the bottom-center of the viewport,
auto-dismiss after 3 seconds, and stack if multiple fire quickly.

**Why:** The app currently gives zero feedback when saves succeed or fail. The user edits
a description, blurs the input, and... nothing visible happens. They must trust that the
debounced save worked. If the network is down, the save fails silently. This is the #6
gap in the audit severity matrix and the lowest-effort high-impact fix. Every mature
app — Harvest, Toggl, Notion, Day One — provides save confirmation, even if it's
subtle (Notion's "Saved" in the header, Day One's brief checkmark).

**Priority:** High
**Complexity:** Simple
**Dependencies:** None. This is a pure UI addition — a Svelte context-based toast store
and a `<ToastContainer>` component in the root layout.

**Sketch:**

```
// Toast store (Svelte 5 runes)
const toasts = $state<Toast[]>([]);
function showToast(message: string, type: 'success' | 'error' | 'info') { ... }

// Usage in save handlers:
try {
  await dataService.updateTimeEntry(id, fields);
  showToast('Entry saved', 'success');
} catch (error) {
  showToast('Failed to save — check your connection', 'error');
}
```

```
+-----------------------------------------------------------+
|                    Main app content                        |
|                                                            |
|                                                            |
|              +----------------------------+                |
|              |  ✓  Entry saved             |                |
|              +----------------------------+                |
+-----------------------------------------------------------+
```

Success toasts: stone-700 bg, white text, subtle slide-up animation. Error toasts:
red-600 bg. Info toasts: sky-600 bg. Max 3 visible at once. Click to dismiss.

---

### 4. Global Search

**What:** A Cmd+K (Mac) / Ctrl+K (Windows) search palette that searches across notes
and time entries. Results show in a floating modal with keyboard navigation.

**Why:** The backend search infrastructure already exists (`/api/notes/search`,
`searchNotesForUser()`), but there is no UI to access it. As note and entry volume
grows, visual scanning becomes impractical. Cmd+K is the established pattern across
Notion, Linear, Slack, VS Code, and Arc — consultants who use these tools daily will
reach for it instinctively. This is the #5 gap in the audit severity matrix.

**Priority:** High
**Complexity:** Moderate
**Dependencies:** New API endpoint: `GET /api/time-entries/search?q=` for searching
time entry descriptions. The notes search endpoint already exists.

**Sketch:**

```
+---------------------------------------------------+
|  🔍  Search notes and time entries...              |
|                                                    |
|  NOTES                                             |
|  +----------------------------------------------+ |
|  | BIGCH.20260519.001 — API Review Notes         | |
|  | "Reviewed the endpoint design for v2..."      | |
|  +----------------------------------------------+ |
|  | ACME.20260515.003 — Sprint Retro              | |
|  | "Discussed migration timeline and..."         | |
|  +----------------------------------------------+ |
|                                                    |
|  TIME ENTRIES                                      |
|  +----------------------------------------------+ |
|  | Mon, May 19 — Reviewed API design      2h 0m | |
|  | Big Cheese / API Contract                     | |
|  +----------------------------------------------+ |
|  | Tue, May 20 — Sprint planning          1h 30m | |
|  | Acme Corp / Platform Rebuild                  | |
|  +----------------------------------------------+ |
|                                                    |
|  ↑↓ Navigate  ↵ Open  esc Close                   |
+---------------------------------------------------+
```

**Interaction details:**
- Cmd+K opens the palette from anywhere in the app
- Results update as the user types (debounced 200ms)
- Notes and time entries shown in separate sections
- Arrow keys navigate results, Enter opens the selected item
- Opening a note navigates to notes mode for that contract
- Opening a time entry navigates to the timesheet week containing it
- Escape closes. Clicking outside closes.
- Recent searches remembered (localStorage, last 5)
- Empty state shows recent items

---

## Worth Doing

Valuable improvements that can wait until the critical gaps above are filled.

---

### 5. Keyboard Shortcuts

**What:** A keyboard shortcut layer covering the most common actions, with a Cmd+/
help overlay listing all shortcuts.

**Why:** A consultant entering time multiple times daily benefits from every keystroke
saved. Toggl's "N for new entry" and Harvest's keyboard navigation are cited as
productivity differentiators by power users. The current app has zero shortcuts —
everything requires a mouse click.

**Priority:** Medium
**Complexity:** Moderate
**Dependencies:** Toast system (#3, for shortcut feedback). Global search (#4, which
implements Cmd+K as the first shortcut).

**Sketch:**

| Shortcut | Action |
|----------|--------|
| `Cmd+K` | Open search palette |
| `Cmd+N` | New time entry (opens quick-add row) |
| `Cmd+Shift+N` | New note (in current contract) |
| `Cmd+T` | Toggle timer (start/stop) |
| `Cmd+1` | Switch to time entries view |
| `Cmd+2` | Switch to notes view |
| `Cmd+E` | Open export dialog |
| `Cmd+/` | Show shortcut help overlay |
| `Escape` | Close modal/dialog/search |

Implementation: a single `useKeyboardShortcuts()` hook registered in the root layout.
Each shortcut maps to an existing navigation or action function. The help overlay is
a simple modal listing all shortcuts in a two-column table.

---

### 6. Weekly Review Summary

**What:** A "Review" action on each week that generates a read-only summary view showing:
total hours, hours per client, top entries by duration, and linked notes. Accessible from
the week header (a "Review" button next to the status field).

**Why:** Every consultant does a weekly review — whether for their own records, a client
standup, or an end-of-week email. Currently this requires mental aggregation while
scrolling through day sections. A pre-computed summary saves 5-10 minutes per week.
Day One's "On This Day" and Harvest's "Weekly Report" email serve similar review needs.

**Priority:** Medium
**Complexity:** Moderate
**Dependencies:** Reporting API (#2 provides the aggregation endpoint). Toast system
(#3, for "copied to clipboard" feedback).

**Sketch:**

```
Week of May 19-25, 2026                    Review
+---------------------------------------------------------+
| TOTAL: 38.5 hours                                        |
|                                                          |
| By Client:                                               |
|   Big Cheese Inc       22.0h  ████████████░░░  57%      |
|   Acme Corp            12.5h  ██████░░░░░░░░░  32%      |
|   Internal              4.0h  ██░░░░░░░░░░░░░  10%      |
|                                                          |
| Longest entries:                                         |
|   Mon — API integration work           4.0h  Big Cheese |
|   Wed — Platform migration planning    3.5h  Acme Corp  |
|   Thu — Code review session            3.0h  Big Cheese |
|                                                          |
| Notes written: 4                                         |
|   BIGCH.20260519.001 — API Review Notes                  |
|   BIGCH.20260521.002 — Integration Test Plan             |
|   ACME.20260520.001 — Migration Checklist                |
|   INT.20260523.001 — Weekly Retro                        |
|                                                          |
| Status: Submitted                                        |
|                                                          |
|                    [Copy Summary]  [Close]               |
+---------------------------------------------------------+
```

"Copy Summary" copies a plain-text version suitable for email. The summary is a modal
or slide-over panel, not a separate page — the user should stay in context.

---

### 7. Hourly Rate on Contracts

**What:** An optional `hourlyRate` field on contracts. When set, hour totals in the
reporting view (#2) and weekly review (#6) show calculated billing amounts alongside
hours.

**Why:** A consultant with 3 contracts at different rates currently tracks hours in
Chronolog and calculates amounts in a spreadsheet. Storing the rate alongside the
contract eliminates that step. Harvest and Clockify both support per-project rates
and calculated amounts — it's a natural extension of time tracking. The field is
optional because some consultants bill fixed-fee and only need hours.

**Priority:** Medium
**Complexity:** Simple
**Dependencies:** Reporting view (#2) for displaying calculated amounts. Schema
migration to add `hourly_rate DECIMAL(10,2) NULL` to the contracts table.

**Sketch:**

Admin contract edit:
```
Contract: API Development
Description: Backend API work for v2 launch
Hourly Rate: [$ 150.00    ]  (optional)
Active: [x]
```

Reporting view with rates:
```
Big Cheese Inc                    68.0h    $10,200.00
  API Contract         42.5h     $6,375.00   (@$150/h)
  Support Contract     25.5h     $3,825.00   (@$150/h)
```

When no rate is set, the amount column is blank (not "$0.00"). The rate is stored
per-contract, not per-deliverable — consultants rarely bill different rates for
different work types within the same contract.

---

### 8. Recurring Time Entry Templates

**What:** Save a time entry as a template (contract + deliverable + work type +
description) and re-use it with one click. Templates appear as a dropdown on the
quick-add row.

**Why:** Consultants often log the same categories repeatedly — "weekly standup" for
Client A, "code review" for Client B. Currently each entry requires re-selecting the
contract, deliverable, and work type. Templates reduce a 4-field entry to 1 click +
time input. Toggl's "Saved Entries" and Clockify's "Templates" serve exactly this
purpose.

**Priority:** Medium
**Complexity:** Moderate
**Dependencies:** None for the basic feature. A `time_entry_template` table with
`contractId`, `deliverableId`, `workTypeId`, `description` fields.

**Sketch:**

Quick-add row with template selector:
```
+-----------------------------------------------------------+
| [▼ Templates]  |  [                    ]  |  [9:00-10:00] |
+-----------------+                         +----------------+
| ★ Weekly standup — Big Cheese / API       |
| ★ Code review — Big Cheese / API         |
| ★ Sprint planning — Acme / Platform      |
+-------------------------------------------+
```

Selecting a template pre-fills contract, deliverable, work type, and description.
The user only needs to enter the time. Templates are created via a "Save as template"
action on existing time entry cards (right-click or overflow menu).

Maximum 15 templates per user. No folders or categories — the list is short enough
to scan. Templates are sorted by usage frequency (most-used first).

---

### 9. Account Management (Sign Out, Profile, Password Reset)

**What:** Three small additions: (a) sign out accessible from the main app sidebar,
(b) profile editing (name, email, password change), (c) password reset flow on the
login page.

**Why:** These are table-stakes features missing from the current app. Sign out is
buried in the admin panel (3 clicks). There is no way to change your name, email,
or password after registration. There is no "Forgot password?" flow. None of these
are exciting, but their absence is noticeable. Better Auth supports all three — the
backend work is minimal.

**Priority:** Medium
**Complexity:** Simple
**Dependencies:** Better Auth already provides the backend for password reset
(`/api/auth/forget-password`, `/api/auth/reset-password`) and profile updates.

**Sketch:**

Sidebar footer (below timer):
```
+---------------------------+
| [Timer widget]            |
+---------------------------+
| olivier@example.com    ⚙  |
+---------------------------+
```

Clicking the gear icon or email opens a small menu:
```
+---------------------------+
| Edit Profile              |
| Sign Out                  |
+---------------------------+
```

"Edit Profile" opens a modal with name, email, and password change fields.
Login page gets a "Forgot password?" link below the password field.

---

## Consider Later

Speculative or dependent on other work being done first.

---

### 10. Note Move Between Contracts

**What:** Allow moving a note from one contract to another via a "Move to..." action
in the note editor header or a context menu in the note list.

**Why:** Notes are occasionally created under the wrong contract, or a project's scope
shifts and notes need to be reassigned. Currently the `contractId` is set at creation
and never editable — the only workaround is to create a new note, copy the content,
and delete the old one (losing backlinks and linked time entries). This is an edge
case, not a daily workflow, but when it's needed the workaround is painful.

**Priority:** Low
**Complexity:** Simple
**Dependencies:** Task 16 (All Notes view) may change how notes are organized,
making this more or less relevant.

**Sketch:**

Note editor header:
```
+-----------------------------------------------------------+
| BIGCH.20260519.001          [Move to...] [Export ▾]       |
+-----------------------------------------------------------+
```

"Move to..." opens a contract picker. Selecting a contract updates the note's
`contractId`. The note ID does not change (it encodes the original creation date,
not the contract). Backlinks and linked time entries are preserved.

---

### 11. Overlap Detection for Time Entries

**What:** Warn the user when they create or edit a time entry that overlaps with an
existing entry on the same day. A yellow warning banner appears below the time input
— not a blocking validation, just an informational alert.

**Why:** A consultant working across 3 clients can accidentally log overlapping hours
(e.g., two entries both claiming 9:00-11:00). No current validation catches this. The
overlap may surface later as an embarrassing billing error. Harvest shows a subtle
"Overlapping entry" indicator; Toggl highlights conflicting entries in the timeline
view.

**Priority:** Low
**Complexity:** Simple
**Dependencies:** None. A client-side check comparing the new entry's start/end against
existing entries for the same day.

**Sketch:**

```
+-----------------------------------------------------------+
| Client / Contract / Deliverable                            |
| Sprint planning  [9:00-11:00]                      2h 0m  |
| ⚠ Overlaps with "API review" (9:30-10:30)                 |
+-----------------------------------------------------------+
```

The warning is informational only — the user may intentionally have overlapping entries
(e.g., a meeting that ran concurrently with background work). No blocking, no forced
resolution.

---

### 12. Contract Budget Tracking

**What:** An optional `budgetHours` field on contracts. When set, the sidebar and
reporting view show a progress indicator: "Used 120 of 200 hours (60%)."

**Why:** Fixed-scope contracts have hour caps. A consultant who burns through 180 of
200 budgeted hours without noticing risks overdelivering without billing. Harvest's
"Project Budget" and Clockify's "Budget Tracking" both provide this. However, not
all consultants work with hour-capped contracts — many bill pure time-and-materials,
making this feature irrelevant for them.

**Priority:** Low
**Complexity:** Moderate
**Dependencies:** Hourly rate (#7) for calculating budget amounts. Reporting view (#2)
for displaying utilization. Schema migration: `budget_hours DECIMAL(10,1) NULL` on
contracts.

**Sketch:**

Sidebar contract item (when budget is set):
```
+---------------------------+
| 🧀 API Contract           |
|   120 / 200h  ████████░░  |
+---------------------------+
```

Reporting view:
```
API Contract         42.5h     $6,375.00   (@$150/h)
Budget: 120 / 200h (60%)  ████████████░░░░░░░░
```

At 80% utilization, the bar turns amber. At 95%, red. A toast notification fires
when crossing the 80% and 95% thresholds.

---

## Explicitly Rejected

Features considered and decided against. Each fails the "would a busy consultant
actually use this weekly?" test or conflicts with the app's design principles.

---

### AI-Powered Time Suggestions

*"The app watches your patterns and suggests time entries."*

**Rejected because:** A solo consultant with 3-5 contracts knows exactly what they
worked on. AI suggestions solve a problem that doesn't exist for this user profile.
The cognitive cost of evaluating suggestions (are they right? do I need to correct
them?) exceeds the cost of just entering the data. This is a gimmick that impresses
in demos but annoys in daily use.

### Gamification (Streaks, Achievements, Productivity Scores)

*"Earn badges for consistent tracking! Maintain your 30-day streak!"*

**Rejected because:** The user explicitly and repeatedly rejects decorative features.
A consultant tracks time because they need to bill clients, not because an app
rewards them for it. Gamification adds visual noise and patronizes a professional user.

### Calendar Integration / Calendar View

*"Sync with Google Calendar or show time entries in a calendar grid."*

**Rejected because:** A consultant's calendar (meetings, calls) and their time tracking
(billable hours) are different data sets that happen to share a time axis. Calendar
events don't map cleanly to billable entries — a 1-hour meeting might generate 30
minutes of billable time plus 30 minutes of follow-up logged separately. Syncing
creates more reconciliation work than it saves. A calendar view of time entries adds
little over the existing week-based chronological layout. Fantastical and Google
Calendar already own the calendar UX — Chronolog should not compete with them.

### Dark Mode

*"A dark color scheme option."*

**Rejected because:** It is purely cosmetic. The warm stone palette in the redesign
spec was carefully designed for readability and visual hierarchy. Maintaining two
complete color schemes doubles the design surface area and testing burden with zero
workflow benefit. If the user works in a dark environment, macOS system-level dark
mode and display controls address the need. This can be reconsidered if users
specifically request it, but it should never be prioritized over functional features.

### Expense Tracking

*"Log expenses alongside time entries for complete project costing."*

**Rejected because:** Expense tracking is a separate domain with its own complexity
(receipt capture, categorization, tax rules, reimbursement workflows). Adding it to
a time-tracking app creates scope bloat. Consultants who need expense tracking use
dedicated tools (Expensify, QuickBooks) that are purpose-built for it. Chronolog
should do time tracking and notes well, not everything poorly.

### Team / Multi-User Features

*"Shared projects, manager approval workflows, team dashboards."*

**Rejected because:** Chronolog is designed for a solo consultant. Multi-user support
would require rethinking the data model (user-scoped everything), authentication
(roles, permissions), the sync model (per-user filtering, access control), and the
UI (team views, approval workflows). This is not a feature — it is a different product.
The single-user design is a strength, not a limitation, because it enables simpler
sync, simpler auth, and a faster UI.

### Standalone Mobile App

*"A native iOS/Android app instead of the PWA fallback."*

**Rejected because:** The PWA serves the mobile use case adequately for a secondary
device. A native mobile app would double the development surface (React Native or
native iOS/Android), require app store management, and introduce platform-specific
bugs — all for a user who primarily works on desktop. The Tauri desktop app is the
primary platform. Mobile is for quick entries on the go, not extended sessions.

### Dashboard with Charts and Analytics Visualizations

*"Pie charts of time distribution, line graphs of hours over time, heatmaps."*

**Rejected because:** Charts look impressive in screenshots but are rarely
actionable for a solo consultant. A consultant needs to know "I worked 42.5 hours
for Big Cheese in May" — a number, not a pie chart. The reporting view (#2) provides
these numbers in a scannable, copy-pasteable format. Charts add complexity (charting
library, responsive sizing, color accessibility) without adding information that the
numbers don't already convey. If a consultant wants to visualize trends, they can
export to CSV (#1) and use their preferred spreadsheet tool.

---

## Phasing Summary

| Phase | Features | Theme |
|-------|----------|-------|
| **Next up** | CSV Export, Client Reporting, Toast System, Global Search | Get data out; know what happened |
| **Worth doing** | Keyboard Shortcuts, Weekly Review, Hourly Rates, Templates, Account Mgmt | Power user speed; billing support |
| **Consider later** | Note Move, Overlap Detection, Budget Tracking | Edge cases; dependent on earlier work |

**Recommended build order for "Next up":**

1. Toast system (#3) — smallest scope, immediately useful, and needed by other features
2. CSV export (#1) — unblocks the consultant's invoicing workflow today
3. Global search (#4) — backend exists, high daily-use value
4. Client reporting (#2) — highest impact but most complex; benefits from toast system
   and export infrastructure already being in place
