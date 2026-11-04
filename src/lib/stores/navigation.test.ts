/**
 * Navigation store: one test group per rule in docs/ux/09-navigation-state.md (sprint 027-CL).
 * A fake adapter records the URLs the store writes; `land()` plays the afterNavigate that
 * SvelteKit would fire once a navigation completes.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createNavigationState, type NavigationContext } from './navigation.svelte';
import { contractDirectory } from './contract-directory.svelte';

const CONTRACT_A = '11111111-1111-4111-8111-111111111111';
const CONTRACT_B = '22222222-2222-4222-8222-222222222222';
const CLIENT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CLIENT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
// Wednesday 4 November 2026 -> ISO week 45, Monday 2 November
const NOW = () => new Date(2026, 10, 4, 10, 0, 0);

type Call = { path: string; replace: boolean };

class MemoryStorage {
	private values = new Map<string, string>();
	get length() {
		return this.values.size;
	}
	clear() {
		this.values.clear();
	}
	getItem(key: string) {
		return this.values.get(key) ?? null;
	}
	key(index: number) {
		return [...this.values.keys()][index] ?? null;
	}
	removeItem(key: string) {
		this.values.delete(key);
	}
	setItem(key: string, value: string) {
		this.values.set(key, value);
	}
}

function setup(startPath = '/', storage = new MemoryStorage()) {
	const calls: Call[] = [];
	let backCalls = 0;
	const nav = createNavigationState({
		initialUrl: new URL('http://app' + startPath),
		adapter: {
			navigate: (path, { replace }) => {
				calls.push({ path, replace });
			},
			back: () => {
				backCalls++;
			}
		},
		sessionStorage: storage as unknown as Storage,
		localStorage: storage as unknown as Storage,
		now: NOW
	});
	/** Let the store flush (one microtask) and then report the navigation landing */
	async function settle() {
		await Promise.resolve();
		const last = calls.at(-1);
		if (last) await nav.syncFromUrl(new URL('http://app' + last.path), 'goto');
	}
	return { nav, calls, settle, backCount: () => backCalls, storage };
}

async function enter(nav: NavigationContext, path: string, loadType = 'reload') {
	await nav.syncFromUrl(new URL('http://app' + path), 'enter', undefined, loadType);
}

beforeEach(() => {
	contractDirectory.replaceAll([
		{ id: CONTRACT_A, name: 'Rocket Build', clientName: 'Acme Corp', clientId: CLIENT_A },
		{ id: CONTRACT_B, name: 'Data Platform', clientName: 'Borealis Labs', clientId: CLIENT_B }
	]);
});

