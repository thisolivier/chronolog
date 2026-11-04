import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { attachmentDelete, attachmentGet, noteAttach, noteAttachments } from './attachments.mjs';
import { NoteChanged } from './note-changes.mjs';
import { ApiError } from '../lib/api.mjs';
import { UsageError } from '../lib/args.mjs';
import { ReferenceError_ } from '../lib/resolve.mjs';
import { countReferences, filenameFromDisposition, formatSize, mimeTypeForFile, referenceLine } from '../lib/attachment-files.mjs';

const NOTE_ID = 'ACME.20261104.001';
const ATTACHMENT_ID = '550e8400-e29b-41d4-a716-446655440000';
const STORED = { id: NOTE_ID, title: 'Status', content: '# Status\n\nBody\n', updatedAt: '2026-11-04T10:00:00.123Z' };
const notATerminal = { isTTY: false };

function fakeApi(responses = {}) {
	const calls = [];
	const respond = (method) => async (path, body) => {
		calls.push({ method, path, body });
		const handler = responses[`${method} ${path}`];
		if (handler === undefined) throw new Error(`unexpected ${method} ${path}`);
		if (handler instanceof Error) throw handler;
		return typeof handler === 'function' ? handler(body) : handler;
	};
	return { calls, get: respond('GET'), patch: respond('PATCH'), delete: respond('DELETE'), upload: respond('UPLOAD'), download: respond('DOWNLOAD'), head: respond('HEAD') };
}

function capture() {
	const output = [];
	return { output, print: (text, json) => output.push({ text, json }) };
}

const tempDirectory = () => mkdtempSync(join(tmpdir(), 'chronolog-036-'));

function uploadedAs(filename, mimeType) {
	return async (formData) => {
		const file = formData.get('file');
		return { attachment: { id: ATTACHMENT_ID, filename: file.name, mimeType, sizeBytes: file.size, createdAt: '2026-11-04T10:01:00Z', declared: file.type } };
	};
}

describe('attachment helpers', () => {
	it('builds an image or a link reference and escapes brackets in the name', () => {
		expect(referenceLine({ id: 'a1', filename: 'shot.png', mimeType: 'image/png' })).toBe('![shot.png](chronolog://attachment/a1)');
		expect(referenceLine({ id: 'a1', filename: 'SOW [v2].pdf', mimeType: 'application/pdf' })).toBe('[SOW \\[v2\\].pdf](chronolog://attachment/a1)');
	});

	it('declares types from extensions, counts references, formats sizes', () => {
		expect(mimeTypeForFile('/x/Report.PDF')).toBe('application/pdf');
		expect(mimeTypeForFile('photo.jpeg')).toBe('image/jpeg');
		expect(mimeTypeForFile('archive.zip')).toBe('application/octet-stream');
		expect(countReferences(`a [x](chronolog://attachment/${ATTACHMENT_ID}) b ![y](chronolog://attachment/${ATTACHMENT_ID})`, ATTACHMENT_ID)).toBe(2);
		expect(formatSize(512)).toBe('512 B');
		expect(formatSize(2048)).toBe('2.0 KB');
		expect(formatSize(3 * 1024 * 1024)).toBe('3.0 MB');
	});

	it('reads the RFC 5987 filename and never lets it leave the directory', () => {
		expect(filenameFromDisposition(`inline; filename="Re_sume_.pdf"; filename*=UTF-8''R%C3%A9sum%C3%A9.pdf`)).toBe('Résumé.pdf');
		expect(filenameFromDisposition('inline; filename="plain.png"')).toBe('plain.png');
		expect(filenameFromDisposition(`inline; filename*=UTF-8''..%2F..%2Fetc%2Fpasswd`)).toBe('passwd');
		expect(filenameFromDisposition(`inline; filename*=UTF-8''..`, 'fallback')).toBe('fallback');
		expect(filenameFromDisposition(null, 'fallback')).toBe('fallback');
	});
});

