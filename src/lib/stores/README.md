# Stores

Application-wide state management modules using Svelte 5 runes.

## Architecture

State modules use Svelte 5's runes (`$state`, `$derived`) with a context-based pattern for sharing state across the component tree. Each module creates reactive state, exposes it through a clean interface, and provides `setContext()`/`getContext()` helpers.

## Working Pattern

```typescript
// In root layout (+layout.svelte), for signed-in users. Simplified: the real layout guards on
// data.user and passes the document load type on first load (see src/routes/+layout.svelte).
import { afterNavigate, goto } from '$app/navigation';
import { page } from '$app/state';
import { createNavigationState, setNavigationContext } from '$lib/stores/navigation.svelte';

const navigationState = createNavigationState({
	initialUrl: page.url,
	adapter: {
		navigate: (path, { replace }) => goto(path, { replaceState: replace, noScroll: true, keepFocus: true }),
		back: () => history.back()
	},
	sessionStorage: window.sessionStorage,
	localStorage: window.localStorage
});
setNavigationContext(navigationState);
afterNavigate((navigation) => {
	if (navigation.to) void navigationState.syncFromUrl(navigation.to.url, navigation.type, navigation.delta);
});

// In any component:
import { getNavigationContext } from '$lib/stores/navigation.svelte';
const navigation = getNavigationContext();
navigation.selectTimeEntries();
```

## Modules

### navigation.svelte.ts

The URL is the state. `createNavigationState` parses the URL it is given, and `syncFromUrl` re-reads it after every navigation, so Back, Forward and plain links all land in the same place. Actions change the state at once, so a component that reads the store right after an action sees the new value; the action then writes the new URL through the adapter (`goto`). Several actions in one tick become one navigation.

Each action is a URL write. Mode, contract and note changes push a history entry. Week changes inside the timesheet, closing a note, and a draft turning into a saved note replace the current entry. `showTimeEntryDay` replaces when the timesheet is already open and pushes otherwise. The rules are listed in `docs/ux/09-navigation-state.md`.

`mobileNavigationLevel` is not stored. It is derived from the route (`mobileLevelFor` in `navigation-routes.ts`): home is 0, the timesheet or a note list (a contract's or a client's) is 1, and a note or a draft is 2.

The client view (sprint 039-CL): `selectClient(clientId)` opens one client's notes across its contracts; `listClientId` names that client (null otherwise) and `selectedClientId` returns it. Inside it, `selectNote(noteId, contractId)` and `openDraft(contractId)` take the note's contract (it is in the URL, so the editor's "note under its own contract" rule still holds), and `openNote` keeps the client view when the note belongs to the viewed client (a link to another client's note leaves it). Closing a note returns to the client list.

Phone Back (`goBackMobile`) uses the in-app history mirror (`navigation-history.ts`). If the previous entry is inside the app it calls `history.back()`; otherwise it moves one level up with a replace. `backTarget` gives that path and whether it is a history entry, which the phone's Back label is built from.

A fresh deep link (a URL opened directly, not by reload or Back) gets `/` put under it, so Back goes up into the app instead of out of it.

`workspaceHref` is the URL of the workspace place. On settings and admin pages the route keeps the last workspace place shown in this tab (sessionStorage), which is where "Back to app" goes.

Persistence: the sidebar-collapsed preference is in localStorage (`chronolog:sidebar-collapsed`), as is the sidebar's Archived item being expanded (`chronolog:sidebar-archived-expanded`, kept by `ContractsSidebar`, not this store). Timesheet scroll positions per week are in sessionStorage (`chronolog:timesheet-scroll`), as is the in-app history (`chronolog:in-app-history`). `showTimeEntryDay(date)` sets the week to show and the day to scroll to; `takeFocusDay()` hands that day out once and then forgets it. `openNote(…, { focusEditor: true })` (a followed wiki-link) marks the note so `takeEditorFocus(noteId)` returns true once; NoteEditorPanel then focuses the editor at the top (not on touch screens).

Actions: `selectTimeEntries`, `selectContract`, `selectClient`, `selectWeek`, `selectNote`, `openNote`, `openDraft`, `clearSelectedNote`, `showTimeEntryDay`, `toggleSidebar`, `navigateMobile`, `goBackMobile`, and the timesheet scroll helpers.

### navigation-routes.ts

Pure functions that map workspace URLs to routes and back. No Svelte.

| URL | Route | Meaning |
|---|---|---|
| `/` | `home` | Phone: the sidebar. Wider screens: this week's timesheet. |
| `/time/YYYY-Www` | `time` | The timesheet for that ISO week |
| `/notes/<contractId>` | `notes` | A contract's note list |
| `/notes/<contractId>/<noteId>` | `notes` | A note open under its contract |
| `/notes/<contractId>/new` | `notes`, `draft` | An unsaved new-note draft for that contract |
| `/notes/client/<clientId>` | `client` | One client's notes across its contracts (sprint 039-CL) |
| `/notes/client/<clientId>/<contractId>/<noteId>` | `client` | A note open with the client view as the list |
| `/notes/client/<clientId>/<contractId>/new` | `client`, `draft` | A draft for that contract inside the client view |

`parseWorkspacePath` returns null for any other page (settings, admin, login), which is how the store knows to keep the last workspace place.

### navigation-history.ts

`InAppHistory` mirrors the browser history entries this tab visited inside Chronolog, because a page cannot read its own history. Every navigation (push, replace, or Back/Forward by a delta) is recorded. If the recorded stack no longer matches what the browser did, it starts over from the current URL. The stack is kept in sessionStorage and capped at 200 entries; a reload restores it when it still points at the current URL. The phone's Back button reads it for its target and label.

### connectivity.svelte.ts

App-wide connectivity. Offline means the browser reports it (`navigator.onLine`) or the last API request failed at the network level. `fetch-helpers.ts` reports request outcomes; `ConnectionStatus` renders the banner, including a short "Back online" notice after reconnecting.

### contract-directory.svelte.ts

The user's contracts, archived ones included, filled by the sidebar when it loads them (`GET /api/contracts-by-client?includeArchived=true`). `labels` holds each contract's name, client name and client ID; other parts of the shell read them without another request: the page `<title>`, the phone title bar, the note list and editor headers, and the timesheet's card links (so a note on an archived contract still opens under it). `contextLabel(contractId)` returns "Client · Contract", or null while the sidebar has not loaded that contract. The navigation store takes `selectedClientId` from the client ID here. The store decides what is active (sprint 033-CL): `sections` (from `$lib/utils/sidebar-sections.ts`) splits the list into the active client groups and the Archived section, and `isArchived(contractId)` answers for one contract.

### timer-state.svelte.ts

Shared timer display state for cross-component communication. `TimerWidget` (in the sidebar) writes to it with `update(partial)` / `reset()`; `TimerIndicator` (in the AppShell top bar) reads from it. Reactive fields: `status` (`'idle' | 'running' | 'paused' | 'stopped'`), `elapsedSeconds`, `description`, `contractName`, `clientColorIndex`, `contractShortCode` (client short code). Inside the desktop app it also pushes the timer to the menu bar through `$lib/desktop/bridge`. Provided with `setTimerStateContext(createTimerState())` and read with `getTimerStateContext()`.
