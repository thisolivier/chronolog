import { describe, expect, it } from 'vitest';
import { checkAttachmentType, sniffAttachmentType } from './file-type';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const PDF = new TextEncoder().encode('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n');
const GIF = new TextEncoder().encode('GIF89a\x01\x00\x01\x00');
const WEBP = new TextEncoder().encode('RIFF\x24\x00\x00\x00WEBPVP8 ');
const SVG = new TextEncoder().encode('<?xml version="1.0"?>\n<!-- logo -->\n<svg xmlns="http://www.w3.org/2000/svg"></svg>');
const TEXT = new TextEncoder().encode('Just some notes\n');

describe('sniffAttachmentType', () => {
	it('recognises each allowed type from its first bytes', () => {
		expect(sniffAttachmentType(PNG)).toBe('image/png');
		expect(sniffAttachmentType(JPEG)).toBe('image/jpeg');
		expect(sniffAttachmentType(PDF)).toBe('application/pdf');
		expect(sniffAttachmentType(GIF)).toBe('image/gif');
		expect(sniffAttachmentType(WEBP)).toBe('image/webp');
		expect(sniffAttachmentType(SVG)).toBe('image/svg+xml');
	});

	it('returns null for text, an empty file and a truncated signature', () => {
		expect(sniffAttachmentType(TEXT)).toBeNull();
		expect(sniffAttachmentType(new Uint8Array())).toBeNull();
		expect(sniffAttachmentType(PNG.subarray(0, 4))).toBeNull();
	});
});

describe('checkAttachmentType', () => {
	it('accepts PNG, JPEG and PDF whose content matches the declared type', () => {
		expect(checkAttachmentType('image/png', PNG)).toEqual({ ok: true, mimeType: 'image/png' });
		expect(checkAttachmentType('image/jpeg', JPEG)).toEqual({ ok: true, mimeType: 'image/jpeg' });
		expect(checkAttachmentType('application/pdf', PDF)).toEqual({ ok: true, mimeType: 'application/pdf' });
	});

	it('uses the sniffed type when the declared one says nothing', () => {
		expect(checkAttachmentType('', PDF)).toEqual({ ok: true, mimeType: 'application/pdf' });
		expect(checkAttachmentType('application/octet-stream', PNG)).toEqual({ ok: true, mimeType: 'image/png' });
	});

	it('rejects a PDF renamed .png (declared image/png)', () => {
		const result = checkAttachmentType('image/png', PDF);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.message).toMatch(/^File type "image\/png" is not allowed: the file's content is application\/pdf\. Allowed types: /);
	});

	it('rejects a .txt with the existing message', () => {
		const result = checkAttachmentType('text/plain', TEXT);
		expect(result).toEqual({
			ok: false,
			message: 'File type "text/plain" is not allowed. Allowed types: image/jpeg, image/png, image/gif, image/webp, image/svg+xml, application/pdf'
		});
	});

	it('rejects text declared as an image', () => {
		expect(checkAttachmentType('image/png', TEXT).ok).toBe(false);
	});
});
