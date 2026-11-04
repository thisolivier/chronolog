/**
 * Sprint 036-CL: the laptop secretary files a PNG and a PDF beside a note through the `chronolog`
 * CLI (a child process against the live server): attach (reference line appended), list, get
 * (bytes match), delete (refused without --yes, then a warning that the note still links to it),
 * and the server's 400s for a file over 10 MB, a .txt and a PDF renamed .png. Also --version and
 * the server version in `me`.
 */
import './test-init';
import { describe, it, expect, beforeAll } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BASE_URL, authGet, authPost } from './helpers';
import { minimalPdf, minimalPng } from './attachment-fixtures';

const CLI_PATH = join(import.meta.dirname, '..', '..', 'cli', 'chronolog.mjs');
const WORK_DIRECTORY = mkdtempSync(join(tmpdir(), 'chronolog-cli-036-'));
const CONFIG_PATH = join(WORK_DIRECTORY, 'config.json');
/** The CLI runs here, so `attachment get` without --out writes here (the fixtures live in WORK_DIRECTORY) */
const DOWNLOAD_DIRECTORY = mkdtempSync(join(tmpdir(), 'chronolog-cli-036-downloads-'));
const PACKAGE_VERSION = JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'package.json'), 'utf8')).version;

let rawToken = '';
let contractId = '';

function runCli(args: string[], stdinText = ''): Promise<{ exitCode: number; stdout: string; stderr: string }> {
	return new Promise((resolve) => {
		const child = execFile(
			process.execPath,
			[CLI_PATH, ...args],
			{ cwd: DOWNLOAD_DIRECTORY, env: { ...process.env, CHRONOLOG_CONFIG: CONFIG_PATH, CHRONOLOG_BASE_URL: BASE_URL, CHRONOLOG_API_TOKEN: rawToken } },
			(error, stdout, stderr) => resolve({ exitCode: error ? Number(error.code ?? 1) : 0, stdout, stderr })
		);
		child.stdin?.end(stdinText);
	});
}

async function runJson(args: string[], stdinText = '') {
	const result = await runCli([...args, '--json'], stdinText);
	expect(result.exitCode, result.stderr).toBe(0);
	return JSON.parse(result.stdout);
}

function writeFixture(name: string, bytes: Buffer): string {
	const path = join(WORK_DIRECTORY, name);
	writeFileSync(path, bytes);
	return path;
}

beforeAll(async () => {
	const tokenResponse = await authPost('/api/tokens', { name: 'e2e 036 laptop' });
	expect(tokenResponse.status).toBe(201);
	rawToken = (await tokenResponse.json()).rawToken;
	const { contracts } = await (await authGet('/api/contracts-by-client')).json();
	contractId = contracts[0].id;
});

describe('versions', () => {
	it('--version prints the CLI version; me carries the server version', async () => {
		const plain = await runCli(['--version']);
		expect(plain.stdout.trim()).toBe(`chronolog ${PACKAGE_VERSION}`);
		expect(PACKAGE_VERSION).toMatch(/^[1-9]\d*\.\d+\.\d+$/);
		const me = await runJson(['me']);
		expect(me).toMatchObject({ serverVersion: PACKAGE_VERSION, cliVersion: PACKAGE_VERSION });
		const meText = await runCli(['me']);
		expect(meText.stdout).toContain(`Server ${PACKAGE_VERSION} at ${BASE_URL}, CLI ${PACKAGE_VERSION}`);
	});
});

