# Image guide and provenance

All raw design renders live in one directory, **raw/**. They are copied byte for byte from the available generated files and renamed descriptively. The original filenames, dimensions and SHA-256 checksums are in [manifest.json](manifest.json). Crops are unscaled pixel cuts, not new renders.

## Current visual references

| Area | Best current reference | Written amendments to apply |
| --- | --- | --- |
| Running timer / selected contract | Raw 26; latest component treatment | Top-right dot; 1.5-unit clip; current spacing rule |
| Desktop notes / inline patterns | Raw 27, supported by approved raw 15 | Sidebar gap correction; no extra pattern rows |
| Mobile notes | Raw 16 | Later pattern fit still needs narrow-layout resolution |
| Completion | Raw 05 | Save/Discard; remove Only option helper; latest shared identity |
| Desktop split | Raw 10 | Desktop only; later states and resize logic specified in text |
| Time review | Raw 12 and mobile draft 14 | Square bar ends; unresolved divider endpoints; calendar-year week convention |
| Link picker | Raw 17–18 | Remove header, close control and all scope controls |
| Capture on mobile | Raw 19, supporting draft | No collapse chevron; latest timer identity and dot rules |
| Global search | Raw 20–21 | Desktop query moves above results; hide header search on route |

## Raw images — final available draft of each retained round

The directory includes historical rounds because the requested evidence set spans the design work. Status is explicit below. Two immediate corrections are excluded; they are listed after the table.

| ID | Raw file | Pixels | Status |
| --- | --- | --- | --- |
| 01 | [01-studio-ledger.png](raw/01-studio-ledger.png) | 1536 × 1024 | Historical mood exploration |
| 02 | [02-working-papers.png](raw/02-working-papers.png) | 1536 × 1024 | Historical mood exploration |
| 03 | [03-field-notes.png](raw/03-field-notes.png) | 1536 × 1024 | Preferred earth-tone direction; component details subsequently amended |
| 04 | [04-symbol-exploration.png](raw/04-symbol-exploration.png) | 1219 × 1290 | Exploratory symbols, not production assets; square base supersedes mixed shapes |
| 05 | [05-stopped-entry.png](raw/05-stopped-entry.png) | 1536 × 1024 | Approved with wording and sole-option amendments |
| 06 | [06-split-fullscreen.png](raw/06-split-fullscreen.png) | 1477 × 1065 | Historical; replaced by two floating cards |
| 07 | [07-split-many.png](raw/07-split-many.png) | 1330 × 1182 | Rejected multi-split study |
| 08 | [08-split-mobile.png](raw/08-split-mobile.png) | 1448 × 1086 | Rejected; splitting is desktop only |
| 09 | [09-split-single-dialog.png](raw/09-split-single-dialog.png) | 1568 × 1003 | Historical; enclosing dialog superseded |
| 10 | [10-split-two-cards.png](raw/10-split-two-cards.png) | 1568 × 1003 | Approved desktop initial state; later states specified in text |
| 11 | [11-time-review-study.png](raw/11-time-review-study.png) | 1516 × 1037 | Historical before sidebar/timer refinements |
| 12 | [12-time-review-selected.png](raw/12-time-review-selected.png) | 1516 × 1037 | Owner-selected sidebar variant; review layout with written amendments |
| 13 | [13-sidebar-alignment-alternative.png](raw/13-sidebar-alignment-alternative.png) | 1516 × 1037 | Not selected; use looser alignment in image 12 |
| 14 | [14-time-review-mobile.png](raw/14-time-review-mobile.png) | 887 × 1774 | Mobile draft; square heading ends and divider notes override image |
| 15 | [15-notes-desktop.png](raw/15-notes-desktop.png) | 1536 × 1024 | Approved notes layout; latest inline-pattern amendments apply |
| 16 | [16-notes-mobile.png](raw/16-notes-mobile.png) | 852 × 1846 | Approved notes layout; latest identity rules apply |
| 17 | [17-link-picker-desktop.png](raw/17-link-picker-desktop.png) | 1536 × 1024 | Banked with visible header and scope controls removed in implementation |
| 18 | [18-link-picker-mobile.png](raw/18-link-picker-mobile.png) | 852 × 1846 | Banked with visible header and scope controls removed in implementation |
| 19 | [19-time-capture-mobile.png](raw/19-time-capture-mobile.png) | 1536 × 1024 | Responsive draft; desktop-only collapse and latest identity rules apply |
| 20 | [20-search-desktop.png](raw/20-search-desktop.png) | 1536 × 1024 | Approved with large results-top query and hidden header-search amendment |
| 21 | [21-search-mobile.png](raw/21-search-mobile.png) | 887 × 1774 | Approved mobile search direction |
| 22 | [22-square-tile-study.png](raw/22-square-tile-study.png) | 1536 × 1024 | Historical; gaps between tiles superseded |
| 23 | [23-continuous-tile-study.png](raw/23-continuous-tile-study.png) | 1536 × 1024 | Continuous repeat study; time-entry wash not approved |
| 24 | [24-timer-clip-study.png](raw/24-timer-clip-study.png) | 1672 × 941 | Corrected 1.5-unit clip study; identity header later amended |
| 25 | [25-note-pattern-rows-study.png](raw/25-note-pattern-rows-study.png) | 1536 × 1024 | Historical; dedicated pattern rows removed |
| 26 | [26-timer-and-selection-latest.png](raw/26-timer-and-selection-latest.png) | 1672 × 941 | Latest requested component render; pulse dot must be TOP RIGHT |
| 27 | [27-notes-inline-patterns-latest.png](raw/27-notes-inline-patterns-latest.png) | 1536 × 1024 | Latest requested desktop render; pulse dot top right; written sidebar spacing controls |

## Excluded immediate drafts

- exec-95d24e70-22ce-423e-80c9-56edea619dd1.png: Replaced in same review round by corrected segmented day bars in image 11.
- exec-4e16b9f8-19cf-4327-8f6c-20257b79fe54.png: Replaced in same clip round by corrected 1.5-unit treatment in image 24.

## Panel crops

Pixel rectangles use **left, top, right, bottom**, with left/top inclusive and right/bottom exclusive. Coordinates are provenance, not CSS measurements. Every crop is also embedded or linked in a feature spec.

| Crop / panel | Raw source | Pixel rectangle | Owning spec | Written correction / limit |
| --- | --- | --- | --- | --- |
| [timer-running](crops/timer-running.png) — Entire running timer | [26](raw/26-timer-and-selection-latest.png) | 48, 312, 756, 762 | [03-time-capture](../specs/03-time-capture.md) | Move pulse light to top right; 1.5:1 graphic clip is defined in writing, not measured from the raster. |
| [sidebar-selected-contract](crops/sidebar-selected-contract.png) — Complete client group with selected contract | [26](raw/26-timer-and-selection-latest.png) | 807, 312, 1630, 762 | [02-shell-and-navigation](../specs/02-shell-and-navigation.md) | Count stays right. Tile-to-name gap is approximately 40% smaller than the earlier selected-contract study; this component reference takes precedence over image 27 spacing. |
| [shell-desktop-header](crops/shell-desktop-header.png) — Entire desktop application header | [27](raw/27-notes-inline-patterns-latest.png) | 0, 0, 1536, 51 | [02-shell-and-navigation](../specs/02-shell-and-navigation.md) | No duplicate timer when the sidebar timer is visible. |
| [sidebar-notes](crops/sidebar-notes.png) — Notes navigation panel with utilities | [27](raw/27-notes-inline-patterns-latest.png) | 0, 51, 348, 709 | [02-shell-and-navigation](../specs/02-shell-and-navigation.md) | Written tile-to-label spacing takes precedence over this raster. |
| [sidebar-time-review](crops/sidebar-time-review.png) — Sidebar showing faded navigation and full-strength timer | [12](raw/12-time-review-selected.png) | 0, 51, 358, 1001 | [02-shell-and-navigation](../specs/02-shell-and-navigation.md) | Timer appearance superseded by latest timer crop; sidebar emphasis and looser alignment are the reference. |
| [completion-just-stopped](crops/completion-just-stopped.png) — Entire stopped completion card | [05](raw/05-stopped-entry.png) | 87, 158, 522, 896 | [03-time-capture](../specs/03-time-capture.md) | Use Save, not Save entry; latest contract-first identity and separate contract-change control apply. |
| [completion-options-open](crops/completion-options-open.png) — Entire completion card with browsable options | [05](raw/05-stopped-entry.png) | 552, 158, 987, 896 | [03-time-capture](../specs/03-time-capture.md) | Use Save; choices overlay the form. All completion fields remain present. |
| [completion-ready](crops/completion-ready.png) — Entire completed form before saving | [05](raw/05-stopped-entry.png) | 1015, 158, 1453, 896 | [03-time-capture](../specs/03-time-capture.md) | Remove Only option text/icon/helper and its reserved space; button says Save. |
| [capture-mobile-running](crops/capture-mobile-running.png) — Whole focused mobile running timer | [19](raw/19-time-capture-mobile.png) | 86, 122, 521, 992 | [03-time-capture](../specs/03-time-capture.md) | No collapse chevron; latest contract-first header, top-right pulse dot and no RECORDING text apply. |
| [capture-mobile-stopped](crops/capture-mobile-stopped.png) — Whole focused mobile stopped form | [19](raw/19-time-capture-mobile.png) | 552, 122, 986, 992 | [03-time-capture](../specs/03-time-capture.md) | No collapse chevron; Back preserves unfinished stopped entry. |
| [capture-mobile-manual](crops/capture-mobile-manual.png) — Whole manual-entry form with keyboard | [19](raw/19-time-capture-mobile.png) | 1015, 122, 1454, 992 | [03-time-capture](../specs/03-time-capture.md) | Selector chevron remains a selector here. Cancel/Save; lower fields remain in scrollable form. |
| [split-two-card-overlay](crops/split-two-card-overlay.png) — Whole split interaction: two cards, Flip, label and Cancel | [10](raw/10-split-two-cards.png) | 319, 179, 1268, 911 | [04-split-time](../specs/04-split-time.md) | Initial state only; resolved-left state is specified in text. No mobile split. |
| [review-desktop-week](crops/review-desktop-week.png) — Whole week-navigation and summary panel | [12](raw/12-time-review-selected.png) | 358, 51, 1516, 294 | [05-time-review](../specs/05-time-review.md) | Week numbering from start of calendar year; partial-week convention remains open. |
| [review-desktop-day](crops/review-desktop-day.png) — Whole day section with heading and six rows | [12](raw/12-time-review-selected.png) | 358, 295, 1516, 773 | [05-time-review](../specs/05-time-review.md) | Heading ends are square. Horizontal divider endpoints remain open; do not copy full-width rules as settled geometry. |
| [review-mobile-week](crops/review-mobile-week.png) — Whole mobile shell and week summary | [14](raw/14-time-review-mobile.png) | 0, 0, 887, 640 | [05-time-review](../specs/05-time-review.md) | Single timer reflection when sidebar absent; exact year-boundary numbering remains open. |
| [review-mobile-day](crops/review-mobile-day.png) — Mobile day section with heading and entries | [14](raw/14-time-review-mobile.png) | 0, 640, 887, 1774 | [05-time-review](../specs/05-time-review.md) | Square heading ends; chronological entries; no mobile split. This remains a responsive draft. |
| [notes-list-panel](crops/notes-list-panel.png) — Entire middle notes-list column | [27](raw/27-notes-inline-patterns-latest.png) | 348, 51, 699, 1024 | [06-notes-workspace](../specs/06-notes-workspace.md) | Repeat is in the existing Notes title row; no dedicated pattern row. |
| [notes-editor-panel](crops/notes-editor-panel.png) — Entire editor panel including metadata, toolbar, body and linked time | [27](raw/27-notes-inline-patterns-latest.png) | 699, 51, 1536, 1024 | [06-notes-workspace](../specs/06-notes-workspace.md) | Repeat goes between Saved and ellipsis; content is illustrative, not a note-data edit. |
| [notes-mobile-context-toolbar](crops/notes-mobile-context-toolbar.png) — Complete mobile navigation, metadata and formatting panel | [16](raw/16-notes-mobile.png) | 0, 0, 852, 477 | [06-notes-workspace](../specs/06-notes-workspace.md) | Restore readable note context in single-column view; compact timer identifies its independent context. |
| [notes-mobile-document](crops/notes-mobile-document.png) — Mobile document content panel | [16](raw/16-notes-mobile.png) | 0, 477, 852, 1846 | [06-notes-workspace](../specs/06-notes-workspace.md) | Illustrative body copy; no content rewrite is specified. |
| [link-picker-desktop](crops/link-picker-desktop.png) — Entire desktop autocomplete panel | [17](raw/17-link-picker-desktop.png) | 715, 320, 1506, 751 | [07-search-and-linking](../specs/07-search-and-linking.md) | Remove visible Link a note header and ALL scope tabs; results start immediately. Query remains inline. |
| [link-picker-mobile](crops/link-picker-mobile.png) — Entire mobile autocomplete panel | [18](raw/18-link-picker-mobile.png) | 20, 746, 832, 1288 | [07-search-and-linking](../specs/07-search-and-linking.md) | Remove header, close control and scope row; do not leave a blank header band. |
| [search-desktop-results](crops/search-desktop-results.png) — Entire desktop mixed-result list | [20](raw/20-search-desktop.png) | 204, 84, 1337, 983 | [07-search-and-linking](../specs/07-search-and-linking.md) | Add one large query input above results; hide header search on this route. Input placement not shown in this crop. |
| [search-mobile-query](crops/search-mobile-query.png) — Complete mobile navigation and search-input panel | [21](raw/21-search-mobile.png) | 0, 0, 887, 370 | [07-search-and-linking](../specs/07-search-and-linking.md) | One large input above results; no duplicate header search. |
| [search-mobile-results](crops/search-mobile-results.png) — Mobile mixed-results panel | [21](raw/21-search-mobile.png) | 0, 370, 887, 1700 | [07-search-and-linking](../specs/07-search-and-linking.md) | Metadata reflows below excerpts. Image is keyboard-dismissed, not an auto-dismiss requirement. |

## Use in engineering

Use the feature spec and its written corrections alongside the crop. Open the raw source for surrounding context. Do not use the old surrounding shell of a split render as a new shell design, or extract patterns from generative raster pixels as production vector assets. The patterns must ultimately come from a consistent approved asset set.
