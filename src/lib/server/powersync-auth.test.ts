import { describe, it, expect } from 'vitest';
import { getJWKS, generatePowerSyncToken } from './powersync-auth';
import { importJWK, jwtVerify } from 'jose';

describe('PowerSync Auth', () => {
	describe('getJWKS', () => {
		it('should return a valid JWKS with one key', async () => {
			const jwks = await getJWKS();

			expect(jwks).toHaveProperty('keys');
			expect(jwks.keys).toHaveLength(1);

			const publicKey = jwks.keys[0];
			expect(publicKey.kty).toBe('RSA');
			expect(publicKey.kid).toBe('chronolog-dev-1');
			expect(publicKey.alg).toBe('RS256');
			// Public key should have modulus and exponent but no private components
			expect(publicKey.n).toBeDefined();
			expect(publicKey.e).toBeDefined();
			expect(publicKey.d).toBeUndefined();
		});
	});

	describe('generatePowerSyncToken', () => {
		it('should return a token string and expiresAt timestamp', async () => {
			const result = await generatePowerSyncToken();

			expect(result).toHaveProperty('token');
			expect(result).toHaveProperty('expiresAt');
			expect(typeof result.token).toBe('string');
			expect(typeof result.expiresAt).toBe('number');
			expect(result.token.split('.')).toHaveLength(3); // JWT has 3 parts
		});

		it('should produce a token verifiable with the JWKS public key', async () => {
			const { token } = await generatePowerSyncToken();
			const jwks = await getJWKS();
			const publicKey = await importJWK(jwks.keys[0], 'RS256');

			const { payload } = await jwtVerify(token, publicKey, {
				audience: 'powersync'
			});

			expect(payload).toBeDefined();
		});

		it('should include correct claims (sub, aud, iat, exp)', async () => {
			const { token, expiresAt } = await generatePowerSyncToken();
			const jwks = await getJWKS();
			const publicKey = await importJWK(jwks.keys[0], 'RS256');

			const { payload } = await jwtVerify(token, publicKey, {
				audience: 'powersync'
			});

			expect(payload.sub).toBe('chronolog-user');
			expect(payload.aud).toBe('powersync');
			expect(payload.iat).toBeDefined();
			expect(payload.exp).toBe(expiresAt);
		});
	});
});
