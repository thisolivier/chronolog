/**
 * Navigation state for the three-panel workspace (sprint 027-CL: the URL is the state).
 *
 * The URL is the source of truth. The store parses it on load and after every navigation
 * (`syncFromUrl`, called from the root layout's `afterNavigate`), and every action writes a
 * new URL through the adapter (SvelteKit `goto`). Actions also update the state at once, so
 * components that read the store right after calling it see the new value; several actions
 * in the same tick become one navigation.
 *
 * History: every navigation is a step (sprint 050-UI): mode, contract, client and note changes
 * and each week paged or picked push an entry. Closing a note, a draft turning into a saved note,
 * a note getting its real ID or moving contract, and URL corrections replace the current one.
 * `goBack` / `goForward` walk this tab's in-app entries (the top bar's ‹ › buttons).
 * Rules enforced here are listed in docs/ux/09-navigation-state.md.
 *
 * Usage:
 * - root layout: setNavigationContext(createNavigationState({ initialUrl, adapter }))
 * - components: getNavigationContext()
 */

import { getContext, setContext } from 'svelte';
import { contractDirectory } from './contract-directory.svelte';
import { InAppHistory } from './navigation-history';
import {
	buildWorkspacePath,
	currentMonday,
	isNoteListRoute,
	mobileLevelFor,
	parentRoute,
	parseWorkspacePath,
	type WorkspaceRoute
} from './navigation-routes';
import { getMondayOfWeek } from '$lib/utils/iso-week';

const NAVIGATION_CONTEXT_KEY = Symbol('navigation');
const SIDEBAR_PREFERENCE_KEY = 'chronolog:sidebar-collapsed';
const TIMESHEET_SCROLL_KEY = 'chronolog:timesheet-scroll';
const LAST_WORKSPACE_KEY = 'chronolog:last-workspace-path';

export type NavigationMode = 'time-entries' | 'notes';
export type MobileNavigationLevel = 0 | 1 | 2;
export type LayoutMode = 'mobile' | 'tablet' | 'desktop';
/** SvelteKit navigation types, plus `reload` / `back_forward` / `navigate` for the first load */
export type NavigationKind = 'enter' | 'form' | 'link' | 'goto' | 'popstate' | 'leave';

export interface NavigationState {
	mode: NavigationMode;
	selectedContractId: string | null;
	selectedClientId: string | null;
	/** ISO date string of the Monday (YYYY-MM-DD) for the week being viewed */
	selectedWeek: string | null;
	selectedNoteId: string | null;
	panel1Collapsed: boolean;
	mobileNavigationLevel: MobileNavigationLevel;
}

/** Where the store sends URL changes; the root layout passes SvelteKit's `goto`, `history.back` and `history.forward` */
export interface NavigationAdapter {
	navigate: (path: string, options: { replace: boolean }) => Promise<void> | void;
	back: () => void;
	forward: () => void;
}

/** A remembered timesheet position: the day at the top and how far past its heading */
export interface TimesheetScrollPosition {
	scrollTop: number;
	topDay: string | null;
	offsetWithinDay: number;
}

export interface NavigationOptions {
	/** The URL the app started on (SSR and hydration both start from it) */
	initialUrl?: URL;
	adapter?: NavigationAdapter;
	/** Session storage for the in-app history and timesheet scroll (null in tests and SSR) */
	sessionStorage?: Storage | null;
	/** Local storage for the sidebar preference (null in tests and SSR) */
	localStorage?: Storage | null;
	now?: () => Date;
}

export interface NavigationContext {
	// State
	mode: NavigationMode;
	selectedContractId: string | null;
	selectedClientId: string | null;
	selectedWeek: string | null;
	selectedNoteId: string | null;
	/** The client whose notes the list shows (`/notes/client/<id>`, sprint 039-CL), else null */
	listClientId: string | null;
	/** The list shows every note (`/notes/all`, sprint 051-UI) */
	isAllNotesView: boolean;
	panel1Collapsed: boolean;
	mobileNavigationLevel: MobileNavigationLevel;

