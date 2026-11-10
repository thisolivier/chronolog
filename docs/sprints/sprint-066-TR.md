# Sprint 066-TR — Total time r1 layout

**Branch:** `total-time-r1` from `main` at `a79a435` (v1.7.0 plus the design pack), worktree `.claude/worktrees/total-time-r1`. **Status:** merged to `main`, shipped as v1.7.1 on 2026-11-10. Presentation only ("window dressing", the owner's words): no migration, no API change, no new dependency, nothing in `src-tauri/`, the CLI unchanged.

## Goal

Give the shipped Total time modal (sprint 065-TT) the owner-approved r1 layout: a bounded two-column desktop modal, a compact phone results screen and a phone contract sheet.

## Spec

`docs/design/total-time-r1/` (`README.md`, `total-time.md` TT-01..TT-14, `acceptance.md` A01..A22, crops in `images/crops/`). Existing tokens, ContractMark pattern tiles, client colours, calculation and selection semantics kept.

## What changed

- **TT-01** Desktop: centred modal bounded at 64rem × 46rem inside a 1.5rem margin, so it never grows with the list; compact bark header (Total time, Close); no footer.
- **TT-02** `TotalTimeDateToolbar`: presets in the approved order (This week, This month, This year, All time), with the viewed "Week N" first when opened from an older week (it is the default there); the pressed preset in pine; the chips never wrap (QA fix: the fifth chip scrolls the phone row sideways, scrollbar hidden; a narrow desktop window moves From / To under the chips); labelled From / To native date inputs on the right, separate with a gap; a thin rule below (desktop).
- **TT-03** Two columns with a quiet vertical rule. Left: big pine total, quieter entry count, "By contract" open by default (button disclosure; once toggled, filter updates leave it alone), rows with the contract's pattern mark, the name, the client beneath (omitted if it equals the name), time right-aligned, thin separators. Right (`TotalTimeContractsPanel`): Contracts, "N selected" (ticked IDs, contracts without time included), All | None, then client groups in the client's wash with the client name as heading; rows of pattern mark, name, checkbox far right; the whole row is the label of a real checkbox; ticked rows are a surface punch-out in the tint; checkboxes in pine via `accent-color`. The list scrolls inside its column; the result column's rows scroll under the total.
- **TT-04** Phone: presets (sharing the row's width), From / To side by side, the `TotalTimeContractsRow` ("Contracts · N selected", filter icon, chevron), then the total and By contract. The ISO range caption is gone (desktop too). The page scrolls.
- **TT-05** `TotalTimeContractSheet`: a tall sheet over the dimmed results; Contracts with All | None; the same `TotalTimeContractList` over the same selection (no Apply copy); an anchored footer with "N selected" (the only count in the sheet) and Done, bottom safe area kept; the footer is a flex sibling, so it never covers the last row. Done, a backdrop tap and Escape only close it; focus returns to the Contracts row. Escape closes the sheet before the modal.
- **TT-08 / TT-10** The list keeps its existing per-row inactive / archived / deleted labels and its disclosure label, which names the kinds present ("Show inactive, archived and deleted (N)"; "Show archived and deleted (N)" when there are no inactive ones).
- **TT-11 / TT-12** Range, selection, loading, offline, stale-reply semantics unchanged (the request loop moved verbatim into `total-time-query.svelte.ts`). New: a selection with no time shows "0h", "0 entries" and "No time recorded"; From after To marks both fields `aria-invalid` (danger border), keeps the typed values and shows "–" with "From is after To" (no total for an invalid range); a failed load (total or contract list) offers Try again with the filters kept.
- **TT-13** The app's `md` line (48rem) through `MediaQuery`; the contract list is drawn in one place for the width (column or sheet), so no duplicate selector or overlay. Short desktop windows scroll inside the columns.
- **TT-14** `role="dialog"`, `aria-modal`, named by its title (the sheet too); focus returns to the opener; focus rings on presets, fields, checkboxes, All | None, disclosures, the Contracts row and Done. No focus trap (the app's other modals have none).

## Not met / notes

- **TT-13 resize across 768 px**: `AppShell` swaps its phone and desktop DOM branches at 767/768 px, remounting the timesheet and with it any open modal (Total time and Add entry alike), so crossing that width closes the modal. Pre-existing and outside this presentation-only sprint; within the modal the layout logic keeps one selection and closes the sheet when wide. A fix would lift the modal's open state and filters above `AppShell`'s branches.
- The contract name is never split into name and context (no reliable field); the selector shows the name only, the breakdown adds the client.
- Native date inputs keep the browser's locale format (the crops' "9 Nov 2026" is illustrative).

## Files

- New: `src/lib/components/weekly/TotalTimeDateToolbar.svelte`, `TotalTimeContractsPanel.svelte`, `TotalTimeContractsRow.svelte`, `TotalTimeContractSheet.svelte`, `TotalTimeBulkActions.svelte`, `total-time-query.svelte.ts`, `total-time-query.test.ts`, `e2e-playwright/total-time-screenshots.spec.ts`, this file.
- Changed: `TotalTimeModal.svelte`, `TotalTimeContractList.svelte`, `TotalTimeResult.svelte`, `total-time.ts` (preset order; `isRangeBackwards`, `selectedCountLabel`, `colorIndexByContract`; `describeRange` removed with the caption), `total-time.test.ts`, `src/lib/utils/client-colors.ts` (`getClientWashTextClass`) and its test, `e2e-playwright/total-time.spec.ts`; docs: `weekly/readme.md`, `identity/readme.md`, `docs/sprints/readme.md`, `cli/CHANGELOG.md` (Unreleased: CLI unchanged).

## Tests

- `npm run check` 0 errors 0 warnings; `npm run lint` clean; `npm test` 147 files, 1431 tests passed.
- Playwright against a worktree dev server on port 5180, `e2e-playwright/total-time.spec.ts` on chromium, iphone-se and iphone-15: desktop defaults, two columns side by side, preset order, A06 (None: dash, no rows, 0 selected), A07 (an empty contract: 0h, 0 entries, still selected), whole-row toggle, A21 (By contract stays closed across updates), All time, A09 (gap between fields, From after To marks both and keeps values), Close / Escape with focus return; the archived / deleted test; the viewed-week chip first; A18 (a failed total offers Try again, choices kept); A13 (14 extra contracts: the modal stays inside a 1280×720 viewport, Close and the dates stay visible, only the list scrolls, the total does not move); `@iphone` order of elements (A02), the sheet's single count and Done (A03), live total behind the sheet, the archived disclosure reached by scrolling the sheet, the footer below the last row, Done closes only the sheet (A05), Escape sheet then modal; the CLI check. QA fix checks: five chips share one row on iphone-se / iphone-15 (44 px tall, All time reached by scrolling the row) and at a 900 px desktop width (the dates below or beside, never overlapping). Results: 12 passed, 2 skipped (the `@iphone` tests on chromium), auth setup included. Regression: `time-review`, `polish-time`, `timesheet-polish` on chromium, 15 passed, 2 skipped.
- Screenshots: `e2e-playwright/total-time-screenshots.spec.ts` (desktop 1280×800, iPhone 15 results and sheet), compared with the crops.
