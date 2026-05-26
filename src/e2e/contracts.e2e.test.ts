/**
 * E2E Tests: Contracts
 *
 * Verifies contract listing and creation.
 */

import { describe, it, expect } from 'vitest';
import './test-init';
import { authGet, authPost } from './helpers';

describe('Contracts API', () => {
	let seededClientId: string;

	it('GET /api/contracts returns the seeded "General" contract', async () => {
		const response = await authGet('/api/contracts');
		expect(response.ok).toBe(true);

		const contracts = await response.json();
		expect(Array.isArray(contracts)).toBe(true);
		expect(contracts.length).toBeGreaterThanOrEqual(1);

		const generalContract = contracts.find(
			(contract: { name: string }) => contract.name === 'General'
		);
		expect(generalContract).toBeDefined();
		expect(generalContract).toHaveProperty('id');
		expect(generalContract).toHaveProperty('clientId');
		expect(generalContract).toHaveProperty('isActive');

		// Save the clientId for later tests
		seededClientId = generalContract.clientId;
	});

	it('GET /api/contracts-by-client returns contracts grouped with client info', async () => {
		const response = await authGet('/api/contracts-by-client');
		expect(response.ok).toBe(true);

		const data = await response.json();
		expect(data).toHaveProperty('contracts');
		expect(Array.isArray(data.contracts)).toBe(true);
		expect(data.contracts.length).toBeGreaterThanOrEqual(1);

		const firstContract = data.contracts[0];
		expect(firstContract).toHaveProperty('id');
		expect(firstContract).toHaveProperty('name');
		expect(firstContract).toHaveProperty('clientId');
		expect(firstContract).toHaveProperty('clientName');
		expect(firstContract).toHaveProperty('clientShortCode');
		expect(firstContract).toHaveProperty('noteCount');
	});

	it('POST /api/contracts creates a new contract', async () => {
		// Ensure we have the clientId
		if (!seededClientId) {
			const contractsResponse = await authGet('/api/contracts');
			const contracts = await contractsResponse.json();
			seededClientId = contracts[0].clientId;
		}

		const response = await authPost('/api/contracts', {
			clientId: seededClientId,
			name: 'E2E Test Contract',
			description: 'Created by e2e test harness',
			isActive: true
		});
		expect(response.status).toBe(201);

		const data = await response.json();
		expect(data).toHaveProperty('contract');
		expect(data.contract).toHaveProperty('id');
		expect(typeof data.contract.id).toBe('string');

		// Verify it appears in subsequent GET
		const listResponse = await authGet('/api/contracts');
		const updatedContracts = await listResponse.json();
		const newContract = updatedContracts.find(
			(contract: { name: string }) => contract.name === 'E2E Test Contract'
		);
		expect(newContract).toBeDefined();
	});
});
