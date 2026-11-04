import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { importFile, undo, ImportFailed } from './import.mjs';
import { parseImportText } from '../lib/import-file.mjs';
import { createReferenceLookups, resolveImportItems } from '../lib/import-items.mjs';
import { readLastImport, recordLastImport } from '../lib/import-history.mjs';
import { ReferenceError_ } from '../lib/resolve.mjs';
import { UsageError } from '../lib/args.mjs';

const FIXTURE = join(import.meta.dirname, 'fixtures', 'import-entries-one-bad.jsonl');
const CONTRACTS = [
	{ id: 'c-acme', clientShortCode: 'ACME', clientName: 'Acme Ltd', name: 'Website' },
	{ id: 'c-beta', clientShortCode: 'BETA', clientName: 'Beta Co', name: 'Retainer' },
	{ id: 'c-beta2', clientShortCode: 'BETA', clientName: 'Beta Co', name: 'Retainer extension' }
];

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

const referenceApi = (extra = {}) =>
	fakeApi({
		'GET /api/me': { today: '2026-11-04' },
		'GET /api/contracts-by-client': { contracts: CONTRACTS },
		'GET /api/deliverables?contractId=c-acme': [{ id: 'd-discovery', name: 'Discovery' }],
		'GET /api/work-types?deliverableId=d-discovery': [{ id: 'w-interviews', name: 'Interviews' }],
		...extra
	});

function tempEnvironment() {
	return { CHRONOLOG_CONFIG: join(mkdtempSync(join(tmpdir(), 'chronolog-import-')), 'config.json') };
}

function writeTemp(name, text) {
	const path = join(mkdtempSync(join(tmpdir(), 'chronolog-import-file-')), name);
	writeFileSync(path, text);
	return path;
}

describe('parseImportText', () => {
	it('reads JSON Lines with their line numbers, skipping blanks and // comments', () => {
		const { items, problems } = parseImportText('// header\n{"a":1}\n\n{"a":2}\nnot json\n[1]\n');
		expect(items).toEqual([{ line: 2, value: { a: 1 } }, { line: 4, value: { a: 2 } }]);
		expect(problems.map((problem) => problem.line)).toEqual([5, 6]);
	});

	it('reads a JSON array, numbering items from 1', () => {
		const { items, problems } = parseImportText('[{"a":1}, 3, {"a":2}]');
		expect(items.map((item) => item.line)).toEqual([1, 3]);
		expect(problems).toEqual([{ line: 2, message: 'item is not a JSON object' }]);
	});
});

describe('resolveImportItems on the fixture file', () => {
	it('resolves each reference once and reports the one bad line with candidates', async () => {
		const api = referenceApi();
		const { items } = parseImportText(readFileSync(FIXTURE, 'utf8'));
		const { payloads, problems } = await resolveImportItems('entries', items, createReferenceLookups(api), '2026-11-04');

		expect(problems).toHaveLength(1);
		expect(problems[0]).toMatchObject({ line: 7, isReference: true });
		expect(problems[0].message).toContain('Phase 9');
		expect(problems[0].candidates.join('\n')).toContain('Discovery');

		expect(payloads.map((payload) => payload.line)).toEqual([2, 3, 4, 6, 8]);
		expect(payloads[0].body).toEqual({
			contractId: 'c-acme',
			date: '2026-10-01',
			duration: '1h30m',
			description: 'Kickoff',
			deliverableId: 'd-discovery',
			workTypeId: 'w-interviews'
		});
		expect(payloads[1].body).toMatchObject({ contractId: 'c-acme', date: '2026-11-03', duration: '9:00-10:15' });
		expect(payloads[2].body).toMatchObject({ date: '2026-11-02', startTime: '14:00', endTime: '15:00', deliverableId: 'd-discovery' });
		expect(payloads[3].body).toEqual({ contractId: 'c-beta', date: '2026-10-02', duration: '2', noteId: 'BETA.20261002.001' });

		const gets = api.calls.map((call) => call.path);
		expect(gets.filter((path) => path === '/api/contracts-by-client')).toHaveLength(1);
		expect(gets.filter((path) => path.startsWith('/api/deliverables'))).toHaveLength(1);
		expect(gets.filter((path) => path.startsWith('/api/work-types'))).toHaveLength(1);
	});

	it('builds note creates (heading from title + body, backdated) and changes by id', async () => {
		const { items } = parseImportText(
			[
				'{"contract":"ACME/Website","title":"Kickoff","body":"Agenda\\n","date":"2026-10-04"}',
				'{"contract":"BETA/Retainer","content":"As written"}',
				'{"id":"ACME.20261004.001","append":"More"}',
				'{"contract":"BETA","title":"Which one?"}',
				'{"contract":"ACME/Website","title":"x","colour":"red"}'
			].join('\n')
		);
		const { payloads, problems } = await resolveImportItems('notes', items, createReferenceLookups(referenceApi()), '2026-11-04');
		expect(payloads.map((payload) => payload.body)).toEqual([
			{ contractId: 'c-acme', title: 'Kickoff', content: '# Kickoff\n\nAgenda\n', createdAt: '2026-10-04' },
			{ contractId: 'c-beta', content: 'As written' },
			{ id: 'ACME.20261004.001', append: 'More' }
		]);
		expect(problems.map((problem) => [problem.line, problem.isReference])).toEqual([
			[4, true],
			[5, false]
		]);
	});
});

