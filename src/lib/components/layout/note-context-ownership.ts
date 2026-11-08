/**
 * Who names the client and contract in the notes workspace (design r1 NT-01, sprint 054-DR).
 *
 * The sidebar, the note list header and the note editor header used to repeat the same
 * "Client / Contract" three times. The rule here gives each layout one readable owner:
 *
 * - three columns, one contract selected: the sidebar owns it; the list says Notes and the count;
 *   the editor shows the contract mark, the note code, the save state and the actions;
 * - navigation hidden (desktop sidebar collapsed, tablet overlay closed, phone): the list header
 *   names the client and contract again. "Hidden" is the shell's own record of what it presents
 *   (`shellPresentation.sidebarOnScreen`, written by AppShell), so the timer reflection and the
 *   notes headers follow one rule;
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
	/** The navigation sidebar is on screen (`shellPresentation.sidebarOnScreen`, written by AppShell) */
	sidebarOnScreen: boolean;
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

/**
 * The sidebar is beside the list only when the shell has it on screen. A phone never shows the
 * sidebar beside a list or note (its sidebar is its own screen), whatever the shell reports.
 */
export function isNavigationHidden(layoutMode: LayoutMode, sidebarOnScreen: boolean): boolean {
	if (layoutMode === 'mobile') return true;
	return !sidebarOnScreen;
}

export function noteContextOwnership({ layoutMode, sidebarOnScreen, scope }: NoteContextInput): NoteContextOwnership {
	const navigationHidden = isNavigationHidden(layoutMode, sidebarOnScreen);
	const spansContracts = scope !== 'contract';
	return {
		navigationHidden,
		listHeader: scope === 'contract' ? (navigationHidden ? 'contract' : 'notes') : scope,
		rowContext: scope === 'all' ? 'client-and-contract' : scope === 'client' ? 'contract' : 'none',
		rowMark: spansContracts,
		editorContextVisible: layoutMode === 'mobile'
	};
}

/**
 * The phone title bar names the screen only when no header on it does (sprint 060-DR; checkpoint A
 * known issue 1). On a phone the notes list header names its scope (`listHeader` is never `notes`)
 * and the editor header shows its client and contract, so a notes screen leaves the title out
 * instead of repeating "Client · Contract" above them; the week and home keep theirs.
 */
export function phoneTitleBarNamesContext(routeKind: 'home' | 'time' | 'notes' | 'client' | 'all'): boolean {
	if (routeKind === 'home' || routeKind === 'time') return true;
	const scope: NoteListScope = routeKind === 'notes' ? 'contract' : routeKind;
	const ownership = noteContextOwnership({ layoutMode: 'mobile', sidebarOnScreen: false, scope });
	return ownership.listHeader === 'notes' && !ownership.editorContextVisible;
}
