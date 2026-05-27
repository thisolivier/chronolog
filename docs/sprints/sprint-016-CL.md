# Sprint 016 — CL: Note Move Between Contracts

**Status:** pending
**Type:** standard
**Backlog items:** Note move (UX-4 recommendation #10)
**Depends on:** nothing
**Branch:** `sprint-016-CL/note-move`

## Objectives

Allow moving a note from one contract to another. Simple feature: a "Move to..." action
in the note editor header that opens a contract picker and updates the note's contractId.

## Context

### Note ID format

Note IDs encode the client short code: `BIGCH.20260526.001`. Moving a note to a different
client would make the ID prefix stale. **Keep the original ID.** The ID is a stable
identifier for backlinks and time entry links — changing it would break `[[BIGCH.20260526.001]]`
references everywhere. The prefix becomes a "created under" indicator, which is fine.

### Current state

- `PUT /api/notes/[noteId]` accepts `{ title, content, contentJson }` only
- `updateNoteForUser()` in `src/lib/server/db/queries/notes.ts` does not update contractId
- The note schema has `contractId` as a FK to contracts
- `DataService.updateNote()` takes `UpdateNoteInput = { title?, content?, contentJson?, isPinned? }`

## Tasks

### 1. Add contractId to UpdateNoteInput

In `src/lib/services/types.ts`, add `contractId?: string` to `UpdateNoteInput`.

### 2. Update the server query

In `src/lib/server/db/queries/notes.ts`, modify `updateNoteForUser()` to accept and
set `contractId` when provided. Validate the target contract belongs to the same user.

### 3. Update the API route

In `src/routes/api/notes/[noteId]/+server.ts`, accept `contractId` in the PUT body
and pass it through to the query function.

### 4. Update FetchDataService

In `src/lib/services/fetch-data-service.ts`, ensure `updateNote()` passes `contractId`
to the PUT request when present.

### 5. Add "Move to..." UI

In `src/lib/components/notes/NoteEditorPanel.svelte` (or the note header area):
- Add a "Move to..." button/action in the note header (near Export)
- On click, show a dropdown or small modal with the user's contracts
- Exclude the current contract from the list
- On selection, call `dataService.updateNote(noteId, { contractId: newContractId })`
- After success, refresh the note list (the note disappears from the old contract's list)
- Show brief feedback ("Moved to [Contract Name]")

Keep it minimal — a dropdown with contract names, grouped by client if possible.

### 6. Update DelegatingDataService and PowerSyncDataService

Ensure `contractId` flows through in both data service implementations. For PowerSync,
update the local SQL to set `contract_id` on the notes table.

### 7. Write tests

- Test that `updateNoteForUser` correctly updates contractId
- Test that the API rejects moving to a contract that doesn't belong to the user
- Test that backlinks and time entry links survive the move (no cascade issues)

### 8. Verify

- `npm run test` passes
- `npm run check` passes
- `npm run build` succeeds

## Acceptance Criteria

- [ ] contractId updatable via PUT /api/notes/[noteId]
- [ ] "Move to..." action in note editor UI
- [ ] Backlinks and linked time entries preserved after move
- [ ] Validation: target contract must belong to the same user
- [ ] Tests for the new functionality
- [ ] All existing tests pass
- [ ] `npm run check` passes
- [ ] `npm run build` succeeds

## Notes

**Keep the original note ID.** Do not regenerate it. The ID prefix becomes cosmetically
stale but functionally stable. This is explicitly the right trade-off.

**Simple UI.** A dropdown in the header, not a modal. This is a rare action.
