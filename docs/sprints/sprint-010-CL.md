# Sprint 010 — CL: Deliverable Selector on Time Entries (CL-6)

**Status:** pending
**Type:** standard
**Backlog items:** CL-6
**Depends on:** nothing
**Branch:** `sprint-010-CL/deliverable-selector`

## Objectives

Expose the existing `deliverable_id` field on time entries in the UI. The schema, API
endpoints, and `CascadingSelects` component already exist. The time entry form at
`/time/new` already has a cascading contract → deliverable → work type selector.

The gap is in the **inline editing** within the weekly view. When editing a time entry
in `TimeEntryCard.svelte`, you can currently change the contract but not the deliverable.
Fix this, and ensure the deliverable shows in the entry display.

## Tasks

### 1. Audit current deliverable support

Check what already works:
- `/time/new` page: Does it already have deliverable selection? (Yes — via CascadingSelects)
- `TimeEntryCard.svelte`: Does inline edit support deliverable changes?
- API: Does PUT `/api/time-entries/[id]` accept `deliverableId`?
- WeeklyEntryRow / NewEntryRow: Do they support deliverable?

Document what's missing vs what already works.

### 2. Update TimeEntryCard inline editing

File: `src/lib/components/weekly/TimeEntryCard.svelte`

If the inline editor doesn't support changing the deliverable:
- Add a deliverable selector that appears when editing a time entry
- It should cascade from the selected contract (filter deliverables by contractId)
- Changing the contract should reset the deliverable selection
- Deliverable is optional (nullable)

### 3. Update NewEntryRow quick-add

File: `src/lib/components/weekly/NewEntryRow.svelte`

If the quick-add row for new entries doesn't include deliverable:
- Add deliverable selection to the quick-add flow
- Keep it optional — don't force users to pick a deliverable

### 4. Display deliverable in entry cards

Ensure `TimeEntryCard.svelte` shows the deliverable name in the context label
when one is set (e.g., "CLIENT / Contract / Deliverable").

### 5. Verify admin UI for deliverables

The admin UI at `/admin/clients/[clientId]/contracts/[contractId]` already manages
deliverables via `DeliverableCard.svelte`. Verify it works correctly:
- Can create a deliverable
- Can edit name and sort order
- Can delete a deliverable
- Work types within deliverables work

If anything is broken, fix it.

### 6. Write/update tests

- Test that time entry form includes deliverable selection
- Test that changing contract resets deliverable
- Test that deliverable is optional

### 7. Verify

- `npm run test` passes
- `npm run test:e2e` passes
- `npm run check` passes (no new errors)
- `npm run build` succeeds

## Contracts

- DataService interface: `docs/contracts/data-service-interface.md`
- API routes: `src/routes/api/deliverables/`, `src/routes/api/time-entries/`
- Schema: `src/lib/server/db/schema.ts` (deliverables table, time_entries.deliverable_id)

## Acceptance Criteria

- [ ] Deliverable selector available in inline time entry editing
- [ ] Deliverable selector available in quick-add new entry row
- [ ] Deliverable name displayed in time entry cards when set
- [ ] Admin deliverable management verified working
- [ ] All existing tests pass + new tests
- [ ] `npm run check` passes
- [ ] `npm run build` succeeds
