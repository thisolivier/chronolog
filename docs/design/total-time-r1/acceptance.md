# Acceptance and integration

**No application tests have been run for this handoff.** These are checks for the engineering implementation.

## Verify against the existing code

The screen already has routing and an MVP. Inspect these details before changing them:

| Area | Preserve / establish |
| --- | --- |
| Range semantics | Inclusive/exclusive dates, timezone, preset definitions, All time bounds and date input parser |
| Calculation | Entry eligibility, running-entry handling, duration precision/rounding and breakdown ordering |
| Selection | Existing initial defaults, bulk All/None scope, hidden historical selections and reopening persistence |
| History | Archived/deleted record availability and labels; disclosure count calculation |
| Identity | Actual client colours, contract-pattern assignments and safe display-name formatting |
| UI integration | Existing modal/sheet primitives, breakpoints, focus/keyboard conventions and asynchronous loading strategy |

No new API, component library or data schema is prescribed. The live filter state should be shared across desktop and mobile presentations.

## Acceptance checklist

| ID | Scenario | Pass condition |
| --- | --- | --- |
| A01 | Open on desktop | Centred bounded modal; compact title/date toolbar; result and selector visible together |
| A02 | Open on mobile | Compact header, presets, separated date fields, Contracts row, total/count and breakdown in that order |
| A03 | Open the mobile selector | Client-grouped sheet; scrollable list; pinned count/Done footer; no duplicate selection count inside sheet |
| A04 | Toggle Daily Pay and National Debt Relief | Both layouts show the same selected IDs and recompute total/count/breakdown together |
| A05 | Close the mobile sheet with Done or supported dismissal | Selection remains applied; no Save/Apply transaction or rollback |
| A06 | Clear all selection | Dash and No contracts selected; stale rows disappear; no automatic All fallback |
| A07 | Select a contract with no entries in range | Zero result and 0 entries; contract remains selected and included in N selected |
| A08 | Choose each date preset | Existing range semantics retained; active preset indicator and date controls agree |
| A09 | Edit the dates | Both endpoints editable; clear gap; no overlapping borders; invalid states preserve input |
| A10 | Rapidly change filters | Latest state wins; obsolete responses cannot overwrite current results |
| A11 | Use All/None with historical section expanded/collapsed | Existing intended scope retained; disclosure visibility alone does not clear checked rows |
| A12 | Select archived/deleted contracts | Existing historical time can be included; contract lifecycle state is unchanged |
| A13 | Scroll a long desktop contract list | Header/date controls and result summary stay visible; no page-height growth |
| A14 | Scroll a long breakdown | Rows remain usable without displacing the desktop total/count or hiding modal controls |
| A15 | Resize between wide and narrow | Dates, selection and results persist; no duplicate selector state or overlays |
| A16 | Keyboard and assistive technology | Modal name, full checkbox labels, visible focus, logical order and focus return work |
| A17 | Long names / increased text size | Text wraps without colliding with checkboxes/durations or making controls unreachable |
| A18 | Load failure / loading | Filter choices remain; no false zero or stale result presented as current; recoverable failure |
| A19 | Pattern/colour review | Existing production identities reused; selection remains obvious from checkboxes and labels |
| A20 | Use approved sample fixture | 61m + 52m = 113m (1h 53m), combined count 5; no invented per-contract count |
| A21 | Toggle By contract | Starts expanded for results; user collapse is respected across filter updates in the session |
| A22 | Exit Total time | Existing Close navigation works; no new save/discard behaviour or unrelated state mutation |

## Deliverable verification

The bundle preserves the two approved raw renders and three direct panel crops. Source hashes, crop rectangles and link/integrity checks are recorded with the images and validation report. These checks validate the handoff files, not the application.
