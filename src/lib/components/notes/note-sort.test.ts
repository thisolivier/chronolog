import { describe, it, expect } from 'vitest';
import { sortNotes } from './note-sort';
import type { NoteSummary } from '$lib/services/types';

const note = (id: string, createdAt: string, updatedAt: string, isPinned = false): NoteSummary => ({
	id,
	contractId: 'c1',
	isPinned,
	createdAt,
	updatedAt,
	firstLine: id,
	secondLine: ''
});

const older = note('older', '2026-11-01T09:00:00Z', '2026-11-03T12:00:00Z');
const newer = note('newer', '2026-11-02T09:00:00Z', '2026-11-02T10:00:00Z');
const pinned = note('pinned', '2026-10-01T09:00:00Z', '2026-10-01T09:00:00Z', true);

describe('sortNotes', () => {
	it('sorts by last modified, newest first, with pinned notes on top', () => {
		expect(sortNotes([newer, older, pinned], 'modified').map((entry) => entry.id)).toEqual([
			'pinned',
			'older',
			'newer'
		]);
	});

	it('ignores pins when floatPinned is false (all notes, sprint 051-UI)', () => {
		expect(sortNotes([pinned, newer, older], 'modified', { floatPinned: false }).map((entry) => entry.id)).toEqual([
			'older',
			'newer',
			'pinned'
		]);
	});

	it('sorts by creation time when asked', () => {
		expect(sortNotes([older, newer], 'created').map((entry) => entry.id)).toEqual(['newer', 'older']);
	});

	it('puts the most recently pinned note first, then the other pinned ones (sprint 039-CL)', () => {
		const pinnedEarlier = { ...note('pinned-earlier', '2026-10-01T09:00:00Z', '2026-11-04T09:00:00Z', true), pinnedAt: '2026-11-01T09:00:00Z' };
		const pinnedLater = { ...note('pinned-later', '2026-10-01T09:00:00Z', '2026-10-01T09:00:00Z', true), pinnedAt: '2026-11-03T09:00:00Z' };
		expect(sortNotes([older, pinnedEarlier, newer, pinnedLater, pinned], 'modified').map((entry) => entry.id)).toEqual([
			'pinned-later',
			'pinned-earlier',
			'pinned',
			'older',
			'newer'
		]);
	});

	it('does not mutate the input', () => {
		const input = [newer, older];
		sortNotes(input, 'modified');
		expect(input[0].id).toBe('newer');
	});
});
