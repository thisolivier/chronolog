# Chronolog Comprehensive Gap Analysis

Exhaustive audit of the Chronolog application, covering workflow completeness, data surface gaps, missing consultant workflows, UX friction points, API surface, and current backlog context.

---

## 1. Workflow Completeness

### Time Entry Creation

| Workflow | Status | Details |
|----------|--------|---------|
| Timer-based entry | **Complete** | Start, pause, resume, stop, save/discard lifecycle is fully implemented in `TimerWidget.svelte`. Draft contract and description are persisted server-side during the running state. Timer recovery on page reload works via `getTimerStatus()`. |
| Manual entry (modal) | **Partial** | `AddTimeEntryModal.svelte` collects date, duration (HH:MM only), contract, and description. **Missing: deliverable and work type fields.** The modal uses `ContractSelect` but does not include `DeliverableSelect` or work type selection. Duration format is limited to HH:MM -- does not accept the "2h30m" or "9:00-11:30" formats that inline entry supports. |
| Quick-add (inline) | **Partial** | `NewEntryRow.svelte` collects contract, deliverable, description, and time. **Missing: work type field.** Description is below contract (not the hero field per the redesign spec). No explicit Save/Cancel buttons -- uses Enter to submit and "x" icon to cancel, which is discoverable but not obvious. |
| Standalone form page | **Complete** | `/time/new` provides a full form with cascading selects (contract, deliverable, work type), start/end time or manual duration toggle, and description. However, this page is a **legacy secondary entry point** not well-connected from the main UI. |

**Gap summary:** The only path to create a fully categorized entry (contract + deliverable + work type) is via the timer completion form or the standalone `/time/new` page. Both the quick-add row and the manual modal are missing work type. The modal is also missing deliverable.

### Time Entry Editing

| Workflow | Status | Details |
|----------|--------|---------|
| Inline time editing | **Complete** | Click duration/time on `TimeEntryCard` to edit. Accepts "2h30m" and "9:00-11:30" formats via `parseTimeInput()`. Saves on Enter or blur. Red border on invalid input. |
| Inline contract editing | **Complete** | Click contract label to show `ContractSelect` dropdown with deliverable select. Saves immediately. |
| Inline description editing | **Complete** | Click description to show text input. Debounced save (1000ms). Saves on blur. |
| Inline deliverable editing | **Partial** | Deliverable can be changed when editing contract, but **work type cannot be edited inline**. The `TimeEntryCard` shows the work type name but provides no editing affordance for it. |
| Modal/page editing | **Complete** | `/time/new?edit=<id>` provides full editing with all fields including work type. However, there is no navigation path to this page from the main UI -- no "Edit" button or link on `TimeEntryCard` points to it. |

**Gap summary:** Work type is not editable inline. The full edit page exists but is unreachable from the main UI.

### Time Entry Deletion

| Workflow | Status | Details |
|----------|--------|---------|
| Inline delete with confirmation | **Complete** | Two-step confirmation: click "x" to reveal Yes/No. Calls `deleteTimeEntry()` and refreshes. Good UX pattern. |
| Bulk delete | **Missing** | No way to delete multiple entries at once. |

### Weekly Review and Status Management

| Workflow | Status | Details |
|----------|--------|---------|
| Week status editing | **Complete** | `WeekSectionHeader.svelte` provides an inline text input for free-text status. Debounced save (1000ms). |
| Status visualization | **Partial** | `WeekListPanel` shows colored status dots (green/yellow/gray). But the `WeekSectionHeader` renders status as a nearly invisible right-aligned borderless text input. The redesign spec addresses this with colored badge chips. |
| Week-level review view | **Missing** | No dedicated "review this week" view that shows a summary of all entries with totals per client/contract. The user must scan the continuous scroll manually. |
| Week submission/approval workflow | **Missing** | The status field is free text with no structured workflow (e.g., "Submit for review" button, lock after submission). |

### Note Creation and Editing

