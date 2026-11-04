/**
 * Sprint 040-CL: `GET /api/notes/todos` and `chronolog todos` against the live server. A note written
 * by the CLI (markdown only) and one saved by the browser (markdown + TipTap JSON) both report their
 * checkbox items; done items only with `all=1`; code blocks and trashed notes never count.
 */
import './test-init';
import { describe, it, expect, beforeAll } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BASE_URL, authGet, authPost, authPut, authDelete } from './helpers';

const CLI_PATH = join(import.meta.dirname, '..', '..', 'cli', 'chronolog.mjs');
const CONFIG_PATH = join(mkdtempSync(join(tmpdir(), 'chronolog-cli-040-')), 'config.json');

let rawToken = '';
let contractId = '';
let contractLabel = '';

function runCli(args: string[], stdinText = ''): Promise<{ exitCode: number; stdout: string; stderr: string }> {
	return new Promise((resolve) => {
		const child = execFile(
			process.execPath,
			[CLI_PATH, ...args],
			{ env: { ...process.env, CHRONOLOG_CONFIG: CONFIG_PATH, CHRONOLOG_BASE_URL: BASE_URL, CHRONOLOG_API_TOKEN: rawToken } },
			(error, stdout, stderr) => resolve({ exitCode: error ? Number(error.code ?? 1) : 0, stdout, stderr })
		);
		child.stdin?.end(stdinText);
	});
}

async function getJson(path: string) {
	const response = await authGet(path);
	expect(response.status, path).toBe(200);
	return response.json();
}

type TodoNote = { id: string; title: string; items: { text: string; checked: boolean; depth: number }[] };

beforeAll(async () => {
	const tokenResponse = await authPost('/api/tokens', { name: 'e2e 040 laptop' });
	expect(tokenResponse.status).toBe(201);
	rawToken = (await tokenResponse.json()).rawToken;
	const { contracts } = await getJson('/api/contracts-by-client');
	contractId = contracts[0].id;
	contractLabel = `${contracts[0].clientShortCode}/${contracts[0].name}`;
});

