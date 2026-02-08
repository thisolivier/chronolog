/**
 * Tests for DexieAdapter — IndexedDB storage via Dexie.js.
 *
 * Uses fake-indexeddb to polyfill IndexedDB in the Node.js test environment.
 * Each test gets a fresh database with a random name to avoid conflicts.
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Dexie from 'dexie';
import { DexieAdapter } from './dexie-adapter';
import type { ClientRow, NoteLinkRow, NoteTimeEntryRow, ContractRow } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uniqueDatabaseName(): string {
	return `chronolog-test-${crypto.randomUUID()}`;
}

function makeClientRow(overrides: Partial<ClientRow> = {}): ClientRow {
	return {
		id: crypto.randomUUID(),
		userId: 'user-1',
		name: 'Acme Corp',
		shortCode: 'ACME',
		createdAt: '2026-01-15T10:00:00.000Z',
		updatedAt: '2026-01-15T10:00:00.000Z',
		...overrides
	};
}

function makeContractRow(overrides: Partial<ContractRow> = {}): ContractRow {
	return {
		id: crypto.randomUUID(),
		clientId: 'client-1',
		name: 'Support Contract',
		description: null,
		isActive: true,
		sortOrder: 0,
		createdAt: '2026-01-15T10:00:00.000Z',
		updatedAt: '2026-01-15T10:00:00.000Z',
		...overrides
	};
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('DexieAdapter', () => {
	let adapter: DexieAdapter;
	let databaseName: string;

	beforeEach(async () => {
		databaseName = uniqueDatabaseName();
		adapter = new DexieAdapter(databaseName);
		await adapter.init();
	});

	afterEach(async () => {
		await adapter.close();
		await Dexie.delete(databaseName);
	});

	// ---- init / close ----

	describe('init() and close()', () => {
		it('should open and close without errors', async () => {
			// The beforeEach already called init(); calling close() should succeed.
			const freshName = uniqueDatabaseName();
			const freshAdapter = new DexieAdapter(freshName);
			await freshAdapter.init();
			await freshAdapter.close();
			await Dexie.delete(freshName);
		});
	});

	// ---- put / getById (simple table) ----

	describe('put() and getById() for simple tables', () => {
		it('should store and retrieve a client row', async () => {
			const clientRow = makeClientRow({ id: 'client-abc' });
			await adapter.put('clients', clientRow);

			const retrieved = await adapter.getById('clients', 'client-abc');
			expect(retrieved).toEqual(clientRow);
		});

		it('should return null for a non-existent id', async () => {
			const result = await adapter.getById('clients', 'nonexistent');
			expect(result).toBeNull();
		});

		it('should upsert an existing row', async () => {
			const clientRow = makeClientRow({ id: 'client-upsert', name: 'Original' });
			await adapter.put('clients', clientRow);

			const updatedRow = { ...clientRow, name: 'Updated' };
			await adapter.put('clients', updatedRow);

			const retrieved = await adapter.getById('clients', 'client-upsert');
			expect(retrieved?.name).toBe('Updated');
		});
	});

	// ---- put / getById (compound-key table) ----

	describe('put() and getById() for compound-key tables', () => {
		it('should store and retrieve a noteLink by compound key', async () => {
			const noteLink: NoteLinkRow = {
				sourceNoteId: 'note-1',
				targetNoteId: 'note-2',
				headingAnchor: '#introduction',
				createdAt: '2026-01-20T12:00:00.000Z'
			};

			await adapter.put('noteLinks', noteLink);

			const retrieved = await adapter.getById('noteLinks', 'note-1|note-2');
			expect(retrieved).toEqual(noteLink);
		});

		it('should store and retrieve a noteTimeEntry by compound key', async () => {
			const noteTimeEntry: NoteTimeEntryRow = {
				noteId: 'note-10',
				timeEntryId: 'te-20',
				headingAnchor: null
			};

			await adapter.put('noteTimeEntries', noteTimeEntry);

			const retrieved = await adapter.getById('noteTimeEntries', 'note-10|te-20');
			expect(retrieved).toEqual(noteTimeEntry);
		});

		it('should return null for a non-existent compound key', async () => {
			const result = await adapter.getById('noteLinks', 'x|y');
			expect(result).toBeNull();
		});
	});

	// ---- bulkPut / getAll ----

	describe('bulkPut() and getAll()', () => {
		it('should bulk-insert rows and retrieve them all', async () => {
			const rows = [
				makeClientRow({ id: 'c-1', name: 'Alpha' }),
				makeClientRow({ id: 'c-2', name: 'Beta' }),
				makeClientRow({ id: 'c-3', name: 'Gamma' })
			];

			await adapter.bulkPut('clients', rows);

			const allClients = await adapter.getAll('clients');
			expect(allClients).toHaveLength(3);

			const names = allClients.map((client) => client.name).sort();
			expect(names).toEqual(['Alpha', 'Beta', 'Gamma']);
		});

		it('should return an empty array when the table is empty', async () => {
			const allClients = await adapter.getAll('clients');
			expect(allClients).toEqual([]);
		});
	});

	// ---- query ----

	describe('query()', () => {
		it('should filter rows by a single field', async () => {
			const rows = [
				makeContractRow({ id: 'con-1', clientId: 'client-a', isActive: true }),
				makeContractRow({ id: 'con-2', clientId: 'client-b', isActive: false }),
				makeContractRow({ id: 'con-3', clientId: 'client-a', isActive: false })
			];

			await adapter.bulkPut('contracts', rows);

			const activeContracts = await adapter.query('contracts', { isActive: true });
			expect(activeContracts).toHaveLength(1);
			expect(activeContracts[0].id).toBe('con-1');
		});

		it('should filter rows by multiple fields (AND logic)', async () => {
			const rows = [
				makeContractRow({ id: 'con-1', clientId: 'client-a', isActive: true }),
				makeContractRow({ id: 'con-2', clientId: 'client-a', isActive: false }),
				makeContractRow({ id: 'con-3', clientId: 'client-b', isActive: true })
			];

			await adapter.bulkPut('contracts', rows);

			const results = await adapter.query('contracts', {
				clientId: 'client-a',
				isActive: true
			});
			expect(results).toHaveLength(1);
			expect(results[0].id).toBe('con-1');
		});

		it('should return all rows when filter is empty', async () => {
			const rows = [
				makeClientRow({ id: 'c-1' }),
				makeClientRow({ id: 'c-2' })
			];
			await adapter.bulkPut('clients', rows);

			const results = await adapter.query('clients', {});
			expect(results).toHaveLength(2);
		});

		it('should return empty array when no rows match', async () => {
			await adapter.put('clients', makeClientRow({ id: 'c-1', shortCode: 'ACME' }));

			const results = await adapter.query('clients', { shortCode: 'NOPE' });
			expect(results).toEqual([]);
		});
	});

	// ---- delete ----

	describe('delete()', () => {
		it('should delete a row by id', async () => {
			const clientRow = makeClientRow({ id: 'to-delete' });
			await adapter.put('clients', clientRow);

			await adapter.delete('clients', 'to-delete');

			const result = await adapter.getById('clients', 'to-delete');
			expect(result).toBeNull();
		});

		it('should not throw when deleting a non-existent id', async () => {
			await expect(adapter.delete('clients', 'nonexistent')).resolves.not.toThrow();
		});

		it('should delete a compound-key row', async () => {
			const noteLink: NoteLinkRow = {
				sourceNoteId: 'src-1',
				targetNoteId: 'tgt-1',
				headingAnchor: null,
				createdAt: '2026-01-20T12:00:00.000Z'
			};
			await adapter.put('noteLinks', noteLink);

			await adapter.delete('noteLinks', 'src-1|tgt-1');

			const result = await adapter.getById('noteLinks', 'src-1|tgt-1');
			expect(result).toBeNull();
		});
	});

	// ---- clear ----

	describe('clear()', () => {
		it('should remove all rows from a table', async () => {
			await adapter.bulkPut('clients', [
				makeClientRow({ id: 'c-1' }),
				makeClientRow({ id: 'c-2' }),
				makeClientRow({ id: 'c-3' })
			]);

			await adapter.clear('clients');

			const allClients = await adapter.getAll('clients');
			expect(allClients).toEqual([]);
		});

		it('should not affect other tables', async () => {
			await adapter.put('clients', makeClientRow({ id: 'c-1' }));
			await adapter.put('contracts', makeContractRow({ id: 'con-1' }));

			await adapter.clear('clients');

			const clients = await adapter.getAll('clients');
			const contracts = await adapter.getAll('contracts');
			expect(clients).toEqual([]);
			expect(contracts).toHaveLength(1);
		});
	});

	// ---- blob storage ----

	describe('putBlob(), getBlob(), deleteBlob()', () => {
		it('should store and retrieve a blob', async () => {
			const blobData = new Blob(['hello world'], { type: 'text/plain' });

			await adapter.putBlob('att-1', blobData);

			const retrieved = await adapter.getBlob('att-1');
			expect(retrieved).not.toBeNull();
			const text = await retrieved!.text();
			expect(text).toBe('hello world');
		});

		it('should return null for a non-existent blob', async () => {
			const result = await adapter.getBlob('nonexistent');
			expect(result).toBeNull();
		});

		it('should delete a blob', async () => {
			const blobData = new Blob(['data'], { type: 'application/octet-stream' });
			await adapter.putBlob('att-2', blobData);

			await adapter.deleteBlob('att-2');

			const result = await adapter.getBlob('att-2');
			expect(result).toBeNull();
		});

		it('should overwrite an existing blob', async () => {
			const originalBlob = new Blob(['original'], { type: 'text/plain' });
			const updatedBlob = new Blob(['updated'], { type: 'text/plain' });

			await adapter.putBlob('att-3', originalBlob);
			await adapter.putBlob('att-3', updatedBlob);

			const retrieved = await adapter.getBlob('att-3');
			expect(retrieved).not.toBeNull();
			const text = await retrieved!.text();
			expect(text).toBe('updated');
		});
	});
});
