import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { formatTodos, todos } from './todos.mjs';
import { noteAppend, noteEdit } from './note-changes.mjs';
import { noteShow } from './read.mjs';
import { countWords } from '../lib/note-body.mjs';

const CONTRACT = { id: '22222222-2222-4222-8222-222222222222', name: 'Website', clientShortCode: 'ACME', clientName: 'Acme Ltd' };
const NOTE_ID = 'ACME.20261104.001';
const TASK_MARKDOWN = '# Plan\n\n- [ ] call Jane\n- [x] send report\n  - [ ] nested follow-up\n';
const STORED = { id: NOTE_ID, contractId: CONTRACT.id, title: 'Plan', content: TASK_MARKDOWN, updatedAt: '2026-11-04T10:00:00.000Z' };

const TODOS_RESPONSE = {
	notes: [
		{ id: NOTE_ID, contractId: CONTRACT.id, title: 'Plan', updatedAt: STORED.updatedAt, items: [
			{ text: 'call Jane', checked: false, depth: 0, line: 3 },
			{ text: 'send report', checked: true, depth: 0, line: 4 },
			{ text: 'nested follow-up', checked: false, depth: 1, line: 5 }
		] },
		{ id: 'ACME.20261103.002', contractId: CONTRACT.id, title: 'Kickoff', updatedAt: STORED.updatedAt, items: [{ text: 'book room', checked: false, depth: 0, line: 2 }] }
	],
	openCount: 3,
	doneCount: 1
};

function fakeApi(responses) {
	const calls = [];
	const respond = (method) => async (path, body) => {
		calls.push({ method, path, body });
		const handler = responses[`${method} ${path.split('?')[0]}`];
		if (handler === undefined) throw new Error(`unexpected ${method} ${path}`);
		return typeof handler === 'function' ? handler(body, path) : handler;
	};
	return { calls, get: respond('GET'), patch: respond('PATCH') };
}

const writeTemp = (text) => {
	const path = join(mkdtempSync(join(tmpdir(), 'chronolog-todos-')), 'body.md');
	writeFileSync(path, text);
	return path;
};

describe('chronolog todos', () => {
	it('prints one line per item (id, title, item), grouped by note, nesting indented', () => {
		const openOnly = { ...TODOS_RESPONSE, notes: TODOS_RESPONSE.notes.map((note) => ({ ...note, items: note.items.filter((item) => !item.checked) })) };
		expect(formatTodos(openOnly, { includeDone: false, scopeLabel: 'ACME/Website' })).toBe(
			[
				'Todos for ACME/Website: 3 open in 2 notes',
				'',
				`${NOTE_ID}  Plan  call Jane`,
				`${NOTE_ID}  Plan    nested follow-up`,
				'',
				'ACME.20261103.002  Kickoff  book room'
			].join('\n')
		);
	});

	it('--all marks each item open or done; contract labels follow the title across contracts', () => {
		const text = formatTodos(TODOS_RESPONSE, { includeDone: true, scopeLabel: 'all contracts', contractLabels: new Map([[CONTRACT.id, 'ACME/Website']]) });
		expect(text).toContain('Todos for all contracts: 3 open, 1 done in 2 notes');
		expect(text).toContain(`${NOTE_ID}  Plan (ACME/Website)  [x] send report`);
		expect(text).toContain(`${NOTE_ID}  Plan (ACME/Website)    [ ] nested follow-up`);
	});

	it('says so when there is nothing open', () => {
		expect(formatTodos({ notes: [], openCount: 0, doneCount: 0 }, { includeDone: false, scopeLabel: 'all contracts' })).toBe('Todos for all contracts: 0 open in 0 notes\nNo open items.');
	});

	it('resolves the contract and asks the server route, with all=1 for --all', async () => {
		const api = fakeApi({ 'GET /api/contracts-by-client': { contracts: [CONTRACT] }, 'GET /api/notes/todos': TODOS_RESPONSE });
		const printed = [];
		await todos({ api, print: (text, value) => printed.push({ text, value }), positionals: ['ACME/Website'], flags: { all: true } });
		expect(api.calls.map((call) => call.path)).toEqual(['/api/contracts-by-client', `/api/notes/todos?contractId=${CONTRACT.id}&all=1`]);
		expect(printed[0].text).not.toContain('(ACME/Website)  ');
		expect(printed[0].value.notes[0].contract).toBe('ACME/Website');

		const allContracts = fakeApi({ 'GET /api/contracts-by-client': { contracts: [CONTRACT] }, 'GET /api/notes/todos': TODOS_RESPONSE });
		await todos({ api: allContracts, print: () => {}, positionals: [], flags: {} });
		expect(allContracts.calls[1].path).toBe('/api/notes/todos');
	});
});

describe('checkbox markdown through note show / edit / append', () => {
	const noteApi = () =>
		fakeApi({
			[`GET /api/notes/${NOTE_ID}`]: { note: STORED },
			[`GET /api/notes/${NOTE_ID}/time-entries`]: { timeEntries: [] },
			[`PATCH /api/notes/${NOTE_ID}`]: (body) => ({ note: { ...STORED, ...body } })
		});

	it('note show prints the markdown as-is', async () => {
		const printed = [];
		await noteShow({ api: noteApi(), print: (text) => printed.push(text), positionals: [NOTE_ID] });
		expect(printed[0]).toContain('- [ ] call Jane\n- [x] send report\n  - [ ] nested follow-up');
	});

	it('note edit and note append keep `- [ ]` / `- [x]` exactly', async () => {
		const editApi = noteApi();
		await noteEdit({ api: editApi, print: () => {}, positionals: [NOTE_ID], flags: { file: writeTemp('- [ ] new open\n- [x] new done\n') }, stdin: { isTTY: true } });
		expect(editApi.calls.find((call) => call.method === 'PATCH').body.content).toBe('# Plan\n\n- [ ] new open\n- [x] new done\n');

		const appendApi = noteApi();
		await noteAppend({ api: appendApi, print: () => {}, positionals: [NOTE_ID], flags: { file: writeTemp('- [ ] appended\n  - [x] child\n') }, stdin: { isTTY: true } });
		expect(appendApi.calls.find((call) => call.method === 'PATCH').body.content).toBe(`${TASK_MARKDOWN}\n- [ ] appended\n  - [x] child\n`);
	});

	it('the CLI word count skips the checkbox markers', () => {
		expect(countWords('- [ ] call Jane\n- [x] send report')).toBe(4);
	});
});
