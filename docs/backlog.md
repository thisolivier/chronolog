# Chronolog — Backlog

## Teams

| ID | Team | Focus |
|----|------|-------|
| `CL` | Client | UI components, data layer, features |
| `IF` | Infrastructure | Backend, DB, containers, tooling |
| `QA` | Quality Assurance | Testing, verification (dispatched by Director) |
| `UX` | User Experience | Research, wireframes, design recommendations |

## Completed Work (Task 11: Offline Sync)

All phases delivered and merged. See `docs/sprints/readme.md` for full sprint history.
- GATE A, B, C: all PASS
- 355 tests (269 unit + 46 API e2e + 40 Playwright)
- Production Docker stack verified

## Current Backlog

### Phase 2: Editor & Export

#### CL-4: Markdown-native note editor
Switch from TipTap HTML storage to Markdown-native storage. Keep WYSIWYG rendering
but add a raw/rendered mode toggle. Include code blocks with syntax highlighting.
Existing notes can be wiped (clean DB migration).

Key deliverables:
- TipTap fork/config that stores Markdown instead of HTML
- Raw MD editing mode with monospace view
- Rendered mode (current WYSIWYG feel)
- Toggle switch between modes
- Code blocks with syntax highlighting (common languages)
- DB migration (drop existing note content, store as MD)

**Depends on:** nothing
**Unblocks:** CL-5, CL-8

#### CL-5: Note export (MD and PDF)
Per-note export to Markdown file and PDF. Export from the note detail view.

**Depends on:** CL-4 (MD storage)

#### CL-6: Deliverable selector on time entries
Expose the existing `deliverable_id` field on time entries in the UI. Add a
deliverable dropdown/selector to the time entry form. Update the settings/admin
UI to manage deliverables per contract.

**Depends on:** nothing

#### CL-7: Hours total in week status
Move the hours total to the left column next to the week status label:
"Unsubmitted (X.Y hours)" instead of showing hours separately.

**Depends on:** nothing

#### CL-8: Note–time entry linking
Implement the `note_time_entry_link` many-to-many table from the spec. Allow
referencing notes from time entry descriptions (inline links). Allow viewing
linked time entries from a note. UX design required first (see UX-3).

**Depends on:** UX-3 (linking UX design)

### Phase 3: UX Overhaul

#### UX-1: Document existing app
Full documentation of the current app: screenshots, wireframes of every view,
component inventory, interaction flows. Integrate into `docs/`. This is the
foundation for all UX work.

**Depends on:** nothing
**Unblocks:** UX-2, UX-3

#### UX-2: Timesheet layout redesign
Research sprint (high-effort Opus). Rethink the timesheet view:
- Middle column feels redundant (infinite scroll in left panel suffices)
- Layout should highlight contracts and notes, keep time/hours secondary
- Clear day/week/month structure without clutter
- Consider journal-app aesthetics: subtle colour, warmth, readability
- Note that note–time entry linking is coming (inform layout decisions)
- No gimmicks — functional elegance only

**Depends on:** UX-1

#### UX-3: Note–time entry linking UX
Design the interaction for linking time entries to notes and vice versa.
Could be inline links, could be a sidebar panel, could be a picker.
Must work for both directions (note → time entries, time entry → notes).
Reference from time entry description field is a minimum.

**Depends on:** UX-1
**Unblocks:** CL-8

#### UX-4: Future feature recommendations
Proactive research sprint (high-effort Opus). Review the entire app and suggest
future features with a heavy emphasis on no gimmicks. Practical improvements only.

**Depends on:** UX-2, UX-3 (run after all other UX work)

### Infrastructure & QA

#### IF-3: PowerSync mode QA
Enable `PUBLIC_SYNC_MODE=powersync` in dev stack, verify offline CRUD round-trip
in the browser, test sync reconnection.

**Depends on:** nothing (deferred from Phase 1)

#### IF-4: Encryption key rotation (enc2 envelope + re-encrypt walker)
Rotation is not supported today: `ENCRYPTION_KEY` is fixed for the life of the database and its
backups. Add an `enc2:` envelope that carries a key id, a key registry that can hold the old and new
keys, and a re-encrypt walker that rewrites every encrypted column (notes, time entries, contracts,
clients, attachments) under the new key, idempotent and resumable. Needs a tested rollback path and
a backup taken before the walk.

**Depends on:** sprint 023 (encryption at rest, `crypto/`)

#### IF-5: Device key rotation tooling / multiple device keys
Rotation today is manual: run `scripts/generate-device-key.mjs`, replace `DEVICE_ACCESS_KEY_HASH`,
redeploy, and every browser and CLI/Tauri client re-enters the key. Add tooling that rotates in one
step, and support several device keys (one per laptop or phone) so a single lost device can be
revoked without re-keying everything. Per-device revocation would also need a device list.

**Depends on:** sprint 023 (device access key gate)

#### QA-H: Full regression after Phase 2
Comprehensive test pass after editor and feature changes land.

**Depends on:** CL-4, CL-5, CL-6, CL-7

## Build Order

```
Phase 2 (parallel where possible):
  CL-7 (hours total) ─────────────────────┐
  CL-6 (deliverable selector) ────────────┤
  CL-4 (MD editor) ──▶ CL-5 (export) ────┤
  IF-3 (PowerSync QA) ────────────────────┤
                                           ├──▶ QA-H (regression)
Phase 3 (UX, sequential):                 │
  UX-1 (document app) ──┬──▶ UX-2 (timesheet redesign) ──┐
                         └──▶ UX-3 (linking UX) ──▶ CL-8 ─┤
                                                           └──▶ UX-4 (future recs)
```

## Dependency Graph

- CL-4 unblocks CL-5, CL-8 (MD storage needed for inline note links)
- UX-1 unblocks UX-2, UX-3
- UX-3 unblocks CL-8
- CL-4, CL-5, CL-6, CL-7 unblock QA-H
- UX-2, UX-3 unblock UX-4

## Carried-over Housekeeping (2026-11-03)

- **Three unmerged API-hardening branches on origin** from March 2026, small and sensible but
  behind main: `fix/json-parse-error-handling` (try/catch around `request.json()` in 9 routes),
  `fix/time-entry-search-input-validation`, `fix/weekly-status-input-validation`. Re-apply onto
  current main (merge or redo by hand), then delete the branches.
- **`wip/2026-05-27-debug-session`** holds the last pre-pause working tree (login-hang logging,
  WeekListPanel removal, notes-search preview with a missing import). Salvage per the code-state
  review in `docs/review/`, then delete.
- **Sprint 018-QA manual checklist** was never run; the live QA review in `docs/review/` covers
  the automatable parts.
- Pre-prune safety net: `~/sites/chronolog-prune-backup-2026-11-03.bundle` holds every ref that
  existed before the worktree and branch prune.
