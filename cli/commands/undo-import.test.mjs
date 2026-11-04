import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { importFile } from './import.mjs';
import { undoLastImport } from './undo-import.mjs';
import { lastImportPath, readLastImport, recordLastImport } from '../lib/import-history.mjs';
import { UsageError } from '../lib/args.mjs';

function fakeApi(responses = {}) {
	const calls = [];
	const respond = (method) => async (path, body) => {
		calls.push({ method, path, body });
		const handler = responses[`${method} ${path}`] ?? responses[`${method} ${path.split('?')[0]}`];
		if (handler instanceof Error) throw handler;
		return typeof handler === 'function' ? handler(body, path) : handler;
	};
	return { calls, get: respond('GET'), post: respond('POST'), delete: respond('DELETE') };
}

const temporaryDirectory = () => mkdtempSync(join(tmpdir(), 'chronolog-undo-import-'));
const tempEnvironment = () => ({ CHRONOLOG_CONFIG: join(temporaryDirectory(), 'config.json') });

describe('chronolog import notes records what it created', () => {
	it('keeps the created notes only (an update to an existing note is not undone)', async () => {
		const environment = tempEnvironment();
		const file = join(temporaryDirectory(), 'notes.jsonl');
		writeFileSync(
			file,
			[
				JSON.stringify({ contract: 'ACME/Website', title: 'One', body: 'a', date: '2026-11-01' }),
				JSON.stringify({ id: 'ACME.20261001.001', append: 'more' }),
				JSON.stringify({ contract: 'ACME/Website', title: 'Two', body: 'b', date: '2026-11-02' })
			].join('\n')
		);
		const api = fakeApi({
			'GET /api/me': { today: '2026-11-04' },
			'GET /api/contracts-by-client': { contracts: [{ id: 'c-acme', clientShortCode: 'ACME', clientName: 'Acme', name: 'Website' }] },
			'POST /api/notes/batch': (body) => ({
				results: body.items.map((item, index) => ({ index, ok: true, id: item.id ?? `ACME.2026110${index}.001` }))
			})
		});
		await importFile({ api, print: () => {}, positionals: ['notes', file], flags: {}, config: { baseUrl: 'http://x' }, environment });
		const record = readLastImport(environment);
		expect(record.kind).toBe('notes');
		expect(record.entryIds).toEqual([]);
		expect(record.noteIds).toEqual(['ACME.20261100.001', 'ACME.20261102.001']);
	});
});

describe('chronolog undo --last-import (notes)', () => {
	it('needs --yes without a terminal, then moves every created note to the trash', async () => {
		const environment = tempEnvironment();
		recordLastImport({ kind: 'notes', entryIds: [], noteIds: ['N.1', 'N.2', 'N.3'], baseUrl: 'http://x', createdAt: '2026-11-04T10:00:00Z', file: '/tmp/notes.jsonl' }, environment);
		const gone = Object.assign(new Error('gone'), { status: 404 });
		const api = fakeApi({ 'DELETE /api/notes/N.1': {}, 'DELETE /api/notes/N.2': gone, 'DELETE /api/notes/N.3': {} });
		const context = { api, print: () => {}, config: { baseUrl: 'http://x' }, environment };

		await expect(undoLastImport({ ...context, flags: {} })).rejects.toThrow(UsageError);
		expect(api.calls).toHaveLength(0);

		const printed = [];
		await undoLastImport({ ...context, print: (text, json) => printed.push({ text, json }), flags: { yes: true } });
		expect(api.calls.map((call) => `${call.method} ${call.path}`)).toEqual(['DELETE /api/notes/N.1', 'DELETE /api/notes/N.2', 'DELETE /api/notes/N.3']);
		expect(printed[0].text).toContain('Moved 2 notes from the import of notes.jsonl to the trash (1 were already gone).');
		expect(printed[0].json).toMatchObject({ trashed: 2, alreadyGone: 1 });
		expect(readLastImport(environment)).toBeNull();
	});

	it('still reads a pre-044 record (entry ids only)', async () => {
		const environment = tempEnvironment();
		writeFileSync(lastImportPath(environment), JSON.stringify({ entryIds: ['e-1'], baseUrl: 'http://x', createdAt: 'then', file: '/tmp/a.json' }));
		const api = fakeApi({ 'DELETE /api/time-entries/e-1': {} });
		const printed = [];
		await undoLastImport({ api, print: (text) => printed.push(text), flags: { yes: true }, config: { baseUrl: 'http://x' }, environment });
		expect(printed[0]).toBe('Deleted 1 time entries from the import of a.json.');
	});

	it('refuses an import made against another server', async () => {
		const environment = tempEnvironment();
		recordLastImport({ kind: 'notes', entryIds: [], noteIds: ['N.1'], baseUrl: 'http://other', createdAt: 'then', file: 'x' }, environment);
		await expect(undoLastImport({ api: fakeApi(), print: () => {}, flags: { yes: true }, config: { baseUrl: 'http://x' }, environment })).rejects.toThrow('nothing undone');
	});
});
