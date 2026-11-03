/**
 * E2E Tests: Timer Endpoints
 *
 * Verifies the timer lifecycle: status check, start, running status, stop, save/discard.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import './test-init';
import { authGet, authPost } from './helpers';

describe('Timer API', () => {
	let contractId: string;
	let timerEntryId: string;

	beforeAll(async () => {
		// Get the seeded "General" contract
		const contractsResponse = await authGet('/api/contracts');
		const contracts = await contractsResponse.json();
		const generalContract = contracts.find(
			(contract: { name: string }) => contract.name === 'General'
		);
		contractId = generalContract.id;
	});

	it('GET /api/timer/status returns current timer state (initially no timer)', async () => {
		const response = await authGet('/api/timer/status');
		expect(response.ok).toBe(true);

		const data = await response.json();
		expect(data).toHaveProperty('timer');
		// No running timer initially
		expect(data.timer).toBeNull();
	});

	it('POST /api/timer/start starts a timer', async () => {
		const response = await authPost('/api/timer/start', { contractId });
		expect(response.status).toBe(201);

		const data = await response.json();
		expect(data).toHaveProperty('id');
		expect(typeof data.id).toBe('string');

		timerEntryId = data.id;
	});

	it('GET /api/timer/status shows running timer', async () => {
		const response = await authGet('/api/timer/status');
		expect(response.ok).toBe(true);

		const data = await response.json();
		expect(data).toHaveProperty('timer');
		expect(data.timer).not.toBeNull();
		expect(data.timer.id).toBe(timerEntryId);
	});

	it('POST /api/timer/stop stops the timer and never yields a 0-minute entry', async () => {
		const response = await authPost('/api/timer/stop', {});
		expect(response.ok).toBe(true);

		const data = await response.json();
		expect(data).toHaveProperty('id');
		expect(data.id).toBe(timerEntryId);
		// Started a few seconds ago at most: sub-minute runs round up to 1 minute
		expect(data.durationMinutes).toBeGreaterThanOrEqual(1);
		expect(data.endTime).toBeTruthy();
	});

	it('GET /api/timer/status for a stopped draft includes contractId and duration', async () => {
		const response = await authGet('/api/timer/status');
		expect(response.ok).toBe(true);

		const data = await response.json();
		expect(data.timer).not.toBeNull();
		expect(data.timer.id).toBe(timerEntryId);
		expect(data.timer.contractId).toBe(contractId);
		expect(data.timer.endTime).toBeTruthy();
		expect(data.timer.durationMinutes).toBeGreaterThanOrEqual(1);
	});

	it('POST /api/timer/discard discards the stopped entry', async () => {
		const response = await authPost('/api/timer/discard', { entryId: timerEntryId });
		expect(response.ok).toBe(true);
	});

	it('Timer save flow: start, stop, save', async () => {
		// Start a new timer
		const startResponse = await authPost('/api/timer/start', { contractId });
		expect(startResponse.status).toBe(201);
		const startData = await startResponse.json();
		const newEntryId = startData.id;

		// Stop it
		const stopResponse = await authPost('/api/timer/stop', {});
		expect(stopResponse.ok).toBe(true);

		// Save it
		const saveResponse = await authPost('/api/timer/save', {
			entryId: newEntryId,
			contractId,
			description: 'Timer saved via e2e test'
		});
		expect(saveResponse.ok).toBe(true);

		// Verify timer status is now clear
		const statusResponse = await authGet('/api/timer/status');
		const statusData = await statusResponse.json();
		expect(statusData.timer).toBeNull();
	});
});
