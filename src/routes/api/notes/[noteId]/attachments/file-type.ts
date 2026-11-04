/**
 * Attachment type checks (sprint 036-CL). The declared `Content-Type` of an upload comes from the
 * client (a browser guesses it from the extension; the CLI from the file name), so the server
 * reads the first bytes and keeps only files whose content is one of the allowed types and agrees
 * with what was declared. A PDF renamed `.png` is refused rather than stored as an image.
 */

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
	'image/jpeg',
	'image/png',
	'image/gif',
	'image/webp',
	'image/svg+xml',
	'application/pdf'
] as const;

export type AttachmentMimeType = (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number];

/** Declared types that say nothing about the content; the sniffed type is used instead. */
const UNSPECIFIC_DECLARED_TYPES = new Set(['', 'application/octet-stream']);

function startsWithBytes(bytes: Uint8Array, signature: number[], offset = 0): boolean {
	if (bytes.length < offset + signature.length) return false;
	return signature.every((byte, index) => bytes[offset + index] === byte);
}

function startsWithAscii(bytes: Uint8Array, text: string, offset = 0): boolean {
	return startsWithBytes(bytes, Array.from(text, (character) => character.charCodeAt(0)), offset);
}

/** SVG is text: an optional BOM, XML prolog, comments or doctype, then an `<svg` root element. */
function looksLikeSvg(bytes: Uint8Array): boolean {
	const head = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, 4096)).replace(/^﻿/, '');
	const withoutPreamble = head
		.replace(/^\s*<\?xml[\s\S]*?\?>/, '')
		.replace(/^(\s*<!--[\s\S]*?-->)*/, '')
		.replace(/^\s*<!DOCTYPE[^>]*>/i, '')
		.replace(/^(\s*<!--[\s\S]*?-->)*/, '');
	return /^\s*<svg[\s>]/i.test(withoutPreamble);
}

/** The allowed type the bytes are, from their magic numbers, or null for anything else. */
export function sniffAttachmentType(bytes: Uint8Array): AttachmentMimeType | null {
	if (startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
	if (startsWithBytes(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
	if (startsWithAscii(bytes, 'GIF87a') || startsWithAscii(bytes, 'GIF89a')) return 'image/gif';
	if (startsWithAscii(bytes, 'RIFF') && startsWithAscii(bytes, 'WEBP', 8)) return 'image/webp';
	if (startsWithAscii(bytes, '%PDF-')) return 'application/pdf';
	if (looksLikeSvg(bytes)) return 'image/svg+xml';
	return null;
}

export type AttachmentTypeCheck =
	| { ok: true; mimeType: AttachmentMimeType }
	| { ok: false; message: string };

/**
 * Check an upload's bytes against its declared type. The message keeps the wording the route has
 * always used (`File type "…" is not allowed. Allowed types: …`).
 */
export function checkAttachmentType(declaredType: string, bytes: Uint8Array): AttachmentTypeCheck {
	const allowedList = ALLOWED_ATTACHMENT_MIME_TYPES.join(', ');
	const declared = declaredType.split(';')[0].trim().toLowerCase();
	const sniffed = sniffAttachmentType(bytes);
	if (!sniffed) {
		return { ok: false, message: `File type "${declaredType}" is not allowed. Allowed types: ${allowedList}` };
	}
	if (!UNSPECIFIC_DECLARED_TYPES.has(declared) && declared !== sniffed) {
		return {
			ok: false,
			message: `File type "${declaredType}" is not allowed: the file's content is ${sniffed}. Allowed types: ${allowedList}`
		};
	}
	return { ok: true, mimeType: sniffed };
}
