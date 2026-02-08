import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { database } from '$lib/server/db';
import { users } from '$lib/server/db/schema/users';
import { clients } from '$lib/server/db/schema/clients';
import { contracts } from '$lib/server/db/schema/contracts';
import { timeEntries } from '$lib/server/db/schema/time-entries';
import { notes } from '$lib/server/db/schema/notes';
import { noteTimeEntries } from '$lib/server/db/schema/note-time-entries';
import { pushChanges } from './sync-push';
import type { SyncPushRequest } from '$lib/sync/types';

describe('Sync Push', () => {
	const testUserId = `test-sync-push-${Date.now()}`;
	let testClientId: string;
	let testContractId: string;

	beforeAll(async () => {
		// Create test user
		await database.insert(users).values({
			id: testUserId,
			name: 'Sync Push Test User',
			email: `${testUserId}@example.com`
		});

		// Create client
		const clientResults = await database
			.insert(clients)
			.values({ userId: testUserId, name: 'Push Test Client', shortCode: 'PSHT' })
			.returning();
		testClientId = clientResults[0].id;

		// Create contract
		const contractResults = await database
			.insert(contracts)
			.values({ clientId: testClientId, name: 'Push Test Contract', isActive: true })
			.returning();
		testContractId = contractResults[0].id;
	});

	afterAll(async () => {
		// Clean up everything created by the user
		await database.delete(noteTimeEntries).where(
			eq(noteTimeEntries.noteId, 'PSHT.20260115.001')
		);
		await database.delete(notes).where(eq(notes.userId, testUserId));
		await database.delete(timeEntries).where(eq(timeEntries.userId, testUserId));
		await database.delete(contracts).where(eq(contracts.id, testContractId));
		await database.delete(clients).where(eq(clients.id, testClientId));
		await database.delete(users).where(eq(users.id, testUserId));
	});

	it('should insert a new time entry via upsert', async () => {
		const newEntryId = crypto.randomUUID();
		const request: SyncPushRequest = {
			changes: {
				timeEntries: [
					{
						operation: 'upsert',
						data: {
							id: newEntryId,
							userId: testUserId,
							contractId: testContractId,
							date: '2026-01-20',
							durationMinutes: 45,
							description: 'Pushed from client',
							isDraft: false
						},
						clientUpdatedAt: new Date().toISOString()
					}
				]
			}
		};

		const result = await pushChanges(testUserId, request);
		expect(result.applied).toBe(1);
		expect(result.conflicts).toBe(0);
		expect(result.serverTimestamp).toBeDefined();

		// Verify it was created
		const created = await database
			.select()
			.from(timeEntries)
			.where(eq(timeEntries.id, newEntryId))
			.limit(1);
		expect(created).toHaveLength(1);
		expect(created[0].description).toBe('Pushed from client');
	});

	it('should update an existing entity when client is newer', async () => {
		// Create an entity on the server
		const entryId = crypto.randomUUID();
		const serverCreatedAt = new Date('2026-01-10T10:00:00Z');
		await database.insert(timeEntries).values({
			id: entryId,
			userId: testUserId,
			contractId: testContractId,
			date: '2026-01-10',
			durationMinutes: 30,
			description: 'Original description',
			isDraft: false,
			createdAt: serverCreatedAt,
			updatedAt: serverCreatedAt
		});

		// Push an update with a newer clientUpdatedAt
		const clientUpdatedAt = new Date('2026-01-10T12:00:00Z').toISOString();
		const request: SyncPushRequest = {
			changes: {
				timeEntries: [
					{
						operation: 'upsert',
						data: {
							id: entryId,
							userId: testUserId,
							contractId: testContractId,
							date: '2026-01-10',
							durationMinutes: 60,
							description: 'Updated by client',
							isDraft: false
						},
						clientUpdatedAt
					}
				]
			}
		};

		const result = await pushChanges(testUserId, request);
		expect(result.applied).toBe(1);
		expect(result.conflicts).toBe(0);

		// Verify it was updated
		const updated = await database
			.select()
			.from(timeEntries)
			.where(eq(timeEntries.id, entryId))
			.limit(1);
		expect(updated[0].description).toBe('Updated by client');
		expect(updated[0].durationMinutes).toBe(60);
	});

	it('should skip upsert when server is newer (conflict)', async () => {
		// Create an entity on the server with a recent updatedAt
		const entryId = crypto.randomUUID();
		const serverUpdatedAt = new Date('2026-01-10T14:00:00Z');
		await database.insert(timeEntries).values({
			id: entryId,
			userId: testUserId,
			contractId: testContractId,
			date: '2026-01-10',
			durationMinutes: 30,
			description: 'Server version',
			isDraft: false,
			createdAt: new Date('2026-01-10T10:00:00Z'),
			updatedAt: serverUpdatedAt
		});

		// Push an update with an OLDER clientUpdatedAt
		const clientUpdatedAt = new Date('2026-01-10T12:00:00Z').toISOString();
		const request: SyncPushRequest = {
			changes: {
				timeEntries: [
					{
						operation: 'upsert',
						data: {
							id: entryId,
							userId: testUserId,
							contractId: testContractId,
							date: '2026-01-10',
							durationMinutes: 90,
							description: 'Client version (should be rejected)',
							isDraft: false
						},
						clientUpdatedAt
					}
				]
			}
		};

		const result = await pushChanges(testUserId, request);
		expect(result.applied).toBe(0);
		expect(result.conflicts).toBe(1);

		// Verify server version is unchanged
		const unchanged = await database
			.select()
			.from(timeEntries)
			.where(eq(timeEntries.id, entryId))
			.limit(1);
		expect(unchanged[0].description).toBe('Server version');
		expect(unchanged[0].durationMinutes).toBe(30);
	});

	it('should delete an existing entity', async () => {
		// Create an entity to delete
		const entryId = crypto.randomUUID();
		await database.insert(timeEntries).values({
			id: entryId,
			userId: testUserId,
			contractId: testContractId,
			date: '2026-01-11',
			durationMinutes: 15,
			description: 'To be deleted',
			isDraft: false
		});

		const request: SyncPushRequest = {
			changes: {
				timeEntries: [
					{
						operation: 'delete',
						data: { id: entryId }
					}
				]
			}
		};

		const result = await pushChanges(testUserId, request);
		expect(result.applied).toBe(1);

		// Verify it was deleted
		const remaining = await database
			.select()
			.from(timeEntries)
			.where(eq(timeEntries.id, entryId));
		expect(remaining).toHaveLength(0);
	});

	it('should enforce userId on protected tables', async () => {
		const maliciousUserId = 'malicious-user';
		const entryId = crypto.randomUUID();

		const request: SyncPushRequest = {
			changes: {
				timeEntries: [
					{
						operation: 'upsert',
						data: {
							id: entryId,
							userId: maliciousUserId, // attempting to set a different userId
							contractId: testContractId,
							date: '2026-01-22',
							durationMinutes: 10,
							description: 'Spoofed entry',
							isDraft: false
						},
						clientUpdatedAt: new Date().toISOString()
					}
				]
			}
		};

		await pushChanges(testUserId, request);

		// Verify the entry was created with the authenticated userId, not the malicious one
		const created = await database
			.select()
			.from(timeEntries)
			.where(eq(timeEntries.id, entryId))
			.limit(1);

		if (created.length > 0) {
			expect(created[0].userId).toBe(testUserId);
			expect(created[0].userId).not.toBe(maliciousUserId);
		}
	});

	it('should handle multiple mutations in a single push', async () => {
		const entryId1 = crypto.randomUUID();
		const entryId2 = crypto.randomUUID();

		const request: SyncPushRequest = {
			changes: {
				timeEntries: [
					{
						operation: 'upsert',
						data: {
							id: entryId1,
							userId: testUserId,
							contractId: testContractId,
							date: '2026-01-25',
							durationMinutes: 30,
							description: 'Batch entry 1',
							isDraft: false
						},
						clientUpdatedAt: new Date().toISOString()
					},
					{
						operation: 'upsert',
						data: {
							id: entryId2,
							userId: testUserId,
							contractId: testContractId,
							date: '2026-01-25',
							durationMinutes: 45,
							description: 'Batch entry 2',
							isDraft: false
						},
						clientUpdatedAt: new Date().toISOString()
					}
				]
			}
		};

		const result = await pushChanges(testUserId, request);
		expect(result.applied).toBe(2);
		expect(result.conflicts).toBe(0);
	});

	it('should handle empty changes gracefully', async () => {
		const request: SyncPushRequest = {
			changes: {}
		};

		const result = await pushChanges(testUserId, request);
		expect(result.applied).toBe(0);
		expect(result.conflicts).toBe(0);
		expect(result.serverTimestamp).toBeDefined();
	});

	it('should skip unknown table names', async () => {
		const request: SyncPushRequest = {
			changes: {
				unknownTable: [
					{
						operation: 'upsert',
						data: { id: 'test' },
						clientUpdatedAt: new Date().toISOString()
					}
				]
			}
		};

		const result = await pushChanges(testUserId, request);
		expect(result.applied).toBe(0);
		expect(result.conflicts).toBe(0);
	});
});
