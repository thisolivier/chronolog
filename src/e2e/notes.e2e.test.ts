/**
 * E2E Tests: Notes CRUD
 *
 * Verifies note creation, reading, updating, sub-resources, and deletion.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import './test-init';
import { authGet, authPost, authPut, authDelete } from './helpers';

describe('Notes API', () => {
	let contractId: string;
	let createdNoteId: string;

	beforeAll(async () => {
		// Get the seeded "General" contract
		const contractsResponse = await authGet('/api/contracts');
		const contracts = await contractsResponse.json();
		const generalContract = contracts.find(
			(contract: { name: string }) => contract.name === 'General'
		);
		contractId = generalContract.id;
	});

	it('POST /api/notes creates a note', async () => {
		const response = await authPost('/api/notes', { contractId });
		expect(response.status).toBe(201);

		const data = await response.json();
		expect(data).toHaveProperty('note');
		expect(data.note).toHaveProperty('id');
		expect(typeof data.note.id).toBe('string');
		expect(data.note).toHaveProperty('contractId', contractId);

		createdNoteId = data.note.id;
	});

	it('GET /api/notes?contractId=X lists notes for that contract', async () => {
		const response = await authGet(`/api/notes?contractId=${contractId}`);
		expect(response.ok).toBe(true);

		const data = await response.json();
		expect(data).toHaveProperty('notes');
		expect(Array.isArray(data.notes)).toBe(true);

		const ourNote = data.notes.find(
			(note: { id: string }) => note.id === createdNoteId
		);
		expect(ourNote).toBeDefined();
	});

	it('GET /api/notes/:id fetches a single note', async () => {
		const response = await authGet(`/api/notes/${createdNoteId}`);
		expect(response.ok).toBe(true);

		const data = await response.json();
		expect(data).toHaveProperty('note');
		expect(data.note).toHaveProperty('id', createdNoteId);
		expect(data.note).toHaveProperty('contractId', contractId);
	});

	it('PUT /api/notes/:id updates title and content', async () => {
		const response = await authPut(`/api/notes/${createdNoteId}`, {
			title: 'Updated E2E Note Title',
			content: 'Updated content from e2e test'
		});
		expect(response.ok).toBe(true);

		const data = await response.json();
		expect(data).toHaveProperty('note');
		expect(data.note.id).toBe(createdNoteId);
	});

	it('GET /api/notes/:id/backlinks returns backlinks (empty for new note)', async () => {
		const response = await authGet(`/api/notes/${createdNoteId}/backlinks`);
		expect(response.ok).toBe(true);

		const data = await response.json();
		expect(data).toHaveProperty('backlinks');
		expect(Array.isArray(data.backlinks)).toBe(true);
	});

	it('GET /api/notes/:id/attachments returns attachments (empty)', async () => {
		const response = await authGet(`/api/notes/${createdNoteId}/attachments`);
		expect(response.ok).toBe(true);

		const data = await response.json();
		expect(data).toHaveProperty('attachments');
		expect(Array.isArray(data.attachments)).toBe(true);
	});

	it('GET /api/notes/:id/time-entries returns linked time entries (empty)', async () => {
		const response = await authGet(`/api/notes/${createdNoteId}/time-entries`);
		expect(response.ok).toBe(true);

		const data = await response.json();
		expect(data).toHaveProperty('timeEntries');
		expect(Array.isArray(data.timeEntries)).toBe(true);
	});

	it('DELETE /api/notes/:id deletes the note', async () => {
		const response = await authDelete(`/api/notes/${createdNoteId}`);
		expect(response.ok).toBe(true);

		const data = await response.json();
		expect(data).toHaveProperty('success', true);
	});

	it('Verify deleted note is gone from the list', async () => {
		const response = await authGet(`/api/notes?contractId=${contractId}`);
		expect(response.ok).toBe(true);

		const data = await response.json();
		const deletedNote = data.notes.find(
			(note: { id: string }) => note.id === createdNoteId
		);
		expect(deletedNote).toBeUndefined();
	});
});
