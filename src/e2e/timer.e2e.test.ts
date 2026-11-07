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

	it('Timer start uses the browser-sent local date and start time', async () => {
		// Yesterday evening (a future start is refused since sprint 041-CL; `confirmed` skips the overlap check)
		const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
		const yesterdayDate = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
		const startResponse = await authPost('/api/timer/start', {
			contractId,
			date: yesterdayDate,
			startTime: '23:40:00',
			confirmed: true
		});
		expect(startResponse.status).toBe(201);
		const startData = await startResponse.json();
		expect(startData.date).toBe(yesterdayDate);
		expect(startData.startTime).toBe('23:40:00');

		// Stop with a local end time after midnight: midnight-safe 30 minutes
		const stopResponse = await authPost('/api/timer/stop', { endTime: '00:10:00' });
		const stopData = await stopResponse.json();
		expect(stopData.durationMinutes).toBe(30);

		await authPost('/api/timer/discard', { entryId: startData.id });
	});

	it('Timer start ignores a malformed local date and falls back to the server clock', async () => {
		const startResponse = await authPost('/api/timer/start', { contractId, date: 'tomorrow' });
		const startData = await startResponse.json();
		expect(startData.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		await authPost('/api/timer/stop', {});
		await authPost('/api/timer/discard', { entryId: startData.id });
	});

	it('Timer save accepts an adjusted time and rejects one over 24 hours', async () => {
		const startData = await (await authPost('/api/timer/start', { contractId })).json();
		await authPost('/api/timer/stop', {});

		const rejected = await authPost('/api/timer/save', {
			entryId: startData.id,
			contractId,
			durationMinutes: 1500
		});
		expect(rejected.status).toBe(400);

		const adjusted = {
			entryId: startData.id,
			contractId,
			description: 'Adjusted timer entry',
			durationMinutes: 45,
			startTime: null,
			endTime: null
		};
		// Sprint 056-DR: time overrides need the start the client saw
		const unguarded = await authPost('/api/timer/save', adjusted);
		expect(unguarded.status).toBe(409);
		expect((await unguarded.json()).code).toBe('expected_start_required');
		const saved = await authPost('/api/timer/save', { ...adjusted, expectedStartedAt: `${startData.date}T${startData.startTime}` });
		expect(saved.ok).toBe(true);
		const savedEntry = await saved.json();
		expect(savedEntry.durationMinutes).toBe(45);
		expect(savedEntry.startTime).toBeNull();
		expect(savedEntry.isDraft).toBe(false);
	});
});