| Workflow | Status | Details |
|----------|--------|---------|
| Note creation | **Complete** | "New Note" button in `NoteListPanel` creates an empty note via `createNote(contractId)` and auto-selects it. |
| Note editing (TipTap) | **Complete** | Rich text editor with bold, italic, headings (H1-H3), bullet/ordered lists, code blocks, blockquotes, horizontal rules, links, images, and wiki-links. Auto-save on 500ms debounce. |
| Note deletion | **Complete** | Delete button in `NoteListPanel` header with `window.confirm()` dialog. |
| Note pinning | **Partial** | The `isPinned` field exists in the data model and is displayed in the note list (pin icon). The `updateNote` API accepts `isPinned`. However, **there is no toggle button in the UI** to pin/unpin a note -- the pin icon is display-only. |
| Note export (Markdown) | **Complete** | Export menu in `NoteEditorPanel` header with "Export as Markdown" option. Downloads a `.md` file. |
| Note export (PDF) | **Partial** | "Export as PDF" triggers `window.print()` with print-specific CSS. This is a workaround, not a true PDF export -- depends on the user's print dialog and browser support. |
| Note search | **Partial** | API endpoint exists (`/api/notes/search?q=`), `searchNotesForUser()` query exists server-side, and the `DataService` interface includes a `searchNotes()` method in the `FetchDataService` route mapping. However, **there is no search UI** anywhere in the application. No search bar, no search results panel, no keyboard shortcut to trigger search. |
| Note move (change contract) | **Missing** | No way to move a note from one contract to another. The `contractId` is set at creation and never editable. |

### Note Linking (Wiki-Links Between Notes)

| Workflow | Status | Details |
|----------|--------|---------|
| Writing wiki-links | **Complete** | Typing `[[` in the TipTap editor triggers a suggestion dropdown (`SuggestionDropdown.ts`) that queries `searchNotes()`. Selecting inserts a `WikiLink` inline node. |
| Wiki-link rendering | **Complete** | Wiki-links render as clickable indigo-styled inline elements. |
| Wiki-link navigation | **Complete** | Clicking a wiki-link calls `onWikiLinkClick(noteId)` which navigates to that note via `navigation.selectNote()`. |
| Backlinks display | **Complete** | `getNoteBacklinks(noteId)` fetches notes that link to the current note. Backlinks are shown as clickable chips below the editor. |
| Heading-anchor links | **Partial** | The `AnchoredHeading` extension generates heading anchors. `[[NOTE_ID#heading]]` syntax is parsed. However, navigation does not scroll to the heading -- it goes to the top of the note. |

### Note-Time Entry Linking

| Workflow | Status | Details |
|----------|--------|---------|
| View linked time entries from note | **Partial** | `LinkedTimeEntries.svelte` shows linked entry IDs, but only as truncated UUIDs (`te-abc123...`) with no description, date, duration, or contract info. Nearly useless for identification. No way to navigate to the linked entry in the timesheet. |
| Create links from note to time entry | **Missing** | No [+] button or picker. Links can only be created via the `note_time_entry_link` table directly (no UI). |
| View linked notes from time entry | **Missing** | `TimeEntryCard` does not show any note indicators. No popover, no link rendering. |
| Create links from time entry to note | **Missing** | No `[[NOTE_ID]]` syntax in description field, no autocomplete, no link button. |
| Parse-on-save link reconciliation | **Missing** | Not implemented yet. Planned in the note-time-linking-spec. |
| Unlink time entry from note | **Complete** | "x" button on each linked entry in `LinkedTimeEntries.svelte` calls `unlinkNoteTimeEntry()`. |

**Gap summary:** The linking infrastructure exists in the data model and API, but the UI is nearly non-functional. The approved `note-time-linking-spec.md` describes the full implementation plan (backlog item CL-8).

### Admin: Client Management

| Workflow | Status | Details |
|----------|--------|---------|
| Client list | **Complete** | `/admin/clients` shows a table of clients with name, short code, emoji, and Edit/Delete buttons. |
| Client creation | **Complete** | "Add Client" button shows an inline form with name, short code, and emoji fields. |
| Client editing | **Complete** | Inline edit mode replaces the table row with editable fields. |
| Client deletion | **Complete** | Two-step confirmation. |
| Client color assignment | **Missing** | The redesign spec introduces a `colorIndex` field for client colors. This does not exist in the current schema or admin UI. |

### Admin: Contract Management

| Workflow | Status | Details |
|----------|--------|---------|
| Contract list (per client) | **Complete** | `/admin/clients/[clientId]` shows contracts with name, description, active/inactive badge, Edit/Delete. |
| Contract creation (admin) | **Complete** | "Add Contract" form with name, description, active checkbox. |
| Contract creation (sidebar) | **Complete** | `ContractCreateModal` accessible from sidebar "New Contract" link. |
| Contract editing | **Complete** | Inline edit mode with name, description, active fields. |
| Contract deletion | **Complete** | Two-step confirmation. |
| Contract rate/billing info | **Missing** | No hourly rate, budget, or billing details on contracts. See Section 3. |

