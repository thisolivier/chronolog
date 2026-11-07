# identity

Client and contract identity marks (design r1, spec `docs/design/r1/specs/01-design-system.md`).

Colour identifies the client (one of eight earth-tone slots in `src/lib/utils/client-colors.ts`,
keyed by `clients.color_index`); the initials identify the contract. Pattern tiles (DS-03, DS-04,
DS-07) are deferred by the owner's decision of 2026-11-07, so the mark is a solid square for now.

## Components

| File | Purpose |
| --- | --- |
| `ContractMark.svelte` | Square solid mark in the client colour with up to three contract initials. Props: `contractName`, `colorIndex`, `size` (`sm` / `md` / `lg` from `--size-mark-*`), `label` (accessible name; omit when visible text already names the contract, and the mark is then `aria-hidden`), `selected` (pine edge), `muted` (quieter). |
| `contract-initials.ts` | Pure initials derivation (contracts have no short code, so the name is used; filler words skipped, short upper-case codes kept whole). Tested in `contract-initials.test.ts`. |

## Working patterns

- Use one `ContractMark` per place a contract is identified; do not redraw a similar mark per widget (DS-07).
- Put the mark beside its label with the `gap-mark-gap` spacing token (`--spacing-mark-gap`).
- Initials text colour comes from the palette entry (`markTextClass`), chosen per colour for AA contrast.
- Used in the note editor header (`notes/NoteEditorHeader.svelte`), the note list header when the navigation is hidden and on rows of lists spanning contracts (`layout/NoteListPanel.svelte`, `NoteListRow.svelte`), and on linked time entries of another contract (`notes/LinkedTimeEntries.svelte`) since 054-DR. Sidebar, timer, review and search placements come in other design stages.
