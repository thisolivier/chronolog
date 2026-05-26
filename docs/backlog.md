# Chronolog — Multi-Agent Backlog (Task 11: Offline Sync)

## Teams

| ID | Team | Backlog file |
|----|------|-------------|
| `IF` | Infrastructure | `docs/backlog-infrastructure.md` |
| `CL` | Client | `docs/backlog-client.md` |
| `QA` | Quality Assurance | (no backlog — dispatched by Director) |

## MVP Build Order

```
Phase A (IF-1) ──┐
                  ├──▶ Phase B (IF-2) ──┐
Phase C (CL-1) ──┘                      ├──▶ Phase D (CL-2) ──▶ Phase E (QA) ──▶ Phase F (CL-3) ──▶ Phase G (QA)
```

### Parallel batch 1 (Sprint 001)
- **IF-1**: Phase A — Containerised remote stack (Docker Compose)
- **CL-1**: Phase C — Land DataService abstraction on main

### Sequential after batch 1
- **IF-2**: Phase B — Single-user sync rules + schema (depends on IF-1)
- **CL-2**: Phase D — Wire PowerSyncDataService (depends on IF-2, CL-1)
- **QA-E**: Phase E — GATE A: Tauri/WebKit validation (depends on CL-2)
- **CL-3**: Phase F — PWA offline (depends on QA-E passing)
- **QA-G**: Phase G — GATES B & C + E2E (depends on CL-3)

## Dependency Graph

- IF-1 unblocks IF-2
- CL-1 unblocks CL-2 (partially — also needs IF-2)
- IF-2 unblocks CL-2
- CL-2 unblocks QA-E (GATE A — blocking)
- QA-E unblocks CL-3
- CL-3 unblocks QA-G

## Reference Documents

- Epic: `docs/EPIC-OFFLINE-SYNC.md`
- Spike migration notes: `docs/POWERSYNC_MIGRATION.md`
- Spike accommodations: `docs/POWERSYNC_ACCOMMODATIONS.md`
- Project spec: `docs/SPEC.md`