describe('todos across notes', () => {
	const suffix = Date.now().toString(36);
	let cliNoteId = '';
	let browserNoteId = '';
	let trashedNoteId = '';

	it('a CLI note keeps its `- [ ]` markdown as written (note show prints it as-is)', async () => {
		const body = `- [ ] CLI open ${suffix}\n- [x] CLI done ${suffix}\n  - [ ] CLI nested ${suffix}\n\n\`\`\`\n- [ ] in code ${suffix}\n\`\`\`\n`;
		const created = await runCli(['note', 'new', contractId, `Todo CLI ${suffix}`, '--json'], body);
		expect(created.exitCode, created.stderr).toBe(0);
		cliNoteId = JSON.parse(created.stdout).id;
		const shown = await runCli(['note', 'show', cliNoteId]);
		expect(shown.stdout).toContain(`- [ ] CLI open ${suffix}\n- [x] CLI done ${suffix}\n  - [ ] CLI nested ${suffix}`);

		const appended = await runCli(['note', 'append', cliNoteId], `- [ ] CLI appended ${suffix}\n`);
		expect(appended.exitCode, appended.stderr).toBe(0);
		const { note } = await getJson(`/api/notes/${cliNoteId}`);
		expect(note.content).toContain(`- [ ] CLI appended ${suffix}`);
		expect(note.content).toContain(`- [x] CLI done ${suffix}`);
	});

	it('a browser-saved note (markdown and JSON) and a trashed one', async () => {
		const createdResponse = await authPost('/api/notes', { contractId, content: `Browser ${suffix}\n` });
		expect(createdResponse.status).toBe(201);
		browserNoteId = (await createdResponse.json()).note.id;
		const contentJson = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: `Todo browser ${suffix}` }] }] });
		const saved = await authPut(`/api/notes/${browserNoteId}`, { title: `Todo browser ${suffix}`, content: `Todo browser ${suffix}\n\n* [ ] Browser open ${suffix}\n* [x] Browser done ${suffix}\n\n- plain bullet`, contentJson });
		expect(saved.status).toBe(200);

		const trashedResponse = await authPost('/api/notes', { contractId, content: `- [ ] Trashed open ${suffix}\n` });
		trashedNoteId = (await trashedResponse.json()).note.id;
		expect((await authDelete(`/api/notes/${trashedNoteId}`)).status).toBe(200);
	});

	it('GET /api/notes/todos lists open items only; all=1 adds done ones; code and trash never count', async () => {
		const open = await getJson(`/api/notes/todos?contractId=${contractId}`);
		const mine = (open.notes as TodoNote[]).filter((note) => [cliNoteId, browserNoteId, trashedNoteId].includes(note.id));
		expect(mine.map((note) => note.id).sort()).toEqual([cliNoteId, browserNoteId].sort());
		const cliNote = mine.find((note) => note.id === cliNoteId)!;
		expect(cliNote.title).toBe(`Todo CLI ${suffix}`);
		expect(cliNote.items).toEqual([
			{ text: `CLI open ${suffix}`, checked: false, depth: 0, line: 3 },
			{ text: `CLI nested ${suffix}`, checked: false, depth: 1, line: 5 },
			{ text: `CLI appended ${suffix}`, checked: false, depth: 0, line: expect.any(Number) }
		]);
		expect(mine.find((note) => note.id === browserNoteId)!.items.map((item) => item.text)).toEqual([`Browser open ${suffix}`]);

		const all = await getJson(`/api/notes/todos?contractId=${contractId}&all=1`);
		const browserAll = (all.notes as TodoNote[]).find((note) => note.id === browserNoteId)!;
		expect(browserAll.items.map((item) => [item.text, item.checked])).toEqual([
			[`Browser open ${suffix}`, false],
			[`Browser done ${suffix}`, true]
		]);
		expect(all.doneCount).toBeGreaterThanOrEqual(2);

		// without a contract: every contract; bad ids and no session are refused
		const everywhere = await getJson('/api/notes/todos');
		expect((everywhere.notes as TodoNote[]).some((note) => note.id === cliNoteId)).toBe(true);
		expect((await authGet('/api/notes/todos?contractId=nope')).status).toBe(400);
		expect((await fetch(`${BASE_URL}/api/notes/todos`)).status).toBe(401);
	});

	it('chronolog todos prints one line per item grouped by note; --all marks done; --json', async () => {
		const result = await runCli(['todos', contractId]);
		expect(result.exitCode, result.stderr).toBe(0);
		expect(result.stdout).toMatch(new RegExp(`^Todos for ${contractLabel.replace('/', '\\/')}: \\d+ open in \\d+ notes?`));
		expect(result.stdout).toContain(`${cliNoteId}  Todo CLI ${suffix}  CLI open ${suffix}\n${cliNoteId}  Todo CLI ${suffix}    CLI nested ${suffix}\n${cliNoteId}  Todo CLI ${suffix}  CLI appended ${suffix}`);
		expect(result.stdout).not.toContain(`CLI done ${suffix}`);
		expect(result.stdout).not.toContain(`in code ${suffix}`);
		expect(result.stdout).not.toContain(`Trashed open ${suffix}`);

		const all = await runCli(['todos', contractId, '--all']);
		expect(all.stdout).toContain(`${cliNoteId}  Todo CLI ${suffix}  [x] CLI done ${suffix}`);
		expect(all.stdout).toContain(`${browserNoteId}  Todo browser ${suffix}  [ ] Browser open ${suffix}`);

		const everywhere = await runCli(['todos']);
		expect(everywhere.stdout).toContain(`${cliNoteId}  Todo CLI ${suffix} (${contractLabel})  CLI open ${suffix}`);

		const asJson = JSON.parse((await runCli(['todos', contractId, '--json'])).stdout);
		const cliNote = asJson.notes.find((note: TodoNote) => note.id === cliNoteId);
		expect(cliNote.contract).toBe(contractLabel);
		expect(cliNote.items).toHaveLength(3);
	});
});
