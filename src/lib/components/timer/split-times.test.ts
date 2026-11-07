import { describe, expect, it } from 'vitest';
import {
	MINUTE_MS,
	applyDurationText,
	atClockNear,
	blankContent,
	clockOf,
	flipContent,
	initialSplitTimes,
	localMomentString,
	momentFromLocal,
	partMinutes,
	splitTimesProblems,
	withBoundary,
	withLeftMinutes,
	withRightMinutes,
	type SplitTimes
} from './split-times';

const at = (time: string, date = '2026-11-07') => momentFromLocal(date, time);

describe('split times: the shared boundary', () => {
	const running: SplitTimes = { start: at('09:00'), boundary: at('09:50'), end: null };

	it('starts halfway on a whole minute, strictly inside', () => {
		const times = initialSplitTimes(at('09:00:37'), null, at('10:30:10'));
		expect(clockOf(times.boundary)).toBe('09:45');
		expect(times.boundary % MINUTE_MS).toBe(0);
		expect(times.end).toBeNull();
	});

	it('left To and right From are one value: editing it moves both parts', () => {
		const moved = withBoundary(running, at('09:40'));
		expect(partMinutes(moved.start, moved.boundary)).toBe(40);
		expect(partMinutes(moved.boundary, at('10:30'))).toBe(50);
	});

	it('a left duration moves the boundary from the start', () => {
		expect(clockOf(withLeftMinutes(running, 30).boundary)).toBe('09:30');
	});

	it('a right duration moves the boundary back from the stopped end', () => {
		const stopped = { ...running, end: at('11:00') };
		expect(clockOf(withRightMinutes(stopped, 20, at('12:00')).boundary)).toBe('10:40');
	});

	it('a right duration on a live part is confirmed against now once, then the start stays', () => {
		const confirmed = applyDurationText(running, 'right', '40m', at('10:30:27'));
		expect(confirmed.ok).toBe(true);
		if (!confirmed.ok) return;
		expect(localMomentString(confirmed.times.boundary)).toBe('2026-11-07T09:50:27');
		// Later ticks: the right part grows, its start does not move
		expect(partMinutes(confirmed.times.boundary, at('10:45:27'))).toBe(55);
		expect(confirmed.times.boundary).toBe(at('09:50:27'));
	});

	it('a typed left range sets the start and the boundary', () => {
		const applied = applyDurationText(running, 'left', '9:10-9:35', at('10:30'));
		expect(applied.ok && clockOf(applied.times.start)).toBe('09:10');
		expect(applied.ok && clockOf(applied.times.boundary)).toBe('09:35');
	});

	it('a range is refused for the live right part', () => {
		expect(applyDurationText(running, 'right', '9:50-10:10', at('10:30'))).toEqual({ ok: false, error: 'Type a duration: this part runs until now' });
	});

	it('zero is refused by the shared parser', () => {
		expect(applyDurationText(running, 'left', '0', at('10:30')).ok).toBe(false);
	});

	it('zero and negative parts are problems, inline per part', () => {
		expect(splitTimesProblems(running, at('10:30'))).toEqual({ left: '', right: '' });
		expect(splitTimesProblems(withBoundary(running, at('09:00')), at('10:30')).left).toMatch(/end after it starts/);
		expect(splitTimesProblems(withBoundary(running, at('08:30')), at('10:30')).left).toMatch(/end after it starts/);
		expect(splitTimesProblems(withBoundary(running, at('10:31')), at('10:30')).right).toMatch(/future/);
		const stopped = { ...running, end: at('09:50') };
		expect(splitTimesProblems(stopped, at('10:30')).right).toMatch(/end after it starts/);
	});

	it('a typed clock lands on the day nearest the value it replaces (midnight)', () => {
		expect(localMomentString(atClockNear(at('23:50'), '00:10') as number)).toBe('2026-11-08T00:10:00');
		expect(localMomentString(atClockNear(at('00:05', '2026-11-08'), '23:55') as number)).toBe('2026-11-07T23:55:00');
		expect(atClockNear(at('10:00'), '25:00')).toBeNull();
	});
});

describe('split times: Flip', () => {
	it('swaps the content packages and leaves the new part blank, contract included', () => {
		const original = { contractId: 'c1', deliverableId: 'd1', workTypeId: 'w1', description: 'Roles [[N.1]]' };
		const flipped = flipContent(original, blankContent());
		expect(flipped.left).toEqual(blankContent());
		expect(flipped.right).toEqual(original);
		expect(flipContent(flipped.left, flipped.right)).toEqual({ left: original, right: blankContent() });
	});
});
