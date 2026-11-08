# identity

Client and contract identity marks (design r1, spec `docs/design/r1/specs/01-design-system.md`).

Colour identifies the client (one of eight earth-tone slots in `src/lib/utils/client-colors.ts`,
keyed by `clients.color_index`); the pattern tile identifies the contract (DS-02, sprint 063-DR).
Tiles are procedural one-colour cutouts, a placeholder set the owner may replace later.

## Components

| File | Purpose |
| --- | --- |
| `tile-library.ts` | The motif library (32 square motifs on a 24-unit viewBox, plain rect / circle / polygon / path shapes), `tileMaskStyle()` (data-URI SVG as `mask-image` plus the `-webkit-` properties, one tile size, `no-repeat` / `repeat-x`), and `tileIndexForContract()` (FNV-1a 32-bit of the contract id modulo the library size). Tested in `tile-library.test.ts`. |
| `ContractMark.svelte` | The contract's tile cut out of the client colour. Props: `contractName`, `contractId` (picks the tile; without it the mark falls back to the 052-DR solid square with initials), `colorIndex`, `size` (`sm` / `md` / `lg` from `--size-mark-*`), `shape` (`wide`: the timer header's large tile cropped at 1.5 tile widths), `label` (accessible name; omit when visible text already names the contract, and the mark is then `aria-hidden`), `selected` (pine ring), `muted` (quieter). `data-tile` names the motif. |
| `ContractTileRepeat.svelte` | The quiet repeat: the same tile at `--size-tile-repeat`, `--opacity-tile-repeat`, edge to edge along x and clipped, as a `flex-1 basis-0 min-w-0` item that takes only the row's free space; `absorbGap` makes it swallow one row gap so a squeezed repeat leaves one gap, not two. `aria-hidden`, no text, `forced-color-adjust: none` (as on the mark's masked span). `data-testid="contract-tile-repeat"`. |
| `contract-initials.ts` | Pure initials derivation for the fallback mark (contracts have no short code, so the name is used; filler words skipped, short upper-case codes kept whole). Tested in `contract-initials.test.ts`. |

## Working patterns

- Tinting: the motif is a CSS mask over an element whose background is the client colour
  (`getClientDotClass`), so one source square serves every colour and both the mark and the repeats
  (DS-03: edge to edge, zero gap, no stretch). The mark's outer span carries the size, rounding,
  ring and muting and the inner span the mask, because a mask would also clip the ring.
- Allocation is deterministic and not stored: every surface hashes the same contract id to the same
  motif (DS-07: never regenerate a similar mark per widget). Two contracts can share a motif; a
  persisted `contracts.pattern_index` with sibling-collision avoidance is a backlog item.
- `TILE_MOTIFS` order is the allocation order: reordering or removing an entry moves contracts to
  other motifs. Append new motifs only alongside a deliberate reshuffle.
- Put the mark beside its label with the `gap-mark-gap` spacing token (`--spacing-mark-gap`).
- Placements: the sidebar rows (`layout/SidebarClientGroup.svelte`, the selected row adds the quiet
  repeat), the timer identity header (`timer/TimerIdentityHeader.svelte`: wide region expanded,
  small mark compact) and the header pill (`weekly/TimerIndicator.svelte`), the notes list header
  and rows (`layout/NoteListPanel.svelte` with the repeat on one contract's list, `NoteListRow.svelte`),
  the note editor header (`notes/NoteEditorHeader.svelte`, repeat on desktop/tablet only), linked
  time entries (`notes/LinkedTimeEntries.svelte`), time-entry rows (`weekly/TimeEntryCard.svelte`),
  search hits (`search/SearchHitRow.svelte`) and the link picker (`search/LinkPicker.svelte`). No
  repeats on time-entry rows, search rows or note bodies (DS-04).