describe('chronolog import', () => {
	it('refuses the whole file with exit-3 error listing the bad line; nothing is sent', async () => {
		const api = referenceApi();
		const failure = await importFile({ api, print: () => {}, positionals: ['entries', FIXTURE], flags: {}, environment: tempEnvironment() }).catch((thrown) => thrown);
		expect(failure).toBeInstanceOf(ReferenceError_);
		expect(failure.candidates[0]).toMatch(/^line 7: /);
		expect(api.calls.some((call) => call.method === 'POST')).toBe(false);
	});

	it('--dry-run prints what would be sent and sends nothing', async () => {
		const path = writeTemp('ok.jsonl', '{"contract":"ACME/Website","date":"2026-10-01","duration":"1h"}\n');
		const api = referenceApi();
		const printed = [];
		await importFile({ api, print: (text) => printed.push(text), positionals: ['entries', path], flags: { dryRun: true }, environment: tempEnvironment() });
		expect(printed[0]).toContain('would create 1  2026-10-01 1h ACME/Website');
		expect(printed[0]).toContain('Dry run: 1 time entries in 1 request; nothing sent.');
		expect(api.calls.some((call) => call.method === 'POST')).toBe(false);
	});

	it('sends entries in chunks of 200, prints one line per item, records the created ids and fails on any failure', async () => {
		const lines = Array.from({ length: 250 }, (_, position) => JSON.stringify({ contract: 'ACME/Website', date: '2026-10-01', duration: `${position + 1}m` }));
		const path = writeTemp('many.jsonl', lines.join('\n'));
		let sent = 0;
		const api = referenceApi({
			'POST /api/time-entries/batch': (body) => {
				const results = body.items.map((_, index) =>
					sent + index === 7 ? { index, ok: false, error: 'date must be YYYY-MM-DD', code: 'invalid_date' } : { index, ok: true, id: `e-${sent + index}` }
				);
				sent += body.items.length;
				return { results };
			}
		});
		const environment = tempEnvironment();
		const printed = [];
		const failure = await importFile({ api, print: (text) => printed.push(text), positionals: ['entries', path], flags: { atomic: true }, config: { baseUrl: 'http://x' }, environment }).catch((thrown) => thrown);
		const posts = api.calls.filter((call) => call.method === 'POST');
		expect(posts.map((call) => call.body.items.length)).toEqual([200, 50]);
		expect(posts.every((call) => call.body.atomic === true)).toBe(true);
		expect(printed[0]).toContain('ok 1 e-0');
		expect(printed[0]).toContain('fail 8 invalid_date date must be YYYY-MM-DD');
		expect(printed[0]).toContain('249 created, 0 updated, 1 failed.');
		expect(failure).toBeInstanceOf(ImportFailed);
		expect(readLastImport(environment).entryIds).toHaveLength(249);
	});

	it('refuses an unknown kind', async () => {
		await expect(importFile({ api: referenceApi(), print: () => {}, positionals: ['clients', FIXTURE], flags: {} })).rejects.toThrow(UsageError);
	});
});

describe('chronolog undo --last-import', () => {
	it('needs --yes without a terminal, then deletes every recorded entry', async () => {
		const environment = tempEnvironment();
		recordLastImport({ entryIds: ['e-1', 'e-2', 'e-3'], baseUrl: 'http://x', createdAt: '2026-11-04T10:00:00Z', file: '/tmp/october.jsonl' }, environment);
		const gone = Object.assign(new Error('gone'), { status: 404 });
		const api = fakeApi({ 'DELETE /api/time-entries/e-1': {}, 'DELETE /api/time-entries/e-2': gone, 'DELETE /api/time-entries/e-3': {} });
		const context = { api, print: () => {}, config: { baseUrl: 'http://x' }, environment };

		await expect(undo({ ...context, flags: { lastImport: true } })).rejects.toThrow(UsageError);
		expect(api.calls).toHaveLength(0);

		const printed = [];
		await undo({ ...context, print: (text) => printed.push(text), flags: { lastImport: true, yes: true } });
		expect(api.calls.map((call) => call.path)).toEqual(['/api/time-entries/e-1', '/api/time-entries/e-2', '/api/time-entries/e-3']);
		expect(printed[0]).toBe('Deleted 2 time entries from the import of october.jsonl (1 were already gone).');
		expect(readLastImport(environment)).toBeNull();
	});
});
