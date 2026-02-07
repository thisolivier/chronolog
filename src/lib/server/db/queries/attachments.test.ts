import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { database, clients, contracts, notes, users, attachments } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import {
	createAttachment,
	listAttachmentsForNote,
	getAttachment,
	deleteAttachment
} from './attachments';

describe('Attachment Queries', () => {
	let testUserId: string;
	let testClientId: string;
	let testContractId: string;
	let testNoteId: string;

	const testFileData = Buffer.from('fake-png-binary-data-for-testing');
	const testFilename = 'screenshot.png';
	const testMimeType = 'image/png';
	const testSizeBytes = testFileData.length;

	beforeAll(async () => {
		// Create a test user
		testUserId = `test-attachments-${Date.now()}`;
		await database
			.insert(users)
			.values({
				id: testUserId,
				name: 'Attachment Test User',
				email: `${testUserId}@example.com`
			});

		// Create a test client
		const clientResult = await database
			.insert(clients)
			.values({
				userId: testUserId,
				name: 'Attachment Test Client',
				shortCode: 'ATCH'
			})
			.returning();
		testClientId = clientResult[0].id;

		// Create a test contract
		const contractResult = await database
			.insert(contracts)
			.values({
				clientId: testClientId,
				name: 'Attachment Test Contract',
				isActive: true
			})
			.returning();
		testContractId = contractResult[0].id;

		// Create a test note
		const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
		testNoteId = `ATCH.${today}.999`;
		await database
			.insert(notes)
			.values({
				id: testNoteId,
				userId: testUserId,
				contractId: testContractId,
				title: 'Attachment Test Note'
			});
	});

	afterAll(async () => {
		// Clean up in reverse order of creation
		await database.delete(attachments).where(eq(attachments.noteId, testNoteId));
		await database.delete(notes).where(eq(notes.id, testNoteId));
		await database.delete(contracts).where(eq(contracts.id, testContractId));
		await database.delete(clients).where(eq(clients.id, testClientId));
		await database.delete(users).where(eq(users.id, testUserId));
	});

	it('should create an attachment and return it with metadata', async () => {
		const attachment = await createAttachment(
			testNoteId,
			testFilename,
			testMimeType,
			testSizeBytes,
			testFileData
		);

		expect(attachment.id).toBeDefined();
		expect(attachment.noteId).toBe(testNoteId);
		expect(attachment.filename).toBe(testFilename);
		expect(attachment.mimeType).toBe(testMimeType);
		expect(attachment.sizeBytes).toBe(testSizeBytes);
		expect(attachment.data).toBeDefined();
		expect(attachment.createdAt).toBeInstanceOf(Date);

		// Clean up this specific attachment
		await deleteAttachment(attachment.id);
	});

	it('should list attachments for a note without binary data', async () => {
		// Create two attachments
		const attachment1 = await createAttachment(
			testNoteId,
			'file1.png',
			'image/png',
			100,
			Buffer.from('data1')
		);
		const attachment2 = await createAttachment(
			testNoteId,
			'file2.pdf',
			'application/pdf',
			200,
			Buffer.from('data2')
		);

		const attachmentList = await listAttachmentsForNote(testNoteId);

		expect(attachmentList.length).toBeGreaterThanOrEqual(2);

		const filenames = attachmentList.map((attachment) => attachment.filename);
		expect(filenames).toContain('file1.png');
		expect(filenames).toContain('file2.pdf');

		// Verify no binary data is included in the list
		for (const attachmentItem of attachmentList) {
			expect(attachmentItem).not.toHaveProperty('data');
		}

		// Clean up
		await deleteAttachment(attachment1.id);
		await deleteAttachment(attachment2.id);
	});

	it('should fetch a single attachment with binary data', async () => {
		const created = await createAttachment(
			testNoteId,
			testFilename,
			testMimeType,
			testSizeBytes,
			testFileData
		);

		const fetched = await getAttachment(created.id);

		expect(fetched).not.toBeNull();
		expect(fetched!.id).toBe(created.id);
		expect(fetched!.filename).toBe(testFilename);
		expect(fetched!.mimeType).toBe(testMimeType);
		expect(fetched!.sizeBytes).toBe(testSizeBytes);
		expect(Buffer.isBuffer(fetched!.data)).toBe(true);
		expect(fetched!.data.toString()).toBe(testFileData.toString());

		// Clean up
		await deleteAttachment(created.id);
	});

	it('should return null for a non-existent attachment', async () => {
		const fetched = await getAttachment('00000000-0000-0000-0000-000000000000');
		expect(fetched).toBeNull();
	});

	it('should delete an attachment and return true', async () => {
		const created = await createAttachment(
			testNoteId,
			'to-delete.png',
			'image/png',
			50,
			Buffer.from('delete-me')
		);

		const wasDeleted = await deleteAttachment(created.id);
		expect(wasDeleted).toBe(true);

		// Verify it's gone
		const fetched = await getAttachment(created.id);
		expect(fetched).toBeNull();
	});

	it('should return false when deleting a non-existent attachment', async () => {
		const wasDeleted = await deleteAttachment('00000000-0000-0000-0000-000000000000');
		expect(wasDeleted).toBe(false);
	});

	it('should return empty list for a note with no attachments', async () => {
		// Use a note ID that has no attachments
		const emptyList = await listAttachmentsForNote('NONEXISTENT.20260101.001');
		expect(emptyList).toEqual([]);
	});
});
