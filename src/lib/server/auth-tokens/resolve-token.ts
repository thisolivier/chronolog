/**
 * Resolves a presented bearer token to a user id (pure logic; storage is injected so it
 * can be unit-tested without a database).
 *
 * Outcomes: `valid` (with userId), `revoked` (a real token whose row is revoked: 403),
 * `invalid` (unknown format, unknown id or wrong secret: 401).
 */

import { parseApiToken, tokenFingerprint, verifyTokenSecret } from './token-format';

export interface StoredApiToken {
	id: string;
	userId: string;
	tokenHash: string;
	lastUsedAt: Date | null;
	revokedAt: Date | null;
}

export interface TokenStorage {
	findTokenById(tokenId: string): Promise<StoredApiToken | null>;
	markTokenUsed(tokenId: string, usedAt: Date): Promise<void>;
}

export type TokenResolution =
	| { kind: 'valid'; userId: string; tokenId: string }
	| { kind: 'revoked'; tokenId: string }
	| { kind: 'invalid' };

/** Record last use at most once a minute per token, not on every request. */
export const LAST_USED_RESOLUTION_MS = 60_000;

export function createTokenResolver(storage: TokenStorage) {
	/** fingerprint of a verified raw token → its row id */
	const verifiedFingerprints = new Map<string, string>();

	return async function resolveApiToken(rawToken: string, now = new Date()): Promise<TokenResolution> {
		const parsed = parseApiToken(rawToken);
		if (!parsed) return { kind: 'invalid' };

		const stored = await storage.findTokenById(parsed.tokenId);
		if (!stored) return { kind: 'invalid' };

		const fingerprint = tokenFingerprint(rawToken);
		const alreadyVerified = verifiedFingerprints.get(fingerprint) === stored.id;
		if (!alreadyVerified) {
			if (!verifyTokenSecret(parsed.secret, stored.tokenHash)) return { kind: 'invalid' };
			verifiedFingerprints.set(fingerprint, stored.id);
		}

		// Revocation is read from the row on every request, so it takes effect immediately.
		if (stored.revokedAt !== null) return { kind: 'revoked', tokenId: stored.id };

		const lastUsed = stored.lastUsedAt?.getTime() ?? 0;
		if (now.getTime() - lastUsed >= LAST_USED_RESOLUTION_MS) {
			await storage.markTokenUsed(stored.id, now);
		}
		return { kind: 'valid', userId: stored.userId, tokenId: stored.id };
	};
}