### Admin: Deliverable and Work Type Management

| Workflow | Status | Details |
|----------|--------|---------|
| Deliverable CRUD | **Complete** | `/admin/clients/[clientId]/contracts/[contractId]` shows deliverables with name, sort order, nested work types. Full inline CRUD. |
| Work type CRUD | **Complete** | Nested under each deliverable. Name, sort order, inline editing. |
| Work type reordering | **Complete** | `?/reorderWorkTypes` form action exists. |
| Deliverable on time entries | **Partial** | The `deliverable_id` field exists on time entries and is exposed in the timer completion form and `/time/new`. But the inline `NewEntryRow` and `AddTimeEntryModal` were missing it until recently -- `NewEntryRow` now has `DeliverableSelect`. The `AddTimeEntryModal` still lacks deliverable. Backlog item CL-6 is specifically about this. |

### Authentication

| Workflow | Status | Details |
|----------|--------|---------|
| Login | **Complete** | Email/password via Better Auth. Error handling, loading states. |
| Register | **Complete** | Name, email, password, confirm password. Client-side validation (8 char min, match check). |
| 2FA enrollment | **Complete** | Full flow: password verification, QR code display, TOTP verification, recovery codes display. |
| 2FA login challenge | **Complete** | 6-digit code entry after password verification. |
| 2FA disable | **Complete** | Password-gated disable with success message. |
| Password reset | **Missing** | No "Forgot password?" link on login page. No password reset flow. |
| Session management | **Partial** | 30-day sessions via Better Auth. Sign out button exists in admin panel. **No sign out accessible from the main app** -- the user must navigate to `/admin` to find the sign out button. |
| Profile editing | **Missing** | No way to change name, email, or password after registration. |

### Data Export

| Workflow | Status | Details |
|----------|--------|---------|
| Note export (Markdown) | **Complete** | Per-note export via Export menu in note editor panel. |
| Note export (PDF) | **Partial** | Uses `window.print()`. No true PDF generation. |
| Time entry export (CSV/Excel) | **Missing** | No export functionality for time entries. |
| Bulk note export | **Missing** | Can only export one note at a time. |
| Report export | **Missing** | No reporting views, therefore no report export. |

### Reporting

| Workflow | Status | Details |
|----------|--------|---------|
| Weekly hour totals | **Partial** | Shown in `WeekSectionHeader` and `WeekListPanel` summaries. Per-week, per-day granularity. |
| Per-client hour breakdown | **Missing** | No visualization of hours by client. The redesign spec's WeekStrip addresses this with client color proportion bars, but it is not implemented. |
| Monthly totals | **Missing** | No month-level aggregation view. |
| Per-contract breakdown | **Missing** | No view showing hours per contract or per deliverable. |
| Billing/invoicing summaries | **Missing** | No rate calculations or billing amount views. |
| Custom date range reports | **Missing** | No date range picker for generating reports. |

### Search

| Workflow | Status | Details |
|----------|--------|---------|
| Note search | **Missing (UI)** | Backend exists (`searchNotesForUser`), API endpoint exists (`/api/notes/search`), but no UI to trigger or display search results. |
| Time entry search | **Missing** | No search for time entries by description, client, date range, etc. |
| Global search | **Missing** | No unified search across notes and time entries. |

### Keyboard Navigation and Shortcuts

| Workflow | Status | Details |
|----------|--------|---------|
| Keyboard shortcuts | **Missing** | No keyboard shortcuts defined. No shortcut overlay or help. Common missing shortcuts: Cmd+K for search, Cmd+N for new entry, Cmd+T for timer toggle, Cmd+1/2/3 for panel navigation. |
| Focus management | **Partial** | `autofocus` is used on some inline edit inputs. But no comprehensive focus trap for modals (Escape works, but Tab does not cycle within the modal). |
| Tab navigation | **Not tested** | Standard HTML tab order is used via natural DOM order. No custom `tabindex` management. |

### Offline Support

