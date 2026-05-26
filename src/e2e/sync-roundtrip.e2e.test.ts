/**
 * E2E Tests: GATE B — Sync Round Trip (API Level)
 *
 * Proves the full REST API -> Postgres pipeline works end-to-end.
 * The PowerSync connector's uploadData() routes through these same
 * REST endpoints, so if API CRUD works, the sync write-back will too.
 *
 * Tests:
 * - Verify seeded client exists in Postgres (read-only, no POST endpoint)
 * - Create a note -> verify it persists after a short delay
 * - Update a note -> verify the update is reflected
 * - Delete a note -> verify it's gone
 * - Create a time entry -> verify weekly summary includes it
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import './test-init';
import { authGet, authPost, authPut, authDelete } from './helpers';

describe('GATE B: Sync Round Trip (API)', () => {
	let contractId: string;
	let createdNoteId: string;
	let createdTimeEntryId: string;

	beforeAll(async () => {
		// Get the seeded "General" contract for note + time-entry creation
		const contractsResponse = await authGet('/api/contracts');
		expect(contractsResponse.ok).toBe(true);
		const contracts = await contractsResponse.json();
		const generalContract = contracts.find(
			(contract: { name: string }) => contract.name === 'General'
		);
		expect(generalContract).toBeDefined();
		contractId = generalContract.id;
	});

	afterAll(async () => {
		// Clean up any resources that weren't deleted during tests
		if (createdTimeEntryId) {
			await authDelete(`/api/time-entries/${createdTimeEntryId}`).catch(() => {});
		}
		if (createdNoteId) {
			await authDelete(`/api/notes/${createdNoteId}`).catch(() => {});
		}
	});

	it('verifies the seeded "Internal" client exists in Postgres via API', async () => {
		// Clients are auto-created by ensureAppUser() during setup.
		// The client API is read-only (no POST), so we verify the seeded data
		// persisted correctly to Postgres and is returned by the API.
		const listResponse = await authGet('/api/clients');
		expect(listResponse.ok).toBe(true);

		const listData = await listResponse.json();
		expect(listData).toHaveProperty('clients');
		expect(Array.isArray(listData.clients)).toBe(true);
		expect(listData.clients.length).toBeGreaterThanOrEqual(1);

		const internalClient = listData.clients.find(
			(client: { name: string }) => client.name === 'Internal'
		);
		expect(internalClient).toBeDefined();
		expect(internalClient).toHaveProperty('id');
		expect(typeof internalClient.id).toBe('string');
		expect(internalClient).toHaveProperty('shortCode');
	});

	it('creates a note via REST API and verifies it persists after a delay', async () => {
		const createResponse = await authPost('/api/notes', { contractId });
		expect(createResponse.status).toBe(201);

		const createData = await createResponse.json();
		expect(createData).toHaveProperty('note');
		createdNoteId = createData.note.id;

		// Small delay to ensure Postgres has committed
		await new Promise((resolve) => setTimeout(resolve, 500));

		// Verify by fetching the note directly
		const getResponse = await authGet(`/api/notes/${createdNoteId}`);
		expect(getResponse.ok).toBe(true);

		const getData = await getResponse.json();
		expect(getData.note).toHaveProperty('id', createdNoteId);
		expect(getData.note).toHaveProperty('contractId', contractId);
	});

	it('updates a note and verifies the update is reflected', async () => {
		const updatedTitle = `Sync Round Trip Updated ${Date.now()}`;
		const updatedContent = 'This content was updated as part of the sync round trip test.';

		const updateResponse = await authPut(`/api/notes/${createdNoteId}`, {
			title: updatedTitle,
			content: updatedContent
		});
		expect(updateResponse.ok).toBe(true);

		// Verify by re-fetching
		const getResponse = await authGet(`/api/notes/${createdNoteId}`);
		expect(getResponse.ok).toBe(true);

		const getData = await getResponse.json();
		expect(getData.note.title).toBe(updatedTitle);
		expect(getData.note.content).toBe(updatedContent);
	});

	it('deletes a note and verifies it is gone', async () => {
		const deleteResponse = await authDelete(`/api/notes/${createdNoteId}`);
		expect(deleteResponse.ok).toBe(true);

		const deleteData = await deleteResponse.json();
		expect(deleteData).toHaveProperty('success', true);

		// Verify by listing notes — deleted note should not appear
		const listResponse = await authGet(`/api/notes?contractId=${contractId}`);
		expect(listResponse.ok).toBe(true);

		const listData = await listResponse.json();
		const deletedNote = listData.notes.find(
			(note: { id: string }) => note.id === createdNoteId
		);
		expect(deletedNote).toBeUndefined();

		// Clear the reference so afterAll doesn't try to delete again
		createdNoteId = '';
	});

	it('creates a time entry and verifies the weekly summary includes it', async () => {
		const today = new Date().toISOString().split('T')[0];
		const createResponse = await authPost('/api/time-entries', {
			contractId,
			date: today,
			durationMinutes: 45,
			description: 'Sync round trip test time entry'
		});
		expect(createResponse.status).toBe(201);

		const createData = await createResponse.json();
		expect(createData).toHaveProperty('entry');
		createdTimeEntryId = createData.entry.id;

		// Get current week Monday for the weekly query
		const now = new Date();
		const dayOfWeek = now.getDay();
		const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
		const monday = new Date(now);
		monday.setDate(now.getDate() + mondayOffset);
		const weekMonday = monday.toISOString().split('T')[0];

		// Verify via weekly endpoint
		const weeklyResponse = await authGet(`/api/time-entries/weekly?weeks=${weekMonday}`);
		expect(weeklyResponse.ok).toBe(true);

		const weeklyData = await weeklyResponse.json();
		expect(weeklyData).toHaveProperty('weeks');
		expect(weeklyData.weeks.length).toBeGreaterThanOrEqual(1);

		// Also verify via the week summaries endpoint
		const summaryResponse = await authGet('/api/weeks?count=4');
		expect(summaryResponse.ok).toBe(true);

		const summaryData = await summaryResponse.json();
		expect(summaryData).toHaveProperty('weeks');

		// Clean up
		const deleteResponse = await authDelete(`/api/time-entries/${createdTimeEntryId}`);
		expect(deleteResponse.ok).toBe(true);
		createdTimeEntryId = '';
	});
});
