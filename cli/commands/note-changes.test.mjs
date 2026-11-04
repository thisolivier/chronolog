import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NoteChanged, noteAppend, noteDelete, noteEdit, noteRestore } from './note-changes.mjs';
import { ApiError } from '../lib/api.mjs';
import { UsageError } from '../lib/args.mjs';
import { ReferenceError_ } from '../lib/resolve.mjs';
import { appendedContent, countWords, editedContent } from '../lib/note-body.mjs';
import { readTrash } from '../lib/trash.mjs';
import { noteNew } from './write.mjs';

const NOTE_ID = 'ACME.20261104.001';
const CONTRACT = { id: '22222222-2222-4222-8222-222222222222', name: 'Website', clientShortCode: 'ACME', clientName: 'Acme Ltd' };
const OTHER_CONTRACT = { id: '33333333-3333-4333-8333-333333333333', name: 'Retainer', clientShortCode: 'ACME', clientName: 'Acme Ltd' };
const STORED = {
	id: NOTE_ID,
	contractId: CONTRACT.id,
	title: 'Status: checkout',
	content: '# Status: checkout\n\n## Done\n- Reviewed the flow\n',
	updatedAt: '2026-11-04T10:00:00.123Z',
	wordCount: 6
};
const notATerminal = { isTTY: false };
const aTerminal = { isTTY: true };

function fakeApi(responses = {}) {
	const calls = [];
	const respond = (method) => async (path, body) => {
		calls.push({ method, path, body });
		const handler = responses[`${method} ${path.split('?')[0]}`];
		if (handler === undefined) throw new Error(`unexpected ${method} ${path}`);
		if (handler instanceof Error) throw handler;
		return typeof handler === 'function' ? handler(body, path) : handler;
	};
	return { calls, get: respond('GET'), post: respond('POST'), patch: respond('PATCH'), delete: respond('DELETE') };
}

const noteApi = (extra = {}) =>
	fakeApi({
		[`GET /api/notes/${NOTE_ID}`]: { note: STORED },
		'GET /api/contracts-by-client': { contracts: [CONTRACT, OTHER_CONTRACT] },
		[`PATCH /api/notes/${NOTE_ID}`]: (body) => ({ note: { ...STORED, ...body } }),
		...extra
	});

const tempEnvironment = () => ({ CHRONOLOG_CONFIG: join(mkdtempSync(join(tmpdir(), 'chronolog-034-')), 'config.json') });

describe('note markdown helpers', () => {
	it('a new body keeps the title heading unless it brings its own; --title replaces it', () => {
		expect(editedContent(STORED, { body: 'New text' })).toBe('# Status: checkout\n\nNew text\n');
		expect(editedContent(STORED, { body: '# Fresh\n\nNew text' })).toBe('# Fresh\n\nNew text\n');
		expect(editedContent(STORED, { title: 'Renamed' })).toBe('# Renamed\n\n## Done\n- Reviewed the flow\n');
		expect(editedContent({ content: 'No heading here', title: null }, { title: 'Added' })).toBe('# Added\n\nNo heading here\n');
	});

	it('append adds a blank line and the text', () => {
		expect(appendedContent('# T\n\nOld\n\n', ' New line \n')).toBe('# T\n\nOld\n\nNew line\n');
		expect(appendedContent('', 'Only')).toBe('Only\n');
	});

	it('counts words without markdown syntax', () => {
		expect(countWords(STORED.content)).toBe(6);
	});
});

describe('chronolog note edit', () => {
	it('sends the new markdown and the updatedAt it read', async () => {
		const api = noteApi();
		const printed = [];
		await noteEdit({ api, print: (text) => printed.push(text), positionals: [NOTE_ID], flags: { title: 'Renamed' }, stdin: aTerminal });
		const patch = api.calls.find((call) => call.method === 'PATCH');
		expect(patch.body).toEqual({
			content: '# Renamed\n\n## Done\n- Reviewed the flow\n',
			title: 'Renamed',
			expectedUpdatedAt: STORED.updatedAt
		});
		expect(printed[0]).toBe(`Updated note ${NOTE_ID}: Renamed`);
	});

	it('moves to another contract without touching the text', async () => {
		const api = noteApi();
		await noteEdit({ api, print: () => {}, positionals: [NOTE_ID], flags: { contract: 'ACME/Retainer' }, stdin: aTerminal });
		expect(api.calls.find((call) => call.method === 'PATCH').body).toEqual({ contractId: OTHER_CONTRACT.id, expectedUpdatedAt: STORED.updatedAt });
	});

	it('turns a 409 into NoteChanged and does not retry', async () => {
		const api = noteApi({ [`PATCH /api/notes/${NOTE_ID}`]: new ApiError(409, 'conflict', 'conflict') });
		await expect(noteEdit({ api, print: () => {}, positionals: [NOTE_ID], flags: { title: 'X' }, stdin: aTerminal })).rejects.toBeInstanceOf(NoteChanged);
		expect(api.calls.filter((call) => call.method === 'PATCH')).toHaveLength(1);
	});

	it('refuses an empty change', async () => {
		await expect(noteEdit({ api: noteApi(), print: () => {}, positionals: [NOTE_ID], flags: {}, stdin: aTerminal })).rejects.toBeInstanceOf(UsageError);
	});
});