| Workflow | Status | Details |
|----------|--------|---------|
| PWA service worker | **Complete** | Registered in `+layout.svelte` with `@vite-pwa/sveltekit`. Shows update prompt. |
| Offline banner | **Complete** | `ConnectionStatus.svelte` shows "Offline -- changes are saved locally" banner with amber styling. Shows "Syncing..." on reconnect. |
| Offline data access (PWA) | **Partial** | Dexie.js (IndexedDB) is specified for offline PWA storage. The `DelegatingDataService` pattern allows swapping to an offline-capable backend. However, the current `FetchDataService` makes direct HTTP calls with no offline queue. PowerSync integration is partially built but flagged for QA (backlog item IF-3). |
| Offline data access (Tauri) | **Partial** | `tauri-plugin-sql` (SQLite) is specified. Architecture supports it via the `DelegatingDataService` pattern. Not verified as working. |

### Multi-Device Sync

| Workflow | Status | Details |
|----------|--------|---------|
| PowerSync sync | **Partial** | Infrastructure exists (schema, database setup, JWT auth, sync rules, data service). Spike page (`/spike`) validates WASM SQLite works. Full sync round-trip not QA'd (IF-3). |
| Conflict resolution | **Specified but not tested** | Last-write-wins via `updated_at`. |
| Sync status indicator | **Partial** | `ConnectionStatus.svelte` shows online/offline/syncing states. No granular "X items pending sync" indicator. |

---

## 2. Data Not Surfaced in UI

### Schema Fields Not Exposed in Forms

| Field | Table | Exposed in UI? | Notes |
|-------|-------|----------------|-------|
| `work_type_id` | Time Entries | **Partial** | Only in timer completion form and `/time/new`. Not in `NewEntryRow`, `AddTimeEntryModal`, or `TimeEntryCard` inline editing. |
| `deliverable_id` | Time Entries | **Partial** | In timer completion form, `/time/new`, `NewEntryRow`, and `TimeEntryCard`. Not in `AddTimeEntryModal`. |
| `start_time` / `end_time` | Time Entries | **Partial** | Editable inline via `TimeEntryCard` and creatable via `NewEntryRow`. Not in `AddTimeEntryModal` (duration-only). |
| `heading_anchor` | Note-Time Entry Links | **Not surfaced** | Stored but not used for navigation (v2 per spec). |
| `isPinned` | Notes | **Display only** | Pin icon shows in note list, but no toggle to pin/unpin. |
| `sort_order` | Deliverables, Work Types | **Admin only** | Used for ordering in admin CRUD. Not visible in time entry forms. |
| `description` | Contracts | **Admin only** | Shown in admin contract detail. Not visible in sidebar or time entry context labels. |
| `emoji` | Clients | **Sidebar only** | Shown before contract name in sidebar. Not in time entry cards. |

### Computed Views Missing

| View | Status | Notes |
|------|--------|-------|
| Monthly hour totals | **Missing** | No aggregation beyond weekly. Users have no way to see "how many hours did I work in January?" |
| Per-client hour summaries | **Missing** | No breakdown of hours by client across any time period. |
| Per-contract hour summaries | **Missing** | No breakdown of hours by contract. |
| Per-deliverable hour summaries | **Missing** | No breakdown by deliverable or work type. |
| Daily capacity indicator | **Missing** | No "target hours per day" indicator. |
| Weekly progress/target | **Missing** | No "32.5 / ~40 hrs" type indicator. The redesign spec includes this in the WeekStrip. |
| Contract utilization | **Missing** | No tracking of hours consumed vs. contract budget/cap. |
| Entry count per day/week | **Partial** | Day and week totals show hours but not entry counts. Mobile redesign shows entry counts. |

### Relationships Not Visualized

| Relationship | Status | Notes |
|-------------|--------|-------|
| Client -> Contracts hierarchy | **Flat list** | Sidebar shows a flat list of all contracts. No visual grouping by client. Contracts are identified by a client prefix (emoji or short code) but not grouped under client headings. |
| Contract -> Deliverables -> Work Types | **Admin only** | This hierarchy is only visible in the admin contract detail page. In the main app, the user sees the hierarchy flattened into a label ("Client / Contract / Deliverable / Work Type") on time entry cards. |
| Note -> Linked Notes (graph) | **Backlinks only** | Backlinks show which notes link TO this note. But there is no visualization of the link graph (e.g., a note map, a list of outgoing links separate from the content). |
| Note -> Linked Time Entries | **Barely functional** | Shows truncated UUIDs only. No description, date, or duration context. |
| Time Entry -> Notes | **Not shown** | No indication on a time entry card that notes are linked. |

