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

App-wide navigation state for the panel layout. Manages mode switching (time-entries vs notes), selected contract/week/note, sidebar collapsed state, and the mobile push level (`mobileNavigationLevel`: 0 = sidebar, 1 = note list in notes mode or time entries in time mode, 2 = note editor). Actions: `selectTimeEntries()` (time mode, mobile level 1), `selectContract()` (notes mode, mobile level 1), `selectWeek()` (does not change the mobile level), `selectNote()` (mobile level 2), `clearSelectedNote()`, `toggleSidebar()`, `navigateMobile()`, `goBackMobile()`.

### connectivity.svelte.ts

App-wide connectivity. Offline means the browser reports it (`navigator.onLine`) or the last API request failed at the network level. `fetch-helpers.ts` reports request outcomes; `ConnectionStatus` renders the banner, including a short "Back online" notice after reconnecting.

### contract-directory.svelte.ts

Names of the visible contracts (contract and client name), filled by the sidebar when it loads them. Lets the page `<title>` name the selected contract without another request.

### timer-state.svelte.ts

Shared timer display state for cross-component communication. `TimerWidget` (in the sidebar) writes to it with `update(partial)` / `reset()`; `TimerIndicator` (in the AppShell top bar) reads from it. Reactive fields: `status` (`'idle' | 'running' | 'paused' | 'stopped'`), `elapsedSeconds`, `description`, `contractName`, `clientColorIndex`. Provided with `setTimerStateContext(createTimerState())` and read with `getTimerStateContext()`.
