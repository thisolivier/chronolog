# Sprint 018 — QA: Manual Testing Backlog

**Status:** pending
**Type:** QA — manual testing checklist
**Depends on:** Sprint 016-CL (note move), Sprint 017-CL (timesheet redesign)
**Branch:** n/a (document only)

## Objectives

Define the manual testing tasks to be performed by the user after sprints 016 and 017
are merged. This sprint produces a checklist, not automated tests.

## Manual Testing Checklist

### A. Timesheet Redesign (Sprint 017 — Desktop)

#### A1. Palette and Visual Feel
- [ ] App uses warm stone tones (not cold gray)
- [ ] Cards feel journal-like, not spreadsheet-clinical
- [ ] White cards on stone-50 background have sufficient contrast
- [ ] Interactive elements (buttons, links) still use blue-600

#### A2. Layout
- [ ] Time entries mode shows 2-panel layout (sidebar + content)
- [ ] Notes mode still shows 3-panel layout (sidebar + list + editor)
- [ ] Sidebar collapses and expands correctly in both modes
- [ ] No layout shift when switching between time entries and notes

#### A3. WeekStrip
- [ ] Horizontal strip appears at top of content area in time mode
- [ ] Shows Mon-Sun with day abbreviation and date number
- [ ] Per-day hour totals update correctly
- [ ] Client color proportion bars visible per day
- [ ] Click a day to scroll to that day's section
- [ ] Prev/next arrows navigate between weeks
- [ ] Current day column highlighted with amber accent
- [ ] Sticky behavior works when scrolling

#### A4. Time Entry Cards
- [ ] Description is the largest/darkest text (hero element)
- [ ] Duration right-aligned, muted color
- [ ] Client color left border (3px) matches the contract's client
- [ ] Client color dot next to contract label
- [ ] Contract label is secondary/muted text
- [ ] Deliverable/work type shown when present (even more muted)
- [ ] All inline editing still works: time, contract, description, delete
- [ ] Wiki-link `[[NOTE_ID]]` rendering still works in descriptions
- [ ] Wiki-link autocomplete still works when editing

#### A5. New Entry Row
- [ ] Description input is first/full-width
- [ ] Contract, deliverable, time inputs in row below
- [ ] Cancel and Save buttons visible
- [ ] Client color border updates when contract is selected

#### A6. Today Emphasis
- [ ] Today's section has warm amber background
- [ ] "TODAY" badge visible next to day name
- [ ] Auto-scrolls to today on page load

#### A7. Status Badges
- [ ] Week status is a colored chip (not a text input)
- [ ] Click cycles through: Unsubmitted (stone) → Draft ready (amber) → Submitted (emerald)
- [ ] Status persists after navigation/reload

#### A8. Empty States
- [ ] Days with no entries show dashed-border container
- [ ] "No entries" message visible
- [ ] "+" add button visible on empty days

#### A9. Timer Indicator
- [ ] When timer running: green pulsing dot + elapsed time in top bar
- [ ] Timer indicator shows contract name and description snippet
- [ ] Timer indicator visible even when sidebar collapsed
- [ ] Clicking indicator reopens sidebar

#### A10. Client Colors
- [ ] Each client has a distinct color
- [ ] Color dots appear in sidebar next to contracts
- [ ] Same color used consistently: sidebar, cards, WeekStrip bars

### B. Timesheet Redesign (Sprint 017 — Mobile)

#### B1. Mobile Layout
- [ ] Single-panel navigation (no overlapping panels)
- [ ] Back button navigation works
- [ ] Timer indicator visible in mobile header

### C. Note Move Between Contracts (Sprint 016)

#### C1. Move Action
- [ ] "Move to..." visible in note editor header
- [ ] Shows contract list (excluding current contract)
- [ ] Selecting a contract moves the note
- [ ] Note disappears from old contract's note list
- [ ] Note appears in new contract's note list
- [ ] Feedback message shown after move

#### C2. Integrity After Move
- [ ] Backlinks (`[[NOTE_ID]]`) still work after move
- [ ] Linked time entries still shown in note
- [ ] Note ID does not change (original prefix preserved)
- [ ] Note content and attachments preserved

### D. Desktop App (Tauri)

#### D1. Basic Functionality
- [ ] App launches without errors
- [ ] Login/registration works
- [ ] Time entry CRUD works
- [ ] Note CRUD works
- [ ] Timer start/stop/save works
- [ ] Navigation between time entries and notes works

#### D2. Tauri-Specific
- [ ] Window resize behaves correctly
- [ ] Sidebar collapse/expand works
- [ ] No CORS or origin errors in development mode

### E. Regression

#### E1. Core Flows
- [ ] Create time entry (manual)
- [ ] Edit time entry (all fields)
- [ ] Delete time entry
- [ ] Start/stop/save timer
- [ ] Create note
- [ ] Edit note (TipTap editor, markdown)
- [ ] Delete note
- [ ] Raw/rendered mode toggle
- [ ] Export note as MD
- [ ] Export note as PDF (print)
- [ ] Wiki-links between notes
- [ ] Backlinks displayed correctly
- [ ] Admin: manage clients and contracts
- [ ] Weekly status update
- [ ] Deliverable selector on time entries

## Notes

This is a **manual testing checklist** for the user. It is not automated.
The user should run through each section in order, checking off items as they pass.

Items marked with `[ ]` need human verification — they test visual appearance,
interaction feel, and cross-device behavior that automated tests cannot verify.

**Priority order:** A (desktop timesheet) → C (note move) → E (regression) → D (Tauri) → B (mobile)