describe('filing a PNG and a PDF beside a note', () => {
	const pngBytes = minimalPng();
	const pdfBytes = minimalPdf('Statement of work');
	let noteId = '';
	let pngId = '';
	let pdfId = '';

	it('attach appends an image line for the PNG and a link line for the PDF', async () => {
		const created = await runJson(['note', 'new', contractId, 'Status: filing documents'], '## Done\n- Signed the SOW\n');
		noteId = created.id;

		const png = await runJson(['note', 'attach', noteId, writeFixture('whiteboard.png', pngBytes)]);
		pngId = png.attachment.id;
		expect(png).toMatchObject({ inserted: true, reference: `![whiteboard.png](chronolog://attachment/${pngId})` });
		expect(png.attachment).toMatchObject({ filename: 'whiteboard.png', mimeType: 'image/png', sizeBytes: pngBytes.length });

		const pdf = await runJson(['note', 'attach', noteId, writeFixture('Statement of work.pdf', pdfBytes)]);
		pdfId = pdf.attachment.id;
		expect(pdf).toMatchObject({ inserted: true, reference: `[Statement of work.pdf](chronolog://attachment/${pdfId})` });
		expect(pdf.attachment).toMatchObject({ mimeType: 'application/pdf', sizeBytes: pdfBytes.length });

		const shown = await runJson(['note', 'show', noteId]);
		expect(shown.content).toBe(
			`# Status: filing documents\n\n## Done\n- Signed the SOW\n\n![whiteboard.png](chronolog://attachment/${pngId})\n\n[Statement of work.pdf](chronolog://attachment/${pdfId})\n`
		);
		expect(shown.updatedAt).toBe(pdf.noteUpdatedAt);

		const human = await runCli(['note', 'attach', noteId, writeFixture('extra.png', pngBytes), '--no-insert']);
		expect(human.exitCode, human.stderr).toBe(0);
		expect(human.stdout).toMatch(/^Attached extra\.png \(image\/png, [\d.]+ [KB ]+\) to note .+ as [0-9a-f-]{36}\nNot added to the text\. Reference line:\n!\[extra\.png\]\(chronolog:\/\/attachment\/[0-9a-f-]{36}\)\n$/);
		expect((await runJson(['note', 'show', noteId])).content).toBe(shown.content);
	});

	it('attachments lists id, filename, type, size and created', async () => {
		const listed = await runJson(['note', 'attachments', noteId]);
		expect(listed).toHaveLength(3);
		expect(listed.find((attachment: { id: string }) => attachment.id === pdfId)).toMatchObject({ filename: 'Statement of work.pdf', mimeType: 'application/pdf', sizeBytes: pdfBytes.length });
		const text = await runCli(['note', 'attachments', noteId]);
		expect(text.stdout).toContain(`${pdfId}  Statement of work.pdf  application/pdf  `);
	});

	it('get writes the original bytes under the original name; refuses to overwrite without --force', async () => {
		const pdf = await runJson(['attachment', 'get', pdfId]);
		expect(pdf.path).toBe(join(realpathSync(DOWNLOAD_DIRECTORY), 'Statement of work.pdf'));
		expect(readFileSync(pdf.path).equals(pdfBytes)).toBe(true);

		const outDirectory = mkdtempSync(join(tmpdir(), 'chronolog-cli-036-out-'));
		const png = await runJson(['attachment', 'get', pngId, '--out', outDirectory]);
		expect(readFileSync(join(outDirectory, 'whiteboard.png')).equals(pngBytes)).toBe(true);
		expect(png).toMatchObject({ filename: 'whiteboard.png', mimeType: 'image/png', sizeBytes: pngBytes.length });

		const again = await runCli(['attachment', 'get', pngId, '--out', outDirectory]);
		expect(again.exitCode).toBe(2);
		expect(again.stderr).toContain('already exists');
		const forced = await runCli(['attachment', 'get', pngId, '--out', join(outDirectory, 'renamed.png'), '--force']);
		expect(forced.exitCode, forced.stderr).toBe(0);
		expect(readFileSync(join(outDirectory, 'renamed.png')).equals(pngBytes)).toBe(true);
	});

	it('the server serves the PDF inline with its type and RFC 5987 filename', async () => {
		const response = await authGet(`/api/attachments/${pdfId}`);
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('application/pdf');
		expect(response.headers.get('content-disposition')).toBe(`inline; filename="Statement of work.pdf"; filename*=UTF-8''Statement%20of%20work.pdf`);
		expect(Buffer.from(await response.arrayBuffer()).equals(pdfBytes)).toBe(true);
	});

	it('delete asks first, then deletes with --yes and warns that the note still links to it', async () => {
		const refused = await runCli(['attachment', 'delete', pdfId]);
		expect(refused.exitCode).toBe(2);
		expect(refused.stderr).toContain('Statement of work.pdf (application/pdf');
		expect(refused.stderr).toContain(`Note ${noteId} still links to it (1 time)`);
		expect((await authGet(`/api/attachments/${pdfId}`)).status).toBe(200);

		const before = (await runJson(['note', 'show', noteId])).content;
		const deleted = await runJson(['attachment', 'delete', pdfId, '--yes']);
		expect(deleted).toMatchObject({ deleted: { id: pdfId, filename: 'Statement of work.pdf', noteId }, noteStillReferences: 1 });
		expect((await authGet(`/api/attachments/${pdfId}`)).status).toBe(404);
		expect((await runJson(['note', 'show', noteId])).content).toBe(before);
		expect(await runJson(['note', 'attachments', noteId])).toHaveLength(2);

		const gone = await runCli(['attachment', 'delete', pdfId, '--yes']);
		expect(gone.exitCode).toBe(3);
	});

	it('the server refuses a file over 10 MB, a .txt, and a PDF renamed .png (400, exit 1)', async () => {
		const oversized = Buffer.concat([minimalPdf(), Buffer.alloc(10 * 1024 * 1024 + 1 - minimalPdf().length, 0x20)]);
		expect(oversized.length).toBe(10 * 1024 * 1024 + 1);
		const tooBig = await runCli(['note', 'attach', noteId, writeFixture('huge.pdf', oversized), '--json']);
		expect(tooBig.exitCode).toBe(1);
		expect(JSON.parse(tooBig.stderr)).toMatchObject({ error: 'File exceeds maximum size of 10 MB', status: 400 });

		const text = await runCli(['note', 'attach', noteId, writeFixture('notes.txt', Buffer.from('plain text\n')), '--json']);
		expect(text.exitCode).toBe(1);
		expect(JSON.parse(text.stderr)).toMatchObject({ status: 400 });
		expect(JSON.parse(text.stderr).error).toMatch(/^File type "text\/plain" is not allowed\. Allowed types: /);

		const disguised = await runCli(['note', 'attach', noteId, writeFixture('invoice.png', minimalPdf()), '--json']);
		expect(disguised.exitCode).toBe(1);
		expect(JSON.parse(disguised.stderr).error).toMatch(/^File type "image\/png" is not allowed: the file's content is application\/pdf/);

		expect(await runJson(['note', 'attachments', noteId])).toHaveLength(2);
	});
});
