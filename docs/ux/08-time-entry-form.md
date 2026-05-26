# Time Entry Form Page (`/time/new`)

## Overview

A standalone full-page form for creating or editing time entries. This page is accessed via direct URL navigation (e.g., from the legacy `DaySection` "Add entry" link or the `TimeEntryRow` "Edit" link). It operates outside the three-panel app shell.

Note: The main app shell now uses inline entry creation (`NewEntryRow`) and inline editing (`TimeEntryCard`) for most time entry operations. This page serves as a secondary entry point.

## Layout

```
+----------------------------------------------------------+
|  Chronolog / Time Entries / New Entry       [Cancel]      |
+----------------------------------------------------------+
|                                                           |
|  New Time Entry  (or "Edit Time Entry")                   |
|                                                           |
|  Date:                                                    |
|  [2026-05-26          ]                                   |
|                                                           |
|  Contract: *                                              |
|  [Select contract... v]                                   |
|                                                           |
|  Deliverable:                                             |
|  [Select deliverable... v]  (if contract has deliverables)|
|                                                           |
|  Work Type:                                               |
|  [Select work type... v]  (if deliverable has work types) |
|                                                           |
|  [Start / End Time]  |  [Manual Duration]   <-- toggle    |
|                                                           |
|  (if Start/End):                                          |
|  Start Time:  [09:00]    End Time:  [11:00]               |
|                                                           |
|  (if Manual Duration):                                    |
|  Duration (hh:mm):  [01:30]                               |
|  Format: hours:minutes (e.g. 1:30 for 1h 30m)            |
|                                                           |
|  Description:                                             |
|  [What did you work on?                    ]              |
|  [                                         ]              |
|  [                                         ]              |
|                                                           |
|                           [Cancel]  [Save Entry]          |
+----------------------------------------------------------+
```

## Modes

### Create Mode

Default when no `edit` query param. Date defaults to the `date` query param or today.

### Edit Mode

Activated when `?edit=<entryId>` is present. Pre-fills all fields from the existing entry. The form action updates instead of creates.

If the existing entry has no start/end time, the form automatically switches to "Manual Duration" mode and pre-fills the duration.

## Time Input Toggle

Two mutually exclusive modes, toggled by clickable text buttons:

1. **Start / End Time**: Two `<input type="time">` fields side by side. Duration calculated server-side as `endMinutes - startMinutes`.

2. **Manual Duration**: Single text input accepting `hh:mm` format with a regex pattern `[0-9]{1,2}:[0-9]{2}`.

## Form Submission

Uses SvelteKit form action (default action). The server-side handler:
1. Validates contract and date are present
2. Calculates duration from either manual input or start/end times
3. Validates duration > 0
4. Creates or updates the time entry
5. Redirects to `/time?date=<date>` (which itself redirects to `/`)

## CascadingSelects

The contract/deliverable/work type selection uses the same `CascadingSelects.svelte` component as the timer completion form. Hidden inputs pass the selected IDs to the form action.

## Files

| File | Purpose |
|------|---------|
| `src/routes/time/new/+page.svelte` | Time entry form page |
| `src/routes/time/new/+page.server.ts` | Server: load existing entry, create/update action |
| `src/routes/time/+page.server.ts` | Redirects `/time` to `/`, legacy delete/status actions |
