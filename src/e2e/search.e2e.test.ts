/**
 * E2E Tests: Note Search
 *
 * Verifies that the note search endpoint finds notes by content.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import './test-init';
import { authGet, authPost, authPut, authDelete } from './helpers';

describe('Note Search API', () => {
	let contractId: string;
	let searchNoteId: string;
	const uniqueKeyword = `e2esearchtest${Date.now()}`;

	beforeAll(async () => {
		// Get the seeded "General" contract
		const contractsResponse = await authGet('/api/contracts');
		const contracts = await contractsResponse.json();
		const generalContract = contracts.find(
			(contract: { name: string }) => contract.name === 'General'
		);
		contractId = generalContract.id;

		// Create a note with specific content for searching
		const createResponse = await authPost('/api/notes', { contractId });
		const createData = await createResponse.json();
		if (!createData.note) {
			throw new Error(
				`Note creation failed (${createResponse.status}): ${JSON.stringify(createData)}`
			);
		}
		searchNoteId = createData.note.id;

		// Update it with searchable content
		await authPut(`/api/notes/${searchNoteId}`, {
			title: `Search Test Note ${uniqueKeyword}`,
			content: `This note contains the unique keyword ${uniqueKeyword} for search testing.`
		});
	});

	afterAll(async () => {
		// Clean up the search test note
		if (searchNoteId) {
			await authDelete(`/api/notes/${searchNoteId}`);
		}
	});

	it('GET /api/notes/search?q=keyword finds the created note', async () => {
		const response = await authGet(
			`/api/notes/search?q=${encodeURIComponent(uniqueKeyword)}`
		);
		expect(response.ok).toBe(true);

		const data = await response.json();
		expect(data).toHaveProperty('notes');
		expect(Array.isArray(data.notes)).toBe(true);

		const foundNote = data.notes.find(
			(note: { id: string }) => note.id === searchNoteId
		);
		expect(foundNote).toBeDefined();
	});

	it('GET /api/notes/search?q=nonexistentrandomstring returns empty results', async () => {
		const response = await authGet('/api/notes/search?q=xyznonexistent999');
		expect(response.ok).toBe(true);

		const data = await response.json();
		expect(data).toHaveProperty('notes');
		expect(data.notes.length).toBe(0);
	});
});
