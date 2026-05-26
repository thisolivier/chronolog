# Navigation State

## Overview

The `navigation.svelte.ts` module manages all app-wide navigation state using Svelte 5 runes and context. It is initialized once in the root layout and accessed by any component via `getNavigationContext()`.

## State Shape

```typescript
interface NavigationState {
    mode: 'time-entries' | 'notes';
    selectedContractId: string | null;
    selectedClientId: string | null;
    selectedWeek: string | null;        // ISO date string (Monday)
    selectedNoteId: string | null;
    panel1Collapsed: boolean;
    mobileNavigationLevel: 0 | 1 | 2;
}
```

## Initial State

| Property | Initial Value |
|----------|--------------|
| `mode` | `'time-entries'` |
| `selectedContractId` | `null` |
| `selectedClientId` | `null` |
| `selectedWeek` | Current week's Monday (calculated via `getMondayOfWeek`) |
| `selectedNoteId` | `null` |
| `panel1Collapsed` | `false` |
| `mobileNavigationLevel` | `0` |

## Derived State

| Property | Derivation |
|----------|-----------|
| `isTimeEntriesMode` | `mode === 'time-entries'` |
| `isNotesMode` | `mode === 'notes'` |
| `isSidebarCollapsed` | `panel1Collapsed` |

## Actions

### `selectTimeEntries()`

Switches to time-entries mode:
- Sets `mode` to `'time-entries'`
- Clears `selectedContractId`, `selectedClientId`, `selectedNoteId`
- Advances mobile to level 1

### `selectContract(contractId, clientId)`

Switches to notes mode for a specific contract:
- Sets `mode` to `'notes'`
- Sets `selectedContractId` and `selectedClientId`
- Clears `selectedNoteId`
- Advances mobile to level 1

### `selectWeek(weekStart)`

Selects a week (for scrolling to in Panel 3):
- Sets `selectedWeek` to the given ISO date string
- Advances mobile to level 2

### `selectNote(noteId)`

Selects a note (for viewing/editing in Panel 3):
- Sets `selectedNoteId`
- Advances mobile to level 2

### `clearSelectedNote()`

Clears `selectedNoteId` (e.g., after deleting a note).

### `toggleSidebar()`

Toggles `panel1Collapsed` between true and false.

### `navigateMobile(level)`

Directly sets `mobileNavigationLevel` to 0, 1, or 2.

### `goBackMobile()`

Decrements `mobileNavigationLevel` by 1 (minimum 0).

## Context Pattern

```typescript
// In root layout:
const navState = createNavigationState();
setNavigationContext(navState);

// In any child component:
const nav = getNavigationContext();
```

Uses Svelte's `setContext()` / `getContext()` with a Symbol key. Throws an error if accessed outside the context.

## Mode Transition Diagram

```
                 click "Time Entries"
    notes mode ──────────────────────> time-entries mode
                                            |
                 click contract              |
    time-entries mode <─────────────── notes mode
                                            |
                 click week                  |
                 ──────────> selectWeek()    |
                                            |
                 click note                  |
                 ──────────> selectNote()
```

## Mobile Navigation Flow

```
Level 0: ContractsSidebar
    selectTimeEntries() ──> Level 1: WeekListPanel
    selectContract() ─────> Level 1: NoteListPanel

Level 1: WeekListPanel
    selectWeek() ─────────> Level 2: TimeEntriesPanel
Level 1: NoteListPanel
    selectNote() ─────────> Level 2: NoteEditorPanel

Level 2: Any content panel
    goBackMobile() ───────> Level 1
Level 1:
    goBackMobile() ───────> Level 0
```

## Files

| File | Purpose |
|------|---------|
| `src/lib/stores/navigation.svelte.ts` | Navigation state creation and context |
| `src/lib/stores/navigation.test.ts` | Unit tests |
