/**
 * Device access key primitives (pure; only `node:crypto`).
 *
 * The raw key is 32 random bytes, base64url. Only its scrypt hash is configured on
 * the box, as `DEVICE_ACCESS_KEY_HASH=scrypt:<N>:<r>:<p>:<salt b64url>:<hash b64url>`
 * (colons, not `$`, so dotenv and docker compose do not try to expand it).
 *
 * The unlock cookie is an HMAC-SHA256 keyed with the configured hash. The server never
 * keeps the raw key, so the cookie must be verifiable from the hash alone; it holds
 * neither the key nor the hash, and rotating the key (new hash) invalidates every cookie.
 */

import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SCRYPT_COST = 16384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELISM = 1;
const HASH_LENGTH = 32;
const COOKIE_HMAC_MESSAGE = 'chronolog-device-unlock-v1';

export function generateDeviceKey(): string {
	return randomBytes(32).toString('base64url');
}

export function hashDeviceKey(rawKey: string): string {
	const salt = randomBytes(16);
	const derived = scryptSync(rawKey, salt, HASH_LENGTH, {
		N: SCRYPT_COST,
		r: SCRYPT_BLOCK_SIZE,
		p: SCRYPT_PARALLELISM
	});
	return ['scrypt', SCRYPT_COST, SCRYPT_BLOCK_SIZE, SCRYPT_PARALLELISM, salt.toString('base64url'), derived.toString('base64url')].join(':');
}

interface ParsedHash {
	cost: number;
	blockSize: number;
	parallelism: number;
	salt: Buffer;
	derived: Buffer;
}

/** Parses a configured hash; throws (without echoing it) when the format is wrong. */
export function parseDeviceKeyHash(configuredHash: string): ParsedHash {
	const parts = configuredHash.trim().split(':');
	const [scheme, costPart, blockPart, parallelPart, saltPart, derivedPart] = parts;
	const cost = Number(costPart);
	const blockSize = Number(blockPart);
	const parallelism = Number(parallelPart);
	if (
		parts.length !== 6 ||
		scheme !== 'scrypt' ||
		![cost, blockSize, parallelism].every((value) => Number.isInteger(value) && value > 0)
	) {
		throw new Error(
			'DEVICE_ACCESS_KEY_HASH is malformed; generate it with: node scripts/generate-device-key.mjs'
		);
	}
	const derived = Buffer.from(derivedPart, 'base64url');
	if (derived.length !== HASH_LENGTH) {
		throw new Error('DEVICE_ACCESS_KEY_HASH has the wrong hash length; regenerate it.');
	}
	return { cost, blockSize, parallelism, salt: Buffer.from(saltPart, 'base64url'), derived };
}

/** Constant-time scrypt comparison of a presented key against the configured hash. */
export function verifyDeviceKey(presentedKey: string, configuredHash: string): boolean {
	if (presentedKey.length === 0 || presentedKey.length > 256) return false;
	const parsed = parseDeviceKeyHash(configuredHash);
	const candidate = scryptSync(presentedKey, parsed.salt, parsed.derived.length, {
		N: parsed.cost,
		r: parsed.blockSize,
		p: parsed.parallelism
	});
	return timingSafeEqual(candidate, parsed.derived);
}

/** The value the unlock page stores in the `chronolog_device` cookie. */
export function deviceCookieValue(configuredHash: string): string {
	return createHmac('sha256', configuredHash.trim()).update(COOKIE_HMAC_MESSAGE).digest('base64url');
}

export function verifyDeviceCookie(cookieValue: string, configuredHash: string): boolean {
	const expected = Buffer.from(deviceCookieValue(configuredHash));
	const presented = Buffer.from(cookieValue);
	return presented.length === expected.length && timingSafeEqual(presented, expected);
}

/** Fingerprint used to memoise successful header checks without keeping the raw key. */
export function keyFingerprint(rawKey: string): string {
	return createHash('sha256').update(rawKey).digest('base64url');
}
