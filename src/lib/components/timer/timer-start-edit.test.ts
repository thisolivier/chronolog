import { describe, it, expect } from 'vitest';
import {
	localTimerStartProblem,
	readTimerStartInput,
	readTimerStartRejection,
	startChangeResultFromError,
	toTimeInputValue
} from './timer-start-edit';

const now = new Date(2026, 10, 4, 15, 0, 30);

describe('localTimerStartProblem', () => {
	it('accepts earlier today, the current minute and yesterday evening', () => {
		expect(localTimerStartProblem('2026-11-04', '09:30', now)).toBeNull();
		expect(localTimerStartProblem('2026-11-04', '15:00', now)).toBeNull();
		expect(localTimerStartProblem('2026-11-03', '23:10:00', now)).toBeNull();
	});

	it('refuses the future, more than a day ago and unreadable input', () => {
		expect(localTimerStartProblem('2026-11-04', '15:05', now)).toMatch(/future/);
		expect(localTimerStartProblem('2026-11-03', '14:00', now)).toMatch(/24 hours/);
		expect(localTimerStartProblem('2026-11-04', '', now)).toMatch(/HH:MM/);
	});
});

describe('readTimerStartInput (060-DR)', () => {
	it('refuses minutes past 59 and other unreadable text with the format message, never a start', () => {
		for (const text of ['12:60', '23:60', '00:75', '24:00', '1:46 PM', 'abc', '']) {
			expect(readTimerStartInput('2026-11-04', text, now)).toEqual({ ok: false, error: 'Enter a start time as HH:MM.' });
		}
	});

	it('the range check alone refuses 12:60 too (no roll forward)', () => {
		expect(localTimerStartProblem('2026-11-04', '12:60', now)).toMatch(/HH:MM/);
		expect(localTimerStartProblem('2026-11-04', '23:60', now)).toMatch(/HH:MM/);
	});

	it('reads the usual forms into HH:MM:SS and still applies the time rules', () => {
		expect(readTimerStartInput('2026-11-04', '9:05', now)).toEqual({ ok: true, clock: '09:05', startTime: '09:05:00' });
		expect(readTimerStartInput('2026-11-04', '1430', now)).toEqual({ ok: true, clock: '14:30', startTime: '14:30:00' });
		expect(readTimerStartInput('2026-11-04', '15:05', now)).toMatchObject({ ok: false, error: expect.stringMatching(/future/) });
	});
});

describe('server refusals', () => {
	const failure = (status: number, body: unknown) =>
		new Error(`PATCH /api/timer failed (${status}): ${JSON.stringify(body)}`);

	it('reads the code and message, and an overlap asks to confirm', () => {
		const overlap = failure(409, { code: 'start_overlaps_entry', message: 'Before the end of ACME' });
		expect(readTimerStartRejection(overlap)).toEqual({ status: 409, code: 'start_overlaps_entry', message: 'Before the end of ACME' });
		expect(startChangeResultFromError(overlap)).toEqual({ outcome: 'overlap', message: 'Before the end of ACME' });
		expect(startChangeResultFromError(failure(400, { code: 'start_in_future', error: 'In the future' }))).toEqual({
			outcome: 'error',
			message: 'In the future'
		});
	});

	it('explains a network failure and a body that is not JSON', () => {
		expect(startChangeResultFromError(new TypeError('Failed to fetch')).outcome).toBe('error');
		expect(readTimerStartRejection(new Error('PATCH /api/timer failed (502): <html>')).message).toMatch(/502/);
	});

	it('shows HH:MM in the time input', () => {
		expect(toTimeInputValue('09:05:33')).toBe('09:05');
		expect(toTimeInputValue('')).toBe('');
	});
});
