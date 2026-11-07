import { describe, expect, it } from 'vitest';
import { isNavigationHidden, noteContextOwnership } from './note-context-ownership';

describe('noteContextOwnership (NT-01)', () => {
	it('three columns, one contract: the sidebar owns it, the list says Notes, the editor shows the mark only', () => {
		expect(noteContextOwnership({ layoutMode: 'desktop', sidebarCollapsed: false, scope: 'contract' })).toEqual({
			navigationHidden: false,
			listHeader: 'notes',
			rowContext: 'none',
			rowMark: false,
			editorContextVisible: false
		});
	});

	it('navigation hidden on desktop: the list header names the client and contract again', () => {
		const ownership = noteContextOwnership({ layoutMode: 'desktop', sidebarCollapsed: true, scope: 'contract' });
		expect(ownership.listHeader).toBe('contract');
		expect(ownership.rowContext).toBe('none');
		expect(ownership.editorContextVisible).toBe(false);
	});

	it('tablet (overlay sidebar) counts as hidden navigation whatever the desktop preference', () => {
		expect(noteContextOwnership({ layoutMode: 'tablet', sidebarCollapsed: false, scope: 'contract' }).listHeader).toBe('contract');
	});

	it('phone: the list names its contract and the single-column editor names its own', () => {
		const ownership = noteContextOwnership({ layoutMode: 'mobile', sidebarCollapsed: false, scope: 'contract' });
		expect(ownership.listHeader).toBe('contract');
		expect(ownership.editorContextVisible).toBe(true);
	});

	it("a client's notes: the header names the client, rows name their contract with a mark", () => {
		for (const sidebarCollapsed of [false, true]) {
			const ownership = noteContextOwnership({ layoutMode: 'desktop', sidebarCollapsed, scope: 'client' });
			expect(ownership.listHeader).toBe('client');
			expect(ownership.rowContext).toBe('contract');
			expect(ownership.rowMark).toBe(true);
		}
	});

	it('all notes: the header says All notes, rows name client and contract with a mark', () => {
		const ownership = noteContextOwnership({ layoutMode: 'desktop', sidebarCollapsed: false, scope: 'all' });
		expect(ownership.listHeader).toBe('all');
		expect(ownership.rowContext).toBe('client-and-contract');
		expect(ownership.rowMark).toBe(true);
	});

	it('isNavigationHidden follows the layout and the collapse preference', () => {
		expect(isNavigationHidden('desktop', false)).toBe(false);
		expect(isNavigationHidden('desktop', true)).toBe(true);
		expect(isNavigationHidden('tablet', false)).toBe(true);
		expect(isNavigationHidden('mobile', false)).toBe(true);
	});
});
