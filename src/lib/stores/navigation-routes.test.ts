/**
 * Tests for the pure workspace URL helpers in navigation-routes.ts (sprint 027-CL).
 * Table-driven: each row is one path, route or date, so a new case is one line.
 */
import { describe, it, expect } from 'vitest';
import {
	buildWorkspacePath,
	currentMonday,
	mobileLevelFor,
	mondayFromWeekParam,
	parentRoute,
	parseWorkspacePath,
	sameRoute,
	todayDateString,
	weekParamFromMonday,
	DRAFT_SEGMENT,
	type WorkspaceRoute
} from './navigation-routes';

const FALLBACK_WEEK = '2026-11-02';

const weekRoundTripCases = [
	{ description: 'a 2026 Monday in week 45', monday: '2026-11-02', weekParam: '2026-W45' },
	{ description: 'a 2026 Monday in week 44', monday: '2026-10-26', weekParam: '2026-W44' },
	{ description: 'a December Monday that starts ISO week 1', monday: '2025-12-29', weekParam: '2026-W01' },
	{ description: '28 Dec 2026 is 2026-W53 (2026 has 53 ISO weeks)', monday: '2026-12-28', weekParam: '2026-W53' },
	{ description: '4 Jan 2027 starts 2027-W01', monday: '2027-01-04', weekParam: '2027-W01' },
	{ description: '28 Dec 2020 is 2020-W53', monday: '2020-12-28', weekParam: '2020-W53' },
	{ description: 'week 52 of 2023 (1 Jan 2023 was a Sunday, so it was 2022-W52)', monday: '2023-12-25', weekParam: '2023-W52' }
];

const invalidWeekParamCases = [
	{ description: 'week 00', weekParam: '2026-W00' },
	{ description: 'week 54', weekParam: '2026-W54' },
	{ description: 'week 53 of a 52-week ISO year', weekParam: '2025-W53' },
	{ description: 'week 53 of 2027 (52 ISO weeks)', weekParam: '2027-W53' },
	{ description: 'a one-digit week (not canonical)', weekParam: '2026-W5' },
	{ description: 'a year below 100 (Date.UTC would read 0026 as 1926)', weekParam: '0026-W45' },
	{ description: 'a year after 2099', weekParam: '2100-W01' },
	{ description: 'missing the year', weekParam: 'W45' },
	{ description: 'missing the W marker', weekParam: '2026-45' },
	{ description: 'empty string', weekParam: '' }
];

const parseCases: Array<{ description: string; pathname: string; expected: WorkspaceRoute | null }> = [
	{ description: 'root is home', pathname: '/', expected: { kind: 'home' } },
	{ description: 'bare /time uses the fallback week', pathname: '/time', expected: { kind: 'time', week: FALLBACK_WEEK } },
	{ description: '/time/<week> resolves to its Monday', pathname: '/time/2026-W44', expected: { kind: 'time', week: '2026-10-26' } },
	{ description: 'an invalid week param is not a route', pathname: '/time/garbage', expected: null },
	{ description: 'ISO week 53 of 2026 opens Monday 28 Dec', pathname: '/time/2026-W53', expected: { kind: 'time', week: '2026-12-28' } },
	{ description: 'ISO 2027-W01 opens Monday 4 Jan', pathname: '/time/2027-W01', expected: { kind: 'time', week: '2027-01-04' } },
	{ description: 'a week 53 the ISO year lacks is not a route', pathname: '/time/2025-W53', expected: null },
	{
		description: 'a contract list',
		pathname: '/notes/abc',
		expected: { kind: 'notes', contractId: 'abc', noteId: null, draft: false }
	},
	{
		description: 'an open note under its contract',
		pathname: '/notes/abc/ACME.20261103.005',
		expected: { kind: 'notes', contractId: 'abc', noteId: 'ACME.20261103.005', draft: false }
	},
	{
		description: 'a new-note draft',
		pathname: '/notes/abc/new',
		expected: { kind: 'notes', contractId: 'abc', noteId: null, draft: true }
	},
	{ description: 'settings is not a workspace URL', pathname: '/settings', expected: null },
	{ description: 'a bare /notes has no contract', pathname: '/notes', expected: null },
	{ description: 'too many note segments', pathname: '/notes/a/b/c', expected: null },
	{ description: 'a time route with an extra segment', pathname: '/time/2026-W44/x', expected: null }
];

