/**
 * E2E Tests: Clients
 *
 * Verifies that the client endpoints return the seeded "Internal" client.
 */

import { describe, it, expect } from 'vitest';
import './test-init';
import { authGet } from './helpers';

describe('Clients API', () => {
	it('GET /api/clients returns the seeded "Internal" client', async () => {
		const response = await authGet('/api/clients');
		expect(response.ok).toBe(true);

		const data = await response.json();
		expect(data).toHaveProperty('clients');
		expect(Array.isArray(data.clients)).toBe(true);
		expect(data.clients.length).toBeGreaterThanOrEqual(1);

		const internalClient = data.clients.find(
			(client: { name: string }) => client.name === 'Internal'
		);
		expect(internalClient).toBeDefined();
		expect(internalClient).toHaveProperty('id');
		expect(typeof internalClient.id).toBe('string');
		expect(internalClient).toHaveProperty('name', 'Internal');
		expect(internalClient).toHaveProperty('shortCode');
	});
});
