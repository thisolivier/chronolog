import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { database } from '$lib/server/db';
import { users } from '$lib/server/db/schema/users';
import { clients } from '$lib/server/db/schema/clients';
import { contracts } from '$lib/server/db/schema/contracts';
import { deliverables } from '$lib/server/db/schema/deliverables';
import { workTypes } from '$lib/server/db/schema/work-types';
import { timeEntries } from '$lib/server/db/schema/time-entries';
import { notes } from '$lib/server/db/schema/notes';
import { noteLinks } from '$lib/server/db/schema/note-links';
import { noteTimeEntries } from '$lib/server/db/schema/note-time-entries';
import { weeklyStatuses } from '$lib/server/db/schema/weekly-statuses';
import { pullChangesSince } from './sync-pull';

describe('Sync Pull', () => {
	const testUserId = `test-sync-pull-${Date.now()}`;
	let testClientId: string;
	let testContractId: string;
	let testDeliverableId: string;
	let testWorkTypeId: string;
	let testTimeEntryId: string;
	const testNoteIdSuffix = Date.now().toString().slice(-6);
	let testNoteId: string;
	let testWeeklyStatusId: string;

	beforeAll(async () => {
		// Create test user
		await database.insert(users).values({
			id: testUserId,
			name: 'Sync Pull Test User',
			email: `${testUserId}@example.com`
		});

		// Create client
		const clientResults = await database
			.insert(clients)
			.values({ userId: testUserId, name: 'Pull Test Client', shortCode: 'PLLT' })
			.returning();
		testClientId = clientResults[0].id;

		// Create contract
		const contractResults = await database
			.insert(contracts)
			.values({ clientId: testClientId, name: 'Pull Test Contract', isActive: true })
			.returning();
		testContractId = contractResults[0].id;

		// Create deliverable
		const deliverableResults = await database
			.insert(deliverables)
			.values({ contractId: testContractId, name: 'Pull Test Deliverable', sortOrder: 0 })
			.returning();
		testDeliverableId = deliverableResults[0].id;

		// Create work type
		const workTypeResults = await database
			.insert(workTypes)
			.values({ deliverableId: testDeliverableId, name: 'Pull Test WorkType', sortOrder: 0 })
			.returning();
		testWorkTypeId = workTypeResults[0].id;

		// Create time entry
		const timeEntryResults = await database
			.insert(timeEntries)
			.values({
				userId: testUserId,
				contractId: testContractId,
				date: '2026-01-15',
				durationMinutes: 60,
				description: 'Pull test entry'
			})
			.returning();
		testTimeEntryId = timeEntryResults[0].id;

		// Create note with unique ID
		testNoteId = `PLLT.20260115.${testNoteIdSuffix}`;
		await database.insert(notes).values({
			id: testNoteId,
			userId: testUserId,
			contractId: testContractId,
			title: 'Pull Test Note'
		});

		// Create note link (self-link for simplicity)
		await database.insert(noteLinks).values({
			sourceNoteId: testNoteId,
			targetNoteId: testNoteId,
			headingAnchor: null
		});

		// Create note-time-entry link
		await database.insert(noteTimeEntries).values({
			noteId: testNoteId,
			timeEntryId: testTimeEntryId
		});

		// Create weekly status
		const weeklyStatusResults = await database
			.insert(weeklyStatuses)
			.values({
				userId: testUserId,
				weekStart: '2026-01-13',
				year: 2026,
				weekNumber: 3,
				status: 'Submitted'
			})
			.returning();
		testWeeklyStatusId = weeklyStatusResults[0].id;
	});

	afterAll(async () => {
		// Clean up in reverse dependency order
		await database.delete(noteTimeEntries).where(eq(noteTimeEntries.noteId, testNoteId));
		await database.delete(noteLinks).where(eq(noteLinks.sourceNoteId, testNoteId));
		await database.delete(notes).where(eq(notes.userId, testUserId));
		await database.delete(weeklyStatuses).where(eq(weeklyStatuses.userId, testUserId));
		await database.delete(timeEntries).where(eq(timeEntries.userId, testUserId));
		await database.delete(workTypes).where(eq(workTypes.id, testWorkTypeId));
		await database.delete(deliverables).where(eq(deliverables.id, testDeliverableId));
		await database.delete(contracts).where(eq(contracts.id, testContractId));
		await database.delete(clients).where(eq(clients.id, testClientId));
		await database.delete(users).where(eq(users.id, testUserId));
	});

	it('should return all entities on full sync (since=null)', async () => {
		const result = await pullChangesSince(testUserId, null);

		expect(result.clients.length).toBeGreaterThanOrEqual(1);
		expect(result.contracts.length).toBeGreaterThanOrEqual(1);
		expect(result.deliverables.length).toBeGreaterThanOrEqual(1);
		expect(result.workTypes.length).toBeGreaterThanOrEqual(1);
		expect(result.timeEntries.length).toBeGreaterThanOrEqual(1);
		expect(result.notes.length).toBeGreaterThanOrEqual(1);
		expect(result.noteLinks.length).toBeGreaterThanOrEqual(1);
		expect(result.noteTimeEntries.length).toBeGreaterThanOrEqual(1);
		expect(result.weeklyStatuses.length).toBeGreaterThanOrEqual(1);
		expect(result.serverTimestamp).toBeDefined();
		expect(new Date(result.serverTimestamp).getTime()).not.toBeNaN();
	});

	it('should return a valid serverTimestamp', async () => {
		const beforeSync = new Date();
		const result = await pullChangesSince(testUserId, null);
		const afterSync = new Date();

		const serverTime = new Date(result.serverTimestamp).getTime();
		expect(serverTime).toBeGreaterThanOrEqual(beforeSync.getTime());
		expect(serverTime).toBeLessThanOrEqual(afterSync.getTime());
	});

	it('should return no entities for a future since timestamp', async () => {
		const futureDate = new Date('2099-01-01');
		const result = await pullChangesSince(testUserId, futureDate);

		expect(result.clients).toHaveLength(0);
		expect(result.contracts).toHaveLength(0);
		expect(result.deliverables).toHaveLength(0);
		// workTypes are always returned (no timestamps)
		expect(result.workTypes.length).toBeGreaterThanOrEqual(1);
		expect(result.timeEntries).toHaveLength(0);
		expect(result.notes).toHaveLength(0);
		expect(result.noteLinks).toHaveLength(0);
		// noteTimeEntries are always returned (no timestamps)
		expect(result.noteTimeEntries.length).toBeGreaterThanOrEqual(1);
		expect(result.weeklyStatuses).toHaveLength(0);
	});

	it('should not return entities for a different user', async () => {
		const otherUserId = `test-sync-pull-other-${Date.now()}`;
		await database.insert(users).values({
			id: otherUserId,
			name: 'Other User',
			email: `${otherUserId}@example.com`
		});

		try {
			const result = await pullChangesSince(otherUserId, null);
			expect(result.clients).toHaveLength(0);
			expect(result.contracts).toHaveLength(0);
			expect(result.timeEntries).toHaveLength(0);
			expect(result.notes).toHaveLength(0);
		} finally {
			await database.delete(users).where(eq(users.id, otherUserId));
		}
	});

	it('should return entities changed since a past timestamp', async () => {
		const pastDate = new Date('2020-01-01');
		const result = await pullChangesSince(testUserId, pastDate);

		// All entities were created recently, so they should all be returned
		expect(result.clients.length).toBeGreaterThanOrEqual(1);
		expect(result.contracts.length).toBeGreaterThanOrEqual(1);
		expect(result.timeEntries.length).toBeGreaterThanOrEqual(1);
	});

	it('should not include attachment blob data', async () => {
		const result = await pullChangesSince(testUserId, null);

		for (const attachment of result.attachments) {
			// Should have metadata fields but NOT 'data'
			expect(attachment).toHaveProperty('id');
			expect(attachment).toHaveProperty('noteId');
			expect(attachment).toHaveProperty('filename');
			expect(attachment).toHaveProperty('mimeType');
			expect(attachment).toHaveProperty('sizeBytes');
			expect(attachment).not.toHaveProperty('data');
		}
	});
});
