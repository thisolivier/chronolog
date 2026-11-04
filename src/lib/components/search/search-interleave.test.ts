import { describe, expect, it } from 'vitest';
import { entrySortKey, formatEntryDateShort, interleaveSearchHits, localSortKey, searchSummary } from './search-interleave';
import type { NoteHit, TimeEntryHit } from './search-types';

const context = {
	clientId: 'client-1',
	clientName: 'Acme',
	clientShortCode: 'ACM',
	contractId: 'contract-1',
	contractName: 'Build'
};
const emptySnippet = { text: '', matches: [] };

/** A note last modified at a local moment (months are 1-based here) */
function note(id: string, month: number, day: number, hour: number, minute = 0): NoteHit {
	return {
		...context,
		id,
		title: id,
		matchedIn: 'title',
		titleMatches: [],
		snippet: emptySnippet,
		updatedAt: new Date(2026, month - 1, day, hour, minute).toISOString()
	};
}

function entry(id: string, date: string, startTime: string | null): TimeEntryHit {
	return {
		...context,
		id,
		date,
		startTime,
		durationMinutes: 30,
		snippet: emptySnippet
	};
}

function idsOf(result: { notes: NoteHit[]; entries: TimeEntryHit[] }): string[] {
	return interleaveSearchHits({
		notes: { hits: result.notes, total: result.notes.length },
		timeEntries: { hits: result.entries, total: result.entries.length }
	}).map((item) => `${item.kind}:${item.hit.id}`);
}

describe('interleaveSearchHits', () => {
	it('merges notes and entries newest first', () => {
		const order = idsOf({
			notes: [note('n-oct-21', 10, 21, 9), note('n-oct-19', 10, 19, 15)],
			entries: [entry('e-oct-22', '2026-10-22', '08:00'), entry('e-oct-20', '2026-10-20', '11:00'), entry('e-oct-18', '2026-10-18', null)]
		});
		expect(order).toEqual(['entry:e-oct-22', 'note:n-oct-21', 'entry:e-oct-20', 'note:n-oct-19', 'entry:e-oct-18']);
	});

	it('orders entries on the same day by start time, untimed ones last', () => {
		const order = idsOf({
			notes: [note('n-noon', 10, 20, 12, 30)],
			entries: [
				entry('e-untimed', '2026-10-20', null),
				entry('e-morning', '2026-10-20', '09:15'),
				entry('e-evening', '2026-10-20', '17:00:00')
			]
		});
		expect(order).toEqual(['entry:e-evening', 'note:n-noon', 'entry:e-morning', 'entry:e-untimed']);
	});

	it('keeps the server order on equal keys, and handles an empty group', () => {
		const order = idsOf({
			notes: [note('n-first', 10, 20, 9), note('n-second', 10, 20, 9)],
			entries: []
		});
		expect(order).toEqual(['note:n-first', 'note:n-second']);
		expect(idsOf({ notes: [], entries: [] })).toEqual([]);
	});
});

describe('sort keys', () => {
	it('uses local time for notes and date plus start time for entries', () => {
		expect(localSortKey(new Date(2026, 0, 5, 7, 4).toISOString())).toBe('2026-01-05T07:04');
		expect(entrySortKey({ date: '2026-01-05', startTime: '07:04:00' })).toBe('2026-01-05T07:04');
		expect(entrySortKey({ date: '2026-01-05', startTime: null })).toBe('2026-01-05T00:00');
	});
});

describe('searchSummary', () => {
	it('counts each type, with "of" when the list was cut', () => {
		const summary = searchSummary({
			notes: { hits: [note('a', 1, 1, 1)], total: 1 },
			timeEntries: {
				hits: [entry('b', '2026-01-01', null), entry('c', '2026-01-01', null)],
				total: 7
			}
		});
		expect(summary).toBe('1 note · 2 of 7 time entries');
		expect(
			searchSummary({
				notes: { hits: [], total: 0 },
				timeEntries: { hits: [entry('d', '2026-01-01', null)], total: 1 }
			})
		).toBe('0 notes · 1 time entry');
	});
});

describe('formatEntryDateShort', () => {
	it('gives month and day only', () => {
		expect(formatEntryDateShort('2026-10-20')).toBe('Oct 20');
	});
});
