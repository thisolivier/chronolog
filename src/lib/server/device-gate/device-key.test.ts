import { describe, it, expect } from 'vitest';
import {
	deviceCookieValue,
	generateDeviceKey,
	hashDeviceKey,
	parseDeviceKeyHash,
	verifyDeviceCookie,
	verifyDeviceKey
} from './device-key';
import { createLockoutTracker } from './lockout';

describe('device key hash', () => {
	const rawKey = generateDeviceKey();
	const configuredHash = hashDeviceKey(rawKey);

	it('generates a 32-byte base64url key and a colon-separated scrypt hash', () => {
		expect(Buffer.from(rawKey, 'base64url')).toHaveLength(32);
		expect(configuredHash).toMatch(/^scrypt:16384:8:1:[\w-]+:[\w-]+$/);
		expect(configuredHash).not.toContain(rawKey);
		expect(configuredHash).not.toContain('$');
	});

	it('verifies the right key and rejects wrong, empty or oversized keys', () => {
		expect(verifyDeviceKey(rawKey, configuredHash)).toBe(true);
		expect(verifyDeviceKey(generateDeviceKey(), configuredHash)).toBe(false);
		expect(verifyDeviceKey('', configuredHash)).toBe(false);
		expect(verifyDeviceKey('x'.repeat(1000), configuredHash)).toBe(false);
	});

	it('rejects malformed hashes', () => {
		expect(() => parseDeviceKeyHash('bcrypt:1:2:3:a:b')).toThrow(/malformed/);
		expect(() => parseDeviceKeyHash('scrypt:16384:8:1:c2FsdA:dG9vc2hvcnQ')).toThrow(/length/);
	});

	it('issues a cookie that holds neither key nor hash and changes when the key rotates', () => {
		const cookieValue = deviceCookieValue(configuredHash);
		expect(cookieValue).not.toContain(rawKey);
		expect(configuredHash).not.toContain(cookieValue);
		expect(verifyDeviceCookie(cookieValue, configuredHash)).toBe(true);
		expect(verifyDeviceCookie(cookieValue, hashDeviceKey(rawKey))).toBe(false);
		expect(verifyDeviceCookie('forged', configuredHash)).toBe(false);
	});
});

describe('lockout tracker', () => {
	it('locks an IP after five failures for fifteen minutes, independently per IP', () => {
		let currentTime = 1_000_000;
		const tracker = createLockoutTracker({ now: () => currentTime });

		for (let attempt = 1; attempt <= 4; attempt += 1) {
			expect(tracker.recordFailure('203.0.113.9')).toBe(false);
		}
		expect(tracker.isLocked('203.0.113.9')).toBe(false);
		expect(tracker.recordFailure('203.0.113.9')).toBe(true);
		expect(tracker.isLocked('203.0.113.9')).toBe(true);
		expect(tracker.isLocked('198.51.100.1')).toBe(false);

		currentTime += 15 * 60 * 1000 - 1;
		expect(tracker.isLocked('203.0.113.9')).toBe(true);
		currentTime += 2;
		expect(tracker.isLocked('203.0.113.9')).toBe(false);
	});

	it('clears the failure count on success', () => {
		const tracker = createLockoutTracker();
		for (let attempt = 1; attempt <= 4; attempt += 1) tracker.recordFailure('192.0.2.5');
		tracker.recordSuccess('192.0.2.5');
		expect(tracker.recordFailure('192.0.2.5')).toBe(false);
	});
});
