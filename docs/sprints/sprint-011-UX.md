# Sprint 011 — UX: Document Existing App (UX-1)

**Status:** pending
**Type:** research / documentation
**Backlog items:** UX-1
**Depends on:** nothing
**Branch:** `sprint-011-UX/document-app`

## Objectives

Create comprehensive documentation of the existing Chronolog app: every view, every
interaction, every component. This documentation serves as the foundation for all
subsequent UX work (timesheet redesign, note-time linking UX, future feature recommendations).

This is a **documentation-only sprint** — no code changes. The output is a set of
markdown documents with text-based wireframes (ASCII/box-drawing) describing the app.

## Tasks

### 1. App overview document

File: `docs/ux/app-overview.md`

Document:
- App purpose and target user (solo consultant, time tracking + notes)
- High-level architecture: 3-panel desktop layout, mobile push-pop navigation
- Two modes: Time Entries mode and Notes mode
- Navigation model: sidebar → list → content
- Auth flow: register → login → (optional 2FA) → dashboard

### 2. View-by-view wireframes

File: `docs/ux/views/` (one file per major view)

For each view, create:
- ASCII/box-drawing wireframe showing layout
- Component inventory (which Svelte components render here)
- User interactions available (buttons, forms, inline edits)
- Data shown and data sources
- Navigation paths (where can you go from here)

Views to document:
- `docs/ux/views/login.md` — Login page
- `docs/ux/views/register.md` — Registration page
- `docs/ux/views/dashboard-time.md` — Main dashboard in Time Entries mode (3 panels)
- `docs/ux/views/dashboard-notes.md` — Main dashboard in Notes mode (3 panels)
- `docs/ux/views/time-entry-form.md` — New/edit time entry form
- `docs/ux/views/note-editor.md` — Note editor (TipTap, attachments, linked entries)
- `docs/ux/views/admin-home.md` — Admin dashboard
- `docs/ux/views/admin-clients.md` — Client management
- `docs/ux/views/admin-contract.md` — Contract detail with deliverables
- `docs/ux/views/settings-2fa.md` — Two-factor authentication setup

### 3. Component inventory

File: `docs/ux/components.md`

Categorised list of all UI components with:
- Component name and file path
- Purpose (one line)
- Where it's used (which views)
- Props / data it receives

Group by: layout, timer, weekly/time, notes, admin

### 4. Interaction flows

File: `docs/ux/flows.md`

Document the key user journeys:
- First-time setup: register → auto-created client/contract → first time entry
- Daily time entry: open app → add entries for today → (optional timer)
- Weekly review: scroll through week → check totals → set status to "Submitted"
- Note creation: select contract → new note → write with wiki-links → attach files
- Admin: create client → create contract → add deliverables → add work types
- Timer flow: start → work → stop → save or discard

### 5. Data model summary (UI perspective)

File: `docs/ux/data-model.md`

Document the data model as the user experiences it (not the DB schema):
- Clients contain Contracts
- Contracts contain Deliverables (which contain Work Types)
- Time entries belong to a contract (optionally a deliverable + work type)
- Notes belong to a contract, can link to other notes via wiki-links
- Notes can have attachments
- Notes can link to time entries (not yet exposed in UI)
- Weeks have a status and total hours

### 6. Known issues and gaps

File: `docs/ux/known-issues.md`

Document issues discovered during the documentation process:
- ConnectionStatus Svelte 5 reactivity bug (from sprint 008)
- Any visual inconsistencies, missing states, or rough edges
- Features in the spec but not yet implemented (note-time linking, etc.)

## Verification

- All markdown files are well-formatted and complete
- Wireframes are readable and accurate
- Component inventory matches actual codebase
- `docs/ux/` directory has a readme.md index

## Acceptance Criteria

- [ ] App overview document
- [ ] Wireframe for every major view (10 views minimum)
- [ ] Component inventory with file paths and purposes
- [ ] Interaction flow documentation (6 flows minimum)
- [ ] Data model summary from UX perspective
- [ ] Known issues documented
- [ ] `docs/ux/readme.md` index file

## Notes

**Read the actual source code.** Do not guess at component behavior — read the Svelte
files and describe what they actually do. Check props, state, event handlers.

**ASCII wireframes should be practical**, not pretty. Use box-drawing characters to show
layout panels, alignment, and hierarchy. Example:

```
┌──────────┬──────────────┬────────────────────────┐
│ Sidebar  │ Week List    │ Time Entries            │
│          │              │                         │
│ Clients  │ Week 21      │ Monday, May 26          │
│ > BigCo  │ 40.0 hrs     │ ┌─────────────────────┐ │
│   Intern │ Submitted    │ │ BigCo / Dev  2.5 hrs│ │
│          │              │ └─────────────────────┘ │
│ [Timer]  │ Week 20      │                         │
│          │ 32.5 hrs     │ Tuesday, May 27         │
│          │ Unsubmitted  │ (no entries)            │
└──────────┴──────────────┴────────────────────────┘
```

**This sprint is the foundation for UX-2 and UX-3.** Be thorough — the UX designers
working on timesheet redesign and note-time linking will rely on this documentation.
