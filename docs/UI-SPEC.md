# Chronolog - UI Specification

## Layout Model

Apple Notes-inspired three-panel layout on desktop, single-panel drill-down on mobile.

### Desktop Layout

```
┌──────────────┬────────────────────┬──────────────────────────────────┐
│  Contracts   │  Note List         │  Content Area                    │
│  Panel       │  (notes mode only) │  (Note editor or Time entries)   │
│              │                    │                                  │
│  [Internal]  │  [pinned notes]    │                                  │
│  [Client A]  │  [notes by date]   │                                  │
│  [Client B]  │                    │                                  │
│              │                    │                                  │
│              │                    │                                  │
│              │                    │                                  │
│  ──────────  │                    │                                  │
│  Time Entries│                    │                                  │
│  ──────────  │                    │                                  │
│              │                    │                                  │
│  [Timer      │                    │                                  │
│   Widget]    │                    │                                  │
└──────────────┴────────────────────┴──────────────────────────────────┘
```

### Panels

**Panel 1 — Contracts (far left, collapsible)**
- Lists all contracts grouped by client
- "Internal" is the default/top-level contract (for non-client work)
- **"Time Entries"** option at the top, above all contracts — this is global (all clients)
- Selecting a contract populates Panel 2 with that contract's notes
- Selecting "Time Entries" hides Panel 2; Panel 3 shows the time entries, with the WeekStrip as the week navigator
- Panel can be collapsed to give more space to Panels 2 and 3
- **Timer widget** sits at the bottom of this panel (see below)

**Panel 2 — Note list (middle left)**
- Shown in Notes mode only (contract selected); hidden in Time Entries mode
- Lists notes for the selected contract
- Sorted by creation date or modification date (toggle)
- Notes can be pinned to the top
- Selecting a note opens it in Panel 3

**Panel 3 — Content (right, main area)**
- **In Notes mode**:
  - TipTap editor for the selected note
  - Full markdown editing with toolbar
- **In Time Entries mode**:
  - WeekStrip at the top is the week navigator (there is no separate week list panel)
  - Continuous vertical scroll of time entries
  - Lazy-loaded by week
  - Broken into sections by day headers
  - Each week has an editable status field in its header ("Unsubmitted", "Draft ready", etc.)
  - Weekly hour totals displayed

### Focus Mode / Multi-Window (Desktop)

Behaviour depends on the runtime environment:

**Desktop (Tauri):**
- Double-clicking a note in Panel 2 opens it in a **new OS-level window** via the Tauri multi-window API
- The new window shows only the note editor (no sidebars) — a dedicated writing surface
- Multiple notes can be open simultaneously in separate windows
- Right-click a note → "Open in New Window" as an alternative to double-click
- Each window is independently resizable, positionable, and closeable

**Mobile (PWA):**
- Double-tapping a note enters **focus mode**: both sidebars collapse, note fills the entire screen
- Back button or swipe-right returns to the three-panel (or drill-down) layout
- No multi-window support (browser limitation)

## Mobile Layout

Single-panel drill-down navigation with push/pop transitions.

```
Level 1: Contracts list (default view)
    │  tap contract
    ▼
Level 2: Notes list (for that contract)
    │  tap note
    ▼
Level 3: Note editor (full screen)
```

- Back arrow / swipe-right to pop back up
- Timer widget is a persistent fixed footer across all levels
- "Time Entries" drills down directly: Contracts → Time Entries panel (the WeekStrip inside it navigates weeks)

## Timer Widget

Persistent widget at the bottom of the contracts panel (desktop) or as a fixed footer (mobile).

### States

**Idle:**
```
┌─────────────────────────────┐
│  ▶ Start Timer              │
└─────────────────────────────┘
```

**Running:**
```
┌─────────────────────────────┐
│  ⏸ 01:23:45                 │
│  Started: [09:30] (editable)│
│  📎 New Note                │
└─────────────────────────────┘
```

**Paused:**
```
┌─────────────────────────────┐
│  ▶ 01:23:45 (paused)        │
│  Started: [09:30] (editable)│
│  📎 New Note                │
└─────────────────────────────┘
```

**Stopped (completing entry):**
```
┌─────────────────────────────┐
│  01:23:45                   │
│  Start: [09:30]  End:[10:53]│
│  Contract: [select]  ← required to save       │
│  Deliverable: [select]                         │
│  Work Type: [select]                           │
│  Description: [...]                            │
│  📎 New Note                │
│  [Save]  [Discard]          │
└─────────────────────────────┘
```

### Behaviour

- **Start**: Creates a draft time entry in the database immediately (gets an ID). Timer begins counting.
- **Start time**: Always editable. Adjusting it recalculates elapsed time.
- **Pause**: Stops the clock. User must manually adjust start or end time to account for the gap. Resume continues the count from the adjusted state.
- **Stop**: Freezes the timer. End time becomes editable. Contract/deliverable/work type fields appear (required to save).
- **Save**: Requires contract selection at minimum. Saves the completed time entry.
- **Discard**: Deletes the draft time entry.
- **New Note**: Creates a new note linked to this time entry. Available from the "running" state onward (since the entry already exists as a draft).
- **Contract/deliverable/work type**: Can be selected at any point, but are required before saving.

## Time Entries View

### Weekly Sections

```
┌──────────────────────────────────────────────┐
│  Week 6 — Feb 3-9, 2026          32.5 hrs   │
│  Status: [Draft ready ▼]                     │
├──────────────────────────────────────────────┤
│  Monday, Feb 3                      7.0 hrs  │
│  ┌──────────────────────────────────────────┐│
│  │ 09:00-10:30  Big Cheese / Install / Dev  ││
│  │ Onboarding workshop prep                 ││
│  │ 📎 BIGCH.20260203.001                    ││
│  ├──────────────────────────────────────────┤│
│  │ 10:30-12:00  Big Cheese / Install / Rev  ││
│  │ Document review                          ││
│  └──────────────────────────────────────────┘│
│                                              │
│  Tuesday, Feb 4                     6.5 hrs  │
│  ...                                         │
├──────────────────────────────────────────────┤
│  Week 5 — Jan 27 - Feb 2, 2026    28.0 hrs  │
│  Status: [Submitted ▼]                       │
│  ...                                         │
└──────────────────────────────────────────────┘
```

- Continuous scroll, newest week at top
- Lazy-loaded as user scrolls
- Day headers with daily hour totals
- Week headers with weekly totals and editable status
- Each entry row shows: time range, client/contract/deliverable/work type, description, linked note references
- Clicking a note reference navigates to that note
- Entries are editable inline (click to edit any field)
