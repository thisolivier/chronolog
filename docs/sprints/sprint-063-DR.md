# Sprint 063-DR — Contract pattern tiles

**Branch:** `design-r1-tiles` (from `design-r1` at `da22bd2`, v1.5.1). **Status:** ready for review. No new dependencies, no migrations, nothing in `src-tauri/`.

Source: owner instruction 2026-11-08: "Generate some tiles and finish off the contract tile UI elements. I'll replace them eventually, but we're looking at one-colour cutouts. Procedural is fine, or an open-source tintable SVG tile library with random allocation." This un-defers DS-03, the DS-04 repeats and DS-07 (`docs/design/r1/specs/01-design-system.md`), which the 2026-11-07 decision had parked behind solid initials marks. Decision record: `docs/decisions.md`, 2026-11-08.

## Goal

Give every contract a pattern tile, the same on every surface: colour names the client, pattern names the contract (DS-02). Finish the four DS-04 placements that 052–054-DR left as reserved space.

## Decisions (PM, not reopened)

1. **Procedural tiles, no new dependency.** One module, `src/lib/components/identity/tile-library.ts`, holds the motifs as plain SVG shapes on a 24-unit square: one colour on transparent.
2. **Tinting: CSS mask.** The motif's SVG is a data-URI `mask-image` (plus every `-webkit-mask-*` property) on an element whose `background-color` is the client colour (`getClientDotClass`, `bg-id-*`). One source square serves the mark and the repeats; the repeat is `mask-repeat: repeat-x` at a fixed `mask-size`, so tiles meet edge to edge with no gap, are clipped at the end and never stretched (DS-03). The mark's rounding is on its outer box only (`rounded-mark`); repeats have no internal rounding.
3. **Deterministic allocation, no persistence.** `tileIndexForContract(contractId)` = FNV-1a 32-bit of the id, modulo the library size. No column, no migration.
4. **The tile replaces the initials** inside `ContractMark` (same name, props and `data-testid`; new `contractId` and `shape`). Without a `contractId` the mark falls back to the 052-DR initials square.
5. **The four DS-04 placements** (below).
6. **Sizes:** existing `--size-mark-*` and `--spacing-mark-gap` kept; new tokens only for new things.

## The motif library (34)

All checked at 16 px and 28 px in two client colours on the contact sheet (`docs/review/screenshots/sprint-063-DR/contact-sheet-all-motifs.png`). In allocation order:

`stripes-up`, `dots-2`, `bars-2`, `checks-2`, `stripes-down`, `dots-3`, `bars-2-v`, `triangle-half`, `disc`, `ring`, `plus`, `saltire`, `diamond`, `chevrons-up`, `zigzag`, `half-disc`, `quarter-arc`, `quarters-opposite`, `checks-4`, `bars-3`, `triangles-up`, `frame`, `bowtie`, `steps`, `target`, `pinwheel`, `quincunx`, `corner-l`, `hash`, `arrows-right`, `triangle-up`, `triangle-down`, `half-disc-r`, `bricks`.

Dropped after the first contact sheet because they read like a neighbour at 16 px: fine diagonal stripes (like `stripes-up`), a frame with a centre dot (like `frame`), scallops and paired half-discs (muddy at 16 px). Weakest pair kept: `ring` / `target` (the centre dot is visible at 16 px, but only just).

The order of `TILE_MOTIFS` is the allocation order: reordering, inserting or removing a motif moves contracts to other motifs. The owner's replacement set should keep the 24-unit square, one colour on transparent, and pass the same 16 px check.

## Allocation and its trade-off

`tileIndexForContract` hashes the contract's UUID (FNV-1a 32-bit, `Math.imul`) and takes it modulo 34. Every surface already has the contract id, so the same contract always draws the same motif with nothing stored (DS-07: one assignment, never a similar mark regenerated per widget).

Trade-off: two contracts can share a motif, including two contracts of the same client, where the colour is also the same; with 34 motifs and n contracts of one client the chance of at least one shared pair is 1 − e^(−n(n−1)/68): about 9% at 3 contracts, 26% at 5. Readable names stay beside every mark, so a collision costs recognisability, not meaning. The fix is a persisted `contracts.pattern_index` assigned to avoid siblings (backfilled from the hash so nothing visibly changes) and a reassignment control in Settings (O13). It needs a migration, so it is in `docs/backlog.md` awaiting the owner's approval.

## Placements

| Surface | Treatment | File |
| --- | --- | --- |
| Timer identity header, expanded | The contract's large tile (`--size-mark-lg`, 28 px) repeated and cropped at 1.5 tile widths (`--size-mark-timer-wide`, 42 × 28), vertically centred; contract above client beside it. The header's gap went from 10 to 8 px and its right padding beside the chevron from 12 to 4 px, so "Amplitude  Change" still fits the 240 px sidebar | `timer/TimerIdentityHeader.svelte` (`ContractMark shape="wide"`) |
| Timer, compact | The small square mark, unchanged | same |
| Selected sidebar contract | Primary mark beside the label, then the quiet repeat filling the space up to the right-aligned count. Only the selected row (grouped and single-contract rows) | `layout/SidebarClientGroup.svelte` |
| Notes list header | Quiet repeat between "Notes N" and New note, only when the list is one contract's (not the client view or all notes) | `layout/NoteListPanel.svelte` |
| Note editor header | Quiet repeat between Saved and the note-actions ellipsis, desktop and tablet | `notes/NoteEditorHeader.svelte` |

