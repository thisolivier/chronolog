/**
 * E2E Tests: Time Entries CRUD
 *
 * Verifies time entry creation, weekly retrieval, update, deletion,
 * weekly status setting, and week summaries.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import './test-init';
import { authGet, authPost, authPut, authDelete } from './helpers';

describe('Time Entries API', () => {
	let contractId: string;
	let createdEntryId: string;

	/** Get the Monday of the current ISO week */
	function getCurrentWeekMonday(): string {
		const now = new Date();
		const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
		const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
		const monday = new Date(now);
		monday.setDate(now.getDate() + mondayOffset);
		return monday.toISOString().split('T')[0];
	}

	beforeAll(async () => {
		// Get the seeded "General" contract
		const contractsResponse = await authGet('/api/contracts');
		const contracts = await contractsResponse.json();
		const generalContract = contracts.find(
			(contract: { name: string }) => contract.name === 'General'
		);
		contractId = generalContract.id;
	});

	it('POST /api/time-entries creates a time entry', async () => {
		const today = new Date().toISOString().split('T')[0];
		const response = await authPost('/api/time-entries', {
			contractId,
			date: today,
			durationMinutes: 60,
			description: 'E2E test time entry'
		});
		expect(response.status).toBe(201);

		const data = await response.json();
		expect(data).toHaveProperty('success', true);
		expect(data).toHaveProperty('entry');
		expect(data.entry).toHaveProperty('id');
		expect(typeof data.entry.id).toBe('string');

		createdEntryId = data.entry.id;
	});

	it('GET /api/time-entries/weekly?weeks=YYYY-MM-DD returns the entry in weekly format', async () => {
		const weekMonday = getCurrentWeekMonday();
		const response = await authGet(`/api/time-entries/weekly?weeks=${weekMonday}`);
		expect(response.ok).toBe(true);

		const data = await response.json();
		expect(data).toHaveProperty('weeks');
		expect(Array.isArray(data.weeks)).toBe(true);
		expect(data.weeks.length).toBeGreaterThanOrEqual(1);
	});

	it('PUT /api/time-entries/:id updates the entry', async () => {
		const response = await authPut(`/api/time-entries/${createdEntryId}`, {
			durationMinutes: 90,
			description: 'Updated E2E time entry'
		});
		expect(response.ok).toBe(true);

		const data = await response.json();
		expect(data).toHaveProperty('success', true);
		expect(data).toHaveProperty('entry');
	});

	it('DELETE /api/time-entries/:id deletes the entry', async () => {
		const response = await authDelete(`/api/time-entries/${createdEntryId}`);
		expect(response.ok).toBe(true);

		const data = await response.json();
		expect(data).toHaveProperty('success', true);
	});

	it('POST /api/time-entries/weekly-statuses sets a week status', async () => {
		const now = new Date();
		// Get ISO year and week number
		const tempDate = new Date(now.getTime());
		tempDate.setDate(tempDate.getDate() + 3 - ((tempDate.getDay() + 6) % 7));
		const isoYear = tempDate.getFullYear();
		const weekNumber = Math.ceil(
			((tempDate.getTime() - new Date(isoYear, 0, 4).getTime()) / 86400000 + 1) / 7
		);

		const response = await authPost('/api/time-entries/weekly-statuses', {
			year: isoYear,
			weekNumber,
			status: 'Submitted'
		});
		expect(response.ok).toBe(true);

		const data = await response.json();
		expect(data).toHaveProperty('success', true);
	});

	it('GET /api/weeks?count=4 returns week summaries', async () => {
		const response = await authGet('/api/weeks?count=4');
		expect(response.ok).toBe(true);

		const data = await response.json();
		expect(data).toHaveProperty('weeks');
		expect(Array.isArray(data.weeks)).toBe(true);
		expect(data.weeks.length).toBeLessThanOrEqual(4);

		if (data.weeks.length > 0) {
			const firstWeek = data.weeks[0];
			expect(firstWeek).toHaveProperty('weekStart');
			expect(firstWeek).toHaveProperty('year');
			expect(firstWeek).toHaveProperty('weekNumber');
			expect(firstWeek).toHaveProperty('totalMinutes');
			expect(firstWeek).toHaveProperty('status');
		}
	});
});