describe('rule 2: the URL is the state', () => {
	it('reads every workspace URL on load', () => {
		expect(setup('/').nav.isHome).toBe(true);
		const time = setup('/time/2026-W44').nav;
		expect(time.mode).toBe('time-entries');
		expect(time.selectedWeek).toBe('2026-10-26');
		const list = setup(`/notes/${CONTRACT_A}`).nav;
		expect(list.mode).toBe('notes');
		expect(list.selectedContractId).toBe(CONTRACT_A);
		expect(list.selectedNoteId).toBeNull();
		const note = setup(`/notes/${CONTRACT_A}/ACME.20261103.005`).nav;
		expect(note.selectedNoteId).toBe('ACME.20261103.005');
		expect(note.selectedClientId).toBe(CLIENT_A);
		const draft = setup(`/notes/${CONTRACT_A}/new`).nav;
		expect(draft.isDraftOpen).toBe(true);
		expect(draft.selectedNoteId).toBeNull();
	});

	it('home shows this week; /time without a week too', () => {
		expect(setup('/').nav.selectedWeek).toBe('2026-11-02');
		expect(setup('/time').nav.selectedWeek).toBe('2026-11-02');
	});

	it('pushes mode, contract and note changes', async () => {
		const { nav, calls, settle } = setup('/time/2026-W45');
		nav.selectContract(CONTRACT_A, CLIENT_A);
		await settle();
		nav.selectNote('ACME.1');
		await settle();
		nav.selectTimeEntries();
		await settle();
		expect(calls).toEqual([
			{ path: `/notes/${CONTRACT_A}`, replace: false },
			{ path: `/notes/${CONTRACT_A}/ACME.1`, replace: false },
			{ path: '/time/2026-W45', replace: false }
		]);
	});

	it('replaces the entry for week changes inside the timesheet', async () => {
		const { nav, calls, settle } = setup('/time/2026-W45');
		nav.selectWeek('2026-10-26');
		await settle();
		expect(calls).toEqual([{ path: '/time/2026-W44', replace: true }]);
		expect(nav.selectedWeek).toBe('2026-10-26');
	});

	it('updates state at once, before the navigation lands', () => {
		const { nav } = setup('/');
		nav.openNote('BORL.1', CONTRACT_B, CLIENT_B);
		expect(nav.selectedContractId).toBe(CONTRACT_B);
		expect(nav.selectedNoteId).toBe('BORL.1');
	});

	it('makes one navigation of several actions in the same tick', async () => {
		const { nav, calls, settle } = setup(`/notes/${CONTRACT_A}/ACME.1`);
		nav.selectTimeEntries();
		nav.selectWeek('2026-10-19');
		await settle();
		expect(calls).toEqual([{ path: '/time/2026-W43', replace: false }]);
	});

	it('follows Back and Forward (popstate) to whatever the URL says', async () => {
		const { nav } = setup('/time/2026-W45');
		await nav.syncFromUrl(new URL(`http://app/notes/${CONTRACT_B}/BORL.2`), 'popstate', -1);
		expect(nav.selectedNoteId).toBe('BORL.2');
		expect(nav.selectedContractId).toBe(CONTRACT_B);
	});

	it('ignores a landing that a newer action already overtook', async () => {
		const { nav, calls } = setup('/time/2026-W45');
		nav.selectContract(CONTRACT_A, CLIENT_A);
		await Promise.resolve();
		nav.selectContract(CONTRACT_B, CLIENT_B);
		await Promise.resolve();
		await nav.syncFromUrl(new URL('http://app' + calls[0].path), 'goto');
		expect(nav.selectedContractId).toBe(CONTRACT_B);
	});

	it('keeps the workspace place while on settings and offers it as the way back', async () => {
		const { nav } = setup(`/notes/${CONTRACT_A}/ACME.1`);
		await nav.syncFromUrl(new URL('http://app/settings'), 'link');
		expect(nav.selectedNoteId).toBe('ACME.1');
		expect(nav.workspaceHref).toBe(`/notes/${CONTRACT_A}/ACME.1`);
	});

	it('a full page load of settings still knows the workspace place of this tab', async () => {
		const storage = new MemoryStorage();
		const first = setup('/', storage);
		first.nav.openNote('ACME.1', CONTRACT_A, CLIENT_A);
		await first.settle();
		const onSettings = setup('/settings/two-factor', storage).nav;
		expect(onSettings.workspaceHref).toBe(`/notes/${CONTRACT_A}/ACME.1`);
	});

	it('does not navigate when the URL would not change', async () => {
		const { nav, calls, settle } = setup(`/notes/${CONTRACT_A}`);
		nav.selectContract(CONTRACT_A, CLIENT_A);
		await settle();
		expect(calls).toEqual([]);
	});
});

describe('rule 1: an open note sits under its own contract', () => {
	it('openNote sets contract, client and note together', () => {
		const { nav } = setup(`/notes/${CONTRACT_A}`);
		nav.openNote('BORL.1', CONTRACT_B, CLIENT_B);
		expect(nav.selectedContractId).toBe(CONTRACT_B);
		expect(nav.selectedClientId).toBe(CLIENT_B);
	});

	it('a wrong contract in the URL is corrected in place (replace)', async () => {
		const { nav, calls, settle } = setup(`/notes/${CONTRACT_A}/BORL.1`);
		nav.openNote('BORL.1', CONTRACT_B, '', { replace: true });
		await settle();
		expect(calls).toEqual([{ path: `/notes/${CONTRACT_B}/BORL.1`, replace: true }]);
		expect(nav.selectedClientId).toBe(CLIENT_B);
	});

	it('selecting a contract closes the note', () => {
		const { nav } = setup(`/notes/${CONTRACT_A}/ACME.1`);
		nav.selectContract(CONTRACT_B, CLIENT_B);
		expect(nav.selectedNoteId).toBeNull();
	});
});

