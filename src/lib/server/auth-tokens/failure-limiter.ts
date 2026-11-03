/**
 * Sliding-window failure counter per client IP (in memory, per process).
 *
 * Auth paths (bearer tokens, Better Auth sign-in) record failures here; once an IP has
 * `maxFailures` within `windowMs`, further attempts get 429 until old failures age out.
 * A success does not reset the window: the limit is about guessing volume.
 */

export interface FailureLimiter {
	isLimited(clientIp: string, now?: number): boolean;
	recordFailure(clientIp: string, now?: number): void;
	readonly maxFailures: number;
	readonly windowMs: number;
}

export function createFailureLimiter(maxFailures = 60, windowMs = 60_000): FailureLimiter {
	const failuresByIp = new Map<string, number[]>();

	function recentFailures(clientIp: string, now: number): number[] {
		const kept = (failuresByIp.get(clientIp) ?? []).filter((timestamp) => now - timestamp < windowMs);
		if (kept.length === 0) failuresByIp.delete(clientIp);
		else failuresByIp.set(clientIp, kept);
		return kept;
	}

	return {
		maxFailures,
		windowMs,
		isLimited(clientIp, now = Date.now()) {
			return recentFailures(clientIp, now).length >= maxFailures;
		},
		recordFailure(clientIp, now = Date.now()) {
			const kept = recentFailures(clientIp, now);
			kept.push(now);
			failuresByIp.set(clientIp, kept);
		}
	};
}
