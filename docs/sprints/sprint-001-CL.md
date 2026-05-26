# Sprint 001 — CL: Land DataService Abstraction

**Status:** closed (superseded — Tauri spike must pass first, see sprint-001-GK.md. Becomes sprint-002-CL.)
**Type:** standard
**Backlog items:** CL-1
**Depends on:** none
**Branch:** (to be filled by Team PM)
**Working tree:** (to be filled by Team PM)

## Objectives

Cherry-pick the DataService abstraction layer from `powersync-spike` onto main as a standalone
change. After this sprint, all UI components use the DataService interface instead of direct
fetch() calls, and the app works exactly as before via the FetchDataService implementation.

## Tasks

1. Study the DataService files on `origin/powersync-spike`:
   - `src/lib/services/data-service.ts` (interface)
   - `src/lib/services/delegating-data-service.ts` (wrapper)
   - `src/lib/services/fetch-data-service.ts` (HTTP implementation)
   - `src/lib/services/types.ts` (type definitions)
   - `src/lib/services/context.ts` (Svelte context)
   - `src/lib/services/index.ts` (exports)
   Bring these files onto the branch. Adapt as needed — the spike had denormalised `user_id`
   columns that we're NOT carrying forward (single-user simplification).

2. Refactor all Svelte components that currently use direct fetch()/API calls to use the
   DataService interface instead. The spike did this for ~20 components — use the spike diff
   as a guide but verify against the current main (components may have changed since the spike).

3. Ensure the FetchDataService routes to the existing SvelteKit API endpoints. The app must
   work identically after this change — no new features, no new dependencies, just the
   abstraction layer.

4. Write tests for the DataService abstraction:
   - Unit tests for FetchDataService (mock fetch, verify correct API calls)
   - Verify all interface methods are implemented
   - Existing tests must continue to pass

5. Add `src/lib/services/readme.md` documenting the abstraction pattern.

## Contracts

- DataService interface: `docs/contracts/data-service-interface.md`
- Epic context: `docs/EPIC-OFFLINE-SYNC.md` (section 2 — "DataService abstraction")

## Verification

- `npm run test` — all existing tests pass, new DataService tests pass
- `npm run check` — no TypeScript errors
- `npm run build` — builds successfully
- `npm run dev` — app starts, can create/read/update/delete clients, contracts, time entries, notes
- Manual smoke: navigate to time entries, create one, verify it persists

## Acceptance Criteria

- [ ] `src/lib/services/` directory exists with all DataService files
- [ ] All UI components use DataService instead of direct fetch()
- [ ] FetchDataService correctly delegates to existing API routes
- [ ] App works identically to current main (no behavior changes)
- [ ] `npm run test` passes (existing + new tests)
- [ ] `npm run check` passes
- [ ] `npm run build` succeeds
- [ ] `src/lib/services/readme.md` exists
- [ ] No `user_id` denormalisation from the spike is carried over

## Notes

**How to access the spike:** `git diff main...origin/powersync-spike -- src/lib/services/` shows
the full DataService code. `git diff main...origin/powersync-spike -- src/` shows all component
refactors. Cherry-pick selectively — do NOT merge the whole spike branch.

**Important:** The spike also removed `src/lib/storage/` (Dexie/SQLite adapters). Do NOT remove
those files in this sprint — they may still be in use on main. Only add the new abstraction layer.

**Type cleanup:** The spike's `types.ts` includes `user_id` fields on several types
(contracts, deliverables, work_types, etc.) for PowerSync denormalisation. Strip those — we're
single-user and won't need per-user sync filtering.

(Team PM: write progress notes here.)

## Sign-off

(Team PM fills this when done)
