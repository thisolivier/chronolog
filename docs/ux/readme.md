# Chronolog UX Documentation

Comprehensive documentation of the Chronolog application's user interface, covering every screen, component, interaction pattern, and data flow. Generated from source code analysis of the SvelteKit + TipTap + Tailwind implementation.

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 01 | [App Shell & Layout](01-app-shell.md) | Three-panel desktop layout, mobile push/pop navigation, auth guard, initialization |
| 02 | [Contracts Sidebar](02-contracts-sidebar.md) | Panel 1: contract navigation, mode switching, contract creation modal |
| 03 | [Time Entries View](03-time-entries-view.md) | Panels 2+3 in time mode: week list, day sections, inline entry cards, inline editing |
| 04 | [Notes View](04-notes-view.md) | Panels 2+3 in notes mode: note list, TipTap editor, backlinks, attachments |
| 05 | [Timer Widget](05-timer-widget.md) | Persistent timer with idle/running/paused/stopped states, manual entry modal |
| 06 | [Authentication Flows](06-auth-flows.md) | Login, registration, TOTP 2FA enrollment/disable, first-user provisioning |
| 07 | [Admin Panel](07-admin-panel.md) | Client/contract/deliverable/work-type CRUD management |
| 08 | [Time Entry Form](08-time-entry-form.md) | Standalone create/edit page with cascading selects |
| 09 | [Navigation State](09-navigation-state.md) | Svelte 5 runes-based navigation context and state machine |
| 10 | [Data Service Layer](10-data-service-layer.md) | DataService interface, DelegatingDataService, FetchDataService, API mapping |
| 11 | [Spike Page](11-spike-page.md) | PowerSync WASM SQLite diagnostic test runner |
| 12 | [Component Inventory](12-component-inventory.md) | Complete list of all Svelte components, TipTap extensions, and route pages |
| 13 | [Styling Patterns](13-styling-patterns.md) | Tailwind CSS patterns, color palette, typography, component classes |
| -- | [Current Layout Analysis](current-layout-analysis.md) | Sprint 012: Analysis of 3-panel timesheet issues, what works, what doesn't |
| -- | [Reference App Research](reference-app-research.md) | Sprint 012: Patterns from Day One, Toggl, Harvest, Fantastical, and others |
| -- | [Wireframes](wireframes-timesheet-redesign.md) | Sprint 012: ASCII wireframes for desktop, mobile, WeekStrip, entry cards, empty states |
| -- | [Visual Hierarchy Spec](visual-hierarchy-spec.md) | Sprint 012: Warm palette, client colors, description-first cards, today treatment |
| -- | [Notes Integration Design](notes-integration-design.md) | Sprint 012: Note-time entry linking, preview popovers, navigation flows |
| -- | **[Timesheet Redesign Spec](timesheet-redesign-spec.md)** | **Sprint 012: Final design specification — the primary deliverable** |
| -- | **[Note-Time Linking Spec](note-time-linking-spec.md)** | **Sprint 013: Inline wiki-links in descriptions, parse-on-save, autocomplete** |

## Architecture Summary

Chronolog is a time-tracking and note-taking app built with SvelteKit as a Tauri desktop app (macOS) with a PWA fallback.

### Main Application Flow

```
User authenticates (login/register)
    |
    v
Root layout initializes NavigationState + DataService
    |
    v
Main page renders AppShell with three panels
    |
    +-- Panel 1: ContractsSidebar (always visible)
    |       - "Time Entries" mode switch
    |       - Contract list (click to switch to notes mode)
    |       - Timer widget (bottom)
    |
    +-- Panel 2: varies by mode
    |       - Time mode: WeekListPanel (week index)
    |       - Notes mode: NoteListPanel (note list)
    |
    +-- Panel 3: varies by mode
            - Time mode: TimeEntriesPanel (weekly breakdown)
            - Notes mode: NoteEditorPanel (TipTap editor)
```

### Data Hierarchy

```
Client (managed in Admin)
  +-- Contract (managed in Admin or sidebar modal)
        +-- Deliverable (managed in Admin)
        |     +-- Work Type (managed in Admin)
        |
        +-- Notes (created/edited in notes view)
        |     +-- Attachments (uploaded in editor)
        |     +-- Wiki-links (typed in editor)
        |     +-- Backlinks (auto-extracted)
        |
        +-- Time Entries (created via timer or manual entry)
              +-- Linked Notes (linked in editor panel)
```

### Key Technology

- **Frontend**: SvelteKit + Svelte 5 runes
- **Editor**: TipTap with custom WikiLink, AnchoredHeading extensions
- **Styling**: Tailwind CSS v4
- **State**: Context-based navigation store with Svelte 5 `$state`/`$derived`
- **Data**: DataService abstraction over fetch-based API calls
- **Auth**: Better Auth with TOTP 2FA
