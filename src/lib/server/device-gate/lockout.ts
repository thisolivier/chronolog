/**
 * In-memory failure counter per client IP: `maxFailures` wrong keys lock the IP
 * for `lockDurationMs`. Resets on process restart, which is acceptable for a
 * single-instance app (Cloudflare rate limits sit in front of it as well).
 */

export interface LockoutOptions {
	maxFailures?: number;
	lockDurationMs?: number;
	now?: () => number;
}

interface LockoutEntry {
	failures: number;
	lockedUntil: number;
}

export function createLockoutTracker(options: LockoutOptions = {}) {
	const maxFailures = options.maxFailures ?? 5;
	const lockDurationMs = options.lockDurationMs ?? 15 * 60 * 1000;
	const now = options.now ?? Date.now;
	const entriesByIp = new Map<string, LockoutEntry>();

	function isLocked(clientIp: string): boolean {
		const entry = entriesByIp.get(clientIp);
		if (!entry || entry.lockedUntil === 0) return false;
		if (entry.lockedUntil > now()) return true;
		entriesByIp.delete(clientIp); // lock expired: start counting afresh
		return false;
	}

	/** Records a failure; returns true when this failure triggered a new lock. */
	function recordFailure(clientIp: string): boolean {
		const entry = entriesByIp.get(clientIp) ?? { failures: 0, lockedUntil: 0 };
		entry.failures += 1;
		const triggeredLock = entry.failures >= maxFailures && entry.lockedUntil === 0;
		if (triggeredLock) entry.lockedUntil = now() + lockDurationMs;
		entriesByIp.set(clientIp, entry);
		return triggeredLock;
	}

	function recordSuccess(clientIp: string): void {
		entriesByIp.delete(clientIp);
	}

	return { isLocked, recordFailure, recordSuccess, lockDurationMs };
}

export type LockoutTracker = ReturnType<typeof createLockoutTracker>;