describe('focus follows a followed link (A-11)', () => {
	it('openNote with focusEditor asks that note, once, to take focus', () => {
		const { nav } = setup('/time/2026-W45');
		nav.openNote('ACME.1', CONTRACT_A, CLIENT_A, { focusEditor: true });
		expect(nav.takeEditorFocus('BORL.1')).toBe(false);
		expect(nav.takeEditorFocus('ACME.1')).toBe(true);
		expect(nav.takeEditorFocus('ACME.1')).toBe(false);
	});

	it('a plain openNote cancels an earlier focus request', () => {
		const { nav } = setup('/time/2026-W45');
		nav.openNote('ACME.1', CONTRACT_A, CLIENT_A, { focusEditor: true });
		nav.openNote('ACME.1', CONTRACT_A, CLIENT_A);
		expect(nav.takeEditorFocus('ACME.1')).toBe(false);
	});
});

describe('rule 5: the week is sticky across modes', () => {
	it('returns to the week you left', async () => {
		const { nav, settle } = setup('/time/2026-W44');
		nav.selectContract(CONTRACT_A, CLIENT_A);
		await settle();
		expect(nav.selectedWeek).toBe('2026-10-26');
		nav.selectTimeEntries();
		await settle();
		expect(nav.selectedWeek).toBe('2026-10-26');
	});
});

describe('rule 6: the view follows saved items', () => {
	it('showTimeEntryDay opens the week of the entry and asks for that day', async () => {
		const { nav, calls, settle } = setup(`/notes/${CONTRACT_A}/ACME.1`);
		const tokenBefore = nav.focusDayToken;
		nav.showTimeEntryDay('2026-10-21');
		await settle();
		expect(calls).toEqual([{ path: '/time/2026-W43', replace: false }]);
		expect(nav.focusDayToken).toBe(tokenBefore + 1);
		expect(nav.takeFocusDay()).toBe('2026-10-21');
		expect(nav.takeFocusDay()).toBeNull();
	});

	it('on the same week it only asks for the day', async () => {
		const { nav, calls, settle } = setup('/time/2026-W45');
		nav.showTimeEntryDay('2026-11-03');
		await settle();
		expect(calls).toEqual([]);
		expect(nav.takeFocusDay()).toBe('2026-11-03');
	});
});

describe('rule 7: returning restores the timesheet position', () => {
	it('remembers a position per week, across a reload of the store', () => {
		const storage = new MemoryStorage();
		const first = setup('/time/2026-W44', storage).nav;
		first.rememberTimesheetScroll('2026-10-26', { scrollTop: 325, topDay: '2026-10-28', offsetWithinDay: 12 });
		const second = setup('/time/2026-W44', storage).nav;
		expect(second.getTimesheetScroll('2026-10-26')).toEqual({
			scrollTop: 325,
			topDay: '2026-10-28',
			offsetWithinDay: 12
		});
		expect(second.getTimesheetScroll('2026-10-19')).toBeNull();
	});
});

describe('rule 9: destructive actions only act on what is visible', () => {
	it('closing or deleting a note replaces its entry so Back cannot reopen it', async () => {
		const { nav, calls, settle } = setup(`/notes/${CONTRACT_A}/ACME.1`);
		nav.clearSelectedNote();
		await settle();
		expect(calls).toEqual([{ path: `/notes/${CONTRACT_A}`, replace: true }]);
	});

	it('the list only has a note selected while that note is in its contract', () => {
		const { nav } = setup(`/notes/${CONTRACT_A}/ACME.1`);
		nav.openNote('BORL.1', CONTRACT_B, CLIENT_B);
		expect(nav.selectedContractId).toBe(CONTRACT_B);
	});
});

