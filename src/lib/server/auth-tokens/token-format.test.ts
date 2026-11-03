import { describe, expect, it } from 'vitest';
import { generateApiToken, parseApiToken, readBearerToken, verifyTokenSecret } from './token-format';

describe('API token format and hashing', () => {
	it('generates a clg_ token whose id and secret round-trip through parse', () => {
		const generated = generateApiToken();
		expect(generated.rawToken).toMatch(/^clg_[0-9a-f]{32}_[A-Za-z0-9_-]{43}$/);
		expect(parseApiToken(generated.rawToken)).toEqual({ tokenId: generated.tokenId, secret: generated.secret });
	});

	it('stores only a scrypt hash that verifies the secret and rejects another', () => {
		const generated = generateApiToken();
		expect(generated.secretHash.startsWith('scrypt:')).toBe(true);
		expect(generated.secretHash).not.toContain(generated.secret);
		expect(verifyTokenSecret(generated.secret, generated.secretHash)).toBe(true);
		expect(verifyTokenSecret(generateApiToken().secret, generated.secretHash)).toBe(false);
	});

	it('rejects tokens that are not in the clg_ format', () => {
		expect(parseApiToken('nope')).toBeNull();
		expect(parseApiToken('clg_abc_def')).toBeNull();
		expect(parseApiToken(`clg_${'g'.repeat(32)}_${'a'.repeat(43)}`)).toBeNull();
	});

	it('reads only the Bearer scheme from the Authorization header', () => {
		expect(readBearerToken('Bearer clg_x')).toBe('clg_x');
		expect(readBearerToken('bearer   clg_y ')).toBe('clg_y');
		expect(readBearerToken('Basic abc')).toBeNull();
		expect(readBearerToken(null)).toBeNull();
	});
});
