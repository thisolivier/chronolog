# Stores

Application-wide state management modules using Svelte 5 runes.

## Architecture

State modules use Svelte 5's runes (`$state`, `$derived`) with a context-based pattern for sharing state across the component tree. Each module creates reactive state, exposes it through a clean interface, and provides `setContext()`/`getContext()` helpers.

## Working Pattern

```typescript
// In root layout (+layout.svelte):
import { setNavigationContext, createNavigationState } from '$lib/stores/navigation.svelte';
setNavigationContext(createNavigationState());

// In any component:
import { getNavigationContext } from '$lib/stores/navigation.svelte';
const navigation = getNavigationContext();
navigation.selectTimeEntries();
```

## Modules

### navigation.svelte.ts

App-wide navigation state for the panel layout. Manages mode switching (time-entries vs notes), selected contract/week/note, sidebar collapsed state, and mobile navigation level. Actions include `selectTimeEntries()`, `selectContract()`, `selectWeek()`, `selectNote()`, `toggleSidebar()`.

### timer-state.svelte.ts

Shared timer display state for cross-component communication. Allows the timer widget (in the sidebar) and the TimerIndicator (in the top bar) to share running/elapsed state without direct coupling. Provides reactive `isRunning`, `elapsedSeconds`, and `activeContractName` state.
