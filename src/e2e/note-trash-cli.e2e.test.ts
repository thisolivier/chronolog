/**
 * Sprint 037-CL: the server-side trash through the `chronolog` CLI against the live server.
 * Create A over the CLI (word count > 0), B linking to A, an entry linked to A; delete A; B's link
 * renders A as deleted (titles with includeDeleted) and A is hidden everywhere; `note restore`
 * lists it; restore A: same ID, backlink from B and the time-entry link intact.
 */
import './test-init';
import { describe, it, expect, beforeAll } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BASE_URL, authGet, authPost } from './helpers';

const CLI_PATH = join(import.meta.dirname, '..', '..', 'cli', 'chronolog.mjs');
const CONFIG_PATH = join(mkdtempSync(join(tmpdir(), 'chronolog-cli-037-')), 'config.json');

let rawToken = '';
let contractId = '';

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

async function getJson(path: string) {
	const response = await authGet(path);
	expect(response.status, path).toBe(200);
	return response.json();
}

beforeAll(async () => {
	const tokenResponse = await authPost('/api/tokens', { name: 'e2e 037 laptop' });
	expect(tokenResponse.status).toBe(201);
	rawToken = (await tokenResponse.json()).rawToken;
	const { contracts } = await getJson('/api/contracts-by-client');
	contractId = contracts[0].id;
});

describe('note trash through the CLI', () => {
	let noteA = '';
	let noteB = '';
	let entryId = '';

	it('note new stores a word count from the markdown; B links to A; an entry links to A', async () => {
		const created = await runJson(['note', 'new', contractId, 'Trash target A'], 'Five words in the body\n');
		noteA = created.id;
		expect(created.wordCount).toBe(8);

		const source = await runJson(['note', 'new', contractId, 'Trash source B'], `Depends on [[${noteA}]]\n`);
		noteB = source.id;
		expect(source.wordCount).toBeGreaterThan(0);

		const logged = await runJson(['log', contractId, '30m', `Worked on [[${noteA}]]`, '--note', noteA]);
		entryId = logged.id ?? logged.entry?.id;
		expect(entryId).toBeTruthy();

		const { backlinks } = await getJson(`/api/notes/${noteA}/backlinks`);
		expect(backlinks.map((link: { sourceNoteId: string }) => link.sourceNoteId)).toEqual([noteB]);
		const { timeEntries } = await getJson(`/api/notes/${noteA}/time-entries`);
		expect(timeEntries.map((entry: { timeEntryId: string }) => entry.timeEntryId)).toContain(entryId);
	});

	it('note delete moves A to the trash: hidden from reads, B renders it as deleted', async () => {
		const deleted = await runCli(['note', 'delete', noteA, '--yes']);
		expect(deleted.exitCode, deleted.stderr).toBe(0);
		expect(deleted.stdout).toContain(`Deleted note ${noteA}`);
		expect(deleted.stdout).toContain(`Restore with \`chronolog note restore ${noteA}\` within 30 days.`);

		expect((await authGet(`/api/notes/${noteA}`)).status).toBe(404);
		const { notes } = await getJson(`/api/notes?contractId=${contractId}`);
		expect(notes.map((note: { id: string }) => note.id)).not.toContain(noteA);
		// B still matches (its body names A's ID); A itself does not
		const searched = (await getJson(`/api/notes/search?q=${noteA}`)).notes.map((note: { id: string }) => note.id);
		expect(searched).not.toContain(noteA);
		expect(searched).toContain(noteB);
		expect((await getJson(`/api/notes/titles?ids=${noteA}`)).titles).toEqual([]);

		// What B's wiki-link renderer asks: A is there, marked deleted
		const { titles } = await getJson(`/api/notes/titles?ids=${noteA},${noteB}&includeDeleted=1`);
		const byId = Object.fromEntries(titles.map((title: { id: string }) => [title.id, title]));
		expect(byId[noteA].deletedAt).toBeTruthy();
		expect(byId[noteB].deletedAt).toBeNull();

		const listed = await runCli(['note', 'restore']);
		expect(listed.stdout).toMatch(new RegExp(`${noteA.replace(/\./g, '\\.')}  deleted \\d{4}-\\d{2}-\\d{2}  purged \\d{4}-\\d{2}-\\d{2}  .+  Trash target A`));
		expect(listed.stdout).not.toContain(noteB);
	});

	it('note restore brings A back with its ID, the backlink from B and the time-entry link', async () => {
		const restored = await runJson(['note', 'restore', noteA]);
		expect(restored).toMatchObject({ id: noteA, title: 'Trash target A', contractId, wordCount: 8 });

		expect((await getJson(`/api/notes/${noteA}`)).note.id).toBe(noteA);
		const { backlinks } = await getJson(`/api/notes/${noteA}/backlinks`);
		expect(backlinks.map((link: { sourceNoteId: string }) => link.sourceNoteId)).toEqual([noteB]);
		const { timeEntries } = await getJson(`/api/notes/${noteA}/time-entries`);
		expect(timeEntries.map((entry: { timeEntryId: string }) => entry.timeEntryId)).toContain(entryId);
		const { titles } = await getJson(`/api/notes/titles?ids=${noteA}&includeDeleted=1`);
		expect(titles[0].deletedAt).toBeNull();

		const again = await runCli(['note', 'restore', noteA]);
		expect(again.exitCode).toBe(3);
		expect(again.stderr).toContain('is not in the trash');
	});
});
