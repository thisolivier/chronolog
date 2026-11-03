/**
 * E2E Tests: Time Entries CRUD
 *
 * Verifies time entry creation, weekly retrieval, update, deletion,
 * weekly status setting, week summaries, and deliverable / work type persistence.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import './test-init';
import { BASE_URL, authGet, authPost, authPut, authDelete, getSessionCookies } from './helpers';

type WeeklyEntry = {
	id: string;
	deliverableId: string | null;
	deliverableName: string | null;
	workTypeId: string | null;
	workTypeName: string | null;
};

describe('Time Entries API', () => {
	let contractId: string;
	let clientId: string;
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

	/** Find one entry by id in the current week's weekly payload */
	async function findWeeklyEntry(entryId: string): Promise<WeeklyEntry | undefined> {
		const response = await authGet(`/api/time-entries/weekly?weeks=${getCurrentWeekMonday()}`);
		const data = await response.json();
		for (const week of data.weeks) {
			for (const day of week.days) {
				const match = day.entries.find((entry: WeeklyEntry) => entry.id === entryId);
				if (match) return match;
			}
		}
		return undefined;
	}

	/**
	 * Deliverables and work types have no JSON API; create them through the admin
	 * contract page's form actions (same session cookies, SvelteKit action protocol).
	 */
	async function submitAdminContractAction(
		actionName: string,
		fields: Record<string, string>
	): Promise<void> {
		const response = await fetch(
			`${BASE_URL}/admin/clients/${clientId}/contracts/${contractId}?/${actionName}`,
			{
				method: 'POST',
				headers: {
					Cookie: getSessionCookies().join('; '),
					Origin: BASE_URL,
					'Content-Type': 'application/x-www-form-urlencoded',
					'x-sveltekit-action': 'true'
				},
				body: new URLSearchParams(fields).toString(),
				redirect: 'manual'
			}
		);
		expect(response.ok).toBe(true);
		const result = await response.json();
		expect(result.type).toBe('success');
	}

	beforeAll(async () => {
		// Get the seeded "General" contract
		const contractsResponse = await authGet('/api/contracts');
		const contracts = await contractsResponse.json();
		const generalContract = contracts.find(
			(contract: { name: string }) => contract.name === 'General'
		);
		contractId = generalContract.id;
		clientId = generalContract.clientId;
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

	describe('deliverable and work type', () => {
		const deliverableName = `E2E Deliverable ${Date.now().toString(36)}`;
		const workTypeName = 'E2E Work Type';
		let deliverableId: string;
		let workTypeId: string;
		let entryWithDeliverableId: string;

		beforeAll(async () => {
			await submitAdminContractAction('createDeliverable', { name: deliverableName });
			const deliverablesResponse = await authGet(`/api/deliverables?contractId=${contractId}`);
			const deliverables = await deliverablesResponse.json();
			deliverableId = deliverables.find(
				(deliverable: { name: string }) => deliverable.name === deliverableName
			).id;

			await submitAdminContractAction('createWorkType', {
				deliverable_id: deliverableId,
				name: workTypeName
			});
			const workTypesResponse = await authGet(`/api/work-types?deliverableId=${deliverableId}`);
			const workTypes = await workTypesResponse.json();
			workTypeId = workTypes.find((workType: { name: string }) => workType.name === workTypeName).id;
		});

		it('POST /api/time-entries persists deliverableId and workTypeId', async () => {
			const today = new Date().toISOString().split('T')[0];
			const response = await authPost('/api/time-entries', {
				contractId,
				deliverableId,
				workTypeId,
				date: today,
				durationMinutes: 30,
				description: 'E2E entry with deliverable'
			});
			expect(response.status).toBe(201);
			const data = await response.json();
			entryWithDeliverableId = data.entry.id;
			expect(data.entry.deliverableId).toBe(deliverableId);
			expect(data.entry.workTypeId).toBe(workTypeId);

			const weeklyEntry = await findWeeklyEntry(entryWithDeliverableId);
			expect(weeklyEntry).toBeDefined();
			expect(weeklyEntry?.deliverableId).toBe(deliverableId);
			expect(weeklyEntry?.deliverableName).toBe(deliverableName);
			expect(weeklyEntry?.workTypeId).toBe(workTypeId);
			expect(weeklyEntry?.workTypeName).toBe(workTypeName);
		});

		it('PUT /api/time-entries/:id clears deliverableId and workTypeId with null', async () => {
			const response = await authPut(`/api/time-entries/${entryWithDeliverableId}`, {
				deliverableId: null,
				workTypeId: null
			});
			expect(response.ok).toBe(true);
			const data = await response.json();
			expect(data.entry.deliverableId).toBeNull();
			expect(data.entry.workTypeId).toBeNull();

			const weeklyEntry = await findWeeklyEntry(entryWithDeliverableId);
			expect(weeklyEntry?.deliverableId).toBeNull();
			expect(weeklyEntry?.deliverableName).toBeNull();
			expect(weeklyEntry?.workTypeName).toBeNull();
		});

		it('PUT /api/time-entries/:id sets deliverableId and workTypeId again', async () => {
			const response = await authPut(`/api/time-entries/${entryWithDeliverableId}`, {
				deliverableId,
				workTypeId
			});
			expect(response.ok).toBe(true);

			const weeklyEntry = await findWeeklyEntry(entryWithDeliverableId);
			expect(weeklyEntry?.deliverableId).toBe(deliverableId);
			expect(weeklyEntry?.deliverableName).toBe(deliverableName);
			expect(weeklyEntry?.workTypeName).toBe(workTypeName);

			// Clean up the entry (the deliverable stays on the throwaway test user's contract)
			const deleteResponse = await authDelete(`/api/time-entries/${entryWithDeliverableId}`);
			expect(deleteResponse.ok).toBe(true);
		});
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
});
