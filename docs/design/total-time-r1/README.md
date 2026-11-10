# Chronolog · Total time

**Engineering handoff · Revision 1 · 10 November 2026**

This is a focused UI specification for the existing Total time screen. Routing and the MVP already exist. The owner approved the second mobile draft and the desktop adaptation shown in this bundle.

Open [index.html](index.html) to read the illustrated pack offline, or use the Markdown sources:

- [UI specification](total-time.md) — layouts, interaction, responsive behaviour and supporting states.
- [Acceptance checks](acceptance.md) — implementation verification and source-dependent checks.
- [Image guide](images/README.md) — original renders, panel crops and limits of the visual references.
- [File verification](validation.md) — image provenance, crop fidelity and package checks.

## Contents and authority

Both approved renders are preserved unchanged in **images/raw/**. The specification embeds whole-screen/widget crops from **images/crops/**. Crop rectangles and checksums are recorded in **images/manifest.json**.

The written specification defines behaviour. The renders define visual composition; their sample data, incidental backgrounds and pixel dimensions are not production data or a new token system. Use the app's existing colours, assigned contract patterns, components and terminology.

The approval evidence in the conversation is:

- Mobile: “Love the second draft.”
- Desktop: “Perfect, write up a spec for the engineers with the images and zip it up.”

This pack carries those approved designs forward. Supporting edge states and accessibility details are labelled engineering requirements; they were not separately rendered. Existing calculation, date, selection and persistence semantics must be checked in source and retained where this UI work does not explicitly change presentation.

## Scope

Implement the approved responsive presentation for Total time and its contract selector. Preserve the existing route, totals calculation, date presets, multi-selection and archived/deleted access. No app source was supplied for this handoff, so component filenames, exact breakpoints and existing query behaviour have not been verified.

The previous broader Chronolog reskin is reported as implemented. This is an additive specification for this screen, not a revision of that entire handoff.