The quiet repeat (`identity/ContractTileRepeat.svelte`) is the same motif at the small tile size (`--size-tile-repeat` = 16 px) and 28% opacity (`--opacity-tile-repeat`), `aria-hidden`, no text. It is a `flex-1 basis-0 min-w-0` item, so it takes only the free space and shrinks to zero before any label or control gives way.

**Phone choice:** the notes list header keeps its repeat at every width (it shrinks away on its own at 320 px). The note editor header has none in the single-column layout: there Saved and the ellipsis sit on different rows, so there is no "after Saved, before the ellipsis" space.

**Compact marks only (DS-04: no washes):** time-entry rows (`weekly/TimeEntryCard.svelte`), search hits (`search/SearchHitRow.svelte`), link picker rows (`search/LinkPicker.svelte`), linked time entries (`notes/LinkedTimeEntries.svelte`), note list rows in cross-contract lists (`layout/NoteListRow.svelte`) and the header pill (`weekly/TimerIndicator.svelte`). Note bodies untouched. Settings shows no marks (unchanged).

## Call sites and where the contract id comes from

Every `ContractMark` call site (11 in 10 files) now passes `contractId`:

- Sidebar rows: `contract.id`. Notes list header: `navigationContext.selectedContractId`. Note list rows: `note.contractId`. Note editor header: its `contractId` prop. Time-entry rows: `entry.contractId`. Search hits: `hit.contractId` (already in the `/api/search` payload). Linked time entries: `entry.contractId` (optional in the type: older cached rows fall back to initials).
- Timer header: `TimerWidget` passes `identityContract.id`.
- **Client-side additions (no server or DB change):** `TimerDisplayState` / the shared timer state gained `contractId` (set by `TimerWidget` and by `timer-reflection.ts`), which the header pill reads; `LinkPickerItem` gained `contractId`, mapped from the `contractId` that `GET /api/notes/search` already returns.

## Tests

- New `src/lib/components/identity/tile-library.test.ts` (6): at least 32 motifs, unique ids and geometry; plain shapes on a 24-unit square; mask style with `-webkit-` properties and single-quoted URL; fixed ids to fixed indexes (FNV-1a of `"a"` and `""`); 500 ids stay in range; 200 UUIDs (from a seeded generator, so it never flakes) spread with no motif above 10% and at least 80% of motifs used.
- New `e2e-playwright/contract-tiles.spec.ts` (chromium, webkit; phone test `@iphone`): one tile per contract across the sidebar, list header, editor header, timer (expanded 42 × 28, compact 16), search and the week; the repeat only on the selected row, decorative, 16 px high, before the count and before the ellipsis; computed mask present (WebKit reads `-webkit-mask-image`); no header repeat in all notes; editor actions stay on screen at 820 px; no editor repeat in the phone layout.
- Changed: `time-review.spec.ts` asserted the initials `HU` in the row's `contract-mark`; it now asserts no text and a `data-tile`.
- `npm run check`: svelte-check found 0 errors and 0 warnings
- `npm run lint`: clean
- `npm test`: 140 files, 1370 tests passed (6 new)
- `npm run test:e2e` (API, against the worktree dev server on :5163): 24 files, 152 tests passed
- `npm run test:playwright` (chromium, webkit, iphone-se, iphone-15, iphone-15-pro-max): 352 passed, 51 skipped, no failures or flakes (3.7m)

## Screenshots

`docs/review/screenshots/sprint-063-DR/` (1280 × 800 chromium at 1×; phone shots from the iphone-15 project at device scale). Each run seeds a fresh user, so the motifs differ between runs.

- `desktop-01-notes-sidebar-list-editor.png` (whole window), `desktop-02-sidebar-selected-contract.png`, `desktop-03-timer-expanded-running.png`, `desktop-04-notes-list-header.png`, `desktop-05-note-editor-header.png`, `desktop-06-timer-compact.png`, `desktop-07-search-results.png`, `desktop-08-weekly-review.png`
- `phone-01-sidebar-and-timer.png`, `phone-02-note-editor.png`, `phone-03-timer-running.png`
- `contact-sheet-all-motifs.png`: every motif at 16 px and 28 px in Juniper and Rust, plus a quiet repeat, drawn by the spec with the app's own mask style and colour tokens (no route ships for it)

Regenerate: `UPDATE_SPRINT_SCREENSHOTS=1 npx playwright test e2e-playwright/contract-tiles.spec.ts --project=chromium --project=iphone-15`.

## Left out on purpose

- Persisted assignment, sibling-collision avoidance and the Settings reassignment control (migration; backlog).
- A pattern for multi-contract list headers (O07): the client view and all notes show no repeat.
- No repeats on time-entry rows, search rows, note bodies (DS-04), or the phone editor header (above).
- `selected` on `ContractMark` (the pine ring) still works on a patterned mark (the ring is on the outer box, the mask on the inner one) but no call site sets it today, as before.
- Owner-drawn tiles: this set is a placeholder.