describe('chronolog note append', () => {
	it('appends after a blank line', async () => {
		const api = noteApi();
		await noteAppend({ api, print: () => {}, positionals: [NOTE_ID], flags: { file: writeTemp('## Next\n- Ship it\n') }, stdin: aTerminal });
		expect(api.calls.find((call) => call.method === 'PATCH').body).toEqual({
			content: '# Status: checkout\n\n## Done\n- Reviewed the flow\n\n## Next\n- Ship it\n',
			expectedUpdatedAt: STORED.updatedAt
		});
	});
});

describe('chronolog note delete and restore', () => {
	it('refuses without a terminal and without --yes, deleting nothing', async () => {
		const api = noteApi();
		const environment = tempEnvironment();
		const refusal = noteDelete({ api, print: () => {}, positionals: [NOTE_ID], flags: {}, environment, stdin: notATerminal });
		await expect(refusal).rejects.toThrow(/Note ACME.20261104.001 “Status: checkout” in ACME\/Website, 6 words\.\nNot deleted/);
		expect(api.calls.some((call) => call.method === 'DELETE')).toBe(false);
		expect(readTrash(NOTE_ID, environment)).toBeNull();
	});

	it('writes the trash file (mode 600) before deleting, and restore recreates the note', async () => {
		const environment = tempEnvironment();
		const api = noteApi({
			[`DELETE /api/notes/${NOTE_ID}`]: () => {
				expect(readTrash(NOTE_ID, environment)).not.toBeNull();
				return { success: true, id: NOTE_ID, title: STORED.title, contractId: CONTRACT.id };
			},
			'POST /api/notes': (body) => ({ note: { ...body, id: 'ACME.20261105.001' } })
		});
		const printedJson = [];
		await noteDelete({ api, print: (text, value) => printedJson.push(value), positionals: [NOTE_ID], flags: { yes: true }, environment, stdin: notATerminal });
		const { trashPath } = printedJson[0];
		expect(printedJson[0].deleted).toEqual({ id: NOTE_ID, title: STORED.title, contractId: CONTRACT.id });
		expect(statSync(trashPath).mode & 0o777).toBe(0o600);
		const fileText = readFileSync(trashPath, 'utf8');
		expect(fileText).toContain(`id: ${NOTE_ID}\ntitle: Status: checkout\ncontractId: ${CONTRACT.id}\ncontract: ACME/Website\nupdatedAt: ${STORED.updatedAt}`);
		expect(fileText.endsWith(STORED.content)).toBe(true);

		const restored = [];
		await noteRestore({ api, print: (text) => restored.push(text), positionals: [NOTE_ID], flags: {}, environment });
		expect(api.calls.find((call) => call.method === 'POST').body).toEqual({ contractId: CONTRACT.id, title: STORED.title, content: STORED.content });
		expect(restored[0]).toBe(`Restored ${NOTE_ID} as new note ACME.20261105.001 in ACME/Website: Status: checkout`);
		expect(existsSync(trashPath)).toBe(false);
	});

	it('removes the trash file again when the server refuses the delete', async () => {
		const environment = tempEnvironment();
		const api = noteApi({ [`DELETE /api/notes/${NOTE_ID}`]: new ApiError(500, 'boom', 'internal_error') });
		await expect(noteDelete({ api, print: () => {}, positionals: [NOTE_ID], flags: { yes: true }, environment })).rejects.toThrow('boom');
		expect(readTrash(NOTE_ID, environment)).toBeNull();
	});

	it('restore without a trash file is an unknown reference; a path-like id is refused', async () => {
		const environment = tempEnvironment();
		await expect(noteRestore({ api: fakeApi(), print: () => {}, positionals: [NOTE_ID], flags: {}, environment })).rejects.toBeInstanceOf(ReferenceError_);
		await expect(noteRestore({ api: fakeApi(), print: () => {}, positionals: ['../config'], flags: {}, environment })).rejects.toBeInstanceOf(UsageError);
	});
});

function writeTemp(text) {
	const path = join(mkdtempSync(join(tmpdir(), 'chronolog-034-body-')), 'body.md');
	writeFileSync(path, text);
	return path;
}

describe('chronolog note new --date', () => {
	const api = () =>
		fakeApi({
			'GET /api/contracts-by-client': { contracts: [CONTRACT] },
			'GET /api/me': { today: '2026-11-04' },
			'POST /api/notes': (body) => ({ note: { ...body, id: `ACME.${body.createdAt?.replace(/-/g, '') ?? '20261104'}.001` } })
		});

	it('sends the resolved day as createdAt', async () => {
		const client = api();
		await noteNew({ api: client, print: () => {}, positionals: ['ACME/Website', 'Kickoff'], flags: { date: 'yesterday' }, stdin: aTerminal });
		expect(client.calls.find((call) => call.method === 'POST').body).toEqual({ contractId: CONTRACT.id, title: 'Kickoff', content: '# Kickoff\n', createdAt: '2026-11-03' });
	});

	it('sends no createdAt without --date and refuses a word it cannot read', async () => {
		const client = api();
		await noteNew({ api: client, print: () => {}, positionals: ['ACME/Website', 'Kickoff'], flags: {}, stdin: aTerminal });
		expect(client.calls.find((call) => call.method === 'POST').body.createdAt).toBeUndefined();
		await expect(noteNew({ api: api(), print: () => {}, positionals: ['ACME/Website', 'Kickoff'], flags: { date: 'last week' }, stdin: aTerminal })).rejects.toBeInstanceOf(UsageError);
	});
});
