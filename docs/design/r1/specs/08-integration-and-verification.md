# 08 · Integration and verification

**Status:** engineering work plan and acceptance coverage. No application source has been inspected or modified, and no app tests have been run.

This document distinguishes the agreed outcome from the implementation decisions needed to deliver it. Source: the requirements in specs 01–07, [D26](../sources/decision-record-v26.md) §§2, 12, 20, 23, 29 and [open items](../open-items.md).

## Requirements and integration constraints

### IN-01 — Work within the supplied stack

**Supplied baseline · D26 §2.** Use the existing Svelte 5/SvelteKit 2/Tailwind 4/Tauri 2/TipTap 3 architecture as the starting point. Inspect src/app.css and src/lib/components/ before choosing component boundaries. No replacement component library, new backend or editor migration has been approved.

### IN-02 — Inspect source-dependent behaviour first

**Engineering follow-through · D26 §§12, 20, 29.** Establish the actual route/layout breakpoints; timer/draft persistence; validation and time parser; ontology loading; inline-edit commit/cancel behaviour; wiki-link representation and target types; search matching/indexing; rich/raw conversion; and note navigation/scroll restoration.

Record what exists before changing it. A behaviour not visible in the supplied screenshots is not permission to invent a new interaction.

### IN-03 — Share behaviour across surfaces

**Implementation consequence of agreed requirements.** Reuse one identity rendering contract across contexts, one ontology dependency policy across capture/manual/inline editing where applicable, one matching/ranking algorithm across search and picker, and one capture state across expanded/compact/header/mobile presentations.

These are behavioural boundaries, not mandated filenames, a new store framework or a persistence schema. In particular, collapse and navigation must not create a second timer model.

### IN-04 — Preserve unrelated workflows

**Scope constraint · D26 §§10, 23.** Preserve settings/account security/API-token functions, client/contract/ontology management, archive/trash, existing Move/Export/Delete, and attachments. A new settings composition is deferred. Applying shared visual tokens is distinct from redesigning these flows.

### IN-05 — Verify transitions, not only screenshots

**Engineering follow-through.** Use focused tests where state changes could lose/duplicate time or break insertion. Use visual/manual review for typography, pattern seams, layout stability and responsive composition. Static mockups cannot certify sticky headers, keyboard behaviour, persistence or race conditions.

## Recommended implementation sequence

This ordering is a handoff recommendation, not a newly approved product requirement.

| Stage | Work | Dependency / exit condition |
| --- | --- | --- |
| 1 | Source map and baseline checks | IN-02 documented; open decisions identified rather than silently filled |
| 2 | Shared tokens and identity renderer | DS-01–DS-06 reviewed at actual sizes; production motif strategy resolved or clearly staged |
| 3 | Shell, sidebar and note headers | Context ownership and timer visibility work in wide, hidden-sidebar and narrow layouts |
| 4 | Stable completion and capture presentation | Stop/Back/Finish entry, ontology cascade and keyboard fit verified |
| 5 | Desktop split | Persistence boundary and resize/commit race verified before release |
| 6 | Review rows/week/day headings and inline styles | Chronology, sticky offsets and existing edit semantics retained |
| 7 | Search/picker integration | Shared matcher and insertion behaviour verified; input/header overrides applied |
| 8 | Cross-surface regression | Below matrix passes in browser/PWA and relevant native wrappers |

## Acceptance matrix for the engineering team

All rows below are **not run against the app**. They are executable acceptance targets.

| Scenario | Expected outcome | Requirements |
| --- | --- | --- |
| Browse one contract while timing another | Correct, independent identities across note and capture | DS-02, SH-08, NT-01 |
| Toggle sidebar and timer collapse | One visible capture representation; state and fields retained | SH-04, SH-06 |
| Stop then spend time completing | Saved interval ends at Stop, not Save | TC-04 |
| Sole-choice ontology chain | Automatic values with no helper badge; no field jumps | TC-05 |
| Change parent to incompatible branch | Invalid children cleared, valid children retained, description/links preserved | TC-05 |
| Back from stopped mobile capture | Finish entry restores frozen time and entered fields | TC-06, TC-08 |
| Timer Add note versus list New note | Each creates in its own explicit context | TC-03, NT-02 |
| Split: boundary edit and Flip | Shared boundary stays adjacent; content moves, chronology does not | SP-02, SP-03 |
| Split: failed left Save | Left remains unresolved; no duplicate entry or lost fields | SP-04, SP-08 |
| Split: left resolved then right action | Correct Save/Discard/Resume semantics; no unfinished left | SP-04, SP-05 |
| Split: Cancel after explicit Stop | Unsplit capture remains stopped | SP-06 |
| Split: resize during/after commit | Exactly one settled left result and correct remainder state | SP-07, SP-08 |
| Scroll and jump between long days | Sticky context and offsets correct; chronology retained | TR-01–TR-03 |
| Inline edit with long text/menu | Existing commit semantics; stable surrounding layout | TR-06 |
| Weekly status | Recordkeeping only; no send/export side effect | TR-07 |
| Year rollover | Agreed examples implemented once O05 resolved | TR-07 |
| Notes with upstream columns hidden | Readable context restored, no misleading inherited scope | NT-01 |
| Back/Forward on a long note | Prior position restored | SH-07 |
| Global/picker metadata query | Same supported-type matching/ranking; no hidden scope | SR-03, SR-04 |
| Picker select/dismiss during async query | Correct insertion range, preserved query, no stale results | SR-06, SR-07 |
| Search empty/loading/failure | Single large query field; no duplicate header field | SR-01 |
| Short viewport/software keyboard | Inputs and actions reachable; no mobile Split | TC-08, SP-01, SR-07 |
| Tile repeats and selection | Zero joins; distinct identity versus selection/state | DS-02–DS-05 |

## Supporting state coverage

Exercise empty lists, long names/prose, absent contract, no applicable ontology, failed option load, pending save/failure, many notes, hidden sidebar, short desktop height, phone rotation, hardware/software keyboard, and safe-area insets. Preserve existing archive/trash and rich/raw behaviour. Do not treat a generated enabled/disabled button as a validation rule.

App restart/reconnect, midnight/DST, duration-only entries, overlapping time policy and server conflict behaviour need source inspection first. The split persistence requirement must cover interruption without presuming a particular storage technology.

## Handoff completion boundary

This pack is complete as a traceable design specification draft with original renders and crops. The application is not “ready to ship” on this evidence alone. Product decisions in open items and source-dependent details must be resolved where they affect the work; engineers can complete the delegated control details without reopening every visual decision.
