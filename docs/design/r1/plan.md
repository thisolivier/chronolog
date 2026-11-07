# Design overhaul r1 — stage plan

Written 2026-11-07 after the stage 1 source maps (`source-map/`). Follows the sequence in
`specs/08-integration-and-verification.md`, adapted to the four owner decisions in `docs/decisions.md`
(solid marks for now, system sans, integration branch with checkpoints, Week 1 contains 1 January).

Branch model: `design-r1` is the integration branch. Each stage runs in `.claude/worktrees/design-r1-<stage>`
on a branch `design-r1-<stage>`, gets a sprint doc under `docs/sprints/`, is reviewed, and merges into
`design-r1`. `design-r1` merges to `main` at the checkpoints below.

| Stage | Sprint | Work | Depends on | Exit condition |
| --- | --- | --- | --- | --- |
| 1 | — | Source maps (done): styling inventory, shell, capture/split, review, notes/search | — | Five reports in `source-map/` |
| 2 | 052-DR | Tokens (`@theme`), system font, earth-tone client colours, `ContractMark`, app-wide class migration off blue/stone, reduced motion | 1 | Whole app renders in the new palette; checks and tests green |
| 3a | 053-DR | Shell and sidebar: tinted client groups, punch-out selection, no client dot, counts right, muted Notes section on Time Entries, header search far right, one visible timer (compact sidebar collapse, Finish entry access), shared capture state surviving remount, note scroll restoration | 2 | SH-01..SH-08 acceptance; no duplicate timer |
| 3b | 054-DR | Notes headers: list header (Notes, count, New note icon, sort), context ownership across layouts, editor header (mark + code copy, Saved pill, note-actions menu), toolbar grouping with phone overflow, quiet linked time | 2 | NT-01..NT-07 acceptance |
| **A** | | **Checkpoint: merge `design-r1` to main and deploy** | 3a, 3b, QA | Consistent look across shell, sidebar, notes |
| 4 | 055-DR | Capture and completion: stable completion layout, Save/Discard, sole-option auto-select, no-options vs failure, unfinished form persisted, phone focused capture with Back, contract-change affordance, manual-entry modal, draft check in save/discard, link creation on timer save | 3a | TC-01..TC-09 acceptance |
| 5 | 056-DR | Desktop split: `POST /api/timer/split` transaction, resume path, two floating cards, left-first rules, resize cancel | 4 | SP-01..SP-08 acceptance |
| **B** | | **Checkpoint merge** | 4, 5, QA | |
| 6 | 057-DR | Time review: week strip with segments, sticky bark day headings with square ends, identity column rows, shortened dividers, local missing-detail cues, Week 1 rule, strip label wrap bug, Submitted hint text, phone reflow, no footer timer bar | 3a | TR-01..TR-08 acceptance |
| 7 | 058-DR | Search and picker: shared matcher with client/contract metadata, `/search` in the app shell with one large input, picker rows with identity, stale-response guard, loading/failure states, phone placement | 3a | SR-01..SR-07 acceptance |
| **C** | | **Checkpoint merge** | 6, 7, QA | |
| 8 | 059-QA | Cross-surface regression against the spec 08 acceptance matrix in browser, PWA and Tauri | all | Matrix passes or deviations recorded |

Parallelism: 3a and 3b run side by side (different files; 3b reads the sidebar-hidden state from 3a's
AppShell, so 3b merges second). 4 and 6 can run side by side, then 5 and 7.

Deferred by owner decision: pattern tiles and their placements (DS-03, DS-04 repeats, DS-07, O02), the
production pattern assignment UI (O13). Layouts must leave the header space where the repeats would go.
