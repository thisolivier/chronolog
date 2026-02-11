import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getNoteForUser } from '$lib/server/db/queries/notes';
import { createAttachment, listAttachmentsForNote } from '$lib/server/db/queries/attachments';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME_TYPES = new Set([
	'image/jpeg',
	'image/png',
	'image/gif',
	'image/webp',
	'image/svg+xml',
	'application/pdf'
]);

/**
 * POST /api/notes/[noteId]/attachments
 *
 * Upload a file attachment to a note.
 * Accepts multipart/form-data with a "file" field.
 */
export const POST: RequestHandler = async ({ locals, params, request }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	// Verify note exists and belongs to the user
	const note = await getNoteForUser(params.noteId, currentUser.id);
	if (!note) throw error(404, 'Note not found');

	const formData = await request.formData();
	const file = formData.get('file');

	if (!file || !(file instanceof File)) {
		throw error(400, 'Missing file field in form data');
	}

	// Validate MIME type
	if (!ALLOWED_MIME_TYPES.has(file.type)) {
		throw error(
			400,
			`File type "${file.type}" is not allowed. Allowed types: ${[...ALLOWED_MIME_TYPES].join(', ')}`
		);
	}

	// Validate file size
	if (file.size > MAX_FILE_SIZE_BYTES) {
		throw error(400, `File exceeds maximum size of 10 MB`);
	}

	const fileBuffer = Buffer.from(await file.arrayBuffer());

	const attachment = await createAttachment(
		params.noteId,
		file.name,
		file.type,
		file.size,
		fileBuffer,
		currentUser.id
	);

	return json({
		attachment: {
			id: attachment.id,
			filename: attachment.filename,
			mimeType: attachment.mimeType,
			sizeBytes: attachment.sizeBytes,
			createdAt: attachment.createdAt
		}
	});
};

/**
 * GET /api/notes/[noteId]/attachments
 *
 * List all attachments for a note (metadata only, no binary data).
 */
export const GET: RequestHandler = async ({ locals, params }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	// Verify note exists and belongs to the user
	const note = await getNoteForUser(params.noteId, currentUser.id);
	if (!note) throw error(404, 'Note not found');

	const attachmentList = await listAttachmentsForNote(params.noteId);

	return json({
		attachments: attachmentList.map((attachment) => ({
			id: attachment.id,
			filename: attachment.filename,
			mimeType: attachment.mimeType,
			sizeBytes: attachment.sizeBytes,
			createdAt: attachment.createdAt
		}))
	});
};
