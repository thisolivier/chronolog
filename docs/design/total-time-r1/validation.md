# File verification

**Revision 1 · 10 November 2026**

| Check | Result |
| --- | --- |
| Approved source images | Two raw PNGs match their original generated files byte for byte; SHA-256 hashes are in the image manifest |
| Panel crops | Three crops match the corresponding source rectangles pixel for pixel, without resizing or retouching |
| Image decoding | All five PNGs decode completely |
| Visual review | Desktop modal, mobile results screen and mobile contract sheet crops reviewed; whole panels and their controls are included |
| Requirements | 14 unique UI requirement IDs and 22 unique acceptance-check IDs |
| Sample arithmetic | 61m + 52m = 113m = 1h 53m; count of 5 is illustrative supplied sample data |
| Document links | All local Markdown/HTML references resolve; internal HTML anchors exist and are unique |
| Offline reader | One HTML reading copy with embedded CSS; no remote resource dependencies |
| Package integrity | ZIP CRC and byte-for-byte correspondence of every archive entry checked after packaging |

The PNGs are composition references, not production assets. The offline reader was checked structurally; no browser rendering test or application test was performed. No app source was available. The engineering acceptance checklist is prospective, not a report of implemented behaviour.

See [image provenance](images/manifest.json), [UI specification](total-time.md) and [acceptance checks](acceptance.md). `SHA256SUMS.txt` records the bundle files except itself.
