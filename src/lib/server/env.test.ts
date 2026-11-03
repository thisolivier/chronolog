import { describe, it, expect } from 'vitest';
import {
	parseServerEnvironment,
	parseTrustedOrigins,
	parseBooleanFlag,
	DEFAULT_BETTER_AUTH_URL,
	BUILD_TIME_PLACEHOLDER_SECRET
} from './env';
import { hashDeviceKey } from './device-gate/device-key';

// 32 bytes, base64 — a test-only key
const testEncryptionKey = Buffer.alloc(32, 7).toString('base64');
const testDeviceHash = hashDeviceKey('test-device-key');

const completeSource = {
	BETTER_AUTH_SECRET: 'test-secret',
	ENCRYPTION_KEY: testEncryptionKey
};

describe('parseServerEnvironment', () => {
	it('throws naming the missing variable when BETTER_AUTH_SECRET is absent', () => {
		expect(() => parseServerEnvironment({ ENCRYPTION_KEY: 'key' })).toThrow(
			/Missing required environment variable\(s\): BETTER_AUTH_SECRET/
		);
	});

	it('names every missing variable when both secrets are absent', () => {
		expect(() => parseServerEnvironment({})).toThrow(
			/BETTER_AUTH_SECRET, ENCRYPTION_KEY/
		);
	});

	it('treats whitespace-only secrets as missing', () => {
		expect(() =>
			parseServerEnvironment({ BETTER_AUTH_SECRET: '   ', ENCRYPTION_KEY: 'key' })
		).toThrow(/BETTER_AUTH_SECRET/);
	});

	it('passes when both secrets are present and applies defaults', () => {
		const environment = parseServerEnvironment(completeSource);
		expect(environment.betterAuthSecret).toBe('test-secret');
		expect(environment.encryptionKey).toBe(testEncryptionKey);
		expect(environment.encryptionKeyBytes).toHaveLength(32);
		expect(environment.deviceAccessKeyHash).toBeNull();
		expect(environment.betterAuthUrl).toBe(DEFAULT_BETTER_AUTH_URL);
		expect(environment.allowRegistration).toBe(false);
		expect(environment.trustedOrigins).toEqual([DEFAULT_BETTER_AUTH_URL]);
	});

	it('substitutes a placeholder for missing secrets when requireSecrets is false (build time)', () => {
		const environment = parseServerEnvironment({}, { requireSecrets: false });
		expect(environment.betterAuthSecret).toBe(BUILD_TIME_PLACEHOLDER_SECRET);
		expect(environment.encryptionKey).toBe(BUILD_TIME_PLACEHOLDER_SECRET);
	});

	it('rejects an ENCRYPTION_KEY that is not base64 of exactly 32 bytes', () => {
		expect(() =>
			parseServerEnvironment({ ...completeSource, ENCRYPTION_KEY: 'test-encryption-key' })
		).toThrow(/ENCRYPTION_KEY must decode to 32 bytes/);
		expect(() =>
			parseServerEnvironment({ ...completeSource, ENCRYPTION_KEY: 'not base64!' })
		).toThrow(/ENCRYPTION_KEY must be base64/);
	});

	it('requires DEVICE_ACCESS_KEY_HASH in production but not in development', () => {
		expect(() => parseServerEnvironment(completeSource, { isProduction: true })).toThrow(
			/DEVICE_ACCESS_KEY_HASH/
		);
		expect(parseServerEnvironment(completeSource).deviceAccessKeyHash).toBeNull();
		expect(
			parseServerEnvironment(
				{ ...completeSource, DEVICE_ACCESS_KEY_HASH: testDeviceHash },
				{ isProduction: true }
			).deviceAccessKeyHash
		).toBe(testDeviceHash);
	});

	it('rejects a malformed DEVICE_ACCESS_KEY_HASH without echoing it', () => {
		expect(() =>
			parseServerEnvironment({ ...completeSource, DEVICE_ACCESS_KEY_HASH: 'sha1:abc' })
		).toThrow(/DEVICE_ACCESS_KEY_HASH is malformed/);
	});

	it('reads ALLOW_REGISTRATION, BETTER_AUTH_URL and TRUSTED_ORIGINS', () => {
		const environment = parseServerEnvironment({
			...completeSource,
			BETTER_AUTH_URL: 'https://chronolog.example',
			ALLOW_REGISTRATION: 'true',
			TRUSTED_ORIGINS: 'http://100.64.0.1:5173, https://tailnet.example'
		});
		expect(environment.allowRegistration).toBe(true);
		expect(environment.betterAuthUrl).toBe('https://chronolog.example');
		expect(environment.trustedOrigins).toEqual([
			'https://chronolog.example',
			'http://100.64.0.1:5173',
			'https://tailnet.example'
		]);
	});
});

describe('parseBooleanFlag', () => {
	it('only accepts "true" (case-insensitive, trimmed)', () => {
		expect(parseBooleanFlag('true')).toBe(true);
		expect(parseBooleanFlag(' TRUE ')).toBe(true);
		expect(parseBooleanFlag('1')).toBe(false);
		expect(parseBooleanFlag('yes')).toBe(false);
		expect(parseBooleanFlag(undefined)).toBe(false);
	});
});

describe('parseTrustedOrigins', () => {
	it('trims entries, drops empties and duplicates, and always includes the base URL', () => {
		expect(
			parseTrustedOrigins(' https://a.example ,, https://b.example ,https://a.example', 'https://base.example')
		).toEqual(['https://base.example', 'https://a.example', 'https://b.example']);
	});

	it('returns only the base URL when the list is empty or undefined', () => {
		expect(parseTrustedOrigins('', 'https://base.example')).toEqual(['https://base.example']);
		expect(parseTrustedOrigins(undefined, 'https://base.example')).toEqual(['https://base.example']);
	});
});
