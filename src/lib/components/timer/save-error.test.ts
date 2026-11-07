import { describe, expect, it } from 'vitest';
import { describeSaveError, describeTimerConflict, timerConflictFrom } from './save-error';

describe('describeSaveError', () => {
	it('explains a network failure', () => {
		expect(describeSaveError(new TypeError('Failed to fetch'))).toContain('no connection');
	});

	it('passes the server message through', () => {
		expect(describeSaveError(new Error('contractId is required'))).toBe(
			"Couldn't save: contractId is required"
		);
	});

	it('handles values that are not errors', () => {
		expect(describeSaveError('boom')).toContain('no connection');
	});
});

describe('describeSaveError with fetch helper errors', () => {
	it('keeps only the server message from a JSON body', () => {
		const fetchError = new Error(
			'POST /api/time-entries failed (400): {"message":"Duration cannot exceed 24 hours"}'
		);
		expect(describeSaveError(fetchError)).toBe("Couldn't save: Duration cannot exceed 24 hours");
	});

	it('falls back to the status code for an empty body', () => {
		expect(describeSaveError(new Error('PUT /api/time-entries/1 failed (500): '))).toBe(
			"Couldn't save: server error 500"
		);
	});
});

describe('timerConflictFrom', () => {
	const conflict = (code: string) =>
		new Error(`POST /api/timer/save failed (409): {"error":"x","code":"${code}","message":"x"}`);

	it('reads the three timer guard codes', () => {
		expect(timerConflictFrom(conflict('not_a_draft'))).toBe('not_a_draft');
		expect(timerConflictFrom(conflict('timer_changed'))).toBe('timer_changed');
		expect(timerConflictFrom(conflict('expected_start_required'))).toBe('expected_start_required');
	});

	it('ignores other conflicts and other failures', () => {
		expect(timerConflictFrom(conflict('start_overlaps_entry'))).toBeNull();
		expect(timerConflictFrom(new Error('POST /api/timer/save failed (400): {"code":"timer_changed"}'))).toBeNull();
		expect(timerConflictFrom(new Error('Failed to fetch'))).toBeNull();
		expect(timerConflictFrom('nope')).toBeNull();
	});

	it('describes a conflict without blaming the user', () => {
		expect(describeTimerConflict('not_a_draft', 'save')).toMatch(/already saved or discarded/);
		expect(describeTimerConflict('timer_changed', 'discard')).toMatch(/was not discarded/);
	});
});
