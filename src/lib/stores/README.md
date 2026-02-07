# Stores

Application-wide state management modules using Svelte 5 runes.

## Architecture

This directory contains state management modules that use Svelte 5's new runes system (`$state`, `$derived`) with a context-based pattern for sharing state across the component tree.

Each store module follows this pattern:
1. Create state with `$state()` for reactive primitive values
2. Create derived values with `$derived()` for computed state
3. Define actions (functions) that mutate the state
4. Expose a clean interface through a context object
5. Provide `setContext()` and `getContext()` helper functions

## Working Pattern

### In the root layout (+layout.svelte):

```typescript
import { setNavigationContext, createNavigationState } from '$lib/stores/navigation.svelte';

setNavigationContext(createNavigationState());
```

### In any component:

```typescript
import { getNavigationContext } from '$lib/stores/navigation.svelte';

const navigation = getNavigationContext();

// Access state reactively
console.log(navigation.mode); // 'time-entries' or 'notes'
console.log(navigation.isTimeEntriesMode); // derived boolean

// Call actions
navigation.selectTimeEntries();
navigation.selectContract('contract-123', 'client-456');
navigation.toggleSidebar();
```

## Modules

### navigation.svelte.ts

App-wide navigation state for the three-panel Apple Notes-inspired layout.

**State:**
- `mode`: Current mode ('time-entries' or 'notes')
- `selectedContractId`: Selected contract ID (for notes mode)
- `selectedClientId`: Client owning the selected contract
- `selectedWeek`: ISO date string of the Monday being viewed (YYYY-MM-DD)
- `selectedNoteId`: Selected note ID (for Panel 3)
- `panel1Collapsed`: Whether the sidebar is collapsed
- `mobileNavigationLevel`: Mobile navigation level (0=contracts, 1=list, 2=content)

**Derived state:**
- `isTimeEntriesMode`: Boolean derived from mode
- `isNotesMode`: Boolean derived from mode
- `isSidebarCollapsed`: Alias for panel1Collapsed

**Actions:**
- `selectTimeEntries()`: Switch to time entries mode
- `selectContract(contractId, clientId)`: Switch to notes mode for a contract
- `selectWeek(weekStart)`: Set which week to view
- `selectNote(noteId)`: Set which note to view in Panel 3
- `toggleSidebar()`: Toggle Panel 1 collapsed state
- `navigateMobile(level)`: Set mobile navigation level
- `goBackMobile()`: Go back one level on mobile

## Benefits of This Pattern

1. **Type-safe**: Full TypeScript support with interfaces
2. **Reactive**: Uses Svelte 5's native reactivity (runes)
3. **Scoped**: Uses Svelte's context API for dependency injection
4. **Testable**: Pure functions that can be tested independently
5. **Simple**: No external state management libraries needed
6. **Performance**: Svelte's fine-grained reactivity only updates what changed
