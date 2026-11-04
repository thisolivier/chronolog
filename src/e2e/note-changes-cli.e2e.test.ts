/**
 * Sprint 034-CL: the laptop secretary changes and deletes notes through the `chronolog` CLI
 * (a child process against the live server) without overwriting what the owner typed in the
 * browser: new → append → show → browser save → stale edit refused (exit 7) → fresh edit →
 * delete → restore (sprint 037-CL: the server trash, same ID). Also backdated `note new --date` (task 6).
 */
import './test-init';
import { describe, it, expect, beforeAll } from 'vitest';
import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BASE_URL, authGet, authPost, authPut } from './helpers';

const CLI_PATH = join(import.meta.dirname, '..', '..', 'cli', 'chronolog.mjs');
const CONFIG_DIRECTORY = mkdtempSync(join(tmpdir(), 'chronolog-cli-034-'));
const CONFIG_PATH = join(CONFIG_DIRECTORY, 'config.json');

let rawToken = '';
let contractId = '';
let contractReference = '';
let shortCode = '';

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

async function runJson(args: string[], stdinText = '') {
	const result = await runCli([...args, '--json'], stdinText);
	expect(result.exitCode, result.stderr).toBe(0);
	return JSON.parse(result.stdout);
}

beforeAll(async () => {
	const tokenResponse = await authPost('/api/tokens', { name: 'e2e 034 laptop' });
	expect(tokenResponse.status).toBe(201);
	rawToken = (await tokenResponse.json()).rawToken;
	const { contracts } = await (await authGet('/api/contracts-by-client')).json();
	contractId = contracts[0].id;
	contractReference = contracts[0].id;
	shortCode = contracts[0].clientShortCode;
});

describe('changing a note through the CLI', () => {
	let noteId = '';

	it('new → append → show reflects the appended text', async () => {
		const created = await runJson(['note', 'new', contractReference, 'Status: CLI edits'], '## Done\n- First pass\n');
		noteId = created.id;
		expect(created.content).toBe('# Status: CLI edits\n\n## Done\n- First pass\n');

		const appended = await runJson(['note', 'append', noteId], '## Next\n- Second pass\n');
		expect(appended.content).toBe('# Status: CLI edits\n\n## Done\n- First pass\n\n## Next\n- Second pass\n');

		const shown = await runJson(['note', 'show', noteId]);
		expect(shown).toMatchObject({ id: noteId, content: appended.content, contentJson: null, wordCount: 9 });
		expect(shown.updatedAt).toBe(appended.updatedAt);
	});

	it('a browser save in between makes the CLI edit exit 7; a fresh edit then wins and clears contentJson', async () => {
		const readBeforeBrowser = await runJson(['note', 'show', noteId]);

		const browserJson = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Owner typed this in the browser' }] }] });
		const browserSave = await authPut(`/api/notes/${noteId}`, {
			title: 'Owner typed this in the browser',
			content: 'Owner typed this in the browser',
			contentJson: browserJson,
			expectedUpdatedAt: readBeforeBrowser.updatedAt
		});
		expect(browserSave.status).toBe(200);

		const stale = await runCli(['note', 'edit', noteId, '--expected-updated-at', readBeforeBrowser.updatedAt, '--json'], 'Secretary rewrite\n');
		expect(stale.exitCode).toBe(7);
		expect(JSON.parse(stale.stderr)).toMatchObject({ error: 'note changed on the server since it was read; re-run', code: 'note_changed', status: 409 });
		const untouched = await (await authGet(`/api/notes/${noteId}`)).json();
		expect(untouched.note).toMatchObject({ content: 'Owner typed this in the browser', contentJson: browserJson });

		const fresh = await runJson(['note', 'edit', noteId, '--title', 'Status: rewritten'], 'Secretary rewrite\n');
		expect(fresh).toMatchObject({ title: 'Status: rewritten', content: '# Status: rewritten\n\nSecretary rewrite\n', contentJson: null, wordCount: 4 });
	});

	it('delete --yes moves it to the server trash (no local copy); restore brings back the same ID', async () => {
		const refused = await runCli(['note', 'delete', noteId]);
		expect(refused.exitCode).toBe(2);
		expect(refused.stderr).toContain('Status: rewritten');

		const deleted = await runJson(['note', 'delete', noteId, '--yes']);
		expect(deleted.deleted).toMatchObject({ id: noteId, title: 'Status: rewritten', contractId });
		expect(existsSync(join(CONFIG_DIRECTORY, 'trash'))).toBe(false);
		expect((await authGet(`/api/notes/${noteId}`)).status).toBe(404);

		const restored = await runJson(['note', 'restore', noteId]);
		expect(restored).toMatchObject({ id: noteId, contractId, title: 'Status: rewritten', content: '# Status: rewritten\n\nSecretary rewrite\n' });

		const { notes } = await (await authGet(`/api/notes?contractId=${contractId}`)).json();
		expect(notes.map((note: { id: string }) => note.id)).toContain(noteId);
	});
});

describe('backdating a note (task 6)', () => {
	it('note new --date yesterday carries yesterday in its ID and created date', async () => {
		const { today } = await runJson(['me']);
		const yesterdayDate = new Date(`${today}T00:00:00Z`);
		yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
		const yesterday = yesterdayDate.toISOString().slice(0, 10);

		const note = await runJson(['note', 'new', contractReference, 'Yesterday’s meeting', '--date', 'yesterday']);
		expect(note.id).toMatch(new RegExp(`^${shortCode}\\.${yesterday.replace(/-/g, '')}\\.\\d{3}$`));
		expect(Date.now() - new Date(note.createdAt).getTime()).toBeGreaterThan(0);
		expect(new Date(note.updatedAt).getTime()).toBeGreaterThan(new Date(note.createdAt).getTime());
	});

	it('a future date is 400 invalid_date', async () => {
		const response = await authPost('/api/notes', { contractId, title: 'Tomorrow', createdAt: '2999-01-01' });
		expect(response.status).toBe(400);
		expect((await response.json()).code).toBe('invalid_date');

		const cli = await runCli(['note', 'new', contractReference, 'Future', '--date', '2999-01-01', '--json']);
		expect(cli.exitCode).toBe(1);
		expect(JSON.parse(cli.stderr)).toMatchObject({ code: 'invalid_date', status: 400 });
	});
});
