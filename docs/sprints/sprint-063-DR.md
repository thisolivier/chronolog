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

## The motif library (32)

All checked at 16 px and 28 px in two client colours on the contact sheet (`docs/review/screenshots/sprint-063-DR/contact-sheet-all-motifs.png`). In allocation order:

`stripes-up`, `dots-2`, `bars-2`, `checks-2`, `stripes-down`, `dots-3`, `bars-2-v`, `triangle-half`, `disc`, `ring`, `plus`, `saltire`, `diamond`, `chevrons-up`, `zigzag`, `half-disc`, `quarter-arc`, `quarters-opposite`, `checks-4`, `triangles-up`, `frame`, `bowtie`, `steps`, `pinwheel`, `quincunx`, `corner-l`, `hash`, `arrows-right`, `triangle-up`, `triangle-down`, `half-disc-r`, `bricks`.

Dropped after the first contact sheet because they read like a neighbour at 16 px: fine diagonal stripes (like `stripes-up`), a frame with a centre dot (like `frame`), scallops and paired half-discs (muddy at 16 px). Dropped in the review round: `target` (too close to `ring`) and `bars-3` (too close to `bars-2`).

The order of `TILE_MOTIFS` is the allocation order: reordering, inserting or removing a motif moves contracts to other motifs. **The list order is frozen from the first deploy of this library:** after that, only append (and accept that appending changes the modulus, so it reshuffles too until a persisted assignment exists). The owner's replacement set should keep the 24-unit square, one colour on transparent, and pass the same 16 px check.

## Allocation and its trade-off

`tileIndexForContract` hashes the contract's UUID (FNV-1a 32-bit, `Math.imul`) and takes it modulo 32. Every surface already has the contract id, so the same contract always draws the same motif with nothing stored (DS-07: one assignment, never a similar mark regenerated per widget).

Trade-off: two contracts can share a motif, including two contracts of the same client, where the colour is also the same; with 32 motifs and n contracts of one client the chance of at least one shared pair is about 1 − e^(−n(n−1)/64): 9% at 3 contracts, 27% at 5. Readable names stay beside every mark, so a collision costs recognisability, not meaning. The fix is a persisted `contracts.pattern_index` assigned to avoid siblings (backfilled from the hash so nothing visibly changes) and a reassignment control in Settings (O13). It needs a migration, so it is in `docs/backlog.md` awaiting the owner's approval.

## Placements

| Surface | Treatment | File |
| --- | --- | --- |
| Timer identity header, expanded | The contract's large tile (`--size-mark-timer-tile`: the large mark rounded to whole px, 28 px) repeated and cropped at 1.5 tile widths (`--size-mark-timer-wide`, 42 × 28), vertically centred; contract above client beside it. The header's gap went from 10 to 8 px and its right padding beside the chevron from 12 to 4 px, so "Amplitude  Change" still fits the 240 px sidebar | `timer/TimerIdentityHeader.svelte` (`ContractMark shape="wide"`) |
| Timer, compact | The small square mark, unchanged | same |
| Selected sidebar contract | Primary mark beside the label, then the quiet repeat filling the space up to the right-aligned count. Only the selected row (grouped and single-contract rows) | `layout/SidebarClientGroup.svelte` |
| Notes list header | Quiet repeat between "Notes N" and New note, only when the list is one contract's (not the client view or all notes) | `layout/NoteListPanel.svelte` |
| Note editor header | Quiet repeat between Saved and the note-actions ellipsis, desktop and tablet | `notes/NoteEditorHeader.svelte` |