/** Valid routes that must survive build -> parse unchanged (contract list, note, draft, week, home) */
const canonicalRouteCases: Array<{ description: string; route: WorkspaceRoute; pathname: string }> = [
	{ description: 'home', route: { kind: 'home' }, pathname: '/' },
	{ description: 'a timesheet week', route: { kind: 'time', week: '2026-10-26' }, pathname: '/time/2026-W44' },
	{
		description: 'a contract list',
		route: { kind: 'notes', contractId: 'abc', noteId: null, draft: false },
		pathname: '/notes/abc'
	},
	{
		description: 'an open note',
		route: { kind: 'notes', contractId: 'abc', noteId: 'ACME.20261103.005', draft: false },
		pathname: '/notes/abc/ACME.20261103.005'
	},
	{
		description: 'a new-note draft',
		route: { kind: 'notes', contractId: 'abc', noteId: null, draft: true },
		pathname: '/notes/abc/new'
	}
];

const mobileLevelCases: Array<{ description: string; route: WorkspaceRoute; expected: 0 | 1 | 2 }> = [
	{ description: 'home', route: { kind: 'home' }, expected: 0 },
	{ description: 'timesheet', route: { kind: 'time', week: '2026-11-02' }, expected: 1 },
	{ description: 'contract note list', route: { kind: 'notes', contractId: 'abc', noteId: null, draft: false }, expected: 1 },
	{ description: 'open note', route: { kind: 'notes', contractId: 'abc', noteId: 'n1', draft: false }, expected: 2 },
	{ description: 'new-note draft', route: { kind: 'notes', contractId: 'abc', noteId: null, draft: true }, expected: 2 }
];

const parentRouteCases: Array<{ description: string; route: WorkspaceRoute; expected: WorkspaceRoute }> = [
	{
		description: 'an open note goes up to its contract list',
		route: { kind: 'notes', contractId: 'abc', noteId: 'n1', draft: false },
		expected: { kind: 'notes', contractId: 'abc', noteId: null, draft: false }
	},
	{
		description: 'a draft goes up to its contract list',
		route: { kind: 'notes', contractId: 'abc', noteId: null, draft: true },
		expected: { kind: 'notes', contractId: 'abc', noteId: null, draft: false }
	},
	{ description: 'a contract list goes up to home', route: { kind: 'notes', contractId: 'abc', noteId: null, draft: false }, expected: { kind: 'home' } },
	{ description: 'a timesheet goes up to home', route: { kind: 'time', week: '2026-11-02' }, expected: { kind: 'home' } },
	{ description: 'home stays at home', route: { kind: 'home' }, expected: { kind: 'home' } }
];

const sameRouteCases: Array<{ description: string; first: WorkspaceRoute; second: WorkspaceRoute; expected: boolean }> = [
	{ description: 'two homes', first: { kind: 'home' }, second: { kind: 'home' }, expected: true },
	{ description: 'the same week', first: { kind: 'time', week: '2026-11-02' }, second: { kind: 'time', week: '2026-11-02' }, expected: true },
	{ description: 'different weeks', first: { kind: 'time', week: '2026-11-02' }, second: { kind: 'time', week: '2026-10-26' }, expected: false },
	{
		description: 'the same note',
		first: { kind: 'notes', contractId: 'abc', noteId: 'n1', draft: false },
		second: { kind: 'notes', contractId: 'abc', noteId: 'n1', draft: false },
		expected: true
	},
	{
		description: 'a note and a draft under the same contract',
		first: { kind: 'notes', contractId: 'abc', noteId: 'n1', draft: false },
		second: { kind: 'notes', contractId: 'abc', noteId: null, draft: true },
		expected: false
	},
	{
		description: 'the same contract with different notes',
		first: { kind: 'notes', contractId: 'abc', noteId: 'n1', draft: false },
		second: { kind: 'notes', contractId: 'abc', noteId: 'n2', draft: false },
		expected: false
	},
	{ description: 'home and a timesheet', first: { kind: 'home' }, second: { kind: 'time', week: '2026-11-02' }, expected: false }
];

describe('weekParamFromMonday', () => {
	it.each(weekRoundTripCases)('formats $description as its ISO week param', ({ monday, weekParam }) => {
		expect(weekParamFromMonday(monday)).toBe(weekParam);
	});
});

describe('mondayFromWeekParam', () => {
	it.each(weekRoundTripCases)('resolves $description back to its Monday', ({ monday, weekParam }) => {
		expect(mondayFromWeekParam(weekParam)).toBe(monday);
	});

	it.each(invalidWeekParamCases)('rejects $description ($weekParam)', ({ weekParam }) => {
		expect(mondayFromWeekParam(weekParam)).toBeNull();
	});
});

describe('parseWorkspacePath', () => {
	it.each(parseCases)('parses $pathname: $description', ({ pathname, expected }) => {
		expect(parseWorkspacePath(pathname, FALLBACK_WEEK)).toEqual(expected);
	});

	it('leaves the trash page (/notes/trash, sprint 043-CL) out of the workspace', () => {
		expect(parseWorkspacePath('/notes/trash', FALLBACK_WEEK)).toBeNull();
	});
});

