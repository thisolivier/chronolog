import { describe, expect, it } from 'vitest';
import { isNavigationHidden, noteContextOwnership, phoneTitleBarNamesContext } from './note-context-ownership';

describe('noteContextOwnership (NT-01)', () => {
	it('three columns, one contract: the sidebar owns it, the list says Notes, the editor shows the mark only', () => {
		expect(noteContextOwnership({ layoutMode: 'desktop', sidebarOnScreen: true, scope: 'contract' })).toEqual({
			navigationHidden: false,
			listHeader: 'notes',
			rowContext: 'none',
			rowMark: false,
			editorContextVisible: false
		});
	});

	it('navigation hidden on desktop: the list header names the client and contract again', () => {
		const ownership = noteContextOwnership({ layoutMode: 'desktop', sidebarOnScreen: false, scope: 'contract' });
		expect(ownership.listHeader).toBe('contract');
		expect(ownership.rowContext).toBe('none');
		expect(ownership.editorContextVisible).toBe(false);
	});

	it('tablet: the closed overlay counts as hidden navigation; the open overlay names the contract itself', () => {
		expect(noteContextOwnership({ layoutMode: 'tablet', sidebarOnScreen: false, scope: 'contract' }).listHeader).toBe('contract');
		expect(noteContextOwnership({ layoutMode: 'tablet', sidebarOnScreen: true, scope: 'contract' }).listHeader).toBe('notes');
	});

	it('phone: the list names its contract and the single-column editor names its own', () => {
		const ownership = noteContextOwnership({ layoutMode: 'mobile', sidebarOnScreen: true, scope: 'contract' });
		expect(ownership.listHeader).toBe('contract');
		expect(ownership.editorContextVisible).toBe(true);
	});

	it("a client's notes: the header names the client, rows name their contract with a mark", () => {
		for (const sidebarOnScreen of [true, false]) {
			const ownership = noteContextOwnership({ layoutMode: 'desktop', sidebarOnScreen, scope: 'client' });
			expect(ownership.listHeader).toBe('client');
			expect(ownership.rowContext).toBe('contract');
			expect(ownership.rowMark).toBe(true);
		}
	});

	it('all notes: the header says All notes, rows name client and contract with a mark', () => {
		const ownership = noteContextOwnership({ layoutMode: 'desktop', sidebarOnScreen: true, scope: 'all' });
		expect(ownership.listHeader).toBe('all');
		expect(ownership.rowContext).toBe('client-and-contract');
		expect(ownership.rowMark).toBe(true);
	});

	it('isNavigationHidden follows what the shell has on screen; a phone is always hidden', () => {
		expect(isNavigationHidden('desktop', true)).toBe(false);
		expect(isNavigationHidden('desktop', false)).toBe(true);
		expect(isNavigationHidden('tablet', false)).toBe(true);
		expect(isNavigationHidden('mobile', true)).toBe(true);
	});
});

describe('phoneTitleBarNamesContext (060-DR)', () => {
	it('leaves the title out on notes screens, whose headers name the context', () => {
		expect(phoneTitleBarNamesContext('notes')).toBe(false);
		expect(phoneTitleBarNamesContext('client')).toBe(false);
		expect(phoneTitleBarNamesContext('all')).toBe(false);
	});

	it('keeps it on the week and home', () => {
		expect(phoneTitleBarNamesContext('time')).toBe(true);
		expect(phoneTitleBarNamesContext('home')).toBe(true);
	});
});
