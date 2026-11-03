import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearPendingTimer, readPendingTimer, writePendingTimer } from './pending-timer';

describe('pending timer storage', () => {
	// In-memory storage: Node's own experimental localStorage global is not usable in tests
	beforeEach(() => {
		const storedValues = new Map<string, string>();
		vi.stubGlobal('localStorage', {
			getItem: (key: string) => storedValues.get(key) ?? null,
			setItem: (key: string, value: string) => void storedValues.set(key, value),
			removeItem: (key: string) => void storedValues.delete(key)
		});
	});

	it('round-trips a pending timer', () => {
		writePendingTimer({ date: '2026-11-03', startTime: '09:05:00', description: 'Call' });
		expect(readPendingTimer()).toEqual({
			date: '2026-11-03',
			startTime: '09:05:00',
			description: 'Call',
			endTime: undefined
		});
	});

	it('returns null for nothing stored, malformed JSON or a missing start', () => {
		expect(readPendingTimer()).toBeNull();
		localStorage.setItem('chronolog.pending-timer', '{not json');
		expect(readPendingTimer()).toBeNull();
		localStorage.setItem('chronolog.pending-timer', JSON.stringify({ date: '2026-11-03' }));
		expect(readPendingTimer()).toBeNull();
	});

	it('clears', () => {
		writePendingTimer({ date: '2026-11-03', startTime: '09:05:00', description: '' });
		clearPendingTimer();
		expect(readPendingTimer()).toBeNull();
	});
});
