import { describe, expect, it } from 'vitest';
import { isUniqueViolation } from './admin-actions';

describe('isUniqueViolation', () => {
	it('finds the Postgres 23505 code inside a wrapped Drizzle error', () => {
		const driverError = Object.assign(new Error('duplicate key value violates unique constraint "x"'), { code: '23505' });
		const drizzleError = new Error('Failed query: insert into "clients" …', { cause: driverError });
		expect(isUniqueViolation(drizzleError)).toBe(true);
	});

	it('ignores other database errors', () => {
		const driverError = Object.assign(new Error('connection refused'), { code: '08006' });
		expect(isUniqueViolation(new Error('Failed query: …', { cause: driverError }))).toBe(false);
		expect(isUniqueViolation('not an error')).toBe(false);
	});
});
