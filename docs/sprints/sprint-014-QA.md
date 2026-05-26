# Sprint 014 — QA: Phase 2 Regression (QA-H)

**Status:** pending
**Type:** QA gate
**Backlog items:** QA-H
**Depends on:** Sprints 009-013 (all Phase 2 CL features merged)
**Branch:** `sprint-014-QA/phase2-regression`

## Objectives

Comprehensive regression test after Phase 2 feature additions. Verify that:
- All existing tests pass (unit, e2e, Playwright)
- New features (deliverable selector, hours display, MD editor, note export) work correctly
- No regressions in the core CRUD flows

## Tasks

### 1. Run all test suites

```bash
npm run test          # Unit tests
npm run test:e2e      # API e2e tests (Docker stack required)
npm run test:playwright  # Playwright browser tests (Docker stack required)
npm run check         # TypeScript check
npm run build         # Production build
```

All must pass. Document any failures.

### 2. Verify deliverable selector (sprint 010)

Via API e2e or Playwright:
- Create a deliverable in admin for a contract
- Create a time entry with that deliverable selected
- Verify the deliverable appears on the time entry
- Change the contract on the entry — verify deliverable resets

### 3. Verify hours in week status (sprint 009)

Via Playwright or manual:
- Create time entries for a week
- Verify hours appear next to the status in the week header
- Verify hours appear in the sidebar week list

### 4. Verify code blocks (sprint 012-CL)

Via Playwright:
- Create a note
- Add a code block with a language (e.g., JavaScript)
- Verify syntax highlighting renders
- Toggle to raw mode — verify markdown with ``` code fence
- Toggle back to rendered — verify no data loss

### 5. Verify note export (sprint 013-CL)

Via Playwright or manual:
- Create a note with content
- Click "Export as Markdown" — verify `.md` file downloads
- Click "Export as PDF" — verify print dialog opens
- Verify exported markdown has title heading

### 6. Write gate verdict

Update `docs/gate-verdicts.md` with Phase 2 regression results.

## Acceptance Criteria

- [ ] `npm run test` passes
- [ ] `npm run test:e2e` passes
- [ ] `npm run test:playwright` passes
- [ ] `npm run check` passes (no new errors)
- [ ] `npm run build` succeeds
- [ ] Deliverable selector verified
- [ ] Hours display verified
- [ ] Code blocks verified
- [ ] Note export verified
- [ ] Gate verdict documented

## Notes

**Docker stack must be running** for e2e and Playwright tests.

**The CL PM's worktree may have stale dependencies.** Run `npm install` in the
worktree before running tests.

**Playwright tests expect `localhost:5173`** for Better Auth origin validation.
E2e tests use `127.0.0.1:5173`. Both patterns are documented in sprint 005 and 007.
