/**
 * Attachment helpers for `note attach`, `note attachments`, `attachment get|delete` (sprint 036-CL):
 * the declared type from the file extension (the server checks the bytes anyway), the markdown
 * reference a note uses, sizes, and the filename from a `Content-Disposition` header.
 */

import { basename, extname } from 'node:path';

const ATTACHMENT_URL_PREFIX = 'chronolog://attachment/';

const MIME_TYPES_BY_EXTENSION = {
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.svg': 'image/svg+xml',
	'.pdf': 'application/pdf',
	'.txt': 'text/plain',
	'.md': 'text/markdown'
};

/** The type to declare for a file; unknown extensions let the server decide from the bytes. */
export function mimeTypeForFile(path) {
	return MIME_TYPES_BY_EXTENSION[extname(path).toLowerCase()] ?? 'application/octet-stream';
}

export const attachmentUrl = (attachmentId) => `${ATTACHMENT_URL_PREFIX}${attachmentId}`;

/**
 * The markdown line that shows an attachment in a note: `![name](chronolog://attachment/<id>)` for an
 * image (shown inline), `[name](chronolog://attachment/<id>)` for anything else (a link that opens it).
 */
export function referenceLine({ id, filename, mimeType }) {
	const label = String(filename ?? 'attachment').replace(/([[\]\\])/g, '\\$1');
	const link = `[${label}](${attachmentUrl(id)})`;
	return String(mimeType).startsWith('image/') ? `!${link}` : link;
}

/** How many times the markdown links to the attachment. */
export function countReferences(markdown, attachmentId) {
	return (markdown ?? '').split(attachmentUrl(attachmentId)).length - 1;
}

export function formatSize(bytes) {
	const size = Number(bytes);
	if (size < 1024) return `${size} B`;
	if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
	return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * The original filename from `inline; filename="…"; filename*=UTF-8''…` (RFC 5987 wins), reduced
 * to a bare name so a server-supplied value can never write outside the target directory.
 */
export function filenameFromDisposition(header, fallback = 'attachment') {
	const value = header ?? '';
	let name = null;
	const extended = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(value);
	if (extended) {
		try {
			name = decodeURIComponent(extended[1].trim());
		} catch {
			name = null;
		}
	}
	if (!name) name = /filename\s*=\s*"([^"]*)"/i.exec(value)?.[1] ?? null;
	const bare = basename(String(name ?? '').replace(/\\/g, '/')).trim();
	return bare && bare !== '.' && bare !== '..' ? bare : fallback;
}
