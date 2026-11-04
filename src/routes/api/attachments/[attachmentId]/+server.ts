import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getNoteForUser } from '$lib/server/db/queries/notes';
import { getAttachment, deleteAttachment } from '$lib/server/db/queries/attachments';

/** Attachment IDs are UUIDs; anything else (e.g. the literal "undefined") is a 404, not a DB error. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `inline` so a PDF opens in the browser's viewer; a plain ASCII `filename` for old clients and the
 * RFC 5987 `filename*` with the real (UTF-8) name.
 */
function contentDisposition(filename: string): string {
	const asciiFallback = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
	return `inline; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function assertAttachmentId(attachmentId: string): void {
	if (!UUID_PATTERN.test(attachmentId)) throw error(404, 'Attachment not found');
}

/**
 * GET /api/attachments/[attachmentId]
 *
 * Serve an attachment file with correct Content-Type and caching headers.
 * Verifies ownership: attachment -> note -> user.
 */
export const GET: RequestHandler = async ({ locals, params }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	assertAttachmentId(params.attachmentId);
	const attachment = await getAttachment(params.attachmentId);
	if (!attachment) throw error(404, 'Attachment not found');

	// Verify the attachment's note belongs to the current user
	const note = await getNoteForUser(attachment.noteId, currentUser.id);
	if (!note) throw error(404, 'Attachment not found');

	return new Response(new Uint8Array(attachment.data), {
		headers: {
			'Content-Type': attachment.mimeType,
			'Content-Disposition': contentDisposition(attachment.filename),
			'Content-Length': attachment.sizeBytes.toString(),
			'X-Content-Type-Options': 'nosniff',
			// private: decrypted bytes must never sit in a shared cache (Cloudflare) in front of the gate
			'Cache-Control': 'private, max-age=31536000, immutable'
		}
	});
};

/**
 * DELETE /api/attachments/[attachmentId]
 *
 * Delete an attachment. Verifies ownership: attachment -> note -> user.
 */
export const DELETE: RequestHandler = async ({ locals, params }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	assertAttachmentId(params.attachmentId);
	const attachment = await getAttachment(params.attachmentId);
	if (!attachment) throw error(404, 'Attachment not found');

	// Verify the attachment's note belongs to the current user
	const note = await getNoteForUser(attachment.noteId, currentUser.id);
	if (!note) throw error(404, 'Attachment not found');

	const wasDeleted = await deleteAttachment(params.attachmentId);
	if (!wasDeleted) throw error(404, 'Attachment not found');

	return json({ success: true });
};
