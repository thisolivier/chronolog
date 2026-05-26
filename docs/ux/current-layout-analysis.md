# Current Timesheet Layout Analysis

Sprint 012-UX: Foundation analysis for the timesheet redesign.

---

## 1. Current 3-Panel Layout Description

The app uses an Apple Notes-inspired three-panel layout managed by `AppShell.svelte`. The mode is controlled by a shared `NavigationContext` (Svelte 5 context + runes) that tracks which panel content to render.

### Panel 1 -- Sidebar (ContractsSidebar)

Fixed width: 240px, collapsible to 0px via `SidebarToggle`.

Contents (top to bottom):
- **"Time Entries" button** -- switches the app to `time-entries` mode (highlights blue when active).
- **"Contracts" heading** -- uppercase label.
- **Flat contract list** -- every contract across all clients in a single list. Each row shows an optional client emoji or short code prefix, the contract name, and a note count badge. Clicking a contract switches to `notes` mode for that contract.
- **Action links** -- "New Contract" (opens `ContractCreateModal`) and "Settings" (links to `/admin`).
- **TimerWidget** -- pinned to the bottom of the sidebar, above the fold.

### Panel 2 -- List View (resizable, 200-500px, default 280px)

Content switches based on `nav.mode`:

**Time Entries mode (`WeekListPanel`):**
- A scrollable list of week summaries, each showing:
  - Formatted Monday date (e.g., "Monday 9th Feb")
  - Total hours for the week (e.g., "7.5 hrs")
  - Status dot + label (Unsubmitted / Draft ready / Submitted)
- Selected week gets a blue left border + blue background.
- Empty past weeks are filtered out (current week always shown).
- Infinite scroll via "Load More" button (12 weeks per page).
- Clicking a week sets `navigationContext.selectedWeek`, which scrolls the TimeEntriesPanel (Panel 3) to that week section.

**Notes mode (`NoteListPanel`):**
- Header with "Notes" title + "New Note" / "Delete" buttons.
- Scrollable list of notes for the selected contract.
- Each note row: first line (bold title), date + second line preview.
- Clicking selects a note and opens it in Panel 3.

### Panel 3 -- Content (flexible width, fills remaining space)

**Time Entries mode (`TimeEntriesPanel`):**
- A continuous vertical scroll of weeks, each containing:
  - `WeekSectionHeader` -- "Week Starting Monday 9th Feb . 7.5 hrs" + inline editable status field.
  - Day sections for each day (Mon-Sun, capped at today for current/past weeks):
    - Day header: "Monday, Feb 3" + daily total + "+" button.
    - `TimeEntryCard` rows for each entry.
    - Expandable `NewEntryRow` for quick-add.
  - Empty past weeks are collapsible (click to expand/add entries).
- Loads 4 weeks initially, with "Load more weeks" button.
- Auto-scrolls to the week selected in Panel 2 via `scrollIntoView`.

**Notes mode (`NoteEditorPanel`):**
- TipTap editor for the selected note.
- Backlinks section (linked from other notes).
- Linked time entries and attachments at the bottom.

### Mobile Behavior

On screens < 1024px, the layout switches to a single-panel push/pop navigation. The `mobileNavigationLevel` (0/1/2) determines which panel is visible, with a "Back" button for navigation. Clicking a sidebar item auto-advances to level 1; clicking a week or note auto-advances to level 2.

---

## 2. What Works Well (Keep)

### Strong Architectural Patterns

1. **Context-based navigation state** (`navigation.svelte.ts`) -- Clean separation of navigation concerns. The `NavigationContext` pattern using Svelte 5 runes is well-structured, with getters for reactive state and clean action methods. This is solid infrastructure.

2. **DataService abstraction** (`data-service.ts` interface) -- The `DelegatingDataService` wrapping pattern lets the UI work against a stable interface regardless of backend (fetch, PowerSync, etc.). All components use `getDataService()` from context consistently.

3. **Inline editing on TimeEntryCard** -- Click-to-edit for time, contract, and description fields is smooth. The time input parser (`parseTimeInput`) accepting both "2h30m" and "9:00-11:30" formats is well-designed and user-friendly.

4. **Week-based data loading** -- `getWeeklyTimeEntries(weekStarts[])` fetches structured `WeekData` objects with pre-grouped days and entries. The batch loading approach (4 weeks at a time) is efficient.