describe('buildWorkspacePath', () => {
	it.each(canonicalRouteCases)('builds the path for $description', ({ route, pathname }) => {
		expect(buildWorkspacePath(route)).toBe(pathname);
	});

	it.each(canonicalRouteCases)('round-trips $description through parse', ({ route, pathname }) => {
		expect(parseWorkspacePath(pathname, FALLBACK_WEEK)).toEqual(route);
		expect(buildWorkspacePath(parseWorkspacePath(pathname, FALLBACK_WEEK) as WorkspaceRoute)).toBe(pathname);
	});

	it('canonicalises bare /time to the fallback week path (not an exact inverse)', () => {
		const parsedBareTimeRoute = parseWorkspacePath('/time', FALLBACK_WEEK);
		expect(parsedBareTimeRoute).not.toBeNull();
		expect(buildWorkspacePath(parsedBareTimeRoute as WorkspaceRoute)).toBe('/time/2026-W45');
	});

	it('uses the DRAFT_SEGMENT constant for drafts', () => {
		expect(DRAFT_SEGMENT).toBe('new');
	});
});

describe('mobileLevelFor', () => {
	it.each(mobileLevelCases)('gives $description level $expected', ({ route, expected }) => {
		expect(mobileLevelFor(route)).toBe(expected);
	});
});

describe('parentRoute', () => {
	it.each(parentRouteCases)('goes up from $description', ({ route, expected }) => {
		expect(parentRoute(route)).toEqual(expected);
	});
});

describe('sameRoute', () => {
	it.each(sameRouteCases)('$description: $expected', ({ first, second, expected }) => {
		expect(sameRoute(first, second)).toBe(expected);
	});
});

describe('currentMonday', () => {
	it('returns the Monday of the week containing the given date', () => {
		// 2026-11-04 is a Wednesday
		expect(currentMonday(new Date(2026, 10, 4))).toBe('2026-11-02');
	});
});

describe('todayDateString', () => {
	it('formats the local calendar date as YYYY-MM-DD', () => {
		expect(todayDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
	});
});

describe('client view paths (sprint 039-CL)', () => {
	const CLIENT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
	const CONTRACT = '11111111-1111-4111-8111-111111111111';
	it('round-trips the list, a note and a draft', () => {
		for (const path of [
			`/notes/client/${CLIENT}`,
			`/notes/client/${CLIENT}/${CONTRACT}/ACME.20261104.001`,
			`/notes/client/${CLIENT}/${CONTRACT}/new`
		]) {
			const route = parseWorkspacePath(path, '2026-11-02');
			expect(route?.kind).toBe('client');
			expect(buildWorkspacePath(route!)).toBe(path);
		}
	});

	it('rejects a half path, and goes up note -> client list -> home', () => {
		expect(parseWorkspacePath(`/notes/client/${CLIENT}/${CONTRACT}`, '2026-11-02')).toBeNull();
		const note = parseWorkspacePath(`/notes/client/${CLIENT}/${CONTRACT}/ACME.1`, '2026-11-02')!;
		expect(mobileLevelFor(note)).toBe(2);
		const list = parentRoute(note);
		expect(buildWorkspacePath(list)).toBe(`/notes/client/${CLIENT}`);
		expect(mobileLevelFor(list)).toBe(1);
		expect(parentRoute(list)).toEqual({ kind: 'home' });
	});
});

describe('all-notes paths (sprint 051-UI)', () => {
	const CONTRACT = '11111111-1111-4111-8111-111111111111';
	it('round-trips the list, a note and a draft', () => {
		for (const path of ['/notes/all', `/notes/all/${CONTRACT}/ACME.20261104.001`, `/notes/all/${CONTRACT}/new`]) {
			const route = parseWorkspacePath(path, '2026-11-02');
			expect(route?.kind).toBe('all');
			expect(buildWorkspacePath(route!)).toBe(path);
		}
	});

	it('rejects a half path, and goes up note -> all notes -> home', () => {
		expect(parseWorkspacePath(`/notes/all/${CONTRACT}`, '2026-11-02')).toBeNull();
		const note = parseWorkspacePath(`/notes/all/${CONTRACT}/ACME.1`, '2026-11-02')!;
		expect(mobileLevelFor(note)).toBe(2);
		const list = parentRoute(note);
		expect(buildWorkspacePath(list)).toBe('/notes/all');
		expect(mobileLevelFor(list)).toBe(1);
		expect(parentRoute(list)).toEqual({ kind: 'home' });
	});
});
