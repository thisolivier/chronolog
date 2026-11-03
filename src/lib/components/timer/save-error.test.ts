import { describe, expect, it } from 'vitest';
import { describeSaveError } from './save-error';

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