The quiet repeat (`identity/ContractTileRepeat.svelte`) is the same motif at the small tile size (`--size-tile-repeat`, the small mark rounded to whole px: 16 px at the default root size) and 18% opacity (`--opacity-tile-repeat`, lowered from 28% in the review round to match the reference crop), `aria-hidden`, no text. It is a `flex-1 basis-0 min-w-0` item, so it takes only the free space and shrinks to zero before any label or control gives way. In the sidebar it swallows one of the row's gaps (`absorbGap`: negative margin, equal padding, background clipped to the content box, `mask-origin: content-box`), so a repeat squeezed to nothing leaves one gap between the name and the count, not two. The note editor header's repeat is capped at ten tiles, so at 768–1024 px the sidebar row, the list header and the editor header do not read as one band of pattern.

**Whole-px tiles:** WebKit draws hairline seams at the joins of tiles whose size is a fractional number of CSS px (the root font is 110% in places, so 1rem is 17.6 px). The repeat tile (`--size-tile-repeat`) and the timer region's tile (`--size-mark-timer-tile`, which also sets the region's height and its 1.5× width) are `round(…, 1px)` in `tokens.css`. CSS `round()` is in Safari/iOS 15.4+, Chrome 125+ and Firefox 118+; older engines drop the declaration (the repeat then has no height and the timer region no size), which is below what the app supports for the PWA and the Tauri webview. A single square mark is one unrepeated tile, so it needs no snapping.

**Forced colours:** the masked span would be repainted with the page background in Windows high contrast and the mark would vanish, so the mark's inner span and the repeat carry `forced-color-adjust: none` (they keep the client colour; the readable name beside them carries the meaning).

**Phone choice:** the notes list header keeps its repeat at every width (it shrinks away on its own at 320 px). The note editor header has none in the single-column layout: there Saved and the ellipsis sit on different rows, so there is no "after Saved, before the ellipsis" space.

**Compact marks only (DS-04: no washes):** time-entry rows (`weekly/TimeEntryCard.svelte`), search hits (`search/SearchHitRow.svelte`), link picker rows (`search/LinkPicker.svelte`), linked time entries (`notes/LinkedTimeEntries.svelte`), note list rows in cross-contract lists (`layout/NoteListRow.svelte`) and the header pill (`weekly/TimerIndicator.svelte`). Note bodies untouched. Settings shows no marks (unchanged).

## Call sites and where the contract id comes from

Every `ContractMark` call site (11 in 10 files) now passes `contractId`:

- Sidebar rows: `contract.id`. Notes list header: `navigationContext.selectedContractId`. Note list rows: `note.contractId`. Note editor header: its `contractId` prop. Time-entry rows: `entry.contractId`. Search hits: `hit.contractId` (already in the `/api/search` payload). Linked time entries: `entry.contractId` (optional in the type: older cached rows fall back to initials).
- Timer header: `TimerWidget` passes `identityContract.id`.
- **Client-side additions (no server or DB change):** `TimerDisplayState` / the shared timer state gained `contractId` (set by `TimerWidget` and by `timer-reflection.ts`), which the header pill reads; `LinkPickerItem` gained `contractId`, mapped from the `contractId` that `GET /api/notes/search` already returns.

## Tests

