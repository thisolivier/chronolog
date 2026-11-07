# Chronolog — engineering specification pack

**Revision 1 · 7 November 2026 · Design handoff, not an implementation report**

This pack consolidates the recorded design discussion through the final timer-light and sidebar-spacing corrections. Markdown is the editable source. Open **index.html** for the offline reading copy. All rendered drafts are together in **images/raw/**; the feature specs embed exact panel-sized crops from **images/crops/**.

## How decisions were integrated

1. Freeze the existing 26th-version decision record as [D26](sources/decision-record-v26.md). It describes the current app and the chronological design discussion, including superseded proposals.
2. Record the later instructions separately as [C01–C05](sources/chat-amendments.md), quoting the changes that were not yet in D26.
3. Give each consolidated requirement an ID and a source locator. The [decision ledger](decision-ledger.md) maps those IDs to their owning spec and evidence. Shared rules have one owner; other specs reference them.
4. Preserve the renders unchanged. Each crop records its source image, exact pixel rectangle and checksum in the [image manifest](images/manifest.json). Written corrections appear beside the relevant image.
5. Keep unresolved product decisions, source-dependent behaviour and unrendered states in [open items](open-items.md). An image's presence is not evidence that every detail in it was approved.

**Precedence:** explicit later owner corrections → the consolidated written requirement and its cited source → the selected visual reference. Historical and rejected studies do not override current requirements. If two written instructions conflict without a later resolution, use the open-item register rather than inventing a resolution.

## Reading order

| Document | Owns |
| --- | --- |
| [01 · Design system](specs/01-design-system.md) | Earth-tone direction, identity semantics, square pattern tiles and placement |
| [02 · Shell and navigation](specs/02-shell-and-navigation.md) | Sidebar, selection, global search entry, timer visibility and history |
| [03 · Time capture](specs/03-time-capture.md) | Running, stopped, compact and mobile capture; ontology controls; manual entry |
| [04 · Split time](specs/04-split-time.md) | Two-card desktop split, ordering, time boundaries, cancellation and resize |
| [05 · Time review](specs/05-time-review.md) | Week strip, sticky day headings, rows, inline edits and weekly status |
| [06 · Notes workspace](specs/06-notes-workspace.md) | Context ownership, list, editor headers, formatting and linked entries |
| [07 · Search and linking](specs/07-search-and-linking.md) | Global search, shared matching and the inline wiki-link picker |
| [08 · Integration and verification](specs/08-integration-and-verification.md) | Source inspection, implementation dependencies and acceptance scenarios |
| [Image guide](images/README.md) | Raw render inventory, crop index, exclusions and visual caveats |
| [Open items](open-items.md) | Decisions and engineering details not settled in the discussion |
| [Decision ledger](decision-ledger.md) | Requirement-level traceability and superseded directions |
| [Package validation](review/package-validation.md) | Checks performed on this deliverable; does not certify the app |

## Status vocabulary

| Label | Meaning |
| --- | --- |
| Agreed | Explicit owner instruction, or a banked/approved behaviour recorded in D26 |
| Current instruction | A later requested amendment in C01–C05; not a claim of blanket approval of its render |
| Visual reference | Composition to implement alongside the written requirements; samples and exact measurements are not normative |
| Draft | A responsive or supporting study that was not separately signed off |
| Historical / rejected | Kept to preserve the design rounds, excluded from the current implementation target |
| Engineering follow-through | A necessary integration/check, clearly distinguished from a new product decision |
| Open / deferred | No settled decision; do not infer approval from a mockup |

## App baseline and scope

Chronolog is a personal time-capture, review and notes app. The owner generally starts a timer, works outside the app while making or consulting notes, then classifies the completed interval. Time Entries is principally a review surface.

The owner reports Svelte 5.49 with runes, SvelteKit 2.50, Tailwind CSS 4 in src/app.css, handwritten components in src/lib/components/, TipTap 3 with wiki links, and a PWA wrapped by Tauri 2 for Mac and iOS. Mac is the primary target. These are supplied facts, not verified dependency versions; no repository was inspected.

The domain is **Client → Contract → Deliverable → Work type / Tag**. Notes belong to contracts. Navigation flattens clients with one contract; counts are note counts. Browsing a Rank Group note while timing Hungryroot is valid. A note can reference several notes, including other contracts. Creating an ordinary note does not start a timer.

Keep the existing data and workflow model except for the specifically agreed changes. This pack does not introduce billing, sending, approval automation, a review queue, a resumable saved-entry model, mobile splitting, resizable desktop columns or a redesigned settings flow.

## Important image limitations

Generated images are composition references, not production assets, pixel specifications or real application screenshots. Text, timings, sample counts, motif geometry, fonts and colours can vary between drafts. Do not copy illustrative content into stored notes or time entries.

The latest timer image still places its pulse dot on the wrong side: **top right is required**. The desktop sidebar image does not reproduce the agreed tile-to-label spacing. The picker images still contain a removed header and scope controls. The desktop search image predates the large results-top query input. These discrepancies are recorded beside their crops and in the manifest.

The supplied original-app screenshots are indexed in D26 §14. This bundle's raw directory contains the generated design rounds, not a duplicate export of those baseline uploads.

## Packaging

Raw PNG bytes are preserved under descriptive filenames, with original filenames retained in the manifest. Crops are direct, unscaled pixel cutouts; no image text or controls have been retouched. Two immediately replaced renders are excluded and listed in the manifest. Earlier distinct rounds remain available and are labelled historical where appropriate.

Relative Markdown links work after extracting the bundle. The HTML reader uses the same local images and has no network dependency. The bundle contains client names and illustrative work excerpts from the provided material; it has not been anonymised.
