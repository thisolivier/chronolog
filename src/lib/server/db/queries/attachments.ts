import { eq } from 'drizzle-orm';
import { database, attachments } from '$lib/server/db';

export type AttachmentMetadata = {
	id: string;
	noteId: string;
	filename: string;
	mimeType: string;
	sizeBytes: number;
	createdAt: Date;
};

export type Attachment = AttachmentMetadata & {
	data: Buffer;
};

/**
 * Create a new attachment stored as bytea in the database.
 */
export async function createAttachment(
	noteId: string,
	filename: string,
	mimeType: string,
	sizeBytes: number,
	data: Buffer,
	userId: string
): Promise<Attachment> {
	const results = await database
		.insert(attachments)
		.values({
			noteId,
			filename,
			mimeType,
			sizeBytes,
			data,
			userId
		})
		.returning();

	return results[0] as Attachment;
}

/**
 * Get attachment metadata (without binary data) for all attachments on a note.
 */
export async function listAttachmentsForNote(noteId: string): Promise<AttachmentMetadata[]> {
	const results = await database
		.select({
			id: attachments.id,
			noteId: attachments.noteId,
			filename: attachments.filename,
			mimeType: attachments.mimeType,
			sizeBytes: attachments.sizeBytes,
			createdAt: attachments.createdAt
		})
		.from(attachments)
		.where(eq(attachments.noteId, noteId));

	return results;
}

/**
 * Get a single attachment including its binary data.
 */
export async function getAttachment(attachmentId: string): Promise<Attachment | null> {
	const results = await database
		.select()
		.from(attachments)
		.where(eq(attachments.id, attachmentId))
		.limit(1);

	if (results.length === 0) return null;

	return results[0] as Attachment;
}

/**
 * Delete an attachment by ID. Returns true if a row was deleted, false otherwise.
 */
export async function deleteAttachment(attachmentId: string): Promise<boolean> {
	const results = await database
		.delete(attachments)
		.where(eq(attachments.id, attachmentId))
		.returning({ id: attachments.id });

	return results.length > 0;
}
