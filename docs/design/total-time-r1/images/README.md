# Image guide

## Approved full renders

| File | Role |
| --- | --- |
| [mobile-approved.png](raw/mobile-approved.png) | Approved second mobile draft, showing results and the contract sheet |
| [desktop-approved.png](raw/desktop-approved.png) | Approved desktop adaptation, with result and selector side by side |

These raw files are unchanged copies of the generated renders. No earlier rejected drafts are included.

## Whole-panel crops

| Crop | Source | Bounds: left, top, right, bottom |
| --- | --- | --- |
| [mobile-results.png](crops/mobile-results.png) | mobile-approved.png | 66, 58, 623, 1181 |
| [mobile-contract-sheet.png](crops/mobile-contract-sheet.png) | mobile-approved.png | 692, 393, 1243, 1181 |
| [desktop-modal.png](crops/desktop-modal.png) | desktop-approved.png | 250, 139, 1288, 927 |

Coordinates refer to original image pixels. Left/top are inclusive; right/bottom are exclusive. Crops are not resized or retouched. Full provenance and checksums: [manifest.json](manifest.json).

## Interpretation

- Reuse actual assigned contract patterns and client colours; do not replace them with motifs extracted from these rasters.
- Dates, totals, counts and visible contracts are illustrative.
- The mobile crop ends before some historical/other-client content; keep the full existing list and archived/deleted disclosure available by scrolling.
- Desktop background UI is incidental context, not part of this change.
- Exact font sizes, spacing and breakpoints come from the implemented app's system and actual layout fit, not screenshot pixels.

The [written specification](../total-time.md) defines behaviour where a still image cannot.
