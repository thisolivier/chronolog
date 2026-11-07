/**
 * Sprint 050-UI: what is a step (push) and what is not (replace), and Back / Forward through
 * this tab's in-app history (`canGoBack`, `canGoForward`, `previousPath`, `nextPath`, `goBack`,
 * `goForward`). Back and Forward are played as the popstate SvelteKit reports once they land.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { contractDirectory } from './contract-directory.svelte';
import { enter, setup } from './navigation-test-setup';

const CONTRACT_A = '11111111-1111-4111-8111-111111111111';
const CLIENT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

beforeEach(() => {
	contractDirectory.replaceAll([{ id: CONTRACT_A, name: 'Rocket Build', clientName: 'Acme Corp', clientId: CLIENT_A }]);
});

const pop = (path: string, delta: number) => [new URL('http://app' + path), 'popstate', delta] as const;

describe('every navigation is a step', () => {
	it('pages weeks, opens a note, a contract and a client: one push each', async () => {
		const { nav, calls, settle } = setup('/time/2026-W45');
		nav.selectWeek('2026-10-26');
		await settle();
		nav.selectWeek('2026-10-19');
		await settle();
		nav.openNote('ACME.1', CONTRACT_A, CLIENT_A);
		await settle();
		nav.selectContract(CONTRACT_A, CLIENT_A);
		await settle();
		nav.selectClient(CLIENT_A);
		await settle();
		expect(calls.map((call) => call.replace)).toEqual([false, false, false, false, false]);
		expect(calls.map((call) => call.path)).toEqual([
			'/time/2026-W44',
			'/time/2026-W43',
			`/notes/${CONTRACT_A}/ACME.1`,
			`/notes/${CONTRACT_A}`,
			`/notes/client/${CLIENT_A}`
		]);
	});

	it('Today (or a search hit) on another week from inside the timesheet is a step', async () => {
		const { nav, calls, settle } = setup('/time/2026-W43');
		nav.showTimeEntryDay('2026-11-04');
		await settle();
		expect(calls).toEqual([{ path: '/time/2026-W45', replace: false }]);
	});

	it('a note getting its real ID replaces its entry (autosave is not a step)', async () => {
		const { nav, calls, settle } = setup(`/notes/${CONTRACT_A}/local-123`);
		nav.selectNote('ACME.7', CONTRACT_A, { replace: true });
		await settle();
		expect(calls).toEqual([{ path: `/notes/${CONTRACT_A}/ACME.7`, replace: true }]);
	});
});

describe('Back and Forward through the journey', () => {
	it('walks timesheet -> week back x2 -> note -> contract -> client in reverse and replays it', async () => {
		// The first entry this tab knows (no enter(): a deep link would get the root put under it)
		const { nav, settle, backCount, forwardCount } = setup('/time/2026-W45');
		expect(nav.canGoBack).toBe(false);
		expect(nav.canGoForward).toBe(false);
		nav.goBack();
		expect(backCount()).toBe(0);

		nav.selectWeek('2026-10-26');
		await settle();
		nav.selectWeek('2026-10-19');
		await settle();
		nav.openNote('ACME.1', CONTRACT_A, CLIENT_A);
		await settle();
		nav.selectContract(CONTRACT_A, CLIENT_A);
		await settle();
		nav.selectClient(CLIENT_A);
		await settle();
		const journey = [
			'/time/2026-W45',
			'/time/2026-W44',
			'/time/2026-W43',
			`/notes/${CONTRACT_A}/ACME.1`,
			`/notes/${CONTRACT_A}`,
			`/notes/client/${CLIENT_A}`
		];
		expect(nav.previousPath).toBe(journey[4]);
		expect(nav.canGoForward).toBe(false);
		nav.goForward();
		expect(forwardCount()).toBe(0);

		for (let position = journey.length - 1; position > 0; position--) {
			nav.goBack();
			await nav.syncFromUrl(...pop(journey[position - 1], -1));
			expect(nav.workspaceHref).toBe(journey[position - 1]);
			expect(nav.nextPath).toBe(journey[position]);
		}
		expect(backCount()).toBe(journey.length - 1);
		expect(nav.canGoBack).toBe(false);
		expect(nav.selectedWeek).toBe('2026-11-02');

		for (let position = 1; position < journey.length; position++) {
			nav.goForward();
			await nav.syncFromUrl(...pop(journey[position], 1));
			expect(nav.workspaceHref).toBe(journey[position]);
			expect(nav.previousPath).toBe(journey[position - 1]);
		}
		expect(forwardCount()).toBe(journey.length - 1);
		expect(nav.canGoForward).toBe(false);
	});

	it('a reload mid-journey keeps both directions', async () => {
		const first = setup('/time/2026-W45');
		await enter(first.nav, '/time/2026-W45', 'reload');
		first.nav.selectWeek('2026-10-26');
		await first.settle();
		first.nav.selectWeek('2026-10-19');
		await first.settle();
		await first.nav.syncFromUrl(...pop('/time/2026-W44', -1));

		const second = setup('/time/2026-W44', first.storage);
		await enter(second.nav, '/time/2026-W44', 'reload');
		expect(second.nav.previousPath).toBe('/time/2026-W45');
		expect(second.nav.nextPath).toBe('/time/2026-W43');
		expect(second.nav.canGoBack).toBe(true);
		expect(second.nav.canGoForward).toBe(true);
	});

	it('a new step after Back drops Forward', async () => {
		const { nav, settle } = setup('/time/2026-W45');
		await enter(nav, '/time/2026-W45', 'reload');
		nav.selectWeek('2026-10-26');
		await settle();
		await nav.syncFromUrl(...pop('/time/2026-W45', -1));
		expect(nav.canGoForward).toBe(true);
		nav.selectContract(CONTRACT_A, CLIENT_A);
		await settle();
		expect(nav.canGoForward).toBe(false);
	});

	it('quick presses never leave the app: Back counts the steps still on their way', async () => {
		const { nav, settle, backCount } = setup('/time/2026-W45');
		nav.selectWeek('2026-10-26');
		await settle();
		nav.goBack();
		nav.goBack();
		expect(backCount()).toBe(1);
		expect(nav.canGoBack).toBe(false);
		expect(nav.nextPath).toBe('/time/2026-W44');
	});
});

describe('the home button (062-DR)', () => {
	it('goHome is one step to / that Back undoes', async () => {
		const { nav, calls, settle } = setup(`/notes/${CONTRACT_A}/ACME.1`);
		await enter(nav, `/notes/${CONTRACT_A}/ACME.1`, 'navigate');
		nav.goHome();
		await settle();
		expect(calls.at(-1)).toEqual({ path: '/', replace: false });
		expect(nav.isHome).toBe(true);
		expect(nav.mobileNavigationLevel).toBe(0);
		expect(nav.previousPath).toBe(`/notes/${CONTRACT_A}/ACME.1`);
	});

	it('goes home from settings even when home was the last workspace place', async () => {
		const { nav, calls, settle } = setup('/');
		await nav.syncFromUrl(new URL('http://app/settings'), 'link');
		nav.goHome();
		await settle();
		expect(calls.at(-1)).toEqual({ path: '/', replace: false });
	});

	it('the phone Back at home, after the home button, takes the step before (review)', async () => {
		const { nav, settle, backCount } = setup('/');
		await enter(nav, '/', 'navigate');
		nav.openNote('ACME.1', CONTRACT_A, CLIENT_A);
		await settle();
		nav.goHome();
		await settle();
		expect(nav.backTarget).toEqual({ path: `/notes/${CONTRACT_A}/ACME.1`, isHistory: true });
		nav.goBackMobile();
		expect(backCount()).toBe(1);
	});

	it('the phone Back on /search entered from home steps back; at home with nothing before it does nothing', async () => {
		const { nav, calls, settle, backCount } = setup('/');
		await enter(nav, '/', 'navigate');
		nav.goBackMobile();
		await settle();
		expect(backCount()).toBe(0);
		expect(calls).toEqual([]);
		await nav.syncFromUrl(new URL('http://app/search'), 'link');
		expect(nav.isHome).toBe(true);
		expect(nav.backTarget).toEqual({ path: '/', isHistory: true });
		nav.goBackMobile();
		expect(backCount()).toBe(1);
	});

	it('does nothing when already home', async () => {
		const { nav, calls, settle } = setup('/');
		await enter(nav, '/', 'navigate');
		nav.goHome();
		await settle();
		expect(calls).toEqual([]);
	});
});