describe('drafts', () => {
	it('New Note pushes a draft URL; saving it replaces the draft with the note', async () => {
		const { nav, calls, settle } = setup(`/notes/${CONTRACT_A}`);
		nav.openDraft();
		await settle();
		nav.selectNote('ACME.9');
		await settle();
		expect(calls).toEqual([
			{ path: `/notes/${CONTRACT_A}/new`, replace: false },
			{ path: `/notes/${CONTRACT_A}/ACME.9`, replace: true }
		]);
	});
});

describe('phone levels and Back (rules 2 and 4)', () => {
	it('derives the level from the route', () => {
		expect(setup('/').nav.mobileNavigationLevel).toBe(0);
		expect(setup('/time/2026-W45').nav.mobileNavigationLevel).toBe(1);
		expect(setup(`/notes/${CONTRACT_A}`).nav.mobileNavigationLevel).toBe(1);
		expect(setup(`/notes/${CONTRACT_A}/ACME.1`).nav.mobileNavigationLevel).toBe(2);
		expect(setup(`/notes/${CONTRACT_A}/new`).nav.mobileNavigationLevel).toBe(2);
	});

	it('Back walks history: a note opened from the timesheet returns to the timesheet', async () => {
		const { nav, settle, backCount } = setup('/');
		await enter(nav, '/', 'navigate');
		nav.selectTimeEntries();
		await settle();
		nav.openNote('ACME.1', CONTRACT_A, CLIENT_A);
		await settle();
		expect(nav.backTarget).toEqual({ path: '/time/2026-W45', isHistory: true });
		nav.goBackMobile();
		expect(backCount()).toBe(1);
	});

	it('with nothing in the app before, Back goes one level up in place', async () => {
		const { nav, calls, settle, backCount } = setup(`/notes/${CONTRACT_A}/ACME.1`);
		expect(nav.backTarget).toEqual({ path: `/notes/${CONTRACT_A}`, isHistory: false });
		nav.goBackMobile();
		await settle();
		expect(backCount()).toBe(0);
		expect(calls).toEqual([{ path: `/notes/${CONTRACT_A}`, replace: true }]);
		nav.goBackMobile();
		await settle();
		expect(calls.at(-1)).toEqual({ path: '/', replace: true });
		expect(nav.mobileNavigationLevel).toBe(0);
	});

	it('a deep link opened fresh gets the app root put under it', async () => {
		const { nav, calls } = setup(`/notes/${CONTRACT_A}/ACME.1`);
		await enter(nav, `/notes/${CONTRACT_A}/ACME.1`, 'navigate');
		expect(calls).toEqual([
			{ path: '/', replace: true },
			{ path: `/notes/${CONTRACT_A}/ACME.1`, replace: false }
		]);
		expect(nav.backTarget).toEqual({ path: '/', isHistory: true });
		expect(nav.selectedNoteId).toBe('ACME.1');
	});

	it('a reload keeps the recorded history and does not add another root', async () => {
		const storage = new MemoryStorage();
		const first = setup('/', storage);
		await enter(first.nav, '/', 'navigate');
		first.nav.selectTimeEntries();
		await first.settle();
		const second = setup('/time/2026-W45', storage);
		await enter(second.nav, '/time/2026-W45', 'reload');
		expect(second.calls).toEqual([]);
		expect(second.nav.backTarget).toEqual({ path: '/', isHistory: true });
	});

	it('the timer pill (level 0) goes home', async () => {
		const { nav, calls, settle } = setup(`/notes/${CONTRACT_A}/ACME.1`);
		nav.navigateMobile(0);
		await settle();
		expect(calls).toEqual([{ path: '/', replace: false }]);
	});
});

describe('sidebar preference', () => {
	it('the collapsed sidebar survives a reload', () => {
		const storage = new MemoryStorage();
		setup('/', storage).nav.toggleSidebar();
		expect(setup('/', storage).nav.panel1Collapsed).toBe(true);
	});
});
