# Chronolog — Multi-Agent Backlog (Task 11: Offline Sync)

## Teams

| ID | Team | Backlog file |
|----|------|-------------|
| `IF` | Infrastructure | `docs/backlog-infrastructure.md` |
| `CL` | Client | `docs/backlog-client.md` |
| `QA` | Quality Assurance | (no backlog — dispatched by Director) |

## MVP Build Order

```
GATE-0 (CL-0) ──▶ Phase A (IF-1) ──┐
   (Tauri spike)   Phase C (CL-1) ──┤ (parallel after gate passes)
                                     ├──▶ Phase B (IF-2) ──┐
                                     │                      ├──▶ Phase D (CL-2) ──▶ Phase F (CL-3) ──▶ Phase G (QA)
                                     └─────────────────────┘
```

### Sprint 001: Blocking gate (Tauri/WebKit OPFS spike)
- **CL-0**: GATE 0 — Validate PowerSync's OPFS-backed SQLite in Tauri's WebKit webview.
  No remote infrastructure needed. Port the existing Chrome spike harness into a Tauri build.
  **If this fails, the entire PowerSync approach is abandoned.** Director halts until user returns.

### Parallel batch (Sprint 002, only if GATE 0 passes)
- **IF-1**: Phase A — Containerised remote stack (Docker Compose)
- **CL-1**: Phase C — Land DataService abstraction on main

### Sequential after batch
- **IF-2**: Phase B — Single-user sync rules + schema (depends on IF-1)
- **CL-2**: Phase D — Wire PowerSyncDataService (depends on IF-2, CL-1)
- **CL-3**: Phase F — PWA offline (depends on CL-2)
- **QA-G**: Phase G — GATES B & C + E2E (depends on CL-3)

## Dependency Graph

- CL-0 (GATE 0) unblocks everything — abort if it fails
- IF-1 unblocks IF-2
- CL-1 unblocks CL-2 (partially — also needs IF-2)
- IF-2 unblocks CL-2
- CL-2 unblocks CL-3
- CL-3 unblocks QA-G

## Reference Documents

- Epic: `docs/EPIC-OFFLINE-SYNC.md`
- Spike migration notes: `docs/POWERSYNC_MIGRATION.md`
- Spike accommodations: `docs/POWERSYNC_ACCOMMODATIONS.md`
- Project spec: `docs/SPEC.md`