5. **TimerWidget lifecycle** -- The timer's state machine (idle -> running/paused -> stopped -> save/discard) is clean. Draft contract and description are persisted server-side in real-time while the timer runs, so nothing is lost on a browser crash.

6. **Collapsible empty weeks** -- Past weeks with zero entries collapse to a single clickable line ("Week Starting... -- No entries this week"), reducing clutter without hiding them entirely.

7. **Mobile push/pop navigation** -- The three-level navigation with automatic level advancement on selection is a sensible adaptation of the three-panel layout for mobile.

### Good UI Decisions

8. **"+" button in day headers** -- The quick-add trigger is discoverable but unobtrusive. It expands a `NewEntryRow` inline, right below the heading and above existing entries, which is the natural insertion point.

9. **Debounced saves** -- Description edits auto-save after 1 second of inactivity, and the status field on `WeekSectionHeader` uses the same pattern. No explicit "Save" button needed for most interactions.

10. **Confirm-before-delete pattern** -- Both `TimeEntryCard` and `WeeklyEntryRow` use a two-step delete: click "x" to reveal "Yes/No" (or "Confirm/Cancel"). Prevents accidental deletions without a heavy modal.

---

## 3. What Doesn't Work (Redesign)

### 3.1 The Middle Column (WeekListPanel) -- Redundancy Problem

The `WeekListPanel` is a pure navigational index. It shows a list of weeks with:
- Date label
- Total hours
- Status dot

Its only function is to scroll Panel 3 to the corresponding week section when clicked. But Panel 3 (`TimeEntriesPanel`) *already shows every week in a continuous scroll*. The user can just scroll Panel 3 directly. This creates a fundamental problem:

- **The same information exists in both panels.** Panel 2 shows week dates + hours + status. Panel 3's `WeekSectionHeader` shows the same week dates + hours + status.
- **The only value Panel 2 adds is jump-to navigation**, but this is something a sticky header, table of contents, or keyboard shortcut could accomplish more efficiently.
- **It consumes 200-500px of horizontal space** (default 280px) for what amounts to a scrollable list of ~5-12 visible items that duplicate Panel 3 headers.
- **In notes mode, the same panel slot serves a genuinely different purpose** (note list for selected contract), making the Panel 2 slot feel inconsistent -- it is essential for notes but vestigial for time entries.

### 3.2 Visual Hierarchy -- Hours/Time Dominate Over Work Context

The `TimeEntryCard` layout prioritizes time data over work narrative:

- **Left side**: Contract path ("Client / Contract / Deliverable / Work Type") as `font-medium text-gray-900`, then description as `text-gray-500`.
- **Right side**: Time display as `font-bold text-gray-900` (the most visually dominant element).
- The description -- the human-readable "what did I actually do?" -- is visually subordinate to the structural contract path and the time value.

In a consulting context, the *description* is what a user reviews when writing a weekly summary or checking what they worked on. The contract path provides context but shouldn't dominate. The current hierarchy reads as a spreadsheet ("I logged 2.5 hours on Contract X") rather than a work journal ("I reviewed the API design -- 2.5h").

### 3.3 Lack of Temporal Boundaries and Rhythm

The `TimeEntriesPanel` renders weeks as a continuous scroll with `WeekSectionHeader` dividers. Within each week, days are separated by a small header line. But:

- **No month-level grouping or navigation.** If a user wants to review January's work, they must scroll through 4-5 week sections manually, with no visual separation between months.
- **No "today" emphasis.** The current day is not highlighted or visually distinguished from other days. A user opening the app cannot instantly see "here is where I am today" without scanning day headers.
- **Week headers are text-only.** The `WeekSectionHeader` shows "Week Starting Monday 9th Feb . 7.5 hrs" -- which is descriptive but not scannable. There's no calendar grid, no progress indicators, no visual sense of "this week is 60% full" or "you're on track."
- **Day sections are uniform.** Monday with 8 entries and Wednesday with 0 entries both use the same lightweight header style. There's no density indication or at-a-glance summary per day.

### 3.4 Clinical Aesthetic -- Missing Journal Warmth

The layout uses a standard gray-50/gray-200/white palette with blue-600 accents. Typography is uniformly `text-sm` with occasional `text-xs`. The result is functional but sterile:

- **Entries as bordered cards** (`rounded-lg border border-gray-200 px-3 py-2`) create a uniform grid of boxes. Every entry looks identical except for its text content.
- **No visual differentiation by client or contract.** The client emoji exists in the sidebar but is not carried into time entry cards. All entries are visually identical regardless of which contract they belong to.
- **No warmth signals.** There are no greetings, progress summaries, or contextual messages. The empty state is "No entries this week" -- accurate but not encouraging.
- **The status field is a plain text input** (`WeekSectionHeader`) rather than a visually prominent element. The weekly status ("Submitted", "Draft ready") is important workflow state but is rendered as a borderless right-aligned input that most users might not notice.

### 3.5 Timer Widget Buried in Sidebar

The `TimerWidget` is anchored to the bottom of `ContractsSidebar`. When the sidebar is collapsed, the timer disappears entirely. The timer is the primary real-time interaction element:

- **Visibility problem**: If a user collapses the sidebar for more content space, they lose sight of their running timer.
- **Small footprint**: The timer display uses `text-2xl font-bold` for the elapsed time, but is crammed into the sidebar's 240px width alongside Start/Pause/Stop buttons, a contract select, and a description textarea. When running, the widget is information-dense in a narrow column.
- **No persistent indicator**: There is no top bar, status bar, or floating element that shows a running timer when the sidebar is collapsed or when in mobile mode.

### 3.6 Duplicate Entry Row Components

There are two nearly identical entry display components:
- `src/lib/components/weekly/TimeEntryCard.svelte` -- used by `TimeEntriesPanel`, supports inline editing (click-to-edit time, contract, description), 298 lines.
- `src/lib/components/weekly/WeeklyEntryRow.svelte` -- an older variant, also supports inline time editing and delete, 209 lines. Has slightly different visual styling (includes "Delete" text button vs. "x" icon).

There is also:
- `src/lib/components/time/TimeEntryRow.svelte` -- uses SvelteKit form actions (`use:enhance`) for delete, links to `/time/new?edit=` for editing, no inline editing. An older server-side approach.

Three components doing approximately the same job creates maintenance burden and inconsistency.

### 3.7 Week Header Component Unused/Orphaned

`src/lib/components/weekly/WeekHeader.svelte` appears to be an older version of the week navigation component. It includes Previous/Next/This Week buttons and an "Add Entry" link to `/time/new`, using SvelteKit form actions for status changes (`use:enhance`). This was likely superseded by `WeekSectionHeader.svelte` (which uses inline status editing) but was never removed. It is not imported by any active route.

### 3.8 DaySection Component Orphaned

`src/lib/components/weekly/DaySection.svelte` renders day groups using the old `WeeklyEntryRow` component and links to `/time/new?date=...` for adding entries. It is not used by `TimeEntriesPanel` (which uses its own inline `{#snippet daySection}` instead). Another dead component.

### 3.9 NewEntryRow -- Limited Categorization

The quick-add `NewEntryRow` only collects:
- Contract (via `ContractSelect`)
- Description (text input)
- Time (text input accepting "2h30m" or range formats)

It does not support selecting deliverable or work type inline. Users who want to categorize entries properly must create a minimal entry and then edit it -- but the `TimeEntryCard` inline editor also lacks deliverable/work type editing. Full categorization is only available via the `TimerCompletionForm` (after stopping a timer) or the `AddTimeEntryModal` -- but even the modal is missing deliverable/work type fields. This means **the only path to a fully categorized entry is via the timer workflow**, which is a significant gap for manual entry.

---

## 4. Component Inventory (Timesheet-Related)

### Layout Components

| Component | Path | Description |
|-----------|------|-------------|
| AppShell | `src/lib/components/layout/AppShell.svelte` | Three-panel layout shell with resizable Panel 2, collapsible Panel 1, mobile push/pop navigation |
| ContractsSidebar | `src/lib/components/layout/ContractsSidebar.svelte` | Panel 1: contract list, mode switching, action buttons, timer widget |
| WeekListPanel | `src/lib/components/layout/WeekListPanel.svelte` | Panel 2 (time mode): scrollable week summary list with selection state |
| TimeEntriesPanel | `src/lib/components/layout/TimeEntriesPanel.svelte` | Panel 3 (time mode): continuous weekly scroll with day sections, entry cards, and inline add |
| NoteListPanel | `src/lib/components/layout/NoteListPanel.svelte` | Panel 2 (notes mode): note list for selected contract with create/delete |
| NoteEditorPanel | `src/lib/components/layout/NoteEditorPanel.svelte` | Panel 3 (notes mode): TipTap editor, backlinks, linked entries, attachments |
| SidebarToggle | `src/lib/components/layout/SidebarToggle.svelte` | Floating button to collapse/expand Panel 1 |

