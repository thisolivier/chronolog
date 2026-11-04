import { describe, it, expect } from 'vitest';
import {
	localTimerStartProblem,
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
