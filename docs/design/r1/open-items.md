# Open items and unrendered states

These items are deliberately unresolved. They are not hidden defaults, blockers for every part of the reskin, or requests for immediate answers. Settle each before the affected feature is considered complete.

| ID | Kind | Unsettled detail | Known constraint / next step |
| --- | --- | --- | --- |
| O01 | Design tokens | Font family/scale, line heights, exact colours by role, border/radius/shadow/focus tokens | Earth-tone direction agreed; establish actual-size system without treating generated pixels as CSS |
| O02 | Production identity | Motif artwork/set size, IDs, random assignment, collision/reuse, migration and reassignment | Square base and zero joins agreed; detailed D26 §26 proposal was deferred |
| O03 | Relative sizing | Absolute timer mark size, selected-contract gap and pulse timing | 1.5-unit clip; height adjustments and ~40% gap reduction recorded; top-right pulse dot; actual offsets need layout review |
| O04 | Review geometry | Exact endpoints of shortened horizontal entry dividers | Preserve owner's quote in TR-04; do not silently substitute vertical rules or full-width separators |
| O05 | Calendar convention | First partial week, year-spanning week ownership and rollover examples | Count weeks from calendar-year start; do not assume ISO numbering |
| O06 | Responsive/capture UI | Exact small-layout breakpoint, compact timer composition, separate contract-change affordance | Collapse in desktop sidebar; Back on mobile; no collapse in split/manual forms |
| O07 | Header patterns | Which pattern for a multi-contract list; narrow-header clipping/omission | Inline only, correct context, controls and text remain readable; no arbitrary timer-pattern fallback |
| O08 | Search algorithm | Tokenisation, partial/exact matching, ambiguous names, weighting/ties, indexing/caps | One shared client/contract-aware matcher; metadata+content query examples in SR-03 |
| O09 | Link target model | Actual picker-supported types and canonical representation | Notes confirmed; time targets must be established in source before claiming support |
| O10 | Persistence/time | Validation, precision/parser, midnight/DST, overlaps, restart/reconnect, save conflicts | Preserve existing behaviour unless reviewed; split requires safe left-resolution/remainder persistence |
| O11 | Existing edit semantics | Inline commit/cancel, focus, keyboard policy, errors; autosave/rich-raw details | Delegated to engineers against actual code; no invented blur-to-save policy |
| O12 | Visual coverage | Two-column/mixed-contract notes, compact/unfinished timer, split after left resolution, open/failure/empty states | Written requirements exist where specified; no approved render for each state |
| O13 | Deferred scope | New settings composition, production pattern assignment UI, saved-entry splitting | Preserve current flows; no feature approval inferred from exploratory drafts |

## Things explicitly superseded or excluded

| Earlier idea | Current disposition |
| --- | --- |
| Purple/lime visual direction | Historical; earth/autumn direction selected |
| Universal rectangular base motif | Square source tile; repeat/clip for wider regions |
| Separate rounded tile badges with gaps | Zero gap/border at adjacent tile edges |
| Dedicated pattern rows under list/editor controls | Removed; repeat inside existing header rows |
| Timer light at top left | Corrected to top right |
| RECORDING text in timer | Removed; running dot pulses |
| “Only option” helper and “Save entry” | Helper removed; Save/Discard |
| Fullscreen split, slider, multiple splits, mobile split | Replaced by desktop-only two floating cards |
| Right Resume before left resolution | Disabled until left saved/discarded |
| Split Cancel after left commit | Removed; completed action stands |
| Universal forced sidebar mark alignment | Owner preferred looser first faded-sidebar variant |
| Duplicate top-bar timer while sidebar timer visible | Hidden; compact sidebar counts as visible |
| Persistent bottom timer bar in notes | Declined |
| Needs details filter / review queue | Declined; inline missing-field indication |
| Picker header and scope tabs | Removed; query-driven global matching |
| Search input in header on results route | Replaced by one large results-top input |
| Time-entry pattern background wash | Exploratory; not approved |

## Evidence limits

D26 is the frozen accumulated working record, not a verbatim transcript. Later amendments are quoted from the visible chat. The selected raw images preserve what was rendered, including mismatches. Exact pixel metrics, sample data and image imperfections are not silently promoted into requirements.

The original app has not been inspected through a repository or running session for this handoff. Functional checks in spec 08 remain to be performed by engineering.
