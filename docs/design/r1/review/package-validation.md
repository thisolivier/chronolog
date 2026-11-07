# Package validation

**Revision 1 · 7 November 2026**

These are deliverable checks, not tests of Chronolog's implementation.

| Check | Result |
| --- | --- |
| Unchanged raw PNG bytes and source checksums | 27 / 27 matched |
| Crop dimensions, bounds, source pixels and checksums | 25 / 25 matched |
| Frozen D26 snapshot | Byte-identical to the retrieved local version; 105,963 bytes |
| Feature specifications | 8 |
| Unique requirement IDs and references | 59; no duplicates or unknown references |
| Markdown local file links | 256 checked; no broken targets |
| HTML local links and anchors | 522 checked; no broken targets |
| Every crop used by a feature spec | Passed |
| Final-amendment presence checks | 17 checked |

## Visual and editorial review

Raw-image contact sheets and panel-crop contact sheets were inspected. Full-size views were used for the timer, split, completion, review, notes, picker and search boundaries. The mobile review crop was adjusted to include its complete day heading. Crops preserve whole widgets/panels, including superseded controls where written overrides explain their removal.

The requirement ledger separates explicit decisions, current instructions, drafts, historical references and engineering follow-through. The final timer dot location, sidebar spacing, inline repeats, removed picker header, search-input relocation, split resize handling and removed sole-option helper are recorded beside the relevant specifications.

The offline HTML copy was generated with Pandoc and checked for local assets/links. A browser rendering check was not performed in this environment. CSS and HTML are supplied as a reading aid; Markdown remains the editable source.

## Not performed

No repository inspection, implementation, app launch, functional test, persistence/race test, accessibility audit or native-wrapper test has been performed. Spec 08 contains the engineering acceptance matrix. Open items remain visible rather than being reported as resolved.

Machine-readable results: [package-validation.json](package-validation.json).
