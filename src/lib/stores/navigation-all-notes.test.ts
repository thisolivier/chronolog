/**
 * The all-notes view (sprint 051-UI): `/notes/all`, opened from the sidebar's "Notes" heading.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setup } from './navigation-test-setup';
import { contractDirectory } from './contract-directory.svelte';
import { labelForPath, titleForRoute } from '$lib/components/layout/navigation-labels';

const CONTRACT_A = '11111111-1111-4111-8111-111111111111';
const CONTRACT_B = '22222222-2222-4222-8222-222222222222';
const CLIENT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CLIENT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

beforeEach(() => {
	contractDirectory.replaceAll([
		{ id: CONTRACT_A, name: 'Rocket Build', clientName: 'Acme Corp', clientId: CLIENT_A },
		{ id: CONTRACT_B, name: 'Data Platform', clientName: 'Borealis Labs', clientId: CLIENT_B }
	]);
});

describe('all notes view', () => {
	it('selectAllNotes pushes /notes/all: notes mode, nothing selected, level 1', async () => {
		const { nav, calls, settle } = setup('/time/2026-W45');
		nav.selectAllNotes();
		await settle();
		expect(calls).toEqual([{ path: '/notes/all', replace: false }]);
		expect(nav.isAllNotesView).toBe(true);
		expect(nav.isNotesMode).toBe(true);
		expect(nav.selectedContractId).toBeNull();
		expect(nav.listClientId).toBeNull();
		expect(nav.mobileNavigationLevel).toBe(1);
	});

	it('a note of any contract opens inside the view; closing returns to it', async () => {
		const { nav, calls, settle } = setup('/notes/all');
		nav.selectNote('BORL.1', CONTRACT_B);
		await settle();
		expect(nav.route).toEqual({ kind: 'all', contractId: CONTRACT_B, noteId: 'BORL.1', draft: false });
		expect(nav.selectedClientId).toBe(CLIENT_B);
		nav.openNote('ACME.1', CONTRACT_A, CLIENT_A);
		await settle();
		expect(nav.isAllNotesView).toBe(true);
		nav.clearSelectedNote();
		await settle();
		expect(calls).toEqual([
			{ path: `/notes/all/${CONTRACT_B}/BORL.1`, replace: false },
			{ path: `/notes/all/${CONTRACT_A}/ACME.1`, replace: false },
			{ path: '/notes/all', replace: true }
		]);
	});

	it('New Note in the view needs a contract and opens the draft inside it', async () => {
		const { nav, settle } = setup('/notes/all');
		nav.openDraft();
		expect(nav.isDraftOpen).toBe(false);
		nav.openDraft(CONTRACT_A);
		await settle();
		expect(nav.workspaceHref).toBe(`/notes/all/${CONTRACT_A}/new`);
	});

	it('is labelled "All notes" for Back / Forward and the phone title', () => {
		expect(labelForPath('/notes/all', '2026-11-02')).toBe('All notes');
		expect(titleForRoute({ kind: 'all', contractId: null, noteId: null, draft: false })).toBe('All notes');
	});
});