### Weekly/Time Entry Components

| Component | Path | Description |
|-----------|------|-------------|
| WeekSectionHeader | `src/lib/components/weekly/WeekSectionHeader.svelte` | Week divider: label, total hours, inline-editable status text field |
| TimeEntryCard | `src/lib/components/weekly/TimeEntryCard.svelte` | **Active** entry row with full inline editing (time, contract, description) and delete |
| NewEntryRow | `src/lib/components/weekly/NewEntryRow.svelte` | Inline quick-add form: contract select + description + time input |
| WeeklyEntryRow | `src/lib/components/weekly/WeeklyEntryRow.svelte` | **Likely orphaned** older entry row variant with inline time editing and delete |
| DaySection | `src/lib/components/weekly/DaySection.svelte` | **Orphaned** day group renderer using WeeklyEntryRow; superseded by inline snippet in TimeEntriesPanel |
| WeekHeader | `src/lib/components/weekly/WeekHeader.svelte` | **Orphaned** navigation-based week header with Prev/Next buttons and form-action status select |
| TimeEntryRow | `src/lib/components/time/TimeEntryRow.svelte` | **Orphaned** server-action-based entry row with Edit link and form-based delete |

### Timer Components

| Component | Path | Description |
|-----------|------|-------------|
| TimerWidget | `src/lib/components/timer/TimerWidget.svelte` | Full timer lifecycle: idle/running/paused/stopped states, lives in sidebar |
| TimerDisplay | `src/lib/components/timer/TimerDisplay.svelte` | Formatted HH:MM:SS elapsed time display with pause indicator |
| TimerCompletionForm | `src/lib/components/timer/TimerCompletionForm.svelte` | Post-stop form: cascading contract/deliverable/work type selects + description + save/discard |
| CascadingSelects | `src/lib/components/timer/CascadingSelects.svelte` | Contract -> Deliverable -> Work Type cascading dropdown group |
| ContractSelect | `src/lib/components/timer/ContractSelect.svelte` | Standalone contract dropdown with compact mode |
| AddTimeEntryModal | `src/lib/components/timer/AddTimeEntryModal.svelte` | Modal for manual entry: date + HH:MM duration + contract + description (no deliverable/work type) |

### Navigation State

| Module | Path | Description |
|--------|------|-------------|
| navigation.svelte.ts | `src/lib/stores/navigation.svelte.ts` | Navigation context: mode, selected contract/week/note, sidebar collapse, mobile level |

### Routes

| Route | Path | Description |
|-------|------|-------------|
| Main page | `src/routes/+page.svelte` | Assembles AppShell with ContractsSidebar + mode-switched Panel 2/3 |
| Root layout | `src/routes/+layout.svelte` | Initializes NavigationContext and DataService in Svelte context |
| Add entry page | `src/routes/time/new/+page.svelte` | Standalone add/edit page (older server-action approach) |

---

## 5. Data Flow

### Initialization

```
+layout.svelte
  |-- Creates NavigationContext (Svelte 5 runes, sets selectedWeek = current Monday)
  |-- Creates DelegatingDataService(FetchDataService)
  |-- Sets both in Svelte context
  |
  +page.svelte
    |-- Reads NavigationContext via getNavigationContext()
    |-- Renders AppShell with mode-switched panel content
```

### Sidebar -> Week Selection -> Entry Display

```
1. User clicks "Time Entries" in ContractsSidebar
   --> navigationContext.selectTimeEntries()
   --> mode = 'time-entries', selectedContractId = null
   --> Panel 2 renders WeekListPanel, Panel 3 renders TimeEntriesPanel

2. WeekListPanel loads on mount:
   --> dataService.getWeekSummaries(12) --> WeekSummary[]
   --> Renders list, filtering out empty past weeks
   --> selectedWeek already set to current Monday

3. TimeEntriesPanel loads on mount:
   --> getWeekStarts(currentMonday, 4) --> 4 Monday date strings
   --> dataService.getWeeklyTimeEntries(weekStarts) --> WeekData[]
   --> Each WeekData contains { weekStart, days: DayData[], weeklyTotalMinutes, status }
   --> Each DayData contains { date, entries: TimeEntryDisplay[], totalMinutes }

4. User clicks a week in WeekListPanel
   --> navigationContext.selectWeek(weekStart)
   --> TimeEntriesPanel $effect detects change
   --> weekSectionRefs[selectedWeek].scrollIntoView({ behavior: 'smooth' })
   --> Panel 3 scrolls to that week section
```