describe('note attach', () => {
	it('uploads a PDF and appends a link line with the updatedAt it read', async () => {
		const directory = tempDirectory();
		const filePath = join(directory, 'Statement of work.pdf');
		writeFileSync(filePath, '%PDF-1.4\n%%EOF\n');
		const api = fakeApi({
			[`GET /api/notes/${NOTE_ID}`]: { note: STORED },
			[`UPLOAD /api/notes/${NOTE_ID}/attachments`]: uploadedAs('Statement of work.pdf', 'application/pdf'),
			[`PATCH /api/notes/${NOTE_ID}`]: (body) => ({ note: { ...STORED, ...body, updatedAt: '2026-11-04T10:02:00.000Z' } })
		});
		const { output, print } = capture();
		await noteAttach({ api, print, positionals: [NOTE_ID, filePath], flags: {} });

		const reference = `[Statement of work.pdf](chronolog://attachment/${ATTACHMENT_ID})`;
		const patch = api.calls.find((call) => call.method === 'PATCH');
		expect(patch.body).toEqual({ content: `# Status\n\nBody\n\n${reference}\n`, expectedUpdatedAt: STORED.updatedAt });
		expect(output[0].json).toMatchObject({ reference, inserted: true, attachment: { id: ATTACHMENT_ID, declared: 'application/pdf' } });
		expect(output[0].text).toContain(ATTACHMENT_ID);
		expect(output[0].text).toContain(reference);
	});

	it('--no-insert only uploads; a PNG gets an image line', async () => {
		const filePath = join(tempDirectory(), 'shot.png');
		writeFileSync(filePath, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
		const api = fakeApi({
			[`GET /api/notes/${NOTE_ID}`]: { note: STORED },
			[`UPLOAD /api/notes/${NOTE_ID}/attachments`]: uploadedAs('shot.png', 'image/png')
		});
		const { output, print } = capture();
		await noteAttach({ api, print, positionals: [NOTE_ID, filePath], flags: { noInsert: true } });
		expect(api.calls.some((call) => call.method === 'PATCH')).toBe(false);
		expect(output[0].json).toMatchObject({ reference: `![shot.png](chronolog://attachment/${ATTACHMENT_ID})`, inserted: false });
	});

	it('a note changed in the app exits 7, naming the attachment and the line to add', async () => {
		const filePath = join(tempDirectory(), 'a.pdf');
		writeFileSync(filePath, '%PDF-1.4');
		const api = fakeApi({
			[`GET /api/notes/${NOTE_ID}`]: { note: STORED },
			[`UPLOAD /api/notes/${NOTE_ID}/attachments`]: uploadedAs('a.pdf', 'application/pdf'),
			[`PATCH /api/notes/${NOTE_ID}`]: new ApiError(409, 'Note was modified', 'conflict')
		});
		const failure = await noteAttach({ api, print: () => {}, positionals: [NOTE_ID, filePath], flags: { expectedUpdatedAt: 'old' } }).catch((error) => error);
		expect(failure).toBeInstanceOf(NoteChanged);
		expect(failure.message).toContain(`attached as ${ATTACHMENT_ID} but not linked`);
		expect(failure.message).toContain(`[a.pdf](chronolog://attachment/${ATTACHMENT_ID})`);
		expect(api.calls.find((call) => call.method === 'PATCH').body.expectedUpdatedAt).toBe('old');
	});

	it('refuses a missing file before calling the server', async () => {
		const api = fakeApi();
		await expect(noteAttach({ api, print: () => {}, positionals: [NOTE_ID, '/nope/x.pdf'], flags: {} })).rejects.toBeInstanceOf(UsageError);
		expect(api.calls).toHaveLength(0);
	});
});

describe('note attachments', () => {
	it('lists id, filename, type, size and created', async () => {
		const api = fakeApi({
			[`GET /api/notes/${NOTE_ID}/attachments`]: { attachments: [{ id: ATTACHMENT_ID, filename: 'a.pdf', mimeType: 'application/pdf', sizeBytes: 2048, createdAt: '2026-11-04T10:01:00.000Z' }] }
		});
		const { output, print } = capture();
		await noteAttachments({ api, print, positionals: [NOTE_ID], flags: {} });
		expect(output[0].text).toBe(`Attachments on ${NOTE_ID}: 1\n${ATTACHMENT_ID}  a.pdf  application/pdf  2.0 KB  2026-11-04 10:01`);
	});
});

describe('attachment get', () => {
	const download = { bytes: Buffer.from('%PDF-1.4'), headers: new Headers({ 'content-type': 'application/pdf', 'content-disposition': `inline; filename*=UTF-8''SOW.pdf` }) };

	it('writes the original filename into --out <dir>, refuses to overwrite without --force', async () => {
		const directory = tempDirectory();
		const api = fakeApi({ [`DOWNLOAD /api/attachments/${ATTACHMENT_ID}`]: download });
		const { output, print } = capture();
		await attachmentGet({ api, print, positionals: [ATTACHMENT_ID], flags: { out: directory } });
		expect(readFileSync(join(directory, 'SOW.pdf'), 'utf8')).toBe('%PDF-1.4');
		expect(output[0].json).toMatchObject({ filename: 'SOW.pdf', mimeType: 'application/pdf', sizeBytes: 8, path: join(directory, 'SOW.pdf') });

		await expect(attachmentGet({ api, print, positionals: [ATTACHMENT_ID], flags: { out: directory } })).rejects.toThrow(/already exists.*--force/);
		writeFileSync(join(directory, 'SOW.pdf'), 'old');
		await attachmentGet({ api, print, positionals: [ATTACHMENT_ID], flags: { out: directory, force: true } });
		expect(readFileSync(join(directory, 'SOW.pdf'), 'utf8')).toBe('%PDF-1.4');
	});

	it('an unknown id is exit 3', async () => {
		const api = fakeApi({ [`DOWNLOAD /api/attachments/${ATTACHMENT_ID}`]: new ApiError(404, 'Attachment not found', 'http_404') });
		await expect(attachmentGet({ api, print: () => {}, positionals: [ATTACHMENT_ID], flags: {} })).rejects.toBeInstanceOf(ReferenceError_);
	});
});

describe('attachment delete', () => {
	const headers = new Headers({
		'content-type': 'application/pdf',
		'content-length': '2048',
		'content-disposition': `inline; filename*=UTF-8''SOW.pdf`,
		'x-note-id': NOTE_ID
	});
	const linkedNote = { ...STORED, content: `# Status\n\n[SOW.pdf](chronolog://attachment/${ATTACHMENT_ID})\n` };

	it('without --yes and no terminal: refuses (usage), shows what and the link warning, deletes nothing', async () => {
		const api = fakeApi({ [`HEAD /api/attachments/${ATTACHMENT_ID}`]: headers, [`GET /api/notes/${NOTE_ID}`]: { note: linkedNote } });
		const failure = await attachmentDelete({ api, print: () => {}, positionals: [ATTACHMENT_ID], flags: {}, stdin: notATerminal }).catch((error) => error);
		expect(failure).toBeInstanceOf(UsageError);
		expect(failure.message).toContain('SOW.pdf (application/pdf, 2.0 KB) on note ACME.20261104.001 “Status”');
		expect(failure.message).toContain('still links to it (1 time)');
		expect(api.calls.some((call) => call.method === 'DELETE')).toBe(false);
	});

	it('with --yes deletes, warns, and leaves the note text alone', async () => {
		const api = fakeApi({
			[`HEAD /api/attachments/${ATTACHMENT_ID}`]: headers,
			[`GET /api/notes/${NOTE_ID}`]: { note: linkedNote },
			[`DELETE /api/attachments/${ATTACHMENT_ID}`]: { success: true }
		});
		const { output, print } = capture();
		await attachmentDelete({ api, print, positionals: [ATTACHMENT_ID], flags: { yes: true }, stdin: notATerminal });
		expect(output[0].json).toMatchObject({ deleted: { id: ATTACHMENT_ID, filename: 'SOW.pdf', noteId: NOTE_ID }, noteStillReferences: 1 });
		expect(output[0].text).toContain('Warning: Note ACME.20261104.001 still links to it');
		expect(api.calls.some((call) => call.method === 'PATCH')).toBe(false);
	});

	it('no warning when the note does not link to it', async () => {
		const api = fakeApi({
			[`HEAD /api/attachments/${ATTACHMENT_ID}`]: headers,
			[`GET /api/notes/${NOTE_ID}`]: { note: STORED },
			[`DELETE /api/attachments/${ATTACHMENT_ID}`]: { success: true }
		});
		const { output, print } = capture();
		await attachmentDelete({ api, print, positionals: [ATTACHMENT_ID], flags: { yes: true } });
		expect(output[0].json.noteStillReferences).toBe(0);
		expect(output[0].text).not.toContain('Warning');
	});
});
