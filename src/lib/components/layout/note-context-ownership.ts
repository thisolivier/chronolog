/**
 * Who names the client and contract in the notes workspace (design r1 NT-01, sprint 054-DR).
 *
 * The sidebar, the note list header and the note editor header used to repeat the same
 * "Client / Contract" three times. The rule here gives each layout one readable owner:
 *
 * - three columns, one contract selected: the sidebar owns it; the list says Notes and the count;
 *   the editor shows the contract mark, the note code, the save state and the actions;
 * - navigation hidden (desktop sidebar collapsed, tablet overlay, phone): the list header names
 *   the client and contract again;
 * - single-column note (phone): the editor header names its own client and contract;
 * - a list spanning contracts (a client's notes, all notes): the header names the scope and each
 *   row names its contract (with its mark); a single-contract list omits the repeated contract text.
 *
 * Pure, so it is unit tested (note-context-ownership.test.ts) without a DOM.
 */
import type { LayoutMode } from '$lib/stores/navigation.svelte';

export type NoteListScope = 'contract' | 'client' | 'all';

export interface NoteContextInput {
	layoutMode: LayoutMode;
	/** The desktop preference "sidebar collapsed" (`navigation.panel1Collapsed`) */
	sidebarCollapsed: boolean;
	scope: NoteListScope;
}

export interface NoteContextOwnership {
	/** The navigation sidebar is not on screen beside the list */
	navigationHidden: boolean;
	/**
	 * What the list header names: `notes` (Notes + count only), `contract` (client and contract),
	 * `client` (the client's name, all its contracts) or `all` (All notes)
	 */
	listHeader: 'notes' | 'contract' | 'client' | 'all';
	/** What each row names besides title, date and excerpt */
	rowContext: 'none' | 'contract' | 'client-and-contract';
	/** Rows carry the contract mark (lists spanning contracts) */
	rowMark: boolean;
	/** The editor header shows "Client / Contract" as visible text (otherwise screen readers only) */
	editorContextVisible: boolean;
}

/** The sidebar is beside the list only on desktop with the sidebar expanded */
export function isNavigationHidden(layoutMode: LayoutMode, sidebarCollapsed: boolean): boolean {
	if (layoutMode === 'mobile') return true;
	// Tablet notes mode: the sidebar is an overlay, closed while the list and editor are in use
	if (layoutMode === 'tablet') return true;
	return sidebarCollapsed;
}

export function noteContextOwnership({ layoutMode, sidebarCollapsed, scope }: NoteContextInput): NoteContextOwnership {
	const navigationHidden = isNavigationHidden(layoutMode, sidebarCollapsed);
	const spansContracts = scope !== 'contract';
	return {
		navigationHidden,
		listHeader: scope === 'contract' ? (navigationHidden ? 'contract' : 'notes') : scope,
		rowContext: scope === 'all' ? 'client-and-contract' : scope === 'client' ? 'contract' : 'none',
		rowMark: spansContracts,
		editorContextVisible: layoutMode === 'mobile'
	};
}