	// Derived state
	isTimeEntriesMode: boolean;
	isNotesMode: boolean;
	isSidebarCollapsed: boolean;
	/** `/`: the phone's sidebar, or this week's timesheet on wider screens */
	isHome: boolean;
	/** `/notes/<contract>/new`: a new-note draft is open */
	isDraftOpen: boolean;
	/** The route being shown (the last workspace route while on settings or admin) */
	route: WorkspaceRoute;
	/** URL of the workspace place to return to from settings and admin */
	workspaceHref: string;
	layoutMode: LayoutMode;
	/** Where the phone's "← Back" goes: an in-app history entry, or one level up */
	backTarget: { path: string; isHistory: boolean };
	/** An in-app history entry is behind / ahead of this one (the top bar's ‹ › buttons, 050-UI) */
	canGoBack: boolean;
	canGoForward: boolean;
	/** The in-app entries Back and Forward go to (null when there is none), for their labels */
	previousPath: string | null;
	nextPath: string | null;

	// Actions
	selectTimeEntries: (options?: { replace?: boolean }) => void;
	selectContract: (contractId: string, clientId: string) => void;
	/** Show one client's notes across its contracts (the client view, sprint 039-CL) */
	selectClient: (clientId: string) => void;
	/** Show every note of every contract, newest first (the sidebar's "Notes" heading, 051-UI) */
	selectAllNotes: () => void;
	selectWeek: (weekStart: string) => void;
	/** Open a note of the current list; in the client view pass the note's contract */
	selectNote: (noteId: string, contractId?: string, options?: { replace?: boolean }) => void;
	/**
	 * Switch to notes mode for the note's contract and open the note in one step. `focusEditor`
	 * asks the editor to take keyboard focus once the note is loaded (following a link, A-11);
	 * `'new-note'` is a note just made to be typed in (Attach note, 049-UI), focused on touch too.
	 */
	openNote: (
		noteId: string,
		contractId: string,
		clientId: string,
		options?: { replace?: boolean; focusEditor?: boolean | 'new-note' }
	) => void;
	/** Once for the note an `openNote(…, { focusEditor })` asked to focus, its `focusEditor`; then false */
	takeEditorFocus: (noteId: string) => boolean | 'new-note';
	/** Open a new-note draft for the selected contract (in the client view: the contract given) */
	openDraft: (contractId?: string) => void;
	clearSelectedNote: () => void;
	/** Show the timesheet on the week holding `date`, scrolled to that day */
	showTimeEntryDay: (date: string) => void;
	/** Changes whenever showTimeEntryDay asks the timesheet to scroll to a day */
	focusDayToken: number;
	/** The day the timesheet should scroll to once (set by showTimeEntryDay), then forgotten */
	takeFocusDay: () => string | null;
	rememberTimesheetScroll: (weekStart: string, position: TimesheetScrollPosition) => void;
	getTimesheetScroll: (weekStart: string) => TimesheetScrollPosition | null;
	toggleSidebar: () => void;
	setLayoutMode: (mode: LayoutMode) => void;
	navigateMobile: (level: MobileNavigationLevel) => void;
	goBackMobile: () => void;
	/** One step back / forward through this tab's in-app history; nothing when there is none */
	goBack: () => void;
	goForward: () => void;
	/** Read the URL after a navigation (afterNavigate); `loadType` is the document load type on enter */
	syncFromUrl: (url: URL, kind: NavigationKind, delta?: number, loadType?: string) => Promise<void> | void;
}

function readJson<T>(storage: Storage | null | undefined, key: string): T | null {
	try {
		const raw = storage?.getItem(key);
		return raw ? (JSON.parse(raw) as T) : null;
	} catch {
		return null;
	}
}

function writeJson(storage: Storage | null | undefined, key: string, value: unknown): void {
	try {
		storage?.setItem(key, JSON.stringify(value));
	} catch {
		// Storage unavailable: the preference lasts for this page only
	}
}

/**
 * Create a navigation state instance. Call once from the root layout and set it in context.
 */
