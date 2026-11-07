import { describe, it, expect } from 'vitest';
import { computeColorSegments } from './week-strip-segments';

describe('computeColorSegments', () => {
	it('returns an empty array for no entries', () => {
		expect(computeColorSegments([])).toEqual([]);
	});

	it('returns an empty array when every entry has zero minutes', () => {
		const segments = computeColorSegments([
			{ clientId: 'client-a', clientColorIndex: 0, durationMinutes: 0 },
			{ clientId: 'client-a', clientColorIndex: 0, durationMinutes: 0 }
		]);
		expect(segments).toEqual([]);
	});

	it('merges two same-client, same-duration entries into one segment with a unique key', () => {
		const segments = computeColorSegments([
			{ clientId: 'client-a', clientColorIndex: 0, durationMinutes: 30 },
			{ clientId: 'client-a', clientColorIndex: 0, durationMinutes: 30 }
		]);
		expect(segments).toHaveLength(1);
		expect(segments[0]).toEqual({ clientId: 'client-a', colorClass: 'bg-id-rust', percentage: 100 });

		const keys = segments.map((segment) => segment.clientId);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it('produces one segment per client with percentages that sum to 100', () => {
		const segments = computeColorSegments([
			{ clientId: 'client-a', clientColorIndex: 0, durationMinutes: 60 },
			{ clientId: 'client-b', clientColorIndex: 1, durationMinutes: 30 },
			{ clientId: 'client-a', clientColorIndex: 0, durationMinutes: 30 }
		]);
		expect(segments).toHaveLength(2);
		expect(segments[0]).toEqual({ clientId: 'client-a', colorClass: 'bg-id-rust', percentage: 75 });
		expect(segments[1]).toEqual({ clientId: 'client-b', colorClass: 'bg-id-juniper', percentage: 25 });

		const percentageTotal = segments.reduce((sum, segment) => sum + segment.percentage, 0);
		expect(percentageTotal).toBeCloseTo(100);
	});

	it('orders segments by first appearance of each client', () => {
		const segments = computeColorSegments([
			{ clientId: 'client-b', clientColorIndex: 1, durationMinutes: 10 },
			{ clientId: 'client-a', clientColorIndex: 0, durationMinutes: 10 },
			{ clientId: 'client-b', clientColorIndex: 1, durationMinutes: 10 }
		]);
		expect(segments.map((segment) => segment.clientId)).toEqual(['client-b', 'client-a']);
	});

	it('drops a client whose entries total zero minutes but keeps the others', () => {
		const segments = computeColorSegments([
			{ clientId: 'client-a', clientColorIndex: 0, durationMinutes: 0 },
			{ clientId: 'client-b', clientColorIndex: 2, durationMinutes: 45 }
		]);
		expect(segments).toEqual([{ clientId: 'client-b', colorClass: 'bg-id-heather', percentage: 100 }]);
	});
});
