import { describe, expect, it } from 'vitest';
import { createFailureLimiter } from './failure-limiter';

describe('failure limiter', () => {
	it('limits an IP after the maximum failures within the window, per IP', () => {
		const limiter = createFailureLimiter(3, 60_000);
		for (let attempt = 0; attempt < 3; attempt += 1) {
			expect(limiter.isLimited('1.1.1.1', 1000)).toBe(false);
			limiter.recordFailure('1.1.1.1', 1000);
		}
		expect(limiter.isLimited('1.1.1.1', 1000)).toBe(true);
		expect(limiter.isLimited('2.2.2.2', 1000)).toBe(false);
	});

	it('lets failures age out of the window', () => {
		const limiter = createFailureLimiter(2, 60_000);
		limiter.recordFailure('ip', 0);
		limiter.recordFailure('ip', 10_000);
		expect(limiter.isLimited('ip', 59_999)).toBe(true);
		expect(limiter.isLimited('ip', 60_000)).toBe(false);
	});
});
