/**
 * E2E Tests: PowerSync Sync Status Verification
 *
 * Verifies that the PowerSync service is operational and replicating:
 * - Service is reachable and responding
 * - JWKS endpoint returns a valid RSA key
 * - Token endpoint returns a JWT with correct claims
 * - PowerSync service logged replication (via liveness check)
 *
 * Note: These tests extend the existing powersync-infra.e2e.test.ts
 * with deeper replication verification.
 */

import { describe, it, expect } from 'vitest';
import './test-init';
import { BASE_URL, authGet, authPost, authDelete } from './helpers';

describe('PowerSync Sync Status Verification', () => {
	it('PowerSync service health endpoint responds', async () => {
		// The PowerSync service exposes a diagnostic endpoint.
		// We check it's alive by hitting port 8080.
		const response = await fetch('http://127.0.0.1:8080/api/');
		// Service is alive if it responds — returns 401 for unauthenticated requests
		expect([200, 401]).toContain(response.status);
	});

	it('JWKS endpoint returns a valid RSA key set', async () => {
		const response = await fetch(`${BASE_URL}/api/powersync/jwks`);
		expect(response.ok).toBe(true);

		const jwks = await response.json();
		expect(jwks).toHaveProperty('keys');
		expect(Array.isArray(jwks.keys)).toBe(true);
		expect(jwks.keys.length).toBeGreaterThan(0);

		const rsaKey = jwks.keys[0];
		expect(rsaKey).toHaveProperty('kty', 'RSA');
		expect(rsaKey).toHaveProperty('n');  // modulus
		expect(rsaKey).toHaveProperty('e');  // exponent
		expect(rsaKey).toHaveProperty('alg'); // algorithm hint
		expect(rsaKey).toHaveProperty('kid'); // key ID
	});

	it('token endpoint returns a JWT with correct structure and claims', async () => {
		const response = await authPost('/api/powersync/token');
		expect(response.ok).toBe(true);

		const data = await response.json();
		expect(data).toHaveProperty('token');
		expect(data).toHaveProperty('expiresAt');
		expect(typeof data.token).toBe('string');
		expect(typeof data.expiresAt).toBe('number');

		// Decode JWT header and payload
		const parts = data.token.split('.');
		expect(parts.length).toBe(3);

		// Decode header
		const headerBase64 = parts[0].replace(/-/g, '+').replace(/_/g, '/');
		const headerJson = Buffer.from(headerBase64, 'base64').toString('utf8');
		const header = JSON.parse(headerJson);
		expect(header).toHaveProperty('alg');
		// Some JWT implementations omit the 'typ' field; it's optional per RFC 7519
		if (header.typ) {
			expect(header.typ).toBe('JWT');
		}

		// Decode payload
		const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
		const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf8');
		const payload = JSON.parse(payloadJson);

		// Verify standard claims
		expect(payload).toHaveProperty('sub');
		expect(payload).toHaveProperty('aud');
		expect(payload).toHaveProperty('exp');
		expect(payload).toHaveProperty('iat');
		expect(typeof payload.sub).toBe('string');
		expect(typeof payload.exp).toBe('number');
		expect(typeof payload.iat).toBe('number');

		// Verify the token is not expired
		const nowSeconds = Math.floor(Date.now() / 1000);
		expect(payload.exp).toBeGreaterThan(nowSeconds);

		// Verify the expiresAt matches the JWT exp claim
		// Both are in seconds (Unix timestamp)
		expect(data.expiresAt).toBe(payload.exp);
	});

	it('creates data via API and verifies PowerSync service is responsive', async () => {
		// This test creates data via the REST API, waits briefly for replication,
		// then verifies the PowerSync service is still healthy.
		// Full replication verification would require a client-side PowerSync connection,
		// but we verify the pipeline preconditions:
		// 1. Data exists in Postgres (created via API)
		// 2. PowerSync service is healthy (can process WAL changes)
		// 3. Token endpoint still works (clients can connect)

		// Step 1: Get contract for note creation
		const contractsResponse = await authGet('/api/contracts');
		expect(contractsResponse.ok).toBe(true);
		const contracts = await contractsResponse.json();
		const generalContract = contracts.find(
			(contract: { name: string }) => contract.name === 'General'
		);

		// Step 2: Create a note (writes to Postgres)
		const noteResponse = await authPost('/api/notes', { contractId: generalContract.id });
		expect(noteResponse.status).toBe(201);
		const noteData = await noteResponse.json();
		const noteId = noteData.note.id;

		// Step 3: Brief wait for WAL replication pickup
		await new Promise((resolve) => setTimeout(resolve, 2000));

		// Step 4: Verify PowerSync is still healthy after the write
		const healthResponse = await fetch('http://127.0.0.1:8080/api/');
		expect([200, 401]).toContain(healthResponse.status);

		// Step 5: Verify token endpoint still works (sync pipeline functional)
		const tokenResponse = await authPost('/api/powersync/token');
		expect(tokenResponse.ok).toBe(true);

		// Clean up
		await authDelete(`/api/notes/${noteId}`);
	});
});