### Entry Creation (Quick-Add)

```
1. User clicks "+" on a day header in TimeEntriesPanel
   --> expandedAddEntry[dayDate] = true
   --> NewEntryRow renders below heading

2. NewEntryRow collects: ContractSelect + description + time text
   --> parseTimeInput(timeInputValue) --> { type: 'range'|'duration', ... }
   --> dataService.createTimeEntry({ date, durationMinutes, contractId, ... })
   --> onEntryCreated callback --> collapses NewEntryRow
   --> TimeEntriesPanel.refreshWeeks() re-fetches all loaded weeks
```

### Entry Editing (Inline)

```
1. User clicks time display on TimeEntryCard
   --> isEditingTime = true, shows text input pre-filled
   --> On blur or Enter: parseTimeInput --> dataService.updateTimeEntry(id, fields)
   --> onUpdated callback --> TimeEntriesPanel.refreshWeeks()

2. User clicks contract label on TimeEntryCard
   --> isEditingContract = true, shows ContractSelect
   --> $effect watches selectedContractId changes
   --> dataService.updateTimeEntry(id, { contractId })
   --> onUpdated callback --> refreshWeeks()

3. User clicks description on TimeEntryCard
   --> isEditingDescription = true, shows text input
   --> Debounced save (1s) via dataService.updateTimeEntry(id, { description })
```

### Timer Flow

```
1. TimerWidget in sidebar (idle state): "Start Timer" / "Add Entry" buttons

2. Start Timer:
   --> dataService.startTimer() --> TimerEntry { id, startTime }
   --> timerState = 'running', interval ticks elapsedSeconds

3. While running: optional contract select + description textarea
   --> Changes immediately persisted via dataService.updateTimeEntry()

4. Stop Timer:
   --> dataService.stopTimer() --> TimerEntry { endTime, durationMinutes }
   --> timerState = 'stopped'
   --> TimerCompletionForm renders with CascadingSelects

5. Save:
   --> dataService.saveTimer({ entryId, contractId, deliverableId, workTypeId, description })
   --> Timer resets to idle

6. Discard:
   --> dataService.discardTimer(entryId)
   --> Timer resets to idle
```

### Week Status Updates

```
1. User types in status input on WeekSectionHeader
   --> Debounced (1s): onStatusChange(trimmedValue)
   --> TimeEntriesPanel.handleStatusChange()
   --> dataService.updateWeeklyStatus(year, weekNumber, newStatus)
   --> Local state updated immediately (optimistic)
```

### Cross-Panel Communication

- **WeekListPanel -> TimeEntriesPanel**: Connected via `navigationContext.selectedWeek`. Setting it in Panel 2 triggers a scroll in Panel 3 via `$effect`.
- **NoteListPanel -> NoteEditorPanel**: Connected via `navigationContext.selectedNoteId`. Setting it triggers a fetch in Panel 3.
- **NoteEditorPanel -> NoteListPanel**: Uses `window.dispatchEvent(new CustomEvent('note-saved', ...))` to update note previews. This is a workaround -- the two panels don't share state directly and use DOM events to bridge the gap.
- **No cross-panel communication between time and notes modes.** They are fully separate views.

---

## 6. Summary of Key Issues for Redesign

| Issue | Severity | Notes |
|-------|----------|-------|
| WeekListPanel redundancy | High | Panel 2 in time mode adds minimal value; consider eliminating or repurposing |
| Description subordinate to contract path | Medium | Visual hierarchy doesn't match information priority for review workflows |
| No "today" emphasis | Medium | Users cannot instantly locate current day |
| No month-level navigation | Low-Medium | Historical review requires excessive scrolling |
| Timer invisible when sidebar collapsed | Medium | Running timer has no persistent indicator |
| Three duplicate entry row components | Medium | Maintenance burden; consolidate to one |
| Quick-add missing deliverable/work type | Low-Medium | Only timer path allows full categorization |
| Orphaned components (WeekHeader, DaySection, WeeklyEntryRow) | Low | Dead code to clean up |
| Status field too subtle | Low | Important workflow state rendered as plain text input |
| No client color/visual identity in entries | Low | All entries look identical regardless of client |