export function createNavigationState(options: NavigationOptions = {}): NavigationContext {
	const now = options.now ?? (() => new Date());
	const adapter = options.adapter ?? null;
	const sessionStore = options.sessionStorage ?? null;
	const localStore = options.localStorage ?? null;

	const initialPath = options.initialUrl?.pathname ?? '/';
	// On settings or admin (even after a full page load) the store keeps the workspace place
	// last shown in this tab, for "Back to app"
	const lastWorkspacePath = readJson<string>(sessionStore, LAST_WORKSPACE_KEY);
	const initialRoute: WorkspaceRoute = parseWorkspacePath(initialPath, currentMonday(now())) ??
		(lastWorkspacePath ? parseWorkspacePath(lastWorkspacePath, currentMonday(now())) : null) ?? { kind: 'home' };

	const state = $state({
		route: initialRoute,
		/** The week the timesheet shows; sticky across mode changes */
		lastWeek: initialRoute.kind === 'time' ? initialRoute.week : currentMonday(now()),
		panel1Collapsed: readJson<boolean>(localStore, SIDEBAR_PREFERENCE_KEY) === true,
		layoutMode: 'desktop' as LayoutMode,
		/** Mirror of the in-app history position, so Back labels update */
		historyVersion: 0,
		/** Bumped by showTimeEntryDay so the timesheet scrolls even when the URL is unchanged */
		focusDayToken: 0
	});

	/** Contract -> client, for contracts the sidebar has not listed (yet) */
	const clientHints: Record<string, string> = {};
	let focusDay: string | null = null;
	/** The note whose editor should take focus when it loads (set by openNote's focusEditor) */
	let editorFocusNoteId: string | null = null;
	let editorFocusKind: true | 'new-note' = true;
	/** True while a deep link gets the app root put under it (its two navigations are not user moves) */
	let isAddingRootEntry = false;
	/** A user move made while the root entry was being added; written once that is done */
	let flushAfterRootEntry = false;
	const timesheetScroll: Record<string, TimesheetScrollPosition> =
		readJson<Record<string, TimesheetScrollPosition>>(sessionStore, TIMESHEET_SCROLL_KEY) ?? {};

	const history = new InAppHistory();
	history.reset(initialPath);

	// --- URL writes: actions set state.route now and flush one navigation per tick ---
	let flushScheduled = false;
	let flushPushes = false;
	/** Path of the navigation the store started and has not seen land yet */
	let pendingPath: string | null = null;
	/** Pathname of the URL last seen (what the address bar shows) */
	let currentPath = initialPath;

	function go(route: WorkspaceRoute, { replace }: { replace: boolean }) {
		if (buildWorkspacePath(route) !== buildWorkspacePath(state.route)) state.route = route;
		if (route.kind === 'time') state.lastWeek = route.week;
		if (!replace) flushPushes = true;
		if (flushScheduled) return;
		flushScheduled = true;
		queueMicrotask(flush);
	}

	function flush() {
		if (isAddingRootEntry) {
			flushAfterRootEntry = true;
			return;
		}
		flushScheduled = false;
		const push = flushPushes;
		flushPushes = false;
		const path = buildWorkspacePath(state.route);
		if (path === currentPath) return;
		pendingPath = path;
		history.apply(push ? { kind: 'push', path } : { kind: 'replace', path });
		history.save(sessionStore);
		state.historyVersion++;
		currentPath = path;
		writeJson(sessionStore, LAST_WORKSPACE_KEY, path);
		void adapter?.navigate(path, { replace: !push });
	}

	async function syncFromUrl(url: URL, kind: NavigationKind, delta?: number, loadType?: string) {
		const path = url.pathname;

		if (kind === 'enter') {
			currentPath = path;
			const restored =
				loadType === 'reload' || loadType === 'back_forward' ? InAppHistory.restore(sessionStore, path) : null;
			if (restored) {
				history.entries = restored.entries;
				history.index = restored.index;
			} else {
				history.reset(path);
			}
			applyUrl(path);
			// Opened straight on a deep link: put the app's root under it, so Back (browser,
			// Android, installed PWA) goes up into the app instead of out of it.
			const route = parseWorkspacePath(path, state.lastWeek);
			if (!restored && route && route.kind !== 'home' && adapter) {
				// Wait for the document load to finish, so this does not cancel the page load itself
				if (typeof document !== 'undefined' && document.readyState !== 'complete') {
					await new Promise((resolve) => window.addEventListener('load', resolve, { once: true }));
				}
				// Only if the user has not moved on meanwhile
				if (currentPath === path && history.entries.length === 1) {
					isAddingRootEntry = true;
					try {
						history.reset('/');
						await adapter.navigate('/', { replace: true });
						// The latest place: a correction made meanwhile (note under its own contract) wins
						const target = buildWorkspacePath(state.route);
						history.apply({ kind: 'push', path: target });
						await adapter.navigate(target, { replace: false });
						currentPath = target;
					} finally {
						isAddingRootEntry = false;
						if (flushAfterRootEntry) {
							flushAfterRootEntry = false;
							flush();
						}
					}
				}
			}
			history.save(sessionStore);
			state.historyVersion++;
			return;
		}

		if (isAddingRootEntry) return;

		if (kind === 'goto' && pendingPath !== null) {
			// A navigation the store started: ignore one that was overtaken by a newer action
			if (path !== pendingPath) return;
			pendingPath = null;
			currentPath = path;
			if (!flushScheduled) applyUrl(path);
			return;
		}

		// Back/Forward, a link, a form, or someone else's goto
		pendingPath = null;
		currentPath = path;
		if (kind === 'popstate') history.apply({ kind: 'pop', path, delta: delta ?? -1 });
		else history.apply({ kind: 'push', path });
		history.save(sessionStore);
		state.historyVersion++;
		if (!flushScheduled) applyUrl(path);
	}

	function applyUrl(path: string) {
		const route = parseWorkspacePath(path, state.lastWeek);
		// Settings, admin and other pages keep the last workspace place for the way back
		if (!route) return;
		writeJson(sessionStore, LAST_WORKSPACE_KEY, path);
		if (route.kind === 'time') state.lastWeek = route.week;
		// Same place: keep the object, so effects that read the route do not re-run for nothing
		if (buildWorkspacePath(route) === buildWorkspacePath(state.route)) return;
		state.route = route;
	}

	// --- Derived state (plain functions over $state: reactive in components, fresh in tests) ---
	const mode = (): NavigationMode => (isNoteListRoute(state.route) ? 'notes' : 'time-entries');
	const selectedContractId = () => (isNoteListRoute(state.route) ? state.route.contractId : null);
	const selectedNoteId = () => (isNoteListRoute(state.route) ? state.route.noteId : null);
	const listClientId = () => (state.route.kind === 'client' ? state.route.clientId : null);
	const clientOfContract = (contractId: string) =>
		contractDirectory.labels[contractId]?.clientId ?? clientHints[contractId] ?? null;
	const selectedClientId = () => {
		const viewedClientId = listClientId();
		if (viewedClientId) return viewedClientId;
		const contractId = selectedContractId();
		if (!contractId) return null;
		return clientOfContract(contractId);
	};

	/**
	 * Where a note of `contractId` opens: inside the client view while it shows that contract's
	 * client (039-CL) or all notes (051-UI), else under its contract.
	 */
	const noteRoute = (contractId: string, noteId: string | null, draft: boolean, clientId?: string): WorkspaceRoute => {
		const route = state.route;
		if (route.kind === 'client' && (clientId || clientOfContract(contractId)) === route.clientId) {
			return { kind: 'client', clientId: route.clientId, contractId, noteId, draft };
		}
		// All notes (051-UI) holds every contract's notes, so a note opened from it stays there
		if (route.kind === 'all') return { kind: 'all', contractId, noteId, draft };
		return { kind: 'notes', contractId, noteId, draft };
	};
	const selectedWeek = () => (state.route.kind === 'time' ? state.route.week : state.lastWeek);
	const backTarget = () => {
		void state.historyVersion;
		const previous = history.previous;
		if (previous) return { path: previous, isHistory: true };
		return { path: buildWorkspacePath(parentRoute(state.route)), isHistory: false };
	};

	// --- Actions ---
	const selectTimeEntries = (actionOptions: { replace?: boolean } = {}) => {
		go({ kind: 'time', week: state.lastWeek }, { replace: actionOptions.replace ?? false });
	};

	const selectContract = (contractId: string, clientId: string) => {
		if (clientId) clientHints[contractId] = clientId;
		go({ kind: 'notes', contractId, noteId: null, draft: false }, { replace: false });
	};

	const selectClient = (clientId: string) => {
		go({ kind: 'client', clientId, contractId: null, noteId: null, draft: false }, { replace: false });
	};

	const selectAllNotes = () => {
		go({ kind: 'all', contractId: null, noteId: null, draft: false }, { replace: false });
	};

	const selectWeek = (weekStart: string) => {
		state.lastWeek = weekStart;
		// Inside the timesheet each week paged is a step (050-UI); elsewhere it only sets the week
		// the timesheet opens on (e.g. selectTimeEntries() then selectWeek() = one navigation)
		if (state.route.kind === 'time' || state.route.kind === 'home') {
			go({ kind: 'time', week: weekStart }, { replace: false });
		}
	};

	const selectNote = (noteId: string, contractId?: string, actionOptions: { replace?: boolean } = {}) => {
		const route = state.route;
		// A draft that was just saved becomes that note in place (Back skips the empty draft)
		const replace = actionOptions.replace ?? (isNoteListRoute(route) && route.draft);
		if (route.kind === 'client' || route.kind === 'all') {
			const noteContractId = contractId ?? route.contractId;
			if (!noteContractId) return;
			go({ ...route, contractId: noteContractId, noteId, draft: false }, { replace });
			return;
		}
		if (route.kind !== 'notes') return;
		go({ kind: 'notes', contractId: route.contractId, noteId, draft: false }, { replace });
	};

	const openNote = (
		noteId: string,
		contractId: string,
		clientId: string,
		actionOptions: { replace?: boolean; focusEditor?: boolean | 'new-note' } = {}
	) => {
		if (clientId) clientHints[contractId] = clientId;
		editorFocusNoteId = actionOptions.focusEditor ? noteId : null;
		editorFocusKind = actionOptions.focusEditor === 'new-note' ? 'new-note' : true;
		go(noteRoute(contractId, noteId, false, clientId), { replace: actionOptions.replace ?? false });
	};

	const openDraft = (contractId?: string) => {
		const route = state.route;
		if (route.kind === 'client' || route.kind === 'all') {
			const draftContractId = contractId ?? route.contractId;
			if (!draftContractId) return;
			go({ ...route, contractId: draftContractId, noteId: null, draft: true }, { replace: route.draft });
			return;
		}
		if (route.kind !== 'notes') return;
		go({ kind: 'notes', contractId: route.contractId, noteId: null, draft: true }, { replace: route.draft });
	};

	const clearSelectedNote = () => {
		const route = state.route;
		if (!isNoteListRoute(route) || (!route.noteId && !route.draft)) return;
		// Closing (or deleting) a note replaces its entry, so Back never reopens it
		go(parentRoute(route), { replace: true });
	};

	const showTimeEntryDay = (date: string) => {
		focusDay = date;
		state.focusDayToken++;
		const week = getMondayOfWeek(date);
		if (state.route.kind === 'time' && state.route.week === week) return;
		// Another week is a step, also from inside the timesheet (Today, a search hit; 050-UI)
		go({ kind: 'time', week }, { replace: false });
	};

	const takeEditorFocus = (noteId: string) => {
		if (editorFocusNoteId !== noteId) return false;
		editorFocusNoteId = null;
		return editorFocusKind;
	};

	const takeFocusDay = () => {
		const day = focusDay;
		focusDay = null;
		return day;
	};

	const rememberTimesheetScroll = (weekStart: string, position: TimesheetScrollPosition) => {
		timesheetScroll[weekStart] = position;
		writeJson(sessionStore, TIMESHEET_SCROLL_KEY, timesheetScroll);
	};

	const getTimesheetScroll = (weekStart: string) => timesheetScroll[weekStart] ?? null;

	const toggleSidebar = () => {
		state.panel1Collapsed = !state.panel1Collapsed;
		writeJson(localStore, SIDEBAR_PREFERENCE_KEY, state.panel1Collapsed);
	};

	const setLayoutMode = (layoutMode: LayoutMode) => {
		state.layoutMode = layoutMode;
	};

	const navigateMobile = (level: MobileNavigationLevel) => {
		if (level === 0) go({ kind: 'home' }, { replace: false });
		else if (level === 1)
			go(
				isNoteListRoute(state.route)
					? parentRoute(state.route).kind === 'home'
						? state.route
						: parentRoute(state.route)
					: { kind: 'time', week: state.lastWeek },
				{ replace: false }
			);
		else openDraft();
	};

	const goBackMobile = () => {
		if (state.route.kind === 'home') return;
		if (history.previous && adapter) {
			moveThroughHistory(-1);
			return;
		}
		// Nothing in the app before this entry: go one level up in place
		go(parentRoute(state.route), { replace: true });
	};

	/** Ask the browser for one step; counted as pending until it lands, so quick presses stay in the app */
	function moveThroughHistory(delta: -1 | 1) {
		if (!adapter) return;
		history.expectMove(delta);
		state.historyVersion++;
		if (delta < 0) adapter.back();
		else adapter.forward();
	}

	const goBack = () => {
		if (history.canGoBack) moveThroughHistory(-1);
	};

	const goForward = () => {
		if (history.canGoForward) moveThroughHistory(1);
	};

	/** Read the in-app history with its version, so components re-render when it moves */
	const readHistory = <T>(read: (inAppHistory: InAppHistory) => T): T => {
		void state.historyVersion;
		return read(history);
	};

	return {
		get mode() {
			return mode();
		},
		get selectedContractId() {
			return selectedContractId();
		},
		get selectedClientId() {
			return selectedClientId();
		},
		get selectedWeek() {
			return selectedWeek();
		},
		get selectedNoteId() {
			return selectedNoteId();
		},
		get listClientId() {
			return listClientId();
		},
		get isAllNotesView() {
			return state.route.kind === 'all';
		},
		get panel1Collapsed() {
			return state.panel1Collapsed;
		},
		get mobileNavigationLevel() {
			return mobileLevelFor(state.route);
		},
		get isTimeEntriesMode() {
			return mode() === 'time-entries';
		},
		get isNotesMode() {
			return mode() === 'notes';
		},
		get isSidebarCollapsed() {
			return state.panel1Collapsed;
		},
		get isHome() {
			return state.route.kind === 'home';
		},
		get isDraftOpen() {
			return isNoteListRoute(state.route) && state.route.draft;
		},
		get route() {
			return state.route;
		},
		get workspaceHref() {
			return buildWorkspacePath(state.route);
		},
		get layoutMode() {
			return state.layoutMode;
		},
		get backTarget() {
			return backTarget();
		},
		get canGoBack() {
			return readHistory((inAppHistory) => inAppHistory.canGoBack);
		},
		get canGoForward() {
			return readHistory((inAppHistory) => inAppHistory.canGoForward);
		},
		get previousPath() {
			return readHistory((inAppHistory) => inAppHistory.previous);
		},
		get nextPath() {
			return readHistory((inAppHistory) => inAppHistory.next);
		},
		get focusDayToken() {
			return state.focusDayToken;
		},

		selectTimeEntries,
		selectContract,
		selectClient,
		selectAllNotes,
		selectWeek,
		selectNote,
		openNote,
		openDraft,
		clearSelectedNote,
		showTimeEntryDay,
		takeFocusDay,
		takeEditorFocus,
		rememberTimesheetScroll,
		getTimesheetScroll,
		toggleSidebar,
		setLayoutMode,
		navigateMobile,
		goBackMobile,
		goBack,
		goForward,
		syncFromUrl
	};
}

/**
 * Set the navigation state in Svelte context.
 * Call this from the root layout after creating the state.
 */
export function setNavigationContext(navigationState: NavigationContext): void {
	setContext(NAVIGATION_CONTEXT_KEY, navigationState);
}

/**
 * Get the navigation state from Svelte context.
 *
 * @throws Error if called outside of a component that has navigation context set
 */
export function getNavigationContext(): NavigationContext {
	const context = getContext<NavigationContext>(NAVIGATION_CONTEXT_KEY);
	if (!context) {
		throw new Error(
			'Navigation context not found. Make sure setNavigationContext() is called in the root layout.'
		);
	}
	return context;
}
