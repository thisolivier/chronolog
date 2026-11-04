/**
 * E2E Tests: Deliverables and Work Types
 *
 * Verifies the reference data endpoints for deliverables and work types,
 * including UUID validation of their query parameters (400, never 500).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import './test-init';
import { authGet } from './helpers';

describe('Reference Data API', () => {
	let contractId: string;

	beforeAll(async () => {
		// Get the seeded "General" contract
		const contractsResponse = await authGet('/api/contracts');
		const contracts = await contractsResponse.json();
		const generalContract = contracts.find(
			(contract: { name: string }) => contract.name === 'General'
		);
		contractId = generalContract.id;
	});

	it('GET /api/deliverables?contractId=X returns deliverables (may be empty)', async () => {
		const response = await authGet(`/api/deliverables?contractId=${contractId}`);
		expect(response.ok).toBe(true);

		const data = await response.json();
		expect(Array.isArray(data)).toBe(true);
		// May be empty for a new contract — that's fine
	});

	it('GET /api/deliverables without contractId returns 400', async () => {
		const response = await authGet('/api/deliverables');
		expect(response.status).toBe(400);
	});

	it('GET /api/deliverables?contractId=<non-uuid> returns 400, not 500', async () => {
		const response = await authGet('/api/deliverables?contractId=nonexistent');
		expect(response.status).toBe(400);
	});

	it('GET /api/work-types?deliverableId=X returns work types for a real deliverable (when any exist)', async () => {
		const deliverablesResponse = await authGet(`/api/deliverables?contractId=${contractId}`);
		const deliverables = await deliverablesResponse.json();

		if (deliverables.length === 0) {
			// No deliverables on the seeded contract — a deliverable that is not the caller's is 404 (sprint 031-CL)
			const response = await authGet(
				'/api/work-types?deliverableId=00000000-0000-4000-8000-000000000000'
			);
			expect(response.status).toBe(404);
			return;
		}

		const response = await authGet(`/api/work-types?deliverableId=${deliverables[0].id}`);
		expect(response.ok).toBe(true);
		expect(Array.isArray(await response.json())).toBe(true);
	});

	it('GET /api/work-types without deliverableId returns 400', async () => {
		const response = await authGet('/api/work-types');
		expect(response.status).toBe(400);
	});

	it('GET /api/work-types?deliverableId=<non-uuid> returns 400, not 500', async () => {
		const response = await authGet('/api/work-types?deliverableId=nonexistent');
		expect(response.status).toBe(400);
	});
});
