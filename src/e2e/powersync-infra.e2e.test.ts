/**
 * E2E Tests: PowerSync Infrastructure
 *
 * Verifies that the PowerSync JWKS, token, and service liveness endpoints work.
 */

import { describe, it, expect } from 'vitest';
import './test-init';
import { BASE_URL, authGet, authPost } from './helpers';

describe('PowerSync Infrastructure', () => {
	it('GET /api/powersync/jwks returns valid JWKS with RSA key', async () => {
		// JWKS endpoint does not require auth
		const response = await fetch(`${BASE_URL}/api/powersync/jwks`);
		expect(response.ok).toBe(true);

		const jwks = await response.json();
		expect(jwks).toHaveProperty('keys');
		expect(Array.isArray(jwks.keys)).toBe(true);
		expect(jwks.keys.length).toBeGreaterThan(0);

		const firstKey = jwks.keys[0];
		expect(firstKey).toHaveProperty('kty', 'RSA');
		expect(firstKey).toHaveProperty('n');
		expect(firstKey).toHaveProperty('e');
	});

	it('POST /api/powersync/token returns JWT with expected claims', async () => {
		const response = await authPost('/api/powersync/token');
		expect(response.ok).toBe(true);

		const data = await response.json();
		expect(data).toHaveProperty('token');
		expect(data).toHaveProperty('expiresAt');
		expect(typeof data.token).toBe('string');

		// Decode the JWT payload (base64url)
		const parts = data.token.split('.');
		expect(parts.length).toBe(3);

		const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
		const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf8');
		const payload = JSON.parse(payloadJson);

		expect(payload).toHaveProperty('sub');
		expect(payload).toHaveProperty('aud');
		expect(payload).toHaveProperty('exp');
		expect(typeof payload.sub).toBe('string');
		expect(typeof payload.exp).toBe('number');
	});

	it('PowerSync service is reachable on port 8080', async () => {
		// The PowerSync service is running and reachable.
		// We verify by hitting the /api/ endpoint which returns a LoginRequired error
		// (confirming the service is alive and responding).
		const response = await fetch('http://127.0.0.1:8080/api/');
		// Service is alive if it responds at all — it returns 401 for unauthenticated requests
		expect([200, 401]).toContain(response.status);
	});
});
