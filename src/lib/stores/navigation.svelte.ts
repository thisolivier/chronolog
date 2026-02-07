/**
 * Navigation state management for the three-panel Apple Notes-inspired layout.
 *
 * This module uses Svelte 5's runes ($state and $derived) with a context-based
 * pattern for app-wide navigation state.
 *
 * Usage:
 * - In root layout: call setNavigationContext(createNavigationState())
 * - In any component: call getNavigationContext() to access the state
 */

import { getContext, setContext } from 'svelte';
import { getMondayOfWeek } from '$lib/utils/iso-week';

const NAVIGATION_CONTEXT_KEY = Symbol('navigation');

export type NavigationMode = 'time-entries' | 'notes';
export type MobileNavigationLevel = 0 | 1 | 2;

export interface NavigationState {
	/** Current mode: determines what Panel 2 and Panel 3 show */
	mode: NavigationMode;
	/** Selected contract ID (when in notes mode) */
	selectedContractId: string | null;
	/** Selected client ID (the client owning the selected contract) */
	selectedClientId: string | null;
	/** ISO date string of the Monday (YYYY-MM-DD) for the week being viewed */
	selectedWeek: string | null;
	/** Selected note ID (when viewing/editing a specific note in Panel 3) */
	selectedNoteId: string | null;
	/** Whether Panel 1 (sidebar) is collapsed */
	panel1Collapsed: boolean;
	/** Mobile navigation level (0=contracts, 1=list, 2=content) */
	mobileNavigationLevel: MobileNavigationLevel;
}

export interface NavigationContext {
	// State
	mode: NavigationMode;
	selectedContractId: string | null;
	selectedClientId: string | null;
	selectedWeek: string | null;
	selectedNoteId: string | null;
	panel1Collapsed: boolean;
	mobileNavigationLevel: MobileNavigationLevel;

	// Derived state
	isTimeEntriesMode: boolean;
	isNotesMode: boolean;
	isSidebarCollapsed: boolean;

	// Actions
	selectTimeEntries: () => void;
	selectContract: (contractId: string, clientId: string) => void;
	selectWeek: (weekStart: string) => void;
	selectNote: (noteId: string) => void;
	clearSelectedNote: () => void;
	toggleSidebar: () => void;
	navigateMobile: (level: MobileNavigationLevel) => void;
	goBackMobile: () => void;
}

/**
 * Create a new navigation state instance.
 * Call this once from the root layout and set it in context.
 */
export function createNavigationState(): NavigationContext {
	// Get the current week's Monday as the initial selected week
	const today = new Date();
	const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
	const currentWeekMonday = getMondayOfWeek(todayString);

	// Initialize state
	const state = $state<NavigationState>({
		mode: 'time-entries',
		selectedContractId: null,
		selectedClientId: null,
		selectedWeek: currentWeekMonday,
		selectedNoteId: null,
		panel1Collapsed: false,
		mobileNavigationLevel: 0
	});

	// Derived state
	const isTimeEntriesMode = $derived(state.mode === 'time-entries');
	const isNotesMode = $derived(state.mode === 'notes');
	const isSidebarCollapsed = $derived(state.panel1Collapsed);

	// Actions
	const selectTimeEntries = () => {
		state.mode = 'time-entries';
		state.selectedContractId = null;
		state.selectedClientId = null;
		state.selectedNoteId = null;
		// Auto-advance to panel 2 on mobile
		state.mobileNavigationLevel = 1;
	};

	const selectContract = (contractId: string, clientId: string) => {
		state.mode = 'notes';
		state.selectedContractId = contractId;
		state.selectedClientId = clientId;
		state.selectedNoteId = null; // Clear note selection when switching contracts
		// Auto-advance to panel 2 on mobile
		state.mobileNavigationLevel = 1;
	};

	const selectWeek = (weekStart: string) => {
		state.selectedWeek = weekStart;
		// Auto-advance to panel 3 on mobile
		state.mobileNavigationLevel = 2;
	};

	const selectNote = (noteId: string) => {
		state.selectedNoteId = noteId;
		// Auto-advance to panel 3 on mobile
		state.mobileNavigationLevel = 2;
	};

	const clearSelectedNote = () => {
		state.selectedNoteId = null;
	};

	const toggleSidebar = () => {
		state.panel1Collapsed = !state.panel1Collapsed;
	};

	const navigateMobile = (level: MobileNavigationLevel) => {
		state.mobileNavigationLevel = level;
	};

	const goBackMobile = () => {
		if (state.mobileNavigationLevel > 0) {
			state.mobileNavigationLevel = (state.mobileNavigationLevel - 1) as MobileNavigationLevel;
		}
	};

	return {
		// State (reactive access)
		get mode() {
			return state.mode;
		},
		get selectedContractId() {
			return state.selectedContractId;
		},
		get selectedClientId() {
			return state.selectedClientId;
		},
		get selectedWeek() {
			return state.selectedWeek;
		},
		get selectedNoteId() {
			return state.selectedNoteId;
		},
		get panel1Collapsed() {
			return state.panel1Collapsed;
		},
		get mobileNavigationLevel() {
			return state.mobileNavigationLevel;
		},

		// Derived state
		get isTimeEntriesMode() {
			return isTimeEntriesMode;
		},
		get isNotesMode() {
			return isNotesMode;
		},
		get isSidebarCollapsed() {
			return isSidebarCollapsed;
		},

		// Actions
		selectTimeEntries,
		selectContract,
		selectWeek,
		selectNote,
		clearSelectedNote,
		toggleSidebar,
		navigateMobile,
		goBackMobile
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
 * Call this from any component that needs access to navigation state.
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