---

## 3. Missing Workflows for Consultants

### Client Reporting / Time Summaries for Invoicing

**Current state:** No reporting views exist. The user must manually scroll through weekly time entries to compile hours for a client.

**What consultants need:**
- A view showing total hours per client for a selected date range (e.g., "Big Cheese Inc: 42.5 hours in May 2026")
- Breakdown by contract and deliverable within that summary
- Exportable as CSV/PDF for attaching to invoices
- Ability to filter by client, contract, date range

**Impact:** This is the most critical missing workflow. Time tracking without reporting is half a product. A consultant who cannot quickly generate a client summary must export raw data and process it in a spreadsheet, defeating the purpose of the app.

### Rate-Based Calculations

**Current state:** No rate information anywhere in the data model or UI.

**What consultants need:**
- Hourly rate per contract (or per deliverable)
- Calculated billing amount: hours x rate
- Display alongside hour totals in weekly/monthly views
- Optional -- some consultants bill fixed-fee and only need hour tracking

**Impact:** Medium. Many solo consultants have a standard rate and can calculate mentally. But for those with multiple contracts at different rates, this is a significant convenience.

### Capacity Planning

**Current state:** No target hours, no "hours remaining" indicator, no workload overview.

**What consultants need:**
- Configurable weekly hour target (e.g., 40h, 35h, or per-contract targets)
- "This week: 32.5 / 40h" indicator (included in the redesign spec's WeekStrip but not implemented)
- Monthly/quarterly capacity overview
- Upcoming commitments view (if contracts have date ranges or milestones)

**Impact:** Medium. The redesign spec's "remaining capacity" dotted bar in the WeekStrip partially addresses this. Full capacity planning (future week projections, contract-level budgets) is a larger feature.

### End-of-Period Reviews

**Current state:** Weekly status field (free text). No structured review process.

**What consultants need:**
- Weekly review summary showing: total hours, hours per client, key entries, linked notes
- Monthly summary with trends (more/fewer hours than last month, client mix changes)
- Quarterly or annual summary for tax/accounting purposes
- Ability to "close" a period and lock it from further edits

**Impact:** Low-medium. The weekly status field is a lightweight approximation. A proper review view would save significant time at week/month end.

### Data Export for Accountants/Bookkeepers

**Current state:** No time entry export. Note export is per-note Markdown only.

**What consultants need:**
- CSV export of time entries with configurable columns (date, client, contract, deliverable, work type, hours, description)
- Date range selection for export
- Per-client or all-clients export option
- Optional PDF summary report
- Consistent format that can be imported into accounting software (Xero, QuickBooks, FreshBooks)

**Impact:** High. Without export, the data is trapped in the app. Every consultant needs to report hours externally at some point.

### Contract Utilization Tracking

**Current state:** No budget/cap information on contracts.

**What consultants need:**
- Optional "budget hours" or "contract cap" field on contracts
- Progress indicator: "Used 120 of 200 hours (60%)"
- Warning when approaching budget limit
- Historical utilization trends

**Impact:** Low-medium. Useful for fixed-scope contracts but not universal.

---

## 4. UX Friction Points

### Click Counts for Common Tasks

| Task | Current Clicks | Notes |
|------|---------------|-------|
| Log a quick time entry (inline) | 4-5 | Click "+", select contract, type time, type description, press Enter |
| Log a quick time entry (modal) | 5-6 | Click "Add Entry" in timer, fill date/duration/contract/description, click Create |
| Start a timer | 1 | Click "Start Timer" |
| Stop and save a timed entry | 4-5 | Click Stop, select contract (if not set while running), fill description, click Save |
| Edit an entry's description | 2 | Click description text, type, blur to save |
| Edit an entry's contract | 3-4 | Click contract label, select new contract, select deliverable, click Done |
| Switch from time view to notes | 2 | Click a contract in the sidebar |
| Switch from notes to time view | 1 | Click "Time Entries" in sidebar |
| Create a new note | 2 | Navigate to notes mode (if not already), click "New Note" |
| View a specific week's entries | 2 | Click week in WeekListPanel, entries scroll into view |
| Access admin settings | 2 | Click "Settings" in sidebar, arrives at admin home |
| Sign out | 3 | Click "Settings" in sidebar, navigate to admin, click "Sign out" |
| Find a specific old entry | 5+ | Scroll/load more weeks, visually scan day sections |

### Context Switching Pain Points

1. **Notes mode loses time context.** Clicking a contract in the sidebar switches entirely to notes mode. If the user was reviewing time entries and wants to check a note, they lose their scroll position in the timesheet. Returning to time entries re-renders from the current week.

2. **Admin is a separate page.** Navigating to Settings leaves the main app entirely. Changes to clients/contracts require returning to `/` and the sidebar reloads.

3. **No cross-mode linking.** There is no way to go from a time entry to a related note or vice versa without manually switching modes. The note-time-linking spec addresses this.

4. **Timer completion requires full attention.** When the timer stops, the completion form appears in the sidebar and demands immediate interaction (contract selection, description). The user cannot continue working on other tasks in the content area while the completion form is pending -- though technically the form stays in the sidebar and the content area is usable.

### Error States Handled vs. Missing

**Handled:**
- Network errors on API calls (caught, logged to console, sometimes shown to user)
- Loading states for all data fetches (loading spinners/messages)
- Invalid time input (red border on `TimeEntryCard` and `NewEntryRow`)
- Failed login/register (error messages displayed)
- Missing required fields on forms (button disabled states)
- Offline detection (connection status banner)

**Missing or inadequate:**
- **No toast/notification system.** Success/failure of save operations is not communicated to the user. Saves happen silently. The user has no feedback that their edit was saved.
- **No undo for deletions.** Deleting a time entry or note is permanent. There is a confirmation step, but no "Undo" action after the fact.
- **No error recovery for failed saves.** If a debounced description save fails (network error), the user is not notified. Their edit appears to be saved (input field closes) but the data was not persisted.
- **No stale data detection.** If two tabs are open, edits in one tab are not reflected in the other. No polling or WebSocket updates.
- **No validation for overlapping time entries.** A user can create two entries with overlapping start/end times for the same day. No warning.
- **No max duration validation.** A user can enter "999h" as a duration -- no sanity check.

### Verbosity Issues

**Too terse:**
- `LinkedTimeEntries` shows only truncated UUIDs -- completely unhelpful
- Contract labels in `TimeEntryCard` show "Client / Contract / Deliverable / Work Type" as a dense single-line string that is hard to parse for long names
- Status field is a borderless text input that most users will not notice
- Error messages in timer are small red boxes at the bottom of the widget

**Too verbose:**
- Week labels say "Week Starting Monday 9th Feb" -- could be "W6 -- Feb 3-9"
- Each week section takes significant vertical space even when collapsed
- The three-panel layout in time mode dedicates 280px to the WeekListPanel, which largely duplicates the content area

### Accessibility Issues Noticed

1. **Keyboard trap in modals.** `AddTimeEntryModal` and `ContractCreateModal` handle Escape to close, but do not trap Tab focus within the modal. Focus can move to elements behind the backdrop.

2. **No ARIA labels on icon buttons.** The "x" delete button on `TimeEntryCard` has a `title` attribute but no `aria-label`. Screen readers will read "times" (the `&times;` entity).

3. **Click targets on "+" button.** The "+" button for adding entries is a single character with no padding around the text itself -- the clickable area is very small.

4. **Color-only status indicators.** In `WeekListPanel`, status is conveyed primarily through colored dots (green/yellow/gray) with text labels. This is adequate for color blind users because the text label is present, but the dots alone would be insufficient.

5. **Auto-focus on inputs.** Inline editing uses `autofocus` which works but does not announce to screen readers that an editing mode has been entered.

6. **No skip navigation link.** The three-panel layout does not provide a "Skip to main content" link for keyboard users.

7. **Sidebar collapse button.** `SidebarToggle.svelte` uses chevron SVG icons without text labels. Has no `aria-label`.

---

## 5. API Surface Analysis

### Existing Endpoints

| Endpoint | Methods | Purpose |
|----------|---------|---------|
| `/api/auth/[...all]` | ALL | Better Auth catch-all (login, register, session, 2FA) |
| `/api/clients` | GET | List clients |
| `/api/contracts` | GET, POST | List contracts (dropdown format), create contract |
| `/api/contracts-by-client` | GET | List contracts with client info + note counts |
| `/api/deliverables` | GET | List deliverables for a contract |
| `/api/work-types` | GET | List work types for a deliverable |
| `/api/notes` | GET, POST | List notes for contract, create note |
| `/api/notes/[noteId]` | GET, PUT, DELETE | Get/update/delete a note |
| `/api/notes/[noteId]/backlinks` | GET | Get backlinks to this note |
| `/api/notes/[noteId]/attachments` | GET, POST | List/upload attachments |
| `/api/notes/[noteId]/time-entries` | GET, DELETE | Get/unlink time entry links |
| `/api/notes/search` | GET | Search notes by query string |
| `/api/attachments/[attachmentId]` | GET, DELETE | Get/delete attachment data |
| `/api/time-entries` | POST | Create time entry |
| `/api/time-entries/[id]` | PUT, DELETE | Update/delete time entry |
| `/api/time-entries/weekly` | GET | Get weekly time entries (structured by day) |
| `/api/time-entries/weekly-statuses` | POST | Update weekly status |
| `/api/weeks` | GET | Get week summaries (paginated) |
| `/api/timer/status` | GET | Check running timer |
| `/api/timer/start` | POST | Start timer |
| `/api/timer/stop` | POST | Stop timer |
| `/api/timer/save` | POST | Finalize timer entry |
| `/api/timer/discard` | POST | Delete draft timer entry |
| `/api/powersync/jwks` | GET | JWKS for PowerSync JWT verification |
| `/api/powersync/token` | POST | Issue PowerSync JWT |

### Missing Endpoints for Feature Completeness

| Endpoint | Need | Priority |
|----------|------|----------|
| `POST /api/notes/[noteId]/time-entries` | Create a note-time entry link (for CL-8). The `unlinkNoteTimeEntry` exists via DELETE but there is no endpoint to create the link. | High (needed for CL-8) |
| `GET /api/time-entries` | List time entries with filters (date range, client, contract). Currently only the weekly endpoint exists. Needed for search, reporting, and export. | High |
| `GET /api/time-entries/[id]` | Get a single time entry by ID. Needed for linking workflows (fetch entry details for display in LinkedTimeEntries). | Medium |
| `GET /api/reports/weekly-summary` | Aggregate hours by client/contract for a week. Needed for reporting views. | Medium |
| `GET /api/reports/period-summary` | Aggregate hours by client/contract for arbitrary date ranges. Needed for invoicing exports. | High |
| `GET /api/time-entries/export` | Export time entries as CSV for a date range. | High |
| `PUT /api/clients/[id]` | Update client via API (currently only via form actions). Needed for client color assignment. | Low |
| `GET /api/time-entries/[id]/notes` | Get notes linked to a time entry (reverse direction). Needed for TimeEntryCard note indicators. | Medium (needed for CL-8) |
| `PUT /api/notes/[noteId]/pin` | Toggle pin status. Currently done via the generic updateNote, but a dedicated endpoint would be cleaner for a UI toggle. | Low |

### API Design Observations

1. **Inconsistent response shapes.** Some endpoints wrap results (`{ contracts: [...] }`, `{ notes: [...] }`) while others return raw arrays (`/api/contracts` returns `ContractOption[]` directly). The `FetchDataService` compensates for this but it creates inconsistency.

2. **No pagination on time entries.** The weekly endpoint fetches all entries for specified weeks. For a user with years of data, there is no way to paginate individual entries within a week.

3. **No bulk operations.** No endpoints for bulk create, update, or delete of time entries.

4. **Auth not checked on some paths.** The admin pages use SvelteKit form actions that check `locals.user`, but the API routes also check auth individually. The `hooks.server.ts` middleware handles the route-level guard.

5. **No rate limiting.** No rate limiting on any endpoints. The debounced saves from the UI (1000ms) provide some natural throttling, but automated clients could overwhelm the server.

---

## 6. Current Backlog Items (Summary to Avoid Duplication)

### Phase 2: Editor and Export

| ID | Item | Status | Overlap with Audit Findings |
|----|------|--------|---------------------------|
| CL-4 | Markdown-native note editor | Planned | Not directly related to audit gaps, but prerequisite for CL-5 and CL-8 |
| CL-5 | Note export (MD and PDF) | Planned | Audit confirms MD export exists but PDF is `window.print()` workaround. CL-5 would improve this. |
| CL-6 | Deliverable selector on time entries | Planned | **Partially done.** `NewEntryRow` now has `DeliverableSelect`. But `AddTimeEntryModal` still lacks it. CL-6 backlog item should be updated to reflect partial completion. |
| CL-7 | Hours total in week status | Planned | The WeekSectionHeader already shows hours + status. CL-7 proposes combining them ("Unsubmitted (X.Y hours)"). The redesign spec supersedes this with the WeekStrip + status badge approach. |
| CL-8 | Note-time entry linking | Planned | **Full spec exists** (`note-time-linking-spec.md`). Depends on UX-3 (complete). This is the single most impactful feature gap in the current app. |

### Phase 3: UX Overhaul

| ID | Item | Status | Overlap with Audit Findings |
|----|------|--------|---------------------------|
| UX-1 | Document existing app | **Complete** | All 13 UX docs exist. |
| UX-2 | Timesheet layout redesign | **Complete** | Approved spec (`timesheet-redesign-spec.md`) with wireframes, visual hierarchy, migration path. |
| UX-3 | Note-time entry linking UX | **Complete** | Approved spec (`note-time-linking-spec.md`). |
| UX-4 | Future feature recommendations | **In progress** | This audit is the foundation for UX-4. |

### Infrastructure and QA

| ID | Item | Status | Overlap with Audit Findings |
|----|------|--------|---------------------------|
| IF-3 | PowerSync mode QA | Planned | Audit confirms sync infrastructure exists but is unverified. |
| QA-H | Full regression after Phase 2 | Blocked | Depends on CL-4, CL-5, CL-6, CL-7. |

### What This Audit Identifies Beyond the Backlog

The following gaps are **not in the current backlog**:

1. **Reporting / summaries views** -- No per-client, monthly, or custom-range hour summaries
2. **Time entry export (CSV)** -- No way to get data out of the app for invoicing or accounting
3. **Search UI** -- Backend exists, no frontend
4. **Keyboard shortcuts** -- None defined
5. **Password reset flow** -- Missing from auth
6. **Sign out from main app** -- Only accessible via admin
7. **Toast/notification system** -- No user feedback for save operations
8. **Note pinning toggle** -- Display-only, no toggle UI
9. **Note move (change contract)** -- Not possible
10. **Profile editing** -- Cannot change name/email/password
11. **Bulk operations** -- No multi-select or bulk delete
12. **Undo for deletions** -- No undo capability
13. **Work type editing inline** -- Cannot edit work type on existing entries from the main UI
14. **AddTimeEntryModal missing fields** -- No deliverable, no work type, duration format limited
15. **Timer indicator when sidebar collapsed** -- Timer is invisible (addressed in redesign spec but not implemented)
16. **Client color system** -- Addressed in redesign spec but not implemented; no schema support yet

---

## 7. Severity Matrix

Items ranked by impact on a solo consultant's daily workflow.

| Rank | Gap | Severity | Effort | Backlog? |
|------|-----|----------|--------|----------|
| 1 | Reporting / client hour summaries | **Critical** | Medium | No |
| 2 | Time entry CSV export | **Critical** | Low | No |
| 3 | Note-time entry linking (CL-8) | **High** | High | Yes |
| 4 | Timesheet redesign implementation | **High** | High | Yes (spec done) |
| 5 | Search UI for notes/entries | **High** | Medium | No |
| 6 | Toast/save feedback system | **High** | Low | No |
| 7 | Sign out from main app | **Medium** | Trivial | No |
| 8 | Password reset flow | **Medium** | Low | No |
| 9 | Note pinning toggle | **Medium** | Trivial | No |
| 10 | AddTimeEntryModal completeness | **Medium** | Low | Partial (CL-6) |
| 11 | Work type inline editing | **Medium** | Low | No |
| 12 | Keyboard shortcuts | **Medium** | Medium | No |
| 13 | Timer indicator (top bar) | **Medium** | Medium | Yes (spec done) |
| 14 | Profile editing | **Low** | Low | No |
| 15 | Note move (change contract) | **Low** | Low | No |
| 16 | Undo for deletions | **Low** | Medium | No |
| 17 | Bulk operations | **Low** | Medium | No |
| 18 | Rate/billing calculations | **Low** | Medium | No |
| 19 | Contract utilization tracking | **Low** | Medium | No |
| 20 | Dark mode | **Low** | Medium | No (open question) |
