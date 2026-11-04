import { describe, expect, it, vi } from 'vitest';
import { daysUntilPurge, fetchTrashedNotes, purgeLabel } from './trash-view';

const now = new Date('2026-11-04T12:00:00Z');

describe('trash view (sprint 043-CL)', () => {
	it('counts whole days left before the purge, rounded up', () => {
		expect(daysUntilPurge('2026-12-04T12:00:00Z', now)).toBe(30);
		expect(daysUntilPurge('2026-11-05T11:00:00Z', now)).toBe(1);
		expect(daysUntilPurge('2026-11-01T00:00:00Z', now)).toBe(0);
	});

	it('labels the time left', () => {
		expect(purgeLabel('2026-12-03T12:00:00Z', now)).toBe('29 days left');
		expect(purgeLabel('2026-11-05T12:00:00Z', now)).toBe('1 day left');
		expect(purgeLabel('2026-11-04T11:00:00Z', now)).toBe('purged today');
	});

	it('reads the notes from the trash endpoint and fails loudly', async () => {
		const notes = [{ id: 'A.1', title: 'Alpha', contractId: 'c', contract: 'ACME/Build', deletedAt: '', purgeAt: '' }];
		const fetcher = vi.fn(async () => new Response(JSON.stringify({ notes })));
		expect(await fetchTrashedNotes(fetcher as unknown as typeof fetch)).toEqual(notes);
		expect(fetcher).toHaveBeenCalledWith('/api/notes/trash');
		const failing = vi.fn(async () => new Response('', { status: 500 }));
		await expect(fetchTrashedNotes(failing as unknown as typeof fetch)).rejects.toThrow('500');
	});
});
