import { describe, expect, it, vi } from 'vitest';
import { generateApiToken } from './token-format';
import { createTokenResolver, LAST_USED_RESOLUTION_MS, type StoredApiToken, type TokenStorage } from './resolve-token';

function storageWith(rows: StoredApiToken[]) {
	const byId = new Map(rows.map((row) => [row.id, row]));
	const storage: TokenStorage = {
		findTokenById: vi.fn(async (tokenId: string) => byId.get(tokenId) ?? null),
		markTokenUsed: vi.fn(async (tokenId: string, usedAt: Date) => {
			const row = byId.get(tokenId);
			if (row) row.lastUsedAt = usedAt;
		})
	};
	return storage;
}

function storedFor(generated: ReturnType<typeof generateApiToken>, overrides: Partial<StoredApiToken> = {}): StoredApiToken {
	return { id: generated.tokenId, userId: 'user-1', tokenHash: generated.secretHash, lastUsedAt: null, revokedAt: null, ...overrides };
}

describe('API token resolution', () => {
	it('resolves a valid token to its user and records last use', async () => {
		const generated = generateApiToken();
		const storage = storageWith([storedFor(generated)]);
		const resolve = createTokenResolver(storage);
		expect(await resolve(generated.rawToken)).toEqual({ kind: 'valid', userId: 'user-1', tokenId: generated.tokenId });
		expect(storage.markTokenUsed).toHaveBeenCalledTimes(1);
	});

	it('records last use at most once a minute', async () => {
		const generated = generateApiToken();
		const storage = storageWith([storedFor(generated)]);
		const resolve = createTokenResolver(storage);
		const start = new Date('2026-11-03T10:00:00Z');
		await resolve(generated.rawToken, start);
		await resolve(generated.rawToken, new Date(start.getTime() + 1000));
		expect(storage.markTokenUsed).toHaveBeenCalledTimes(1);
		await resolve(generated.rawToken, new Date(start.getTime() + LAST_USED_RESOLUTION_MS));
		expect(storage.markTokenUsed).toHaveBeenCalledTimes(2);
	});

	it('answers revoked (403) for a real but revoked token, even after it was cached as verified', async () => {
		const generated = generateApiToken();
		const row = storedFor(generated);
		const resolve = createTokenResolver(storageWith([row]));
		expect((await resolve(generated.rawToken)).kind).toBe('valid');
		row.revokedAt = new Date();
		expect(await resolve(generated.rawToken)).toEqual({ kind: 'revoked', tokenId: generated.tokenId });
	});

	it('answers invalid for a wrong secret, an unknown id or a malformed token', async () => {
		const generated = generateApiToken();
		const resolve = createTokenResolver(storageWith([storedFor(generated)]));
		const wrongSecret = generated.rawToken.slice(0, -4) + 'AAAA';
		expect((await resolve(wrongSecret)).kind).toBe('invalid');
		expect((await resolve(generateApiToken().rawToken)).kind).toBe('invalid');
		expect((await resolve('Bearer-ish nonsense')).kind).toBe('invalid');
	});

	it('does not reveal revocation to someone holding the id with a wrong secret', async () => {
		const generated = generateApiToken();
		const resolve = createTokenResolver(storageWith([storedFor(generated, { revokedAt: new Date() })]));
		const wrongSecret = generated.rawToken.slice(0, -4) + 'AAAA';
		expect((await resolve(wrongSecret)).kind).toBe('invalid');
	});
});
