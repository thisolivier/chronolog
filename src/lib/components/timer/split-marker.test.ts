import { describe, expect, it } from 'vitest';
import { reconcileStepFor, resendFailureMeaning, splitMarkerFor } from './split-marker';
import type { SplitTimerInput, TimerEntry } from '$lib/services/types';

function request(overrides: Partial<SplitTimerInput> = {}): SplitTimerInput {
	return {
		entryId: 'draft-1',
		expectedStartedAt: '2026-11-07T09:00:00',
		expectedEndedAt: null,
		boundary: '2026-11-07T09:50:00',
		clientRequestId: 'req-1',
		left: { action: 'save', contractId: 'c1' },
		right: { contractId: null, description: null },
		...overrides
	};
}

const timer = (startTime: string, id = 'draft-1'): TimerEntry => ({ id, date: '2026-11-07', startTime, endTime: null, durationMinutes: 0 });

describe('split marker reconcile (SP-08)', () => {
	const marker = splitMarkerFor(request());

	it('records what a reload needs', () => {
		expect(marker).toMatchObject({ clientRequestId: 'req-1', entryId: 'draft-1', boundary: '2026-11-07T09:50:00', leftAction: 'save' });
	});

	it('the marked draft starting at the boundary means the split happened', () => {
		expect(reconcileStepFor(marker, timer('09:50:00'))).toBe('split-happened');
	});

	it('the marked draft still at the expected start means it did not', () => {
		expect(reconcileStepFor(marker, timer('09:00:00'))).toBe('not-split');
	});

	it('no draft, or another one: only a re-send can tell', () => {
		expect(reconcileStepFor(marker, null)).toBe('unknown');
		expect(reconcileStepFor(marker, timer('09:50:00', 'draft-2'))).toBe('unknown');
		expect(reconcileStepFor(marker, timer('09:20:00'))).toBe('unknown');
	});

	it('compares at the precision of the shorter moment', () => {
		const minutePrecision = splitMarkerFor(request({ boundary: '2026-11-07T09:50' }));
		expect(reconcileStepFor(minutePrecision, timer('09:50:41'))).toBe('split-happened');
	});

	it('a 404 after discard-left with a contractless right is the known gap: settled', () => {
		const discardPending = splitMarkerFor(request({ left: { action: 'discard' } }));
		expect(resendFailureMeaning(discardPending, 404)).toBe('settled-known-gap');
		expect(resendFailureMeaning(discardPending, 409)).toBe('abandoned');
	});

	it('any other 404 is not the gap', () => {
		expect(resendFailureMeaning(marker, 404)).toBe('abandoned');
		const discardDraft = splitMarkerFor(request({ left: { action: 'discard' }, right: { contractId: 'c1' } }));
		expect(resendFailureMeaning(discardDraft, 404)).toBe('abandoned');
	});
});
