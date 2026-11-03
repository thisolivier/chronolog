/**
 * Personal API token format and hashing (pure; only `node:crypto` via device-key).
 *
 * Raw token: `clg_<32 hex: token row id without dashes>_<43 chars base64url: 32 random bytes>`.
 * The id part makes lookup a primary-key read; only the scrypt hash of the secret part is
 * stored (same `scrypt:N:r:p:salt:hash` format as the device key, so the primitives are shared).
 */

import { randomBytes, randomUUID } from 'node:crypto';
import { hashDeviceKey, keyFingerprint, verifyDeviceKey } from '$lib/server/device-gate/device-key';

export const API_TOKEN_PREFIX = 'clg_';
const TOKEN_PATTERN = /^clg_([0-9a-f]{32})_([A-Za-z0-9_-]{43})$/;

export interface ParsedApiToken {
	/** Row id in uuid form (with dashes). */
	tokenId: string;
	secret: string;
}

export interface GeneratedApiToken extends ParsedApiToken {
	rawToken: string;
	secretHash: string;
}

export function generateApiToken(): GeneratedApiToken {
	const tokenId = randomUUID();
	const secret = randomBytes(32).toString('base64url');
	return {
		tokenId,
		secret,
		rawToken: `${API_TOKEN_PREFIX}${tokenId.replace(/-/g, '')}_${secret}`,
		secretHash: hashDeviceKey(secret)
	};
}

/** Splits a presented token into id and secret, or null when it is not in our format. */
export function parseApiToken(presented: string): ParsedApiToken | null {
	const match = presented.trim().match(TOKEN_PATTERN);
	if (!match) return null;
	const hex = match[1];
	const tokenId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
	return { tokenId, secret: match[2] };
}

export function verifyTokenSecret(secret: string, storedHash: string): boolean {
	return verifyDeviceKey(secret, storedHash);
}

/** Memo key for a verified token, so scrypt runs once per token per process. */
export function tokenFingerprint(rawToken: string): string {
	return keyFingerprint(rawToken.trim());
}

/** Reads `Authorization: Bearer <token>`; null when absent or another scheme. */
export function readBearerToken(authorizationHeader: string | null): string | null {
	if (!authorizationHeader) return null;
	const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
	return match ? match[1].trim() : null;
}