- New `src/lib/components/identity/tile-library.test.ts` (6, mask-origin checked since the review round): at least 32 motifs, unique ids and geometry; plain shapes on a 24-unit square; mask style with `-webkit-` properties and single-quoted URL; fixed ids to fixed indexes (FNV-1a of `"a"` and `""`); 500 ids stay in range; 200 UUIDs (from a seeded generator, so it never flakes) spread with no motif above 10% and at least 80% of motifs used.
- New `e2e-playwright/contract-tiles.spec.ts` (chromium, webkit; phone test `@iphone`): one tile per contract across the sidebar, list header, editor header, timer (expanded 42 × 28, compact 16), search and the week; the repeat only on the selected row, decorative, 16 px high, before the count and before the ellipsis; computed mask present (WebKit reads `-webkit-mask-image`); no header repeat in all notes; editor actions stay on screen at 820 px; no editor repeat in the phone layout.
- New `src/lib/components/identity/ContractMark.test.ts` (3, server render, no DOM library): no `contractId` and `contractId=''` both give the initials and no `data-tile`; a known id gives the hash's tile and no initials.
- Review round, `contract-tiles.spec.ts`: every surface's tile is compared with the contract's sidebar tile and the hash (each week row by its contract, the phone widget and capture screen); the repeat's height and mask tile size are whole px (both engines); the sidebar repeat's box starts at the name's edge (one gap when squeezed); a new case opens contract A's note at 600 px with B's timer running (the pill fed by `timer-reflection.ts`) and expects B's tile in the pill, A's in the editor; the narrow-width case checks the repeat ends before the ellipsis and is at most ten tiles.
- Changed: `time-review.spec.ts` asserted the initials `HU` in the row's `contract-mark`; it now asserts no text and a `data-tile`.
- `npm run check`: svelte-check found 0 errors and 0 warnings
- `npm run lint`: clean
- `npm test`: 141 files, 1373 tests passed (9 new)
- `npm run test:e2e` (API, against the worktree dev server on :5163): 24 files, 152 tests passed. The dev server must be started with `ALLOW_REGISTRATION=true` (both suites register fresh users) and `BETTER_AUTH_URL` set to its own URL, and `npm run test:e2e` needs the same `BETTER_AUTH_URL` (its sign-up Origin header comes from it)
- `npm run test:playwright` (chromium, webkit, iphone-se, iphone-15, iphone-15-pro-max), review round: 354 passed, 51 skipped, no failures or flakes (3.8m). The run before it had one webkit failure in `split-time.spec.ts` ("a changed request after an unanswered attempt gets a new id", fails on and before retry) and one webkit flake (`notes-followups` trash page); both specs pass in isolation (19/19) and the next full run was clean. Neither touches tiles; the split test builds its times from "minutes ago" clock values, so a minute boundary under load is the likely cause.

## Screenshots

`docs/review/screenshots/sprint-063-DR/` (1280 × 800 chromium at 1×; phone shots from the iphone-15 project at device scale). Each run seeds a fresh user, so the motifs differ between runs.

- `desktop-01-notes-sidebar-list-editor.png` (whole window), `desktop-02-sidebar-selected-contract.png`, `desktop-03-timer-expanded-running.png`, `desktop-04-notes-list-header.png`, `desktop-05-note-editor-header.png`, `desktop-06-timer-compact.png`, `desktop-07-search-results.png`, `desktop-08-weekly-review.png`
- `phone-01-sidebar-and-timer.png`, `phone-02-note-editor.png`, `phone-03-timer-running.png`
- `contact-sheet-all-motifs.png`: every motif at 16 px and 28 px in Juniper and Rust, plus a quiet repeat, drawn by the spec with the app's own mask style and colour tokens (no route ships for it)

Regenerate: `UPDATE_SPRINT_SCREENSHOTS=1 npx playwright test e2e-playwright/contract-tiles.spec.ts --project=chromium --project=iphone-15`.

## Review round (2026-11-08)

No blockers. Applied: fallback tests, stronger e2e assertions and the pill case, repeat opacity 0.28 → 0.18, editor repeat capped at ten tiles, `target` and `bars-3` removed (32 motifs), whole-px tiles via `round()`, `forced-color-adjust: none`, one gap in a squeezed sidebar repeat (`absorbGap`), docs. The tokens now define the timer region's tile separately (`--size-mark-timer-tile`) so the region's height and its tile snap together.

## Left out on purpose

- Persisted assignment, sibling-collision avoidance and the Settings reassignment control (migration; backlog).
- A pattern for multi-contract list headers (O07): the client view and all notes show no repeat.
- No repeats on time-entry rows, search rows, note bodies (DS-04), or the phone editor header (above).
- `selected` on `ContractMark` (the pine ring) still works on a patterned mark (the ring is on the outer box, the mask on the inner one) but no call site sets it today, as before.
- Owner-drawn tiles: this set is a placeholder.
